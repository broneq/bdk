// The settings schema (spec `bdk-cli/config`, "Settings keys"; design D1, D7). One strict zod
// schema of the resolved configuration: a default on every leaf, `prefault({})` on every nested
// object so its inner defaults apply (zod 4's `default({})` would skip them).

import { z } from "zod";

/** A key segment, a role, an orchestrator or an item id. */
export const KEBAB = /^[a-z0-9][a-z0-9-]*$/;

const kebab = z.string().regex(KEBAB, "must be kebab-case (a-z, 0-9, -)");
const text = z.string().min(1, "must not be empty");
const count = (fallback: number, description: string) =>
  z.int().min(1).default(fallback).meta({ description });
/** The user-facing text of a key; the settings Reference is generated from it. */
const about = (description: string) => ({ description });

const Check = z.strictObject({
  id: kebab.meta(
    about("Names the command; other layers and `bdk config set` address it by this id."),
  ),
  command: text.meta(about("Shell command run from the project root.")),
  scoped: text
    .includes("{files}", { message: "must contain {files}" })
    .optional()
    .meta(
      about(
        "Variant of the command for a set of files; `{files}` is replaced by the changed files, so a check covers only what a part touched.",
      ),
    ),
  /** Seconds, at most a day (a longer timer overflows); `bdk check run` defaults it. */
  timeout: z
    .int()
    .min(1)
    .max(86_400)
    .optional()
    .meta(about("Seconds before `bdk check run` stops the command; 600 when absent.")),
  paths: z
    .array(text)
    .min(1, "must hold at least one glob")
    .optional()
    .meta(
      about(
        "Globs of the files the command checks, matched like rule paths. On a scoped run the command gets only the changed files they match, and is skipped when none matches; every file when absent.",
      ),
    ),
});

const E2e = z.strictObject({
  id: kebab.meta(
    about("Names the entry; other layers and `bdk config set` address it by this id."),
  ),
  start: text.meta(about("Command that starts the product for the E2E tester.")),
  ready: text.meta(
    about("URL that answers, or command that exits 0, once the started product is ready."),
  ),
  driver: z
    .enum(["cli", "http", "browser"])
    .meta(
      about("How the E2E tester uses the product: as a command line, over HTTP, or in a browser."),
    ),
  env: z
    .record(
      z.string().regex(/^[A-Za-z_][A-Za-z0-9_]*$/),
      z.string().meta(about("Value of the environment variable.")),
    )
    .optional()
    .meta({ ...about("Environment variables set for `start`."), entry: "name" }),
  /** Read only for `driver: browser`; the e2e tester takes an absent field as `playwright`. */
  browser: z
    .enum(["playwright", "chrome-devtools-mcp"])
    .optional()
    .meta(
      about(
        "Browser tool the E2E tester drives; read only for `driver: browser`, where an absent value means `playwright`.",
      ),
    ),
});

const Step = z.strictObject({
  id: kebab.meta(about("The step of the orchestrator this entry changes.")),
  enabled: z.boolean().optional().meta(about("`false` skips the step.")),
  use: text.optional().meta(about("Project skill or agent that runs instead of the step's block.")),
});

const gate = (description: string) =>
  z.enum(["manual", "auto"]).default("manual").meta(about(description));

const checks = (what: string) =>
  z
    .array(Check)
    .default([])
    .meta(about(`Commands that ${what}; \`bdk check run\` runs them, each by its \`id\`.`));

export const SettingsSchema = z
  .strictObject({
    tools: z
      .strictObject({
        test: checks("run the project's tests"),
        lint: checks("lint the project"),
        build: checks("build the project"),
        e2e: z
          .array(E2e)
          .default([])
          .meta(about("How to start the product so the E2E tester can use it as a user would.")),
      })
      .prefault({})
      .meta({
        ...about("The project's commands, which `/bdk:setup` detects."),
        examples: [
          {
            test: [{ id: "vitest", command: "pnpm test", scoped: "pnpm vitest run {files}" }],
            lint: [{ id: "eslint", command: "pnpm lint", scoped: "pnpm eslint {files}" }],
            build: [{ id: "vite", command: "pnpm build" }],
            e2e: [
              { id: "web", start: "pnpm dev", ready: "http://localhost:5173", driver: "browser" },
            ],
          },
        ],
      }),
    languages: z
      .array(kebab)
      .default([])
      .meta({
        ...about(
          "Languages of the project; `bdk rules for` picks the rule pack's language rules by them.",
        ),
        examples: [["typescript", "react"]],
      }),
    rules: z
      .strictObject({
        disabled: z
          .array(text)
          .default([])
          .meta(about("Rules of the rule pack that no role reads in this project.")),
      })
      .prefault({})
      .meta({
        ...about("Which rules of the BDK rule pack and of `.bdk/rules/` apply."),
        examples: [{ disabled: ["BDK-DP-2", "BDK-REACT-10"] }],
      }),
    models: z
      .record(kebab, text.meta(about("Model name or alias the agent of this role runs on.")))
      .default({})
      .meta({
        ...about(
          "Model per agent role, named after its agent: `lead`, `explorer`, `verifier`, `implementer`, `conformer`, `reviewer`, `integration-reviewer`, `e2e-tester` or `judge`; a role not set runs on its agent's default model.",
        ),
        entry: "role",
        examples: [{ implementer: "opus", reviewer: "sonnet" }],
      }),
    policy: z
      .strictObject({
        gates: z
          .strictObject({
            design: gate(
              "`manual`: you approve a verified design before `/bdk:plan`, and a bug diagnosis before `/bdk:debug` builds the fix; `auto`: both are approved without asking.",
            ),
            review: gate(
              "`manual`: you decide fix, accept or defer for each finding of a review round; `auto`: triage decides by each finding's level.",
            ),
          })
          .prefault({})
          .meta(about("Where a run stops for your decision.")),
        questions: z
          .enum(["decide-and-record", "stop"])
          .default("stop")
          .meta(
            about(
              "What a skill does with an open question: `stop` asks you; `decide-and-record` takes the recommended answer and records it.",
            ),
          ),
        budgets: z
          .strictObject({
            "part-attempts": count(
              3,
              "Most implementer runs one plan part gets in one `/bdk:execute` run before it counts as blocked.",
            ),
            "review-rounds": count(3, "Most review rounds one `/bdk:auto-review` run takes."),
            verifier: count(3, "Most verifier passes one design or plan orchestrator run spends."),
          })
          .prefault({})
          .meta(about("Limits on retries, so a run ends.")),
        escalation: z
          .strictObject({
            model: text
              .default("opus")
              .meta(
                about(
                  "Model the last implementer run of a plan part runs on, within its `policy.budgets.part-attempts`.",
                ),
              ),
          })
          .prefault({})
          .meta(about("What a run does before it gives up on a part.")),
      })
      .prefault({})
      .meta({
        ...about("How autonomous a run is: gates, questions, budgets and escalation."),
        examples: [
          {
            gates: { design: "auto", review: "auto" },
            questions: "decide-and-record",
            budgets: { "part-attempts": 4, "review-rounds": 2 },
          },
        ],
      }),
    plan: z
      .strictObject({
        part: z
          .strictObject({
            "max-tasks": count(
              5,
              "Most tasks in one plan part; `bdk plan check` reports a larger part.",
            ),
            "max-files": count(
              10,
              "Most files one plan part may touch; `bdk plan check` reports a larger part.",
            ),
            "max-bytes": count(
              8192,
              "Most bytes of one plan part file; `bdk plan check` reports a larger part.",
            ),
          })
          .prefault({})
          .meta(about("Size limits of one plan part, so one agent can finish it.")),
      })
      .prefault({})
      .meta({
        ...about("Rules for the plans `/bdk:plan` writes."),
        examples: [{ part: { "max-tasks": 4, "max-files": 8 } }],
      }),
    steps: z
      .record(
        kebab,
        z
          .array(Step)
          .meta(about("Changes to the steps of this orchestrator, each by the step's `id`.")),
      )
      .default({})
      .meta({
        ...about(
          "Not read by any orchestrator yet: per-orchestrator step changes the configuration accepts.",
        ),
        entry: "orchestrator",
        examples: [{ "auto-review": [{ id: "e2e", enabled: false }] }],
      }),
    execution: z
      .strictObject({
        lead: z
          .enum(["background", "foreground"])
          .default("background")
          .meta(
            about(
              "Whether the lead agent of `/bdk:execute`, `/bdk:auto-review` and `/bdk:pr-review` runs in the background or in your session.",
            ),
          ),
        /** Part agents the execute lead runs at once; 10 from the concurrency probe of #200. */
        "max-parallel": count(10, "Most part agents the execute lead runs at once."),
      })
      .prefault({})
      .meta({
        ...about("How the lead agents run."),
        examples: [{ lead: "foreground", "max-parallel": 4 }],
      }),
    hooks: z
      .strictObject({
        "subagent-git": z
          .boolean()
          .default(false)
          .meta(
            about(
              "`true` makes the `PreToolUse` guard deny git commands that change history in every subagent except the lead.",
            ),
          ),
      })
      .prefault({})
      .meta({ ...about("Hooks of the bdk plugin."), examples: [{ "subagent-git": true }] }),
  })
  .prefault({});

export type Settings = z.infer<typeof SettingsSchema>;

/** The `default` layer: every key at its default. */
export const DEFAULTS: Settings = SettingsSchema.parse(undefined);
