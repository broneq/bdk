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

/** The check points of `bdk check run --at` (spec `bdk-cli/check`). */
export const CHECK_POINTS = ["part", "wave", "review"] as const;

const Check = z.strictObject({
  id: kebab.meta(
    about("Names the command; other layers and `bdk config set` address it by this id."),
  ),
  command: text.meta(
    about(
      "Shell command run from the project root. A `{files}` in it is replaced by the changed files, and the command is skipped when there are none.",
    ),
  ),
  when: z
    .array(
      z.enum(CHECK_POINTS, {
        error: () => `must be one of ${CHECK_POINTS.join(", ")}`,
      }),
    )
    .min(1, "must hold at least one point")
    .refine((points) => new Set(points).size === points.length, "must not repeat a point")
    .optional()
    .meta(
      about(
        "Check points the command runs at: `part` after each plan part, `wave` after each wave of execute, `review` in each review round; every point when absent.",
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
        "Globs of the files the command checks, matched like rule paths. The command gets only the changed files they match, and is skipped when files changed and none matches; every file when absent.",
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

/** The agent roles `models` configures; each is the `name` of an agent of the plugin. */
export const MODEL_ROLES = [
  "lead",
  "explorer",
  "verifier",
  "implementer",
  "conformer",
  "reviewer",
  "integration-reviewer",
  "e2e-tester",
  "judge",
  "designer",
  "planner",
] as const;

/** Claude Code's reasoning effort levels, which the `Agent` tool and agent frontmatter take. */
export const EFFORTS = ["low", "medium", "high", "xhigh", "max"] as const;

const effort = (description: string) => z.enum(EFFORTS).optional().meta(about(description));

const RoleModel = z
  .strictObject(
    {
      model: text
        .optional()
        .meta(
          about("Model name or alias the agent of this role runs on; its default when absent."),
        ),
      effort: effort("Reasoning effort of the agent of this role; the session's when absent."),
    },
    {
      error: (issue) =>
        issue.code === "invalid_type" && typeof issue.input === "string"
          ? `must be a mapping with model and effort (${[...(issue.path ?? []), "model"].join(".")}: ${issue.input})`
          : undefined,
    },
  )
  .meta(about("Model and effort the agent of this role runs with."));

const Step = z.strictObject({
  id: kebab.meta(about("The step of the orchestrator this entry changes.")),
  enabled: z.boolean().optional().meta(about("`false` skips the step.")),
  use: text.optional().meta(about("Project skill or agent that runs instead of the step's block.")),
});

/** The stages and kinds of a rule (spec `rule-pack`); `rules/domain/rule.ts` holds the same. */
export const RULE_STAGES = ["design", "plan", "execute", "review"] as const;
export const RULE_KINDS = ["house", "knowledge"] as const;
/** The prefix of the BDK pack's rule ids. */
export const PACK_PREFIX = "BDK-";
/** A rule id (spec `bdk-cli/config`, "Settings keys"): the one key that keeps its case. */
export const RULE_ID = /^[A-Za-z0-9][A-Za-z0-9-]*$/;

const ruleId = z.string().regex(RULE_ID, "must be a rule id (letters, digits and -)");

const RuleEntry = z
  .strictObject({
    text: text
      .optional()
      .meta(
        about("The rule text, Markdown; a project rule holds exactly one of `text` and `file`."),
      ),
    file: text
      .optional()
      .meta(
        about(
          "Markdown file holding the rule text, relative to the project root (to the directory of the global settings file in the global layer); a leading `---` frontmatter block is skipped.",
        ),
      ),
    kind: z
      .enum(RULE_KINDS)
      .optional()
      .meta(
        about(
          "`house` (a choice among valid alternatives, the default) or `knowledge` (a fact about a library, language or tool).",
        ),
      ),
    paths: z
      .array(text)
      .min(1, "must name at least one glob")
      .optional()
      .meta(
        about(
          'Globs, relative to the project root, of the files the rule governs; `["**"]` when absent.',
        ),
      ),
    stages: z
      .array(z.enum(RULE_STAGES))
      .min(1, "must name at least one stage")
      .refine((stages) => new Set(stages).size === stages.length, "must not repeat a stage")
      .optional()
      .meta(
        about(
          "Stages whose roles read the rule, among `design`, `plan`, `execute` and `review`; `[execute, review]` when absent.",
        ),
      ),
    source: text.optional().meta(about("Where the fact of a `knowledge` rule is documented.")),
    verified: z.iso
      .date("must be a date YYYY-MM-DD")
      .optional()
      .meta(about("The date (`YYYY-MM-DD`) the fact of a `knowledge` rule was last checked.")),
    enabled: z
      .boolean()
      .optional()
      .meta(about("`false` switches the rule off, so no role reads it; `true` when absent.")),
  })
  .meta(
    about(
      "A rule: a project rule holds `text` or `file`; an entry whose id starts with `BDK-` sets only `enabled`, `paths` or `stages` of that pack rule.",
    ),
  );

/** Fields an entry for a pack rule may set: the pack's text and kind stay the pack's. */
const PACK_FIELDS: ReadonlySet<string> = new Set(["enabled", "paths", "stages"]);

/**
 * A rule entry's checks across its fields (spec `bdk-cli/config`, "Settings keys"). Checks that a
 * higher layer can still satisfy carry `resolved: true`, so `validate` reports them only on the
 * full merge, like a missing required field.
 */
function checkRules(rules: Record<string, z.infer<typeof RuleEntry>>, ctx: z.RefinementCtx): void {
  for (const [id, entry] of Object.entries(rules)) {
    if (id.startsWith(PACK_PREFIX)) {
      for (const field of Object.keys(entry).filter((name) => !PACK_FIELDS.has(name))) {
        ctx.addIssue({
          code: "custom",
          path: [id, field],
          message: "a BDK- entry takes only enabled, paths and stages",
        });
      }
      continue;
    }
    if (entry.text !== undefined && entry.file !== undefined) {
      ctx.addIssue({
        code: "custom",
        path: [id],
        message: "a project rule holds exactly one of text and file",
      });
    } else if (entry.text === undefined && entry.file === undefined) {
      ctx.addIssue({
        code: "custom",
        path: [id],
        message: "a project rule holds exactly one of text and file",
        params: { resolved: true },
      });
    }
    for (const field of ["source", "verified"] as const) {
      if (entry.kind === "knowledge" && entry[field] === undefined) {
        ctx.addIssue({
          code: "custom",
          path: [id, field],
          message: "required, missing",
          params: { resolved: true },
        });
      }
      if (entry.kind !== "knowledge" && entry[field] !== undefined) {
        ctx.addIssue({
          code: "custom",
          path: [id, field],
          message: "belongs to knowledge rules only",
          params: { resolved: true },
        });
      }
    }
  }
}

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
            test: [
              { id: "vitest", command: "pnpm test", when: ["wave", "review"] },
              {
                id: "vitest-related",
                command: "pnpm vitest related --run {files}",
                when: ["part"],
                paths: ["src/**/*.ts"],
              },
            ],
            lint: [
              { id: "eslint", command: "pnpm lint", when: ["review"] },
              {
                id: "eslint-changed",
                command: "pnpm eslint {files}",
                when: ["part"],
                paths: ["**/*.ts"],
              },
            ],
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
      .record(ruleId, RuleEntry)
      .superRefine(checkRules)
      .default({})
      .meta({
        ...about(
          "The project's own rules and changes to the rules of the BDK rule pack, each by its rule id; an id starting with `BDK-` changes the pack rule of that id.",
        ),
        entry: "id",
        examples: [
          {
            "API-1": {
              paths: ["src/api/**"],
              text: "Every handler under `src/api/` parses its request body with the schema in `src/api/schemas/`.",
            },
            "GATEWAY-1": {
              stages: ["design", "plan", "review"],
              file: "docs/conventions/gateway.md",
            },
            "BDK-DP-2": { enabled: false },
          },
        ],
      }),
    models: z
      .partialRecord(z.enum(MODEL_ROLES), RoleModel)
      .default({})
      .meta({
        ...about(
          "Model and effort per agent role, each role named after its agent: `lead`, `explorer`, `verifier`, `implementer`, `conformer`, `reviewer`, `integration-reviewer`, `e2e-tester`, `judge`, `designer` or `planner`; a field not set leaves the agent on its default model and the session's effort.",
        ),
        entry: "role",
        examples: [
          {
            implementer: { model: "opus", effort: "high" },
            reviewer: { model: "sonnet" },
            planner: { effort: "xhigh" },
          },
        ],
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
            effort: effort(
              "Effort of the last implementer run of a plan part; when absent that run takes `models.implementer.effort`.",
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
