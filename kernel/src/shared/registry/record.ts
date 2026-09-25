// The shape of the bundled command index `schema/cli/commands.json`; the
// contract test validates the file against `commands.schema.json`, this schema
// only types it for the kernel and rejects an index the pipeline cannot use.
import * as z from "zod";

import { RULES } from "../refusal/index.ts";

const rule = z.enum(RULES);

const arg = z.object({
  name: z.string(),
  required: z.boolean(),
  values: z.array(z.string()).optional(),
  description: z.string().optional(),
});

const flag = z.object({
  name: z.string().startsWith("--"),
  value: z.string().optional(),
  values: z.array(z.string()).optional(),
  description: z.string().optional(),
});

const record = z.object({
  id: z.string(),
  argv: z.array(z.string()).min(1).max(3),
  summary: z.string(),
  availability: z.enum(["orchestrator", "agent", "read", "hook"]),
  mode: z.enum(["command", "inject", "guard"]),
  slice: z.string(),
  owner: z.string(),
  changeScoped: z.boolean(),
  standalone: z.boolean().optional(),
  args: z.array(arg),
  flags: z.array(flag),
  stdin: z.string().optional(),
  output: z.string(),
  exits: z.array(z.number().int()),
  refusals: z.array(rule),
  writes: z.array(z.string()),
});

const commandIndexSchema = z.object({
  contract: z.number().int(),
  base: z.object({ all: z.array(rule), changeScoped: z.array(rule) }),
  commands: z.array(record),
});

export type CommandIndex = z.infer<typeof commandIndexSchema>;
export type CommandRecord = z.infer<typeof record>;
export type FlagSpec = z.infer<typeof flag>;

export function loadIndex(raw: unknown): CommandIndex {
  return commandIndexSchema.parse(raw);
}

/** The command as the user types it, e.g. `bdk attempt close`. */
export function commandLine(record: CommandRecord): string {
  return `bdk ${record.argv.join(" ")}`;
}
