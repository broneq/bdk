# Design

## Context

See proposal.md - Why. The host scans the default `skills/` directory in addition to the `skills` array of `plugin.json`. The manifest key "adds to the default" (plugins reference, How each key combines with its default location). So the v2 skills under `skills/` load today next to the v3 ones, and moving a skill means deleting its old directory as well.

The kernel already has every command these skills need. `rules check|show|explain|prune|import|stats|export|accept` come from T31. `doctor [--fix]` comes from T11 and T12. `log add learning --applies` and `log show <qualified id>` come from T20 and T31. No kernel command changes in this Change.

A skill gets its settings-derived context only from `bdk ctx skill <name>`. The set of skills with context lines must equal the keys of `SKILL_CONTEXT` in `kernel/src/ctx/use-cases/manifest.ts` (`.claude/rules/skill-context.md`, enforced by `skill-context.test.ts`).

## Goals / Non-Goals

**Goals:**

- Six tools skills, each a thin layer over kernel commands or a short process the model would not follow on its own.
- One source for each piece of knowledge:
  - the rule definition stays in `rules/README.md`;
  - the MADR template sits in `adr`;
  - the document shape sits in `docs`.

**Non-Goals:**

- New kernel commands. A `rules remove` that writes the tombstone is a possible later addition (see D7).
- The `bdk-craft` skills and the removal of `debug`, `test-driven-development` and `mermaid-drawer` (`v3-t42-craft`).
- `skills/swarm/`: it is an internal skill of the stages (T23-D6), not in the tools list, and stays where it is.

## Decisions

### D1. `commit` is BDK's own skill

`/bdk:commit` writes the message itself. It reads the project's convention: commitlint, then `CONTRIBUTING.md`, then the recent subjects.

Alternatives:

- **Keep delegating to `/caveman:caveman-commit`.** A user without that plugin gets nothing, and `skill-check` flags the foreign namespace (the baseline entry `namespaced-refs`).
- **Own logic, with delegation when caveman is installed.** Two behaviours for one command.

The user chose the own skill on 2026-10-04.

Inside a Change, tasks and review fixes are committed by `bdk commit`, with trailers and the diff check. `/bdk:commit` is for the user's own commits, so it adds no trailer. A commit made outside the pipeline on a Change branch is already allowed: main-thread git stays the user's (`kernel-cli/commit`, T3).

### D2. `hooks skill-exists` stays without a current user

`commit` was its only caller. The command is the documented way for a skill to declare that it needs another skill (`.claude/rules/skills.md`), it is small, and its spec and tests are generic.

Alternative: remove the command, its schema and its tests. That deletes a mechanism `bdk-craft` or a later skill may need, to save little code. `.claude/rules/skills.md` keeps the mechanism but drops the pointer to `skills/commit/SKILL.md` as its example.

### D3. `docs`: one skill, mode from the argument, reading in the main thread

The argument decides the mode:

- an existing `.md` file means refresh;
- anything else is a code path to document.

This keeps one entry, as OD-13 (b) decided, without a mode flag the user must remember.

The skill reads the code in the main thread. For a module above about 30 files it proposes documenting a narrower part instead.

Alternatives:

- **Parallel subagents (v2).** v3 has no general-purpose explorer agent: the `scout` adapter follows a role contract, a fork answers in at most 15 lines, and forks run one at a time. Splitting the reading gains no time and loses the detail the document needs.
- **The host's built-in agents.** Not portable, and outside BDK's adapter set.

### D4. `docs` drops the v2 `Stop` prompt hooks

Both v2 skills ended with a prompt hook that asked a model to verify the sections. In v3 the document shape is a checklist in the skill's reference file, and the body ends with "Done when the document has every section of the shape".

Alternative: keep the hooks. Each one costs a model call at every end of turn while the skill is active, and fires on turns that are not the end of the document.

### D5. `docs` writes to `docs/architecture/<module>.md` by default

v2 wrote under `.bdk/explain-complex-code/`. In v3, `.bdk/` holds kernel state and Change directories only (`kernel-state`, Write map). Documentation is a project file. Any other path the user names is taken as given.

### D6. `rules`: modes `audit`, `capture`, `check`

T31 settled the funnel:

- a lesson is a `learning` entry;
- `rules stats` is the audit view;
- `rules accept` is the only adoption;
- there is no `rules add` and no `log route`.

So the modes follow the funnel and not section 4.2's `add` and `refine`, which predate R-3. The v2 references go:

- `rule-admission.md`: the definition is now `rules/README.md`, which the skill cites instead of copying;
- `uniform-rule-format.md`: the rule file schema, which `bdk rules check` enforces;
- the Python linter: OD-11 (a), already ported as `bdk rules check`.

`audit` is the default because it is the step only a model can do: grouping entries by meaning (`kernel-cli/rules`, bdk rules stats). Proposals go through the `Asking the user` section, so the user picks with Lavish or `AskUserQuestion` per `features.lavish`.

### D7. A rule removal is an approved edit, not a new command

`rules prune` only reports, and its spec says removal is a manual edit that sets `removed` and leaves a tombstone. The skill makes that edit after the user approves each removal, then runs `rules check` and `rules export --claude`. Its `allowed-tools` grant `Edit`.

Alternatives:

- **The skill only tells the user what to edit.** That leaves the work the skill exists to do.
- **A kernel `rules remove`.** It would stamp `removed` mechanically. It is a kernel change outside this Change's scope, and can come later without changing the skill's contract.

### D8. `adr`: one skill, two inputs

The user chose this on 2026-10-04. The input is either a decision entry id (bare or qualified) or a free-form decision. For an entry, the skill reads it with `bdk log show`. `design` keeps recording decisions as entries and does not export ADRs itself, so the MADR template has one home.

Alternative: an exporter inside `design` plus a separate stateless `adr`. That puts two copies of the template, or a shared fragment, in two skills, for no behaviour the user asked for.

### D9. `doctor` repairs in two tiers

`--fix` repairs need no system change (the schema copy, the modeline), so they run first without a question. The kernel and BDK repairs are offered one by one. System changes run only with the user's yes for that exact command.

`doctor` is user-only (`disable-model-invocation`, R-14). `/bdk:setup` already ends with its own `doctor` pass and does not call this skill.

### D10. `bdk-cli` has no context lines

It is a skill that fronts a CLI (R-13, the kit's `cli-front` rule): at most 30 lines, with `--help` as the only reference. Context lines would add a kernel call and a manifest entry to a pointer. `metadata.fronts-cli` is `bdk`, the command name. Until T52 adds `bin/bdk`, the skill states the full `node` form.

### D11. Manifest entries

| Skill    | `SKILL_CONTEXT` parts                                                       |
| -------- | --------------------------------------------------------------------------- |
| `commit` | none; the context lines give only the `BDK STOP` when the kernel is missing |
| `docs`   | none                                                                        |
| `rules`  | `decision`, for the proposals                                               |
| `adr`    | `rules("architecture")`, as `create-adr` had                                |
| `doctor` | none                                                                        |

The entries for `create-adr` leave. The entries for `debug` and `test-driven-development` stay until `v3-t42-craft`.

### D12. Tests

A new contract file `kernel/tests/contract/tools-skills.test.ts` checks the scenarios of the `tools-skills` spec, as `review-skills.test.ts` does for `cr` and `pr-review`. The checks that already exist keep covering the context lines, the manifest and the content rules: `skill-context.test.ts` and `pnpm skill-check`.

The removed Python scripts take their pytest files with them. The legacy evals of the removed skills under `tests/evals/skills/` go with their skills; T32 deletes the rest of that directory.

### D13. Measurement

`commit`, `rules`, `doctor` and `bdk-cli` are wiring over kernel commands. A with-without measurement would measure the kernel. `docs` and `adr` carry knowledge: the document shape and the MADR template. They are measured with a probe of `pnpm eval with-without` only after the user approves the spend (CLAUDE.md, Adding a New Skill). Without that approval the task stays open and is reported as such.

## Risks / Trade-offs

- **[Skill names change for users]** The old names stop working. Mitigation: the Removed skills table in `README.md` names each replacement, and the 3.0 release notes (T50) list them.
- **[Main-thread reading in `docs` uses context on large modules]** Mitigation: the 30-file threshold proposes a narrower part.
- **[`rules` edits rule files]** The kernel's write map names only `accept` and `import` as rule writers. Mitigation: the edit is limited to setting `removed` on a rule the user approved, and is followed by `rules check`, which refuses a malformed file.
- **[`hooks skill-exists` without a caller]** Mitigation: its tests keep it working, and D2 records why it stays.
