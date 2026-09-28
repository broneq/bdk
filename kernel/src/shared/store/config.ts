// The settings the checkpoint core reads (`kernel-settings`, Keys of workflow
// policy): whether the kernel commits the Change directory on its own. Every
// caller of `checkpointChange` shares it, so `shared/store` consumes it.
import * as z from "zod";

import { defineConfigModule } from "../config/index.ts";

export const checkpointModule = defineConfigModule({
  key: "policy.checkpoint",
  consumer: "shared/store",
  owner: "T22",
  description: "Pathspec commits of the Change directory at park, escalation and session end.",
  schema: z
    .strictObject({
      enabled: z.boolean().default(true).meta({
        description: "false skips every checkpoint; the task commits still carry the Change.",
      }),
    })
    .prefault({}),
});
