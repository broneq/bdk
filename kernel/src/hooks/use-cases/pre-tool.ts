// `bdk hooks pre-tool` (`kernel-cli/hooks`, Pre-tool guards): the payload is
// parsed, kernel verbs are classified against the command index exactly as the
// kernel dispatches them, and the first guard that matches denies. The agent
// guards read the registry only for a subagent's `Agent`, `SendMessage` and a
// lead's Bash; an admitted message to a registered agent is recorded for its
// `agents wait`.
import { resolve as resolvePath } from "node:path";

import {
  dispatchPaths,
  messageEntries,
  needsAgentFacts,
  preToolDecision,
} from "../domain/guards.ts";
import type { AgentFacts, Classify, Deny } from "../domain/guards.ts";
import { preToolPayload } from "../domain/payload.ts";
import type { PreToolPayload } from "../domain/payload.ts";
import type { PreToolPass } from "../domain/report.ts";
import { refuse } from "../../shared/refusal/index.ts";
import type { Refusal } from "../../shared/refusal/index.ts";
import { resolve } from "../../shared/registry/index.ts";
import { readDocument } from "../../shared/store/index.ts";
import type { CommandIndex } from "../../shared/registry/index.ts";
import { agentFacts, bdkProject, onRegistry, registryExists } from "./agents.ts";
import type { HookPlace } from "./agents.ts";
import type { HooksDeps } from "./input.ts";

export async function preTool(
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
  const outcome = decidePreTool(deps.commands, raw, facts, model);
  if (!("missing" in payload) && !("refused" in outcome) && payload.tool === "SendMessage") {
    await recordMessage(deps, place, payload);
  }
  return outcome;
}

/** The decision alone, for a payload and the agent facts already gathered. */
export function decidePreTool(
  commands: CommandIndex,
  raw: string,
  facts?: AgentFacts,
  packageModel?: string,
): PreToolPass | Refusal {
  const payload = preToolPayload(raw);
  if ("missing" in payload) {
    return refuse("input/invalid-argument", `the PreToolUse payload lacks ${payload.missing}`, [
      "run bdk hooks pre-tool only from the PreToolUse hook of hooks/hooks.json",
    ]);
  }
  const deny = preToolDecision(payload, classifier(commands), facts, packageModel);
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
  "guard/lead-scope": "return blocked with the cause",
  "guard/reader-write": "report through bdk log add or bdk log ingest",
  "guard/dispatch-prompt": "pass the dispatch package path and at most one sentence",
  "guard/agent-spawn": "do the work yourself or return blocked with the cause",
  "guard/agent-message":
    "write the substance with bdk log add, then send its id to a running agent",
  "guard/escalation-model": "set model in the Agent call to the package's model",
};
