// `bdk check record <run-dir> <id> [--exit <kind>-<tool>=<code>]... [--timed-out <kind>-<tool>]... [--round <n>]`
// (ADR-0011).

import type { Command, Input } from "../../shared/cli/index.ts";
import { renderRecord } from "../render/record.ts";
import type { CheckDeps } from "../use-cases/deps.ts";
import { recordChecks } from "../use-cases/record.ts";

function list(value: Input["flags"][string]): readonly string[] | undefined {
  if (typeof value === "string") return [value];
  return Array.isArray(value) ? (value as readonly string[]) : undefined;
}

export function recordCommand(deps: CheckDeps): Command {
  return {
    verb: "record",
    summary: "Record the exit codes of a planned check's lines and write checks/<id>.json",
    arguments: [
      {
        name: "run-dir",
        description: "The Change's run directory, as given to bdk check plan",
        required: true,
      },
      { name: "id", description: "The id of the plan, as given to bdk check plan", required: true },
    ],
    flags: {
      exit: {
        type: "string",
        multiple: true,
        description:
          "<kind>-<tool>=<code>: the exit code the Bash tool reported for that check's line",
      },
      "timed-out": {
        type: "string",
        multiple: true,
        description: "<kind>-<tool>: a check whose line the Bash tool ended at its timeout",
      },
      round: {
        type: "string",
        description: "Append red checks as findings to review/round-<n>/findings.jsonl",
      },
    },
    exits: [
      {
        code: 1,
        when: "a check is red (failed, timed out or not run); the result is printed",
      },
    ],
    run({ args, flags }) {
      const { result, file } = recordChecks(deps, {
        runDir: String(args["run-dir"]),
        id: String(args.id),
        exits: list(flags.exit),
        timedOut: list(flags["timed-out"]),
        round: typeof flags.round === "string" ? flags.round : undefined,
      });
      return {
        data: result,
        text: renderRecord(result, file),
        ...(result.verdict === "fail" ? { exit: 1 as const } : {}),
      };
    },
  };
}
