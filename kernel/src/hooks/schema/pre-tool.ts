// Generates `schema/cli/output/hooks-pre-tool.json` (kernel/scripts/export-schemas.ts).
import * as z from "zod";

import type { PreToolPass } from "../domain/report.ts";

export const preToolOutput = z
  .strictObject({
    decision: z.literal("pass"),
    tool: z.string().meta({ description: "The payload's tool_name." }),
    subagent: z.boolean().meta({ description: "Whether the payload carries agent_id." }),
  })
  .meta({
    title: "bdk hooks pre-tool --json",
    description:
      "PreToolUse guard: the kernel's own record of a pass, used by tests. A block is the error object under --json and the host's deny object otherwise.",
    examples: [{ decision: "pass", tool: "Bash", subagent: false }],
  }) satisfies z.ZodType<PreToolPass>;
