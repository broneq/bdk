# Design

## Context

See proposal.md for the motivation, the user's five decisions and the scope boundary.

Facts that shape the approach (observed 2026-09-28):

- promptfoo's `anthropic:claude-agent-sdk` provider (docs, promptfoo.dev/docs/providers/claude-agent-sdk) runs real Claude Code sessions. It supports `plugins` (a local directory with `.claude-plugin/plugin.json`, skills namespaced `bdk:*`), `working_dir`, `setting_sources`, `permission_mode`, `model`, `max_turns`, `max_budget_usd`, subagents through the `Task` tool (`max_subagent_spawn_depth` 5, `max_concurrent_subagents` 20), and returns `metadata.toolCalls` with `parentToolUseId` for subagent calls, plus a `skill-used` assertion. It needs `@anthropic-ai/claude-agent-sdk` installed next to promptfoo.
- The docs do not say whether `plugins` also loads a plugin's `agents/` and `hooks/hooks.json`, whether a run's cost is returned (only `tokenUsage` is documented), how to give each test its own `working_dir` (it is per provider config; the docs suggest `maxConcurrency: 1` and extension hooks), or whether the `Workflow` tool and background subagents work. BDK's behaviour under test depends on its agents and its `pre-tool` hook, and the v2 arm uses `Workflow`.
- The kernel can seed a Change at the execute stage without a model: `change new --profile tiny`, plan part files, `bdk done plan`, `part start` (as `kernel/src/attempt/tests/e2e-support.ts` does). The execute-stage instruction templates (`pipeline/execute-part.md`, `simplify.md`, `tests-scoped.md`, `lint.md`) are one or two sentences each; the thin arm depends on them and on `attempt close`'s `next.action`.
- Kernel exit codes (`kernel-cli`): 2 refusal (`policy/`, `guard/`, `kernel/`), 3 input error (`input/`).
- The v2 skill at `v2.7.0` (`skills/subagent-execute-plan/SKILL.md`, 662 lines) declares `model: opus`, uses `scripts/bdk_run_state.py` (needs `python3`) and git trailers `BDK-Run:` / `BDK-Group:`.
- Role adapters: `agents/reviewer.md` and `agents/worker.md` are `sonnet`, `agents/runner.md` is `haiku`.
- Fixture `kamkie/technical-interview-frontend` at `946a2081f84381ffc3b4a494467479a5b6886ead`: public, no licence, 215 tracked files, Vite + React 19 + TypeScript, `vitest run`, `tsc -b`, `eslint .`, Node 24 (the repository's `.nvmrc` is 24 too). It ships `.claude/skills/`, `.agents/`, `AGENTS.md` and a `CLAUDE.md` that imports `@AGENTS.md`.
- `rules/` holds 9 files with 131 bullets (`code-quality` 10, `architecture` 7, `engineering-judgment` 2, `test-quality` 17, `design-patterns` 14, `security` 10, `languages/javascript` 25, `languages/react` 24, `languages/typescript` 22).

## Goals / Non-Goals

**Goals:**

- A harness that answers the T41 gate question with a pre-registered criterion and an A/A noise floor, and that anyone can rerun with one command and an API key.
- Per-bullet rule data that lets T31 decide removals without running its own measurement.
- A reusable with / without mode for craft admission (R-6).
- Total model spend for T40 at or below 100 USD, with the user approving the full series after a measured probe.

**Non-Goals:**

- Writing the shipped `execute` skill (T41). The two v3 variants live under `evals/` and are not shipped.
- Improving kernel instruction templates. A thin loss caused by template text is reported as such for T41.
- Final COVERED thresholds and rule removal (T31).
- A general benchmark of models or of promptfoo.

## Decisions

### D-1 Harness layout: `evals/` with its own pinned tool package

```
evals/
  harness/          Node modules (TypeScript, run by Node 24 type stripping) + unit tests
  suites/
    execute-ab/     promptfooconfig, task (shared source), v2 plan, v3 seed, hidden tests, variants/
    rules-noop/     promptfooconfig, questions, seeded diffs, violation map
    with-without/   promptfooconfig template, example task file
  package.json      promptfoo and @anthropic-ai/claude-agent-sdk, exact versions, own pnpm lockfile
  versions.json     fixture repo + commit, v2 tag
  results/          committed per-run summary rows (JSONL), one file per series
  .runs/            gitignored: fixture cache, plugin copies, per-run working copies, raw outputs
```

`pnpm eval <suite> [--probe] [--budget N] [--runs N]` runs `node evals/harness/cli.ts`, which installs the tool package when `evals/node_modules` is missing or older than its lockfile (`pnpm --dir evals install --frozen-lockfile --ignore-workspace`), prepares the fixture and plugin copies, renders the suite config under `evals/.runs/`, and runs `evals/node_modules/.bin/promptfoo eval --no-cache -c <config>`. The provider resolves the SDK from the config's directory, which `evals/node_modules` is an ancestor of. Harness unit tests join the root vitest `unit` project and the root lint and typecheck; they need no tool package.

As built (probe 1): the first plan, pinned `npx -p promptfoo -p @anthropic-ai/claude-agent-sdk`, fails because promptfoo resolves the SDK from the config's directory, not from the `npx` cache (`evals/README.md`, Provider facts). Alternatives: promptfoo and the SDK as root devDependencies (promptfoo pulls a large tree into every kernel CI install and the root lockfile); a global install (unpinned, not reproducible).

### D-2 Probe first, with a fixed fallback

Task group 1 is a probe on the real provider before any suite is built: one trivial session with the plugin copy, checking (a) BDK agents listed and spawnable, (b) the `pre-tool` hook fires (a subagent `git commit` is denied), (c) a per-run `working_dir` (via an extension `beforeEach` hook that resets the copy, `maxConcurrency: 1`), (d) cost or token usage in the result, (e) the session's init lists exactly the arm's plugin and no user-level plugin or MCP server, (f) `Workflow` and background `Task` in a v2 session.

If (a), (b) or (e) fail, the harness uses a promptfoo custom provider (`evals/harness/provider.ts`) that runs `claude -p --plugin-dir <copy> --output-format stream-json --verbose --setting-sources project` in the per-run directory with an isolated `HOME`, the method T03 proved. Configs, `repeat`, assertions and reports stay promptfoo either way. If only (d) fails, cost is computed from token usage and a pinned price table. If (f) fails, the v2 arm is reported "not runnable" with the reason and the report states that only the kernel-free comparison is missing.

Alternative: skip promptfoo and write the whole harness as a script (the plan's fallback). It loses `repeat`, assertions, the web viewer and the reuse for craft admission.

As built (probes 1-7, 2026-09-28, `evals/README.md` Provider facts): (a), (b), (c), (d) and (e) pass, so the harness uses the built-in `anthropic:claude-agent-sdk` provider; the `claude -p` custom provider is not built. (f): background subagents work, `Workflow` is absent, so the v2 arm runs its subagent strategy only. Every arm sets `allow_all_tools: true` (the `Agent` tool is off by default), `forward_subagent_text: true` (otherwise promptfoo strips subagent transcripts from what the orchestrator sees), `setting_sources: ["project"]`, `ENABLE_CLAUDEAI_MCP_SERVERS=false`, `apiKeyRequired: false`, and a per-run `debug_file` that is the isolation evidence. Authentication is an `ANTHROPIC_API_KEY` or a logged-in Claude Code (`claude auth status --json`); the reported cost is at list price either way.

### D-3 Fixture: fetched, pinned, stripped, copied per run

The harness fetches the fixture once into `evals/.runs/cache/` (`git init`, `git fetch --depth 1 origin <sha>`), checks `HEAD` equals the pin, removes `.claude/`, `.agents/`, `CLAUDE.md` and `AGENTS.md`, runs `npm ci` once, and commits the stripped tree as the base commit on branch `feat/eval`. The provider's `working_dir` is one fixed path per cell (`evals/.runs/work/<suite>/<cell>/`); an extension `beforeEach` hook replaces its content with a fresh copy of the base before every run (copy-on-write where the filesystem supports it, so `node_modules` costs no time), and runs are sequential (`maxConcurrency: 1`). `setting_sources: ["project"]` and `ENABLE_CLAUDEAI_MCP_SERVERS=false` keep the user's plugins, MCP servers, connectors and `CLAUDE.md` out (probe 4-5); `HOME` stays the user's, because Claude Code's login lives there. Each run's `debug_file` is checked after the session: exactly one directory-loaded plugin (the arm's copy), claude.ai connectors disabled, no MCP tool call; a mismatch discards the run (spec: isolation leak).

Nothing from the fixture is committed to BDK: its licence is absent. BDK's own inputs (task text, plans, hidden tests, seeded diffs as patch files that add or edit small, self-written code) are committed under `evals/suites/`.

Why strip the fixture's instructions: its `AGENTS.md` prescribes its own planning and review workflow, which would compete with the skill under test in every arm differently. Alternative: keep them as "realistic noise" (adds an uncontrolled variable).

Alternatives for the repository: T03's `vibe-kanban` snapshot (2116 files, larger than an execute task needs, pnpm workspace); a synthetic fixture (no real conventions to follow). User decision.

### D-4 The execute task and its three encodings

One feature of the fixture, chosen in task group 3 to meet: two plan parts, four tasks, each task test-first, touches only `src/` and its tests, needs no backend, and has an objective definition of done. It is written once in `evals/suites/execute-ab/task/` (intent, parts, tasks with `Files:` and test cases), then encoded:

- v3: a seed script that creates the Change with kernel commands (`change new`, part files, `done` on the plan nodes, `part start 01`), so every v3 run starts at the same `bdk next` answer. Where the pipeline needs a user transition, the seed calls `bdk hooks prompt-expansion` with the stage command, the same path a typed command takes.
- v2: a plan file in v2 format at `.bdk/plans/<name>.md`.

Hidden acceptance tests (`evals/suites/execute-ab/hidden/`) are copied in only after the session ends. The reference solution is written and must pass them before the first measured run (T03 D-3 practice).

Prompts: v2 `/bdk:subagent-execute-plan .bdk/plans/<name>.md`; v3 `/bdk:execute`. Every arm runs with `permission_mode: bypassPermissions` inside the throwaway copy.

As built (task 3.1-3.3): the user chose the CSV export of the operator audit page over the two alternatives shown. Part 01 adds `src/operator/auditCsv.ts` (`toAuditCsv` with RFC 4180 quoting and formula-injection guard, `auditCsvFilename` recording date, filters and page); part 02 adds the `Export CSV` button to `OperatorPage` and its download. The reference solution (`reference/solution.patch`) passes the 10 hidden tests, the whole fixture suite and `tsc -b`; the untouched fixture fails the hidden tests. The v3 seed stops after `change checkpoint` of the plan stage: the typed `/bdk:execute` records the execute transition through the `UserPromptExpansion` hook, so the seed does not simulate it, and `part start` is the skill's first step. The seed writes `.bdk/settings.yaml` with the fixture's test, lint and typecheck commands and the `tiny` profile. The fixture base also carries a `main` branch at the base commit, because the v2 executor diffs against `merge-base HEAD main`.

### D-5 Arms and plugin copies

| Arm       | Plugin copy                                            | Skill under test                                                                        |
| --------- | ------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| `v2`      | `git archive v2.7.0`                                   | `skills/subagent-execute-plan/SKILL.md` as tagged                                       |
| `v3-long` | `git archive HEAD` (with the committed `dist/bdk.mjs`) | `evals/suites/execute-ab/variants/execute-long/SKILL.md` installed as `skills/execute/` |
| `v3-thin` | same                                                   | `evals/suites/execute-ab/variants/execute-thin/SKILL.md` installed as `skills/execute/` |

v3 plugin copies keep only `skills/roles/` with the variant's `skills/execute/`, and only the five role adapters in `agents/` (`worker`, `reader`, `reviewer`, `runner`, `scout`, the agents the role skills name): the host scans the default `skills/` directory in addition to the manifest's `skills` array (probe 4), and HEAD still ships the v2-era skills and agents (`implementer`, `fixer`, `code-reviewer`, ...), which would otherwise be offered next to the variant. The v3 arms thus measure the v3 plugin as T42 leaves it, not today's mixed tree. Both variants follow T41's constraints that apply to execute: `disallowed-tools` for Edit and Write (P9), `disable-model-invocation: true` (T1), roles dispatched through `bdk dispatch build`. `v3-long` is written from the v2 skill's structure translated to v3 commands (approach B): the step order per task (attempt open, dispatch build, implementer, post-task steps in pipeline order, attempt close, commit), failure routing and part closing are in the skill text. `v3-thin` contains only the loop, the role-to-subagent mapping and the envelope handling; it takes the order from `bdk next` and `attempt close`'s `next.action`. Its line count is checked by a unit test (spec: at most 200 lines).

As built (task 3.4): v3 copies also keep `skills/swarm/`, which `v3-thin` loads for the order of packages inside a ticket; `v3-long` spells that order out instead. The arms are stored as `execute-thin` and `execute-long`, because `skill-check` requires unique skill names across the repository and checks the variants with BDK's own rules; the plugin copy installs a variant under `skills/execute/` with its frontmatter `name` set to `execute`, and the recorded variant hash is that of the installed file.

### D-6 Models

Orchestrator: Opus 5.5 (`claude-opus-5-5`) through the provider's `model` in every arm (user decision; the v2 skill's own `model: opus` agrees). Subagents: the model in each agent's frontmatter, unchanged. Judge for `llm-rubric` and for the rules measurements: Sonnet 5 at temperature 0, with the author spot-checking 10% of judged items and every item the judge marks uncertain. Rules knowledge test subjects: Haiku 4.5 and Sonnet 5 (T31 measurement 1). Rules ablation reviewer: Sonnet 5, the `reviewer` adapter's model.

Alternative judge: Opus 5.5 (cleaner separation from a test subject, several times the cost for about 3000 short judgements). Haiku 4.5 (cheapest; T03 needed spot-check corrections on its rubric scores).

### D-7 Execute metrics and the pre-registered criterion

Per run, computed from state after the session, not from the model's own summary:

- **Acceptance** (primary): hidden tests pass, the fixture's whole `vitest run` passes, `tsc -b` passes, `eslint` passes on changed files; score 1 when all pass, else the fraction.
- **Step completeness** (primary): the expected steps present, as a fraction. v3: per task a ticket opened, an implementer package built, a report ingested, `tests-scoped` and `lint` evidence `pass` and fresh, `simplify` evidence, a commit with the task trailer; per part `part done`. v2: per task a commit with `BDK-Run` / `BDK-Group` trailers, a test-runner and a static-analyse subagent after the implementer (from `toolCalls`), the run manifest complete.
- **Secondary**: cost, turns, wall time; v3 only: `bdk` calls, exit-3 calls, exit-2 calls (from Bash `toolCalls` whose command runs `dist/bdk.mjs`), envelope length (bytes of each role subagent's final return).
- **llm-rubric**: the orchestrator's final message states the true end state (parts done, failures) as the kernel records it. Reported, not part of the decision.

Criterion (written before the runs, copied verbatim into the report): **thin is "no worse"** when, on both primary metrics, `v3-thin` vs `v3-long` is either "no measurable difference" or in favour of `v3-thin` under the difference rule (T03 D-7), with the A/A pair on `v3-long` as the noise floor. Otherwise T41 falls back to approach B. A measurable regression of `v3-thin` on a secondary metric does not fail it; it is listed for T41 with its cause (for example exit-3 calls pointing at a thin instruction template). `v2` comparisons decide nothing in T40; a measurable primary regression of `v3-long` vs `v2` is raised to the user as a v3 risk for T50.

Runs: 5 per cell; cells `v2`, `v3-long` A, `v3-long` A', `v3-thin`: 20 measured runs plus the probe.

### D-8 Rules measurement design

Bullets are identified by file, ordinal and the first 8 hex digits of the sha256 of the bullet text (IDs arrive in T31).

- **M1 knowledge (T31 measurement 1)**: for each bullet, one question that the bullet answers without quoting it, written with Sonnet 5's help, reviewed and committed before the runs (`questions.yaml`). Haiku 4.5 and Sonnet 5 answer blind, 5 times each (A/A: the Sonnet cell twice). The judge sees bullet and answer and returns COVERED, MISSED or WRONG. A model's outcome for a bullet is the majority of its 5.
- **M2 ablation (T31 measurement 2)**: 15-20 patches against the fixture, each seeding 3-8 violations mapped to bullets in `violations.yaml`, plus 3 clean control patches for false positives. A review is a one-turn call with no tools (`anthropic:claude-agent-sdk` with `custom_system_prompt`, `tools: []`, `max_turns: 1`, so it works with a logged-in Claude Code as well as with an API key) whose system prompt is the `reviewer` role text and adapter prompt, the diff, and the rules files in the "with" cell only; 5 runs per cell, A/A on the "with" cell. The judge decides per seeded violation whether the review named it. One-turn calls isolate the one variable (the rules text) and cost a fraction of agent sessions. M1 answers and every judgement use the same one-turn form. Bullets that a TypeScript/React diff cannot violate (process rules) are "not seedable".
- **Provisional class** per bullet, for T31: `no-op candidate` when M1 is COVERED for both models and M2 is "not seedable" or shows no measurable difference with a without-rules detection rate of at least 0.8; `effective` when M2 shows a measurable difference in favour of "with"; `corrects the model` when M1 is WRONG for either model; `unclear` otherwise. T31 owns the final thresholds.

As built (task 4.3): 18 seeded patches (`18-audit-sync` added so that the Observer, Decorator, Repository, DIP, ISP, least-privilege and Suspense bullets have a case) and 3 clean controls (`19`-`21`). A line may break more than one bullet (an if-chain on a format tag breaks Strategy, Open/Closed and conditional-to-polymorphism at once), so the 3-8 range counts distinct lines: 3 to 8 per patch, while patches 11 and 13 name 10 and 9 bullets. 110 of the 131 bullets are seeded; 21 are "not seedable" with a reason in `violations.yaml`: notes about the rule files themselves, process rules, the five "still allowed" test permissions, the Server Component and Server Action rules (the fixture is a client-only Vite SPA), `ViewTransition` (not in stable React 19.2) and the two compiler-flag rules the base config already leaves off. The unit test fetches the pinned fixture once into its own cache (`evals/.runs/cache-patches/`, without the dependency install, so it never replaces the suites' installed base) and checks each patch with `git apply --check`.

As built (task 4.4): M1 and M2 are two series of the one suite (`probe-`/`series-m1-<date>`, `-m2-<date>`), run one after the other by `pnpm eval rules-noop`; the suite's hook tells them apart by the cell setting `measurement`. The reviewer's role contract expects a dispatch package and tools, so its system prompt adds a short "This review" section: one turn, no tools, findings as `- <file>:<line> [<severity>] <problem>` in the reply. The rules text enters the "with" cells under the section titles `bdk ctx skill` uses (`Rules: <category>`, `Language rules: <language>`); the sha256 of each cell's system prompt is the row's `variantHash`. The judge makes one call per review and answers per seeded violation (found or not) plus `claimed`, the number of distinct problems the review reports, which is the false-positive measure on the clean controls. An M1 majority is strict (more than half of the counted runs); without one the outcome is `MIXED`. The provisional class takes the first that applies: `effective`, `corrects the model`, `no-op candidate`, `unclear`. A probe runs a sample of the items (6 questions, 3 patches with a clean control) and scales its cost to all items. One call is capped at 1 USD.

### D-9 With / without mode

`pnpm eval with-without --skill <plugin:name> --tasks <file> [--fixture none|default]`. The task file is YAML: a list of `{id, prompt, assert}` in promptfoo assertion syntax. The two cells differ only in the plugin copy: with the skill directory, and without it (so a preloaded or model-invoked skill is really absent, which a `skills` filter would not guarantee). Metrics: the task's assertions, cost, turns; the report states per metric whether the difference is measurable.

### D-10 Budget and cost

Cost is the provider's reported `cost` (probe 1). A budget ledger (`evals/.runs/budget.json`) sums the cost of every run of every suite since it was created, so the 100 USD cap covers all of T40. The suite's extension `beforeEach` hook refuses to start a run once the ledger has reached the budget; promptfoo then aborts the series (probe 8), and the harness reports the budget and exits non-zero. Because promptfoo writes its own output only at the end of a series, the `afterEach` hook records the run's cost in the ledger and appends its result row itself, so an aborted series keeps every finished run. Each session carries `max_budget_usd` = the smaller of the budget remaining at series start and a per-run cap (15 USD, `--run-cap`), so the overshoot is bounded by one run. `--probe` runs one run per cell and prints the per-cell cost and the projection for the configured runs per cell; the user approves the full series after seeing it.

### D-11 Results and provenance

Raw outputs stay in `evals/.runs/` (T03 dropped raw data from the tree). Each measured run appends one summary row to `evals/results/<suite>/<series>.jsonl`: metrics, cost, discard reason if any, model ids from the session, fixture commit, BDK commit of the plugin copy, sha256 of the variant SKILL.md, and the `template-hash` values of the run's dispatch packages (P10). Reports are generated from these rows by `pnpm eval report <suite>`, then the decision text is written by hand.

### D-12 CI

The existing `tests.yml` kernel job already runs lint, typecheck and the unit project, which now include `evals/harness/`. One step adds `pnpm eval check`: it installs the tool package, renders every suite config and validates it with the pinned `promptfoo validate`, with no credentials and no model call. Measurement runs stay local (user decision).

## Risks / Trade-offs

- [Opus 5.5 execute sessions are long and expensive; 20 runs may exceed 100 USD] -> the probe measures real cost first; the user approves the series or cuts it (for example drop the A/A pair to 3 + 3), and the budget stop is hard.
- [5 runs is a small sample; the range rule is conservative and may report "no measurable difference" for a real but small effect] -> accepted: T41's question is "no worse", and the conservative rule errs toward that answer only when the arms are genuinely close; the report states the ranges.
- [The thin arm may lose because the kernel's instruction templates are terse, not because thin skills are wrong] -> exit-3 counts and the step where each thin run diverged are reported; T41 decides whether to improve templates and rerun, with the harness unchanged.
- [promptfoo may not load plugin agents or hooks] -> the probe (D-2) switches to the proven `claude -p` provider before any suite is built.
- [Upstream fixture repository deleted or rewritten] -> the harness pins a commit and fails loudly on mismatch; the user can point `versions.json` at a fork with the same commit.
- [No licence on the fixture] -> it is fetched at run time and never committed; committed patches contain self-written code.
- [The v2 arm may fail for environmental reasons (`python3`, `Workflow`)] -> reported as "not runnable" with the cause; the T41 gate does not depend on it.
- [Judge bias: Sonnet 5 judges its own knowledge answers] -> temperature 0, rubric with the bullet text, 10% author spot-check plus every uncertain item; the report lists the spot-check agreement.

## Migration Plan

None for users. `tests/evals/` stays until T32 with a notice; new evals go to `evals/`.

## Open Questions

- The concrete execute feature in the fixture (task group 3 picks it against D-4's criteria and shows it to the user before the reference solution is written).
- Whether the full series fits 100 USD; answered by the probe, then by the user.
