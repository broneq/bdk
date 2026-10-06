// The settings `change` reads (`kernel-settings`, Keys of execution and
// archive; T23-D53): whether `change close` keeps the evidence bodies.
import * as z from "zod";

import { defineConfigModule } from "../shared/config/index.ts";

export const archiveModule = defineConfigModule({
  key: "archive",
  consumer: "change",
  owner: "T30",
  setup: "default",
  description: "What `change close` keeps in the archived Change.",
  schema: z
    .strictObject({
      "keep-evidence": z.boolean().default(false).meta({
        description:
          "Keep the full dispatch/ and reports/ bodies; false prunes them to their hash index.",
      }),
    })
    .prefault({}),
});
