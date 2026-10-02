// Entering a pipeline stage (`kernel-cli/hooks`, Prompt-expansion outcomes;
// Pre-tool guards, Stage skill): what a typed stage command writes, shared by
// `hooks prompt-expansion` and the stage skill a run starts through `Skill`
// (T41 design D3). A typed command passes a ready gate with `source: user`;
// a run passes it with `source: policy` only when it resolves to `auto` or
// the run has `--auto`, and is denied with `guard/gate-manual` otherwise.
import { join } from "node:path";

import { stageGates } from "../../graph/index.ts";
import type { ChangeGraph, GateView, StageGate } from "../../graph/index.ts";
import { appendEntry } from "../../log/index.ts";
import { isRefusal, refuse } from "../../shared/refusal/index.ts";
import type { Refusal } from "../../shared/refusal/index.ts";
import type { ActiveChange } from "../../shared/registry/index.ts";
import { readDocument } from "../../shared/store/index.ts";
import type { IndexDb } from "../../shared/store/index.ts";
import type { GateSummary, PolicyPass, PromptExpansionReport } from "../domain/report.ts";
import type { HooksDeps } from "./input.ts";

export const NAMESPACE = "bdk:";
export const SKIP_VERIFY = "--skip-verify";

/** Who enters the stage: the user typing its command, or a run starting its skill. */
export type Entrant = { readonly by: "user" } | { readonly by: "run"; readonly auto: boolean };

export interface StageCall {
  /** The bare skill name (`plan`). */
  readonly command: string;
  readonly session: string;
  /** Stored as the transition's `command`: what the user typed, or the run's typed line. */
  readonly prompt: string;
}

interface Draft {
  readonly summary: string;
  readonly refs: readonly string[];
  readonly to: string;
  readonly gate?: string;
  readonly skipVerify?: boolean;
  readonly source?: "user" | "policy";
  /** Set when only the run's `--auto` lets the gate pass (`kernel-pipeline`, Gate). */
  readonly auto?: boolean;
}

export type Write = (draft: Draft) => Promise<string | Refusal>;

export function writer(
  deps: HooksDeps,
  change: ActiveChange,
  index: IndexDb,
  call: StageCall,
): Write {
  return async (draft) => {
    const written = await appendEntry(
      deps,
      change,
      index,
      {
        type: "transition",
        status: "accepted",
        body: "",
        session: call.session,
        command: call.prompt,
        ...draft,
      },
      { dedupe: false },
    );
    return isRefusal(written) ? written : written.entry.id;
  };
}

/** The outcome of entering `stage`, read from the graph once. */
export function enterStage(
  deps: HooksDeps,
  change: ActiveChange,
  read: ChangeGraph,
  call: StageCall,
  stage: string,
  skipVerify: boolean,
  entrant: Entrant,
  write: Write,
): Promise<PromptExpansionReport | Refusal> {
  const gate = stageGates(read).find((candidate) => candidate.opens === stage);
  if (gate?.status === undefined) {
    return plainTransition(deps, change, read, call, stage, skipVerify, entrant, write);
  }
  return gateOutcome(read, call, stage, gate, entrant, write);
}

async function gateOutcome(
  read: ChangeGraph,
  call: StageCall,
  stage: string,
  gate: StageGate,
  entrant: Entrant,
  write: Write,
): Promise<PromptExpansionReport | Refusal> {
  const { status, view, node, policy } = gate;
  const base = { decision: "pass", command: call.command, stage, gate: node.id } as const;
  if (status === undefined || view === undefined) throw new Error(`${node.id} has no status`);
  const typed = `/${NAMESPACE}${call.command}`;
  if (status.done) {
    const passedAt = status.passedIn?.at;
    return {
      ...base,
      wrote: "none",
      skipVerify: false,
      status: summary(view),
      ...(passedAt === undefined ? {} : { passedAt }),
    };
  }
  if (!status.ready) {
    const missing = node.requires
      .map((id) => read.graph.find(id))
      .filter((required) => required !== undefined && required.state !== "done")
      .map((required) => `${required?.id ?? ""} is ${required?.state ?? ""}`);
    return refuse(
      "policy/gate-not-ready",
      `${node.id} is not ready for ${typed}: ${missing.length > 0 ? missing.join(", ") : status.why}`,
      ["bdk next", `bdk explain ${node.id}`],
    );
  }
  if (entrant.by === "run" && policy !== "auto" && !entrant.auto) {
    return refuse(
      "guard/gate-manual",
      `${node.id} is manual and this run has no --auto; stop the run and ask the user to type ${typed} (BDK T41, R-9)`,
      [`stop the run and ask the user to type ${typed}`],
    );
  }
  const source = entrant.by === "user" ? "user" : "policy";
  const entry = await write({
    summary:
      source === "user"
        ? `${typed} typed: ${node.id} passed`
        : `${typed} started by a run: ${node.id} passed by policy`,
    refs: [node.id, ...node.requires],
    to: stage,
    gate: node.id,
    source,
    ...(source === "policy" && policy !== "auto" ? { auto: true } : {}),
  });
  if (typeof entry !== "string") return entry;
  return {
    ...base,
    entry,
    wrote: source === "user" ? "transition:user" : "transition:policy",
    skipVerify: false,
    status: { ...summary(view), ready: true, done: true, passedBy: source },
  };
}

async function plainTransition(
  deps: HooksDeps,
  change: ActiveChange,
  read: ChangeGraph,
  call: StageCall,
  stage: string,
  skipVerify: boolean,
  entrant: Entrant,
  write: Write,
): Promise<PromptExpansionReport | Refusal> {
  const base = { decision: "pass", command: call.command, stage, skipVerify } as const;
  const latest = read.entries
    .filter((entry) => entry.type === "transition" && entry.to === stage)
    .at(-1);
  if (latest !== undefined && recordedSkipVerify(deps, change, latest.path) === skipVerify) {
    return { ...base, wrote: "none" };
  }
  const how = entrant.by === "user" ? "typed" : "started by a run";
  const entry = await write({
    summary: `/${NAMESPACE}${call.command} ${how}${skipVerify ? ` ${SKIP_VERIFY}` : ""}`,
    refs: [stage],
    to: stage,
    ...(skipVerify ? { skipVerify } : {}),
  });
  if (typeof entry !== "string") return entry;
  return { ...base, entry, wrote: "transition:stage" };
}

/** `/bdk:run` typed: every ready gate that resolves to `auto`, or every ready gate with `--auto`. */
export async function runGates(
  read: ChangeGraph,
  call: StageCall,
  auto: boolean,
  write: Write,
): Promise<{ passed: PolicyPass[]; waiting: GateSummary[] } | Refusal> {
  const passed: PolicyPass[] = [];
  const waiting: GateSummary[] = [];
  for (const { node, opens, policy, status, view } of stageGates(read)) {
    if (status === undefined || view === undefined || status.done || !status.ready) continue;
    if (policy !== "auto" && !auto) {
      waiting.push(summary(view));
      continue;
    }
    const entry = await write({
      summary: `/${NAMESPACE}${call.command}: ${node.id} passed by policy`,
      refs: [node.id, ...node.requires],
      to: opens,
      gate: node.id,
      source: "policy",
      ...(policy === "auto" ? {} : { auto: true }),
    });
    if (typeof entry !== "string") return entry;
    passed.push({ gate: node.id, stage: opens, entry });
  }
  return { passed, waiting };
}

/** The `skip-verify` of a committed transition; false when the field is absent. */
function recordedSkipVerify(deps: HooksDeps, change: ActiveChange, path: string): boolean {
  const document = readDocument(deps.store, join(change.projectRoot, path));
  return document !== undefined && "data" in document && document.data["skip-verify"] === true;
}

function summary(view: GateView): GateSummary {
  return {
    gate: view.gate,
    ready: view.ready,
    done: view.done,
    ...(view.passedBy === undefined ? {} : { passedBy: view.passedBy }),
    ...(view.command === undefined ? {} : { command: view.command }),
    pending: view.pending.map(({ id, type, summary: text }) => ({ id, type, summary: text })),
  };
}
