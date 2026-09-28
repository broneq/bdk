// `bdk hooks prompt-expansion` (`kernel-cli/hooks`, Prompt-expansion outcomes;
// T24 design D-12): the only writer of `source: user` stage transitions. A
// typed stage command passes its gate when the gate is ready; `/bdk:run`
// passes the ready `auto` gates by policy. Anything else writes nothing.
import { join } from "node:path";

import { readGraph, stageGates, stageOfCommand } from "../../graph/index.ts";
import type { ChangeGraph, GateView, StageGate } from "../../graph/index.ts";
import { appendEntry, withChangeIndex } from "../../log/index.ts";
import { isRefusal, refuse } from "../../shared/refusal/index.ts";
import type { Refusal } from "../../shared/refusal/index.ts";
import type { ActiveChange } from "../../shared/registry/index.ts";
import { readDocument } from "../../shared/store/index.ts";
import type { IndexDb } from "../../shared/store/index.ts";
import { expansionPayload } from "../domain/payload.ts";
import type { ExpansionPayload } from "../domain/payload.ts";
import type { GateSummary, PolicyPass, PromptExpansionReport } from "../domain/report.ts";
import type { HooksDeps } from "./input.ts";

export interface PromptExpansionInput {
  readonly globalDir: string;
  /** Resolves the Change bound to the branch; called only for a stage command. */
  readonly resolveChange: () => ActiveChange | Refusal;
}

const NAMESPACE = "bdk:";
const SKIP_VERIFY = "--skip-verify";

export async function promptExpansion(
  deps: HooksDeps,
  input: PromptExpansionInput,
  raw: string,
): Promise<PromptExpansionReport | Refusal> {
  const payload = expansionPayload(raw);
  if (payload === undefined) return unmarked("a JSON object body");
  if (payload.commandName === undefined) return unmarked("command_name");
  if (!payload.commandName.startsWith(NAMESPACE)) return quiet(payload.commandName);
  const command = payload.commandName.slice(NAMESPACE.length);
  const stage = stageOfCommand(deps, `/${payload.commandName}`);
  if (command !== "run" && stage === undefined) return quiet(command);

  const missing = missingMarker(payload);
  if (missing !== undefined) return unmarked(missing);
  const session = payload.session ?? "";
  const change = input.resolveChange();
  if (isRefusal(change)) return change;

  return withChangeIndex(deps, change, async (index) => {
    const read = await readGraph(deps, change, index, input.globalDir);
    if (isRefusal(read)) return read;
    const typed = {
      command,
      session,
      prompt: payload.prompt ?? `/${payload.commandName} ${payload.args ?? ""}`.trim(),
    };
    const write = writer(deps, change, index, typed);
    if (stage === undefined) return runGates(read, typed, write);
    const gate = stageGates(read).find((candidate) => candidate.opens === stage);
    if (gate?.status === undefined) {
      const skipVerify = command === "execute" && tokens(payload.args).includes(SKIP_VERIFY);
      return plainTransition(deps, change, read, typed, stage, skipVerify, write);
    }
    return typedGate(read, typed, stage, gate, write);
  });
}

interface Typed {
  readonly command: string;
  readonly session: string;
  /** What the user typed, stored as the transition's `command`. */
  readonly prompt: string;
}

interface Draft {
  readonly summary: string;
  readonly refs: readonly string[];
  readonly to: string;
  readonly gate?: string;
  readonly skipVerify?: boolean;
  readonly source?: "user" | "policy";
}

type Write = (draft: Draft) => Promise<string | Refusal>;

function writer(deps: HooksDeps, change: ActiveChange, index: IndexDb, typed: Typed): Write {
  return async (draft) => {
    const written = await appendEntry(
      deps,
      change,
      index,
      {
        type: "transition",
        status: "accepted",
        body: "",
        session: typed.session,
        command: typed.prompt,
        ...draft,
      },
      { dedupe: false },
    );
    return isRefusal(written) ? written : written.entry.id;
  };
}

async function typedGate(
  read: ChangeGraph,
  typed: Typed,
  stage: string,
  gate: StageGate,
  write: Write,
): Promise<PromptExpansionReport | Refusal> {
  const { status, view, node } = gate;
  const base = { decision: "pass", command: typed.command, stage, gate: node.id } as const;
  if (status === undefined || view === undefined) throw new Error(`${node.id} has no status`);
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
      `${node.id} is not ready for /${NAMESPACE}${typed.command}: ${missing.length > 0 ? missing.join(", ") : status.why}`,
      ["bdk next", `bdk explain ${node.id}`],
    );
  }
  const entry = await write({
    summary: `/${NAMESPACE}${typed.command} typed: ${node.id} passed`,
    refs: [node.id, ...node.requires],
    to: stage,
    gate: node.id,
    source: "user",
  });
  if (typeof entry !== "string") return entry;
  return {
    ...base,
    entry,
    wrote: "transition:user",
    skipVerify: false,
    status: { ...summary(view), ready: true, done: true, passedBy: "user" },
  };
}

async function plainTransition(
  deps: HooksDeps,
  change: ActiveChange,
  read: ChangeGraph,
  typed: Typed,
  stage: string,
  skipVerify: boolean,
  write: Write,
): Promise<PromptExpansionReport | Refusal> {
  const base = { decision: "pass", command: typed.command, stage, skipVerify } as const;
  const latest = read.entries
    .filter((entry) => entry.type === "transition" && entry.to === stage)
    .at(-1);
  if (latest !== undefined && recordedSkipVerify(deps, change, latest.path) === skipVerify) {
    return { ...base, wrote: "none" };
  }
  const entry = await write({
    summary: `/${NAMESPACE}${typed.command} typed${skipVerify ? ` ${SKIP_VERIFY}` : ""}`,
    refs: [stage],
    to: stage,
    ...(skipVerify ? { skipVerify } : {}),
  });
  if (typeof entry !== "string") return entry;
  return { ...base, entry, wrote: "transition:stage" };
}

async function runGates(
  read: ChangeGraph,
  typed: Typed,
  write: Write,
): Promise<PromptExpansionReport | Refusal> {
  const passed: PolicyPass[] = [];
  const waiting: GateSummary[] = [];
  for (const { node, opens, policy, status, view } of stageGates(read)) {
    if (status === undefined || view === undefined || status.done || !status.ready) continue;
    if (policy !== "auto") {
      waiting.push(summary(view));
      continue;
    }
    const entry = await write({
      summary: `/${NAMESPACE}${typed.command}: ${node.id} passed by policy`,
      refs: [node.id, ...node.requires],
      to: opens,
      gate: node.id,
      source: "policy",
    });
    if (typeof entry !== "string") return entry;
    passed.push({ gate: node.id, stage: opens, entry });
  }
  return {
    decision: "pass",
    command: typed.command,
    wrote: passed.length > 0 ? "transition:policy" : "none",
    passed,
    waiting,
  };
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

function tokens(args: string | undefined): string[] {
  return (args ?? "").split(/\s+/).filter((token) => token !== "");
}

/** The first field of the user-typed marker (HOST-FACTS `upe-fields`) the payload lacks. */
function missingMarker(payload: ExpansionPayload): string | undefined {
  if (payload.event !== "UserPromptExpansion") return "hook_event_name UserPromptExpansion";
  if (payload.expansionType !== "slash_command") return "expansion_type slash_command";
  if (payload.session === undefined) return "session_id";
  return undefined;
}

function unmarked(field: string): Refusal {
  return refuse(
    "input/invalid-argument",
    `the UserPromptExpansion payload has no ${field}; no transition was written`,
    ["type the stage command yourself", "bdk doctor"],
  );
}

function quiet(command: string): PromptExpansionReport {
  return { decision: "pass", command, wrote: "none" };
}
