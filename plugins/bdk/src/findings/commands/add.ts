import { CliError } from "../../shared/cli/index.ts";
import type { Command } from "../../shared/cli/index.ts";
import type { Files } from "../../shared/fs/index.ts";
import { renderAdd } from "../render/add.ts";
import { addFinding } from "../use-cases/add.ts";
import { arg, LOG, text } from "./flags.ts";

function required(value: string | undefined, flag: string): string {
  if (value === undefined) {
    throw new CliError(
      "usage/missing-argument",
      `missing flag --${flag}`,
      "Run bdk findings add --help.",
    );
  }
  return value;
}

function lineNumber(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  if (!/^[1-9][0-9]*$/.test(value)) {
    throw new CliError(
      "usage/invalid-argument",
      `--line: ${value} is not a positive integer`,
      "Run bdk findings add --help.",
    );
  }
  return Number(value);
}

export function add(files: Files): Command {
  return {
    verb: "add",
    summary: "Append a finding and print its id (the same id for a duplicate)",
    arguments: [LOG],
    flags: {
      source: { type: "string", description: "Who reports it, e.g. review-group (required)" },
      summary: { type: "string", description: "What is wrong, in one line (required)" },
      file: { type: "string", description: "The file it is in" },
      line: { type: "string", description: "The line in --file, a positive integer" },
      rule: { type: "string", description: "The rule or check it breaks; part of the dedupe key" },
      evidence: { type: "string", description: "What shows it: output, a quote, steps" },
    },
    run(input) {
      const result = addFinding(files, {
        log: arg(input, "log"),
        source: required(text(input, "source"), "source"),
        summary: required(text(input, "summary"), "summary"),
        file: text(input, "file"),
        line: lineNumber(text(input, "line")),
        rule: text(input, "rule"),
        evidence: text(input, "evidence"),
      });
      return { data: result, text: renderAdd(result) };
    },
  };
}
