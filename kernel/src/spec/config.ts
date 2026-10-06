// The settings `spec` reads (`kernel-settings`, Keys of rules and specs): the
// word every requirement statement of a delta must carry.
import * as z from "zod";

import { defineConfigModule } from "../shared/config/index.ts";

export const specModule = defineConfigModule({
  key: "spec",
  consumer: "spec",
  owner: "T30",
  setup: "derived",
  description: "The grammar `spec delta check` holds a delta to.",
  schema: z
    .strictObject({
      "normative-word": z.string().trim().min(1).default("SHALL").meta({
        description: "The word every requirement statement carries, as a whole word.",
      }),
    })
    .prefault({}),
});
