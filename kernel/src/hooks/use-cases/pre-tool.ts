// `bdk hooks pre-tool` (`kernel-cli/hooks`, Pre-tool guards): the payload is
// parsed, kernel verbs are classified against the command index exactly as the
// kernel dispatches them, and the first guard that matches denies.
import { preToolDecision } from "../domain/guards.ts";
import type { Classify, Deny } from "../domain/guards.ts";
import { preToolPayload } from "../domain/payload.ts";
import type { PreToolPass } from "../domain/report.ts";
import { refuse } from "../../shared/refusal/index.ts";
import type { Refusal } from "../../shared/refusal/index.ts";
import { resolve } from "../../shared/registry/index.ts";
import type { CommandIndex } from "../../shared/registry/index.ts";

export function preTool(commands: CommandIndex, raw: string): PreToolPass | Refusal {
  const payload = preToolPayload(raw);
  if ("missing" in payload) {
    return refuse("input/invalid-argument", `the PreToolUse payload lacks ${payload.missing}`, [
      "run bdk hooks pre-tool only from the PreToolUse hook of hooks/hooks.json",
    ]);
  }
  const deny = preToolDecision(payload, classifier(commands));
  if (deny !== undefined) return denial(deny);
  return { decision: "pass", tool: payload.tool, subagent: payload.agentId !== undefined };
}

function classifier(commands: CommandIndex): Classify {
  return (argv) => {
    const record = resolve(commands, argv)?.record;
    return record === undefined
      ? undefined
      : { command: `bdk ${record.argv.join(" ")}`, availability: record.availability };
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
  "guard/reader-write": "report through bdk log add or bdk log ingest",
  "guard/dispatch-prompt": "pass the dispatch package path and at most one sentence",
};
