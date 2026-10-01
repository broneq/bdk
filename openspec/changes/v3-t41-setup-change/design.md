## Context

See proposal.md (Why, and the decisions taken with the user on 2026-10-01). Requirements: `specs/stage-skills`, `specs/skill-content-checks`, `specs/skill-evals`.

State the design builds on:

- The kernel already has every command the two skills call. A probe on 2026-10-01 in an empty repository showed that `bdk config set tools.test.vitest '{tier: fast, command: ..., scoped: ...}'` creates `.bdk/settings.yaml` with the modeline, appends the entry addressed by `id` and writes both `.gitignore` paths; `config check` and `doctor` then pass. `change new` binds to the current branch (also `main`) and answers `next: /bdk:design`.
- The v2 `skills/setup/SKILL.md` (227 lines) holds the stack detection table and the scoped-form table (T02 OD-9 (a): this knowledge stays in the skill), but writes `.bdk/settings.yaml` by hand and still plans the v2 directories `.bdk/plans/` and `.bdk/design/`.
- The plugin manifest's `skills` array adds to the default `skills/` scan (plugins reference, Fields: "Adds to the default `skills/` scan"). Today it lists only `./skills/roles/`.
- `kernel/tests/contract/skill-context.test.ts` reads skills only from the top level of `skills/`, so a skill under `skills/stages/` would escape the context-line check.
- The T40 report (`docs/V3-EVAL-EXECUTE-AB.md`, "For T41") decided thin stage skills and named one failure to design against: a thin skill that stopped early because it read a pending gate item as the end of its work.

## Goals / Non-Goals

**Goals:**

- Two thin stage skills that a user can run on a fresh or a v2 project and that end with the command to type next.
- One place that states the stage-skill contract (`specs/stage-skills`), so the next four T41 Changes add a requirement each instead of restating it.
- A `stages` eval suite that later T41 Changes extend with one case file per skill.

**Non-Goals:**

- No kernel command changes. A gap found while writing a skill becomes a `kernel-cli/<group>` delta in this Change, not a workaround in prose.
- No `doctor` tools skill (T42). `setup` runs `bdk doctor`; it does not replace `/bdk:doctor`.
- No measured eval series (decision 5); only `--probe`.

## Decisions

### D1 Stage skills under `skills/stages/`, v2 `setup` removed in the same Change

`skills/stages/<name>/` with `./skills/stages/` added to the manifest's `skills` array (T02 section 13.1, R-2). The v2 `skills/setup/` is deleted in the same commit, because two directories holding a skill named `setup` would make `/bdk:setup` ambiguous.

- Alternative: rewrite `skills/setup/` in place and move all stage skills at T42's layout step. Lost: every later T41 Change would land in the old layout and T42 would move nine skills at once, touching every contract test that names a path.
- Alternative: keep the v2 skill next to the v3 one under another name. Lost: the v2 skill writes a layout the v3 kernel refuses (Q1 hard cut).

The contract tests and `skill-check.config.ts` that enumerate skills read the directories from the manifest (`skills/`, plus every entry of the `skills` array) instead of a hard-coded list, so `skills/stages/` and `skills/roles/` are covered by the same code.

### D2 `setup` writes settings only through `bdk config set`

One `config set` per key: `languages`, each `tools.<group>.<id>` entry as an inline mapping, `features.lavish` when declined. The kernel validates each value against the module registry, keeps the modeline, writes atomically and adds the two `.gitignore` paths (the plan's "`.gitignore` (two paths)").

- Alternative: the skill writes the YAML file and runs `config check` afterwards (v2 behaviour). Lost: the skill must know the modeline URL and the gitignore paths, and a broken file is found only after it was written.
- Alternative: a new `bdk config init` taking the whole document. Lost: a new command for a once-per-project step that `config set` already covers.

The cost is several kernel calls instead of one write, about 50 ms each, once per project.

### D3 Order of `setup`

`bdk doctor --json` first, because its findings decide the path: a v2 layout leads to the migration of D10; an existing v3 layout shows the current settings and changes only what the user names; otherwise detection. Then the Lavish check, then the rules import, then `bdk config check` and `bdk doctor --json` as the closing evidence. The skill reports the tier and scoped forms it derived for each confirmed command in its closing render, so a wrong derivation is visible to the one person who knows the project (kept from v2).

No `bdk export agents` on Claude Code (decision 2).

### D4 Knowledge tables in `references/`

The runner detection table and the scoped-form table move from the v2 skill body to `skills/stages/setup/references/stacks.md`, read with `Read` only when the skill detects a stack. `SKILL.md` keeps the process and stays below 200 lines (S1).

- Alternative: a `file` part in the `ctx skill setup` manifest entry. Lost: the table would be injected on every run, also on a re-run that changes one key or on a v2 import that needs no detection.

### D5 Context lines of the two skills

`setup`'s manifest entry holds the three tool groups (`Project commands: test`, `lint`, `build`), so a re-run shows the current settings without a further call; on a fresh project the parts render empty. `change`'s entry holds no part: its body needs no settings, and the state it acts on comes from the commands it runs (`change status`, `change new`). The context line stays because the stage-skill shape requires it and it carries the `BDK STOP` line when the kernel is unavailable. If the manifest code or the contract test rejects an empty entry, the entry gets the `decision` fragment instead.

Both skills ask with `AskUserQuestion` directly. Their questions are confirmations and choices between a few named options; the Lavish fragment (R-11) is for design-sized decisions and arrives with `design`.

### D6 `change` arguments and the branch question

The first word of the arguments selects the action: `list`, `resume`, `park`, `takeover`; an empty argument is status; anything else is the intent. This keeps `/bdk:change <intent>` as the one form the user types to start, as the design's entry flow writes it.

Before `change new` the skill always asks one question with two options: create `feat/<slug>` (`fix/<slug>` for a bug) or stay on the current branch (decision 1). The slug is the skill's own short kebab-case summary of the intent, because the kernel derives the Change id only inside `change new`, after the branch must exist. The branch is created with `git switch -c`, which carries uncommitted work over. A name that already exists is refused by git; the skill then asks for another name instead of switching to the existing branch.

`allowed-tools` adds `Bash(git switch -c *)`, `Bash(git branch --show-current)` and `Read Grep Glob` for the `tiny` judgment; nothing else of git.

### D7 The `tiny` judgment

The skill reads only what the intent names (the files or symbols it mentions, found with `Grep` and `Glob`) and judges the four items of T20 D-11. It passes `--profile tiny` only with a `--reason` that addresses each item, so the profile assumption entry records why design was skipped. Any doubt leaves the kernel's `small` default; an undersized Change is the expensive error (kernel-cli/change, `change new` Behaviour).

### D8 `stages` eval suite

A new suite next to `execute-ab`, `rules-noop` and `with-without`. One case file per stage skill (`evals/suites/stages/cases/<skill>.yaml`): base (`fixture` or `empty`), optional setup commands run before the session (for example an existing Change for the refusal case), the typed command, scripted answers, and assertions as kernel commands with expected JSON fields. The model words its own questions, so an answer pairs a case-insensitive pattern of the question's header or text with a pattern of the option label; a value no option matches goes in as free text, as "Other" would, and a question no pattern matches gets its first option.

Scripted answers reach `AskUserQuestion` through a `PreToolUse` hook installed in the run's project settings: it returns `permissionDecision: allow` with `updatedInput.answers` set from the case. The SDK treats a filled `answers` field as the user's reply. This is unverified on the harness's Claude Code version and is the first thing the probe checks; if the hook cannot answer, the fallback is a case-level answer appended to the typed command ("answers: ...") and the suite records that the run did not exercise the question.

Assertions read state, not prose, except the refusal case's final reply, which must name a command from `instead`.

### D9 Documentation

`docs/guide/getting-started/setup.md` and `reference/skills.md` describe the v3 `setup` and the new `change`; `reference/artifacts.md` gains the v3 settings and Change paths and marks `.bdk/settings.json` as the v2 file `/bdk:setup` migrates (the v2 directories stay documented while the v2 skills that write them ship, until T42 and T50); README's skill table gains `/bdk:change`. The docs-site drift guards in `pnpm test:contract` decide what else must follow.

### D10 v2 migration as an instruction, not a command

The user decided on 2026-10-01 that `bdk import` is not built. The skill's reference `references/v2-migration.md` tells the model what to do: read `.bdk/settings.json` and offer its commands as the detected ones (the v2 keys `tools.test`, `tools.lint`, `tools.build`, `languages` map onto the same v3 keys, plus a tier from the runner table), import hand-written rules as for any project, and list the v2 files for deletion after a confirmation. Old designs are personal v2 files (they were gitignored), so none is converted into a Change.

- Alternative: the `bdk import` command of the T32 plan (key mapping, design to intent conversion, its own output schema). Lost: a deterministic converter for a step that runs once per project, on a handful of projects, while the model already does the same detection for a project without settings.

The command was a stub that answered `kernel/not-implemented`, so removing it from `schema/cli/commands.json` changes no working behaviour. `doctor`'s `v2-layout` repair, the `config check` `legacy-settings` message and the session-start line now name `/bdk:setup`.

## Risks / Trade-offs

- [The `AskUserQuestion` answer hook does not work headless] → probe first (D8); fallback recorded per run.
- [The model asks questions `setup` must not ask (tiers, profile, sizes)] → the spec's "asks nothing the kernel measures" is an eval assertion on the number and headers of questions in the happy path.
- [`npx -y lavish-axi --help` needs the network and can take seconds] → one call, with the answer "not available" treated as a declined install offer when it times out.
- [A user with uncommitted work answers "create branch"] → `git switch -c` keeps the work on the new branch; the closing render names the branch.
- [Deleting `skills/setup/` breaks v2 users mid-migration] → the v3 `setup` migrates the v2 layout itself (D10); v2 is a hard cut (Q1).

## Migration Plan

One PR into `staging/v3`. The skill-check baseline loses the entries of `skills/setup/` (`pnpm skill-check --baseline-prune`). Rollback is a revert of the PR; no state format changes.
