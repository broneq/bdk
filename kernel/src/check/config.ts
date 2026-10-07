// The setting `check run` reads (`kernel-settings`, Keys of execution;
// #166): how long one project command may run before the kernel kills it.
import * as z from "zod";

import { defineConfigModule } from "../shared/config/index.ts";

export const executionChecksModule = defineConfigModule({
  key: "execution.checks",
  consumer: "check",
  owner: "T22",
  setup: "default",
  description: "The project's check commands that bdk check run runs (#166).",
  schema: z
    .strictObject({
      timeout: z.int().min(10).max(540).default(300).meta({
        description:
          "Seconds one check command may run; it is then killed with its process group and fails. Below the host's 600 s tool bound.",
      }),
    })
    .prefault({}),
});
