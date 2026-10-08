// `bdk git scope <base> [--rounds <dir>]` (spec `bdk-cli/git`, "Scope of a review round").

import type { Command } from "../../shared/cli/index.ts";
import { renderScope } from "../render/scope.ts";
import type { GitDeps } from "../use-cases/deps.ts";
import { scope } from "../use-cases/scope.ts";

export const BASE = {
  name: "base",
  description: "The branch the work merges into; the first round starts at its merge base",
  required: true,
} as const;

export const ROUNDS = {
  type: "string",
  description:
    "The run's review/ directory; start after the last round-<N>/ holding review.md and groups.json",
} as const;

export function scopeCommand(deps: GitDeps): Command {
  return {
    verb: "scope",
    summary: "The range and the changed files a review round covers",
    arguments: [BASE],
    flags: { rounds: ROUNDS },
    run({ args, flags }) {
      const result = scope(deps, {
        base: String(args.base),
        rounds: typeof flags.rounds === "string" ? flags.rounds : undefined,
      });
      return { data: result, text: renderScope(result) };
    },
  };
}
