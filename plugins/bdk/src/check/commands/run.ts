// `bdk check run <run-dir> <id> [--at <point>] [--changed <ref>] [--scope <path>]... [--kind <kind>]... [--round <n>]`
// (spec `bdk-cli/check`, "Run the checks").

import type { Command, Input } from "../../shared/cli/index.ts";
import { renderRun } from "../render/run.ts";
import { runChecks } from "../use-cases/run.ts";
import type { CheckDeps } from "../use-cases/run.ts";

function list(value: Input["flags"][string]): readonly string[] | undefined {
  if (typeof value === "string") return [value];
  return Array.isArray(value) ? (value as readonly string[]) : undefined;
}

export function runCommand(deps: CheckDeps): Command {
  return {
    verb: "run",
    summary: "Run the configured test, lint and build commands and write checks/<id>.json",
    arguments: [
      {
        name: "run-dir",
        description: "The Change's run directory, such as .bdk/runs/<change>; must exist",
        required: true,
      },
      {
        name: "id",
        description: "Kebab-case name of the result, such as a part id or round-2",
        required: true,
      },
    ],
    flags: {
      at: {
        type: "string",
        description:
          "Check point: part, wave or review; runs only the items whose when holds it, and items without when",
      },
      changed: {
        type: "string",
        description:
          "A git revision; adds the files changed against it (and untracked files) to the run's files",
      },
      scope: {
        type: "string",
        multiple: true,
        description:
          "A file to check, relative to the project root; a {files} command gets the files its paths match",
      },
      kind: {
        type: "string",
        multiple: true,
        description: "Only this kind: test, lint or build; all three when absent",
      },
      round: {
        type: "string",
        description: "Append red checks as findings to review/round-<n>/findings.jsonl",
      },
    },
    exits: [{ code: 1, when: "a check is red (failed or timed out); the result is printed" }],
    async run({ args, flags }) {
      const runDir = String(args["run-dir"]);
      const id = String(args.id);
      const { result, file } = await runChecks(deps, {
        runDir,
        id,
        scope: list(flags.scope),
        at: typeof flags.at === "string" ? flags.at : undefined,
        changed: typeof flags.changed === "string" ? flags.changed : undefined,
        kinds: list(flags.kind),
        round: typeof flags.round === "string" ? flags.round : undefined,
      });
      return {
        data: result,
        text: renderRun(result, file),
        ...(result.verdict === "fail" ? { exit: 1 as const } : {}),
      };
    },
  };
}
