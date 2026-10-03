// The settings `review` reads (`kernel-settings`, Keys of review policy):
// the size above which `bdk review plan` splits a group by module (T42-R1).
import * as z from "zod";

import { defineConfigModule } from "../shared/config/index.ts";

export const reviewGroupModule = defineConfigModule({
  key: "review.group",
  consumer: "review",
  owner: "T42",
  description: "How bdk review plan sizes the reviewer groups.",
  schema: z
    .strictObject({
      "max-files": z.int().min(5).max(200).default(30).meta({
        description:
          "A group above this many files is split by module; a plan part stays whole up to it.",
      }),
    })
    .prefault({}),
});
