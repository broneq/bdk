# Design

## Context

See proposal.md, Why. State the design starts from:

- The `rules` slice registers eight commands. `export` (`use-cases/export.ts`, `domain/projection.ts`) writes the projection; `accept` and `import` call its `regenerate`, and `health.ts` calls its `projectionDrift` for `doctor`. `import` (`use-cases/import.ts`, `domain/import.ts`) shares the writer helpers of `use-cases/write.ts` with `accept`.
- `domain/projection.ts` also holds `ruleLine`, which `use-cases/context.ts` uses to print rule lists for `ctx`. `isProjection` is used by `import` and `health.ts` to skip the generated files.
- `doctor` (`service/use-cases/doctor.ts`) turns `ruleHealth` into three findings: `rule-without-id`, `rules-invalid`, `projection-outdated`.
- `policy/generated-drift` has two emitters: `rules export --check` and `export agents --check`.
- The rule schema (`shared/store/state/rule.ts`) accepts `origin: bdk | import | user | <changeId>/<id>`.
- BDK's own repository holds 13 rules under `.bdk/rules/` (T50): `SKILLS-1..7` and `PROMPTS-1..5` with `applies: [skills/**, agents/**]`, and the global `REPO-1`. They reach a developing session only through the projection. `kernel/tests/contract/repo-rules.test.ts` allows nothing else under `.claude/rules/`.
- T31 design D-7 and D-8 introduced the projection and the import. This change reverses both.

## Goals / Non-Goals

**Goals:**

- BDK never reads, writes or reports a file under `.claude/rules/`.
- A project rule exists only because a user adopted it with `bdk rules accept`.
- BDK's own development rules load in the session that develops BDK, without BDK machinery.

**Non-Goals:**

- A redesigned import (#153). This change closes #153 by removal. A new design, if one is wanted, gets its own issue.
- Showing BDK project rules to the interactive main session (#152, open question). Project rules reach the main session where they already do: the `project-rules` context part of `create-plan` and `design`.
- Changes to selection, `rules.warn-above`, `show`, `explain`, `prune` or `stats`.

## Decisions

### D-1 Remove both commands; do not repair them

Export and import are removed together. Export writes what import read, so either one alone keeps half of the loop: an import without the projection leaves the source files as a second copy, and an export without the import still writes BDK output into a directory the project owns.

- Alternative: keep export, but write only project rules that were adopted (not imported). Lost: it still writes into `.claude/rules/`, still needs drift checks in `close`, `doctor` and CI, and the main session already gets the project rules where they matter (`project-rules` part).
- Alternative: keep import and redesign it now (interactive review, glob narrowing, classification). Lost (user, 2026-10-06): #153 lists seven open design questions. Removing the command now stops more projects from running it. A redesign starts from zero in its own issue.

### D-2 No backward compatibility for `origin: import`

`import` leaves the `origin` enum. A rule file that carries it fails `rules check` with `policy/rule-format`, like any other schema problem, and `doctor` reports `rules-invalid`.

- Alternative: keep `import` as an accepted legacy value. Lost (user): v3 is unreleased, and a value no writer produces is dead schema.
- Alternative: rewrite `origin: import` to `user` automatically. Lost: the kernel writes a rule only through `accept`, and a silent rewrite of hundreds of files is the kind of side effect #152 is about.

### D-3 No notice for leftover projection files

`doctor` does not detect `bdk-generated*.md` files. They are plain Markdown that Claude Code keeps loading until the user deletes them. The user guide's migration note names them.

- Alternative: a one-time `doctor` finding found by the generated-file marker. Lost (user): it keeps knowledge of a removed feature in the kernel for good.

### D-4 `doctor` looks only at `.bdk/rules/`

The rule check runs when `.bdk/rules/` exists, and `isProjection` and `carriesId` go with `rule-without-id`. `ruleHealth` keeps one job: the `rules check` answer for `doctor`, so `rules-invalid` keeps the same wording as the command.

- Alternative: keep `rule-without-id` with a new repair (`bdk rules accept`). Lost: a hand-written `.claude/rules/` file is a valid Claude Code rule, not a BDK defect. Reporting it pushes the user to duplicate rules.

### D-5 `ruleLine` moves next to its only caller

`ruleLine` (`- [<id>] <text>`, ` (applies: ...)` after a scoped rule) moves from `domain/projection.ts` into the rules slice's domain under a name that is not about projection (for example `domain/rule.ts`). Its output does not change, so the `ctx` rule lists and their template hashes stay the same. `domain/projection.ts` is deleted.

### D-6 `policy/generated-drift` stays

`export agents --check` still emits it. Only its emitter list and its `why` description in `kernel-cli` change.

### D-7 BDK's repository rules return to `.claude/rules/`

The 13 rules become three hand-written files, grouped by the prefix they had:

| File                       | `paths:`                 | Rules                      |
| -------------------------- | ------------------------ | -------------------------- |
| `.claude/rules/skills.md`  | `skills/**`, `agents/**` | the seven `SKILLS-*` texts |
| `.claude/rules/prompts.md` | `skills/**`, `agents/**` | the five `PROMPTS-*` texts |
| `.claude/rules/repo.md`    | none                     | `REPO-1`                   |

Each rule stays one bullet, with its text unchanged and its id dropped: nothing resolves an id outside `.bdk/rules/`. `.bdk/rules/` and the two projection files are deleted. `repo-rules.test.ts` is deleted, since what it enforced (only the projection under `.claude/rules/`) no longer exists. The admission test stays in the `plugin-tooling` requirement and in `CONTRIBUTING.md`. `.bdk/.prettierrc` stays: the kernel creates it again on the next `change new` or `config set`, so deleting it would only cause churn.

- Alternative: keep the rules in `.bdk/rules/`. Lost (user): only BDK agents running inside this repository would see them, and the sessions that edit skills would not.
- Alternative: restore the eight pre-T50 files. Lost: T50 moved their definitions into specs and `CONTRIBUTING.md` on purpose, and only the 13 admitted rules are rules.

### D-8 Contract and generated files

The command index loses `rules-export` and `rules-import`. `schema/cli/output/rules-export.json` and `rules-import.json` go, and `rules-accept.json` loses `projection`. All three are generated by `pnpm build` from the Zod schemas, so the change edits the schemas and rebuilds. If the CLI contract test finds `bdk rules import` or `bdk rules export` mentioned in the design or plan documents it scans, the mention goes into its allowlist with the reason "removed by v3-152-remove-rules-export-import", as `import` was for v3-t41.

### D-9 Purpose texts are edited in place

A delta cannot change a `## Purpose`. The purposes of `kernel-cli/rules` (it lists `import` and `export` as writers) and `kernel-cli/export` (it names `rules export`) are edited directly in `openspec/specs/`, in the same PR.

### D-10 Mentions of `.claude/rules/` that stay

Three kinds of mention survive the removal, because none of them couples BDK to the directory:

- `change close` writes nothing under `.claude/rules/`: the `close proposes no rule` scenario of `kernel-cli/change` and its check in `kernel/src/change/tests/close.test.ts`. It is a negative guard, and it now backs the goal that BDK never writes the directory.
- The hook path check scans the repository's own `.claude/rules/` (`kernel/tests/docs/hook-references.test.ts`, `docs-site` spec). It concerns BDK's development files, which come back as hand-written files (D-7).
- `rule-pack` requires that the repository's `.claude/rules/` holds no `quality-rules.md`. It concerns the repository too, and the new layout of D-7 meets it.

- Alternative: remove every mention of `.claude/rules/` from specs and tests. Lost: the first would drop a guard that the change wants, and the other two describe the repository, not the product.

## Risks / Trade-offs

- [A project that ran the import now fails `rules check` on every imported file] -> intended (D-2). The `rules-invalid` finding names the first file, and the user guide's migration note says to set `origin: user` or delete the file.
- [Leftover `bdk-generated*.md` files keep loading in Claude Code after the upgrade] -> the migration note names them. They no longer change, so they are stale, not growing.
- [Project rules adopted with `accept` no longer reach the main session through Claude Code] -> the main session does not write code in a BDK pipeline (T31 D-7 alternatives, P9), and `create-plan` and `design` read them through the `project-rules` part. A need beyond that is the open question of #152, for its own issue.
- [BDK's repository rules lose their ids, so a review finding cannot cite them] -> no BDK agent reads them by id: the repository runs no BDK pipeline on itself (`REPO-1`).

## Migration Plan

1. Kernel: remove the commands, the projection and the import code; slim `accept`, `health.ts`, `doctor`; drop `import` from the `origin` enum; update `known.ts`; regenerate `schema/` and `dist/` with `pnpm build`.
2. Tests: delete the tests of removed behaviour, update fixtures that carry `origin: import`, add the scenarios of the deltas.
3. Skills and README: `setup`, `close`, `rules`, `doctor`.
4. Repository: write the three `.claude/rules/` files, delete `.bdk/rules/` and the projection, update `CLAUDE.md` and `CONTRIBUTING.md`, delete `repo-rules.test.ts`.
5. Docs: the user guide pages, with a migration note for projects that ran the import, and the docs-sync map; edit the two Purpose texts (D-9).

Rollback: the change lands as one PR into `staging/v3`; reverting it restores the commands, the schema value and the repository layout together.
