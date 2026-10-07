// `bdk rules for --stage <stage> [--files <file>]...` (spec `bdk-cli/rules`).

import type { Command } from "../../shared/cli/index.ts";
import { CliError } from "../../shared/cli/index.ts";
import { STAGES } from "../domain/rule.ts";
import type { Stage } from "../domain/rule.ts";
import { renderFor } from "../render/for.ts";
import { rulesFor } from "../use-cases/for.ts";
import type { RulesDeps } from "../use-cases/for.ts";

function stageOf(value: unknown): Stage {
  const stage = STAGES.find((name) => name === value);
  if (stage !== undefined) return stage;
  const given = typeof value === "string" ? `, not ${value}` : "";
  throw new CliError(
    "usage/invalid-argument",
    `--stage must be one of ${STAGES.join(", ")}${given}`,
    "Run bdk rules for --help for its flags.",
  );
}

export function forCommand(deps: RulesDeps): Command {
  return {
    verb: "for",
    summary: "Print the rules a role of a stage reads for a set of files",
    flags: {
      stage: { type: "string", description: `The stage: ${STAGES.join(", ")} (required)` },
      files: {
        type: "string",
        multiple: true,
        description: "A file the role works on; without any, every path matches",
      },
    },
    run({ flags }) {
      const files = Array.isArray(flags.files) ? flags.files : [];
      const result = rulesFor(deps, { stage: stageOf(flags.stage), files });
      return { data: result, text: renderFor(result) };
    },
  };
}
