// The settings `agents` reads (`kernel-settings`, Keys of agent orchestration;
// T41-D6): when an agent without a recent tool call turns `suspect`.
import * as z from "zod";

import { defineConfigModule } from "../shared/config/index.ts";

export const ttlModule = defineConfigModule({
  key: "agents.ttl",
  consumer: "agents",
  owner: "T41",
  description: "Seconds without a tool call after which an agent with no open call is suspect.",
  schema: z.int().min(60).max(1800).default(300),
});

export const openCallLimitModule = defineConfigModule({
  key: "agents.open-call-limit",
  consumer: "agents",
  owner: "T41",
  description: "Seconds after which an open tool call no longer keeps an agent running.",
  schema: z.int().min(60).max(3600).default(720),
});
