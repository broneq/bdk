// The settings `hooks` reads (`kernel-settings`, Keys of agent orchestration;
// T41-D4, D5, D7): the message guard, the continuation check and the scout
// limit of a worker.
import * as z from "zod";

import { defineConfigModule } from "../shared/config/index.ts";

export const messageModule = defineConfigModule({
  key: "agents.message",
  consumer: "hooks",
  owner: "T41",
  description: "Messages between agents.",
  schema: z
    .strictObject({
      "max-chars": z.int().min(50).max(2000).default(300).meta({
        description: "The longest message one agent may send another.",
      }),
    })
    .prefault({}),
});

export const continuationModule = defineConfigModule({
  key: "agents.continuation",
  consumer: "hooks",
  owner: "T41",
  description: "The continuation check of the Stop and SubagentStop hooks.",
  schema: z
    .strictObject({
      max: z.int().min(0).max(10).default(3).meta({
        description: "Turn ends in a row the check blocks without progress; 0 switches it off.",
      }),
    })
    .prefault({}),
});

export const scoutModule = defineConfigModule({
  key: "agents.scout",
  consumer: "hooks",
  owner: "T41",
  description: "The scouts a worker may start.",
  schema: z
    .strictObject({
      "max-per-ticket": z.int().min(0).max(10).default(2).meta({
        description: "Scout agents one worker may start under one ticket; 0 forbids it.",
      }),
    })
    .prefault({}),
});
