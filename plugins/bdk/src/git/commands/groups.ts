// `bdk git groups <base> [--rounds <dir>] [--plan <dir>] [--max-files <n>] [--record <dir>]`
// (spec `bdk-cli/git`, "Review groups", "Recording a round").

import { CliError } from "../../shared/cli/index.ts";
import type { Command } from "../../shared/cli/index.ts";
import { renderGroups } from "../render/groups.ts";
import type { GitDeps } from "../use-cases/deps.ts";
import { groups } from "../use-cases/groups.ts";
import { BASE, ROUNDS } from "./scope.ts";

export const DEFAULT_MAX_FILES = 30;

function maxFiles(value: string | boolean | readonly string[] | undefined): number {
  if (value === undefined) return DEFAULT_MAX_FILES;
  if (typeof value === "string" && /^[1-9]\d*$/.test(value)) return Number(value);
  throw new CliError(
    "usage/invalid-argument",
    `--max-files must be a positive integer, not ${String(value)}`,
    "Run bdk git groups --help for its flags.",
  );
}

export function groupsCommand(deps: GitDeps): Command {
  return {
    verb: "groups",
    summary: "The scope of a review round split into reviewer groups",
    arguments: [BASE],
    flags: {
      rounds: ROUNDS,
      plan: {
        type: "string",
        description: "The Change's plan/parts/ directory; group by part instead of by module",
      },
      "max-files": {
        type: "string",
        description: `The file target of a group (default ${DEFAULT_MAX_FILES}); a third above it is tolerated`,
      },
      record: {
        type: "string",
        description:
          "Also write the result to <dir>/groups.json, the record later rounds start from",
      },
    },
    run({ args, flags }) {
      const text = (name: string): string | undefined => {
        const value = flags[name];
        return typeof value === "string" ? value : undefined;
      };
      const result = groups(deps, {
        base: String(args.base),
        rounds: text("rounds"),
        plan: text("plan"),
        maxFiles: maxFiles(flags["max-files"]),
        record: text("record"),
      });
      return { data: result, text: renderGroups(result) };
    },
  };
}
