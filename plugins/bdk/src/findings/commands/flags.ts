// Reading the string flags of an `Input`: the frame parses them, a command picks its own.
import type { Input } from "../../shared/cli/index.ts";

export function text(input: Input, name: string): string | undefined {
  const value = input.flags[name];
  return typeof value === "string" ? value : undefined;
}

export function arg(input: Input, name: string): string {
  return input.args[name] ?? "";
}

export const LOG = {
  name: "log",
  description: "The findings log, e.g. .bdk/runs/<change>/review/round-<N>/findings.jsonl",
  required: true,
} as const;
