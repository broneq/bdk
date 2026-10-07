// The settings schema (spec `bdk-cli/config`, "Settings keys"; design D1, D7). One strict zod
// schema of the resolved configuration: a default on every leaf, `prefault({})` on every nested
// object so its inner defaults apply (zod 4's `default({})` would skip them).

import { z } from "zod";

/** A key segment, a role, an orchestrator or an item id. */
export const KEBAB = /^[a-z0-9][a-z0-9-]*$/;

const kebab = z.string().regex(KEBAB, "must be kebab-case (a-z, 0-9, -)");
const text = z.string().min(1, "must not be empty");
const count = (fallback: number) => z.int().min(1).default(fallback);

const Check = z.strictObject({
  id: kebab,
  command: text,
  scoped: text.includes("{files}", { message: "must contain {files}" }).optional(),
  /** Seconds, at most a day (a longer timer overflows); `bdk check run` defaults it. */
  timeout: z.int().min(1).max(86_400).optional(),
});

const E2e = z.strictObject({
  id: kebab,
  start: text,
  ready: text,
  driver: z.enum(["cli", "http", "browser"]),
  env: z.record(z.string().regex(/^[A-Za-z_][A-Za-z0-9_]*$/), z.string()).optional(),
  /** Read only for `driver: browser`; the e2e tester takes an absent field as `chrome-devtools-axi`. */
  browser: z.enum(["chrome-devtools-axi", "chrome-devtools-mcp"]).optional(),
});

const Step = z.strictObject({
  id: kebab,
  enabled: z.boolean().optional(),
  use: text.optional(),
});

const gate = z.enum(["manual", "auto"]).default("manual");

export const SettingsSchema = z
  .strictObject({
    tools: z
      .strictObject({
        test: z.array(Check).default([]),
        lint: z.array(Check).default([]),
        build: z.array(Check).default([]),
        e2e: z.array(E2e).default([]),
      })
      .prefault({}),
    languages: z.array(kebab).default([]),
    rules: z.strictObject({ disabled: z.array(text).default([]) }).prefault({}),
    models: z.record(kebab, text).default({}),
    policy: z
      .strictObject({
        gates: z.strictObject({ design: gate, review: gate }).prefault({}),
        questions: z.enum(["decide-and-record", "stop"]).default("stop"),
        budgets: z
          .strictObject({ "part-attempts": count(3), "review-rounds": count(3) })
          .prefault({}),
        escalation: z.strictObject({ model: text.default("opus") }).prefault({}),
      })
      .prefault({}),
    plan: z
      .strictObject({
        part: z
          .strictObject({
            "max-tasks": count(5),
            "max-files": count(10),
            "max-bytes": count(8192),
          })
          .prefault({}),
      })
      .prefault({}),
    steps: z.record(kebab, z.array(Step)).default({}),
    execution: z
      .strictObject({ lead: z.enum(["background", "foreground"]).default("background") })
      .prefault({}),
    hooks: z.strictObject({ "subagent-git": z.boolean().default(false) }).prefault({}),
  })
  .prefault({});

export type Settings = z.infer<typeof SettingsSchema>;

/** The `default` layer: every key at its default. */
export const DEFAULTS: Settings = SettingsSchema.parse(undefined);
