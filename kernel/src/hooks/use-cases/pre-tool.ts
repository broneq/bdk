// `bdk hooks pre-tool` (`kernel-cli/hooks`, Pre-tool guards): the payload is
// parsed, kernel verbs are classified against the command index exactly as the
// kernel dispatches them, and the first guard that matches denies. The agent
// guards read the registry only for a subagent's `Agent` and `SendMessage`;
// an admitted message to a registered agent is recorded for its
// `agents wait`. A `Skill` call to a stage skill reads the session's run
// marker and, admitted, enters the stage as a typed command would, with the
// run's policy at the gate (T41 design D3).
import { resolve as resolvePath } from "node:path";

import { readGraph, stageOfCommand } from "../../graph/index.ts";
import { withChangeIndex } from "../../log/index.ts";
import {
  dispatchPaths,
  EDIT_TOOLS,
  messageEntries,
  needsAgentFacts,
  preToolDecision,
  stageSkillDecision,
  stageSkillOf,
} from "../domain/guards.ts";
import type { AgentFacts, Classify, Deny } from "../domain/guards.ts";
import { preToolPayload } from "../domain/payload.ts";
import type { PreToolPayload } from "../domain/payload.ts";
import type { PreToolPass } from "../domain/report.ts";
import { isRefusal, refuse } from "../../shared/refusal/index.ts";
import type { Refusal } from "../../shared/refusal/index.ts";
import { resolve } from "../../shared/registry/index.ts";
import {
  readAttempts,
  readDocument,
  readRunMarker,
  reviewRoundPath,
  resolveActiveChange,
  writeRunMarker,
} from "../../shared/store/index.ts";
import type { CommandIndex } from "../../shared/registry/index.ts";
import { agentFacts, bdkProject, onRegistry, registryExists } from "./agents.ts";
import type { HookPlace } from "./agents.ts";
import type { HooksDeps } from "./input.ts";
import { enterStage, NAMESPACE, writer } from "./stage-entry.ts";

/** `noteAgent` hears the blocked agent, `main` without `agent_id`, for the run journal's guard line. */
export async function preTool(
  deps: HooksDeps,
  place: HookPlace,
  raw: string,
  noteAgent: (agent: string) => void = () => undefined,
): Promise<PreToolPass | Refusal> {
  const outcome = await decide(deps, place, raw);
  if (isRefusal(outcome)) {
    const payload = preToolPayload(raw);
    noteAgent(("missing" in payload ? undefined : payload.agentId) ?? "main");
  }
  return outcome;
}

async function decide(
  deps: HooksDeps,
  place: HookPlace,
  raw: string,
): Promise<PreToolPass | Refusal> {
  const payload = preToolPayload(raw);
  const facts =
    !("missing" in payload) && needsAgentFacts(payload) && payload.agentId !== undefined
      ? await agentFacts(deps, place, payload.agentId)
      : undefined;
  const model = "missing" in payload ? undefined : packageModel(deps, payload);
  const round = "missing" in payload ? undefined : reviewRound(deps, place, payload);
  const outcome = decidePreTool(deps.commands, raw, facts, model, round);
  if ("missing" in payload || "refused" in outcome) return outcome;
  if (payload.tool === "SendMessage") await recordMessage(deps, place, payload);
  const skill = stageSkillOf(payload);
  if (skill === undefined) return outcome;
  const entered = await enterRunStage(deps, place, payload, skill);
  return entered ?? outcome;
}

/**
 * The stage-skill guard and, for an admitted call, the stage entry of
 * `prompt-expansion` with the run's policy; undefined when the call passes.
 */
async function enterRunStage(
  deps: HooksDeps,
  place: HookPlace,
  payload: PreToolPayload,
  skill: string,
): Promise<Refusal | undefined> {
  const projectRoot = bdkProject(deps, place);
  const marker =
    projectRoot === undefined || payload.session === undefined
      ? undefined
      : readRunMarker(deps.store, projectRoot, payload.session);
  const deny = stageSkillDecision(
    skill,
    payload,
    marker === undefined ? undefined : { changeStarted: marker["change-started"] },
  );
  if (deny !== undefined) return denial(deny);
  if (marker === undefined || projectRoot === undefined) {
    throw new Error(`the stage-skill guard admitted ${skill} without a run marker`);
  }
  if (skill === `${NAMESPACE}change`) {
    writeRunMarker(deps.store, projectRoot, { ...marker, "change-started": true });
    return undefined;
  }
  const stage = stageOfCommand(deps, `/${skill}`);
  if (stage === undefined || place.workTree === undefined) return undefined;
  const change = resolveActiveChange(deps.store, deps.git, {
    cwd: place.cwd,
    workTree: place.workTree,
  });
  if (isRefusal(change)) return change;
  const call = {
    command: skill.slice(NAMESPACE.length),
    session: marker.session,
    prompt: marker.prompt,
  };
  return withChangeIndex(deps, change, async (index) => {
    const read = await readGraph(deps, change, index, place.globalDir);
    if (isRefusal(read)) return read;
    const write = writer(deps, change, index, call);
    const entrant = { by: "run", auto: marker.auto } as const;
    const entered = await enterStage(deps, change, read, call, stage, false, entrant, write);
    return isRefusal(entered) ? entered : undefined;
  });
}

/** The decision alone, for a payload and the agent facts already gathered. */
export function decidePreTool(
  commands: CommandIndex,
  raw: string,
  facts?: AgentFacts,
  packageModel?: string,
  reviewRound?: string,
): PreToolPass | Refusal {
  const payload = preToolPayload(raw);
  if ("missing" in payload) {
    return refuse("input/invalid-argument", `the PreToolUse payload lacks ${payload.missing}`, [
      "run bdk hooks pre-tool only from the PreToolUse hook of hooks/hooks.json",
    ]);
  }
  const deny = preToolDecision(payload, classifier(commands), facts, packageModel, reviewRound);
  if (deny !== undefined) return denial(deny);
  return { decision: "pass", tool: payload.tool, subagent: payload.agentId !== undefined };
}

/**
 * The `model` of the one dispatch package an `Agent` prompt names. A package
 * that is missing or does not parse has none: `dispatch show` refuses it in the
 * agent, and the guard does not block on what it cannot read.
 */
function packageModel(deps: HooksDeps, payload: PreToolPayload): string | undefined {
  if (payload.tool !== "Agent") return undefined;
  const prompt = typeof payload.input.prompt === "string" ? payload.input.prompt : "";
  const paths = dispatchPaths(prompt);
  if (paths.length !== 1) return undefined;
  const path = resolvePath(payload.cwd ?? "/", paths[0] ?? "");
  try {
    const document = readDocument(deps.store, path);
    const model = document !== undefined && "data" in document ? document.data.model : undefined;
    return typeof model === "string" ? model : undefined;
  } catch {
    return undefined;
  }
}

/**
 * The ticket of the active Change's open review round, for a main-thread file
 * edit; the marker spares the attempt records on every other edit.
 */
function reviewRound(
  deps: HooksDeps,
  place: HookPlace,
  payload: PreToolPayload,
): string | undefined {
  if (payload.agentId !== undefined || !EDIT_TOOLS.has(payload.tool)) return undefined;
  const projectRoot = bdkProject(deps, place);
  if (projectRoot === undefined || place.workTree === undefined) return undefined;
  if (!deps.store.exists(reviewRoundPath(projectRoot))) return undefined;
  const change = resolveActiveChange(deps.store, deps.git, {
    cwd: place.cwd,
    workTree: place.workTree,
  });
  if (isRefusal(change)) return undefined;
  return readAttempts(deps.store, change.dir).find(
    (record) => record.data.loop === "review-fix" && record.data["closed-at"] === undefined,
  )?.data.ticket;
}

/** A passed message to an agent the registry holds, naming a ledger id, waits for its `agents wait`. */
async function recordMessage(
  deps: HooksDeps,
  place: HookPlace,
  payload: PreToolPayload,
): Promise<void> {
  const to = typeof payload.input.to === "string" ? payload.input.to : undefined;
  const message = typeof payload.input.message === "string" ? payload.input.message : "";
  const [entry] = messageEntries(message);
  const projectRoot = bdkProject(deps, place);
  if (to === undefined || entry === undefined || projectRoot === undefined) return;
  if (!registryExists(deps, projectRoot)) return;
  await onRegistry(deps, projectRoot, (registry) => {
    if (registry.get(to) === undefined) return;
    registry.addMessage({
      from: payload.agentId ?? "main",
      to,
      entry,
      at: deps.clock.now(),
    });
  });
}

function classifier(commands: CommandIndex): Classify {
  return (argv) => {
    const resolved = resolve(commands, argv);
    if (resolved === undefined) return undefined;
    const { record, rest } = resolved;
    const valued = new Set(
      record.flags.filter((flag) => flag.value !== undefined).map((flag) => flag.name),
    );
    const positionals: string[] = [];
    for (let at = 0; at < rest.length; at += 1) {
      const word = rest[at] ?? "";
      if (word.startsWith("-")) {
        if (valued.has(word)) at += 1;
        continue;
      }
      positionals.push(word);
    }
    return {
      command: `bdk ${record.argv.join(" ")}`,
      availability: record.availability,
      positionals,
    };
  };
}

function denial(deny: Deny): Refusal {
  return refuse(deny.rule, deny.reason, [INSTEAD[deny.rule]]);
}

const INSTEAD: Readonly<Record<Deny["rule"], string>> = {
  "guard/spec-dir-write": "write the change into the Change's spec-delta/",
  "guard/hooks-from-bash": "let the user type the stage command",
  "guard/nested-stage-command": "ask the user to type the stage command",
  "guard/subagent-git": "return blocked with the cause",
  "guard/subagent-kernel-command": "return blocked with the cause",
  "guard/judge-scope": "return blocked with the cause",
  "guard/worktree-scope": "edit the same path under your work root",
  "guard/reader-write": "report through bdk log add or bdk log ingest",
  "guard/draft-only": "write the report to its draft path under .bdk/.machine/drafts/",
  "guard/dispatch-prompt": "pass the dispatch package path and at most one sentence",
  "guard/agent-spawn": "do the work yourself or return blocked with the cause",
  "guard/agent-message":
    "write the substance with bdk log add, then send its id to a running agent",
  "guard/escalation-model": "set model in the Agent call to the package's model",
  "guard/stage-skill": "ask the user to type the stage command",
};
