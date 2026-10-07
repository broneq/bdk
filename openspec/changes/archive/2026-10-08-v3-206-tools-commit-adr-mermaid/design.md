# Design

## Context

- `plugins/bdk/` holds the CLI slices (#178-#188), the hooks (#182), the rule pack (#184), the BDK OpenSpec schema (#180) and one skill, `setup` (#181). Its eval suite (#189, spec `skill-evals`) runs cases under `plugins/bdk/evals/<block>-<case>/` with `claude plugin eval`, and PR CI loads every case for free.
- `plugins/bdk-craft/` (#207) already ships `mermaid-drawer`, admitted on three cases with a mean `Δ` of +0.41 (`plugins/bdk-craft/evals/RESULTS.md`).
- Input material, read and not copied: v2 `skills/commit` (a one-line delegation to `/caveman:caveman-commit`, with a hook that checks that skill exists) and `skills/create-adr` (MADR template, Python rule injection, always asks the status) on `main`; `draft/v3-1:skills/tools/commit` and `skills/tools/adr` with the draft design `openspec/changes/archive/2026-10-04-v3-t42-tools/design.md` (D1, D8) and the draft probe `evals/suites/with-without/examples/adr.yaml`. The draft skills started with `bdk ctx skill <name>`, a kernel call that no longer exists; the draft `adr` read decisions from `bdk log show`, a store that v3 does not have. In v3 a decision is a `### D<N>.` section of a Change's `design.md` (BDK schema template `plugins/bdk/openspec/schemas/bdk/templates/design.md`).
- Host facts for the eval cases (plugin-eval docs, #189 README): `regex` graders over the `trace` with `match: not_contains` and `count:N`; `file_exists` takes a glob and sees only files created during the run; Claude Code switches off git hooks in every run; Bash runs in the OS sandbox and needs the clean-`HOME` workaround on a Mac with Docker Desktop; the scaffold's `HOME` is empty, so the git identity goes into the repository's own config.
- The architecture says every BDK skill starts with a `!` block running `bdk config show` (design "Configuration and extension points").

## Goals / Non-Goals

**Goals:**

- `/bdk:commit` and `/bdk:adr` as plain skills that work in any git project, with or without a BDK configuration.
- Eval cases first, then the skill text with `/skill-creator`, then a with/without run whose numbers are recorded here.
- `/bdk:close` (#202) can compose `commit` by calling it with an argument.

**Non-Goals:**

- A `bdk` command for either tool: no eval or measurement shows a problem a command would solve (CLAUDE.md "Building skills (v3)").
- `add-rule`, `refine-rules` (issue, "Out of scope").
- Diagram guidance for the design stage (#190).

## Decisions

### D1. `mermaid-drawer` stays in `bdk-craft`; no copy in `bdk`

The issue lists `mermaid-drawer` among the tools to bring back. #207 already brought it back as a craft skill, with three eval cases and an admission record, which is this issue's acceptance signal ("Each tool has an eval case"). The architecture places craft knowledge in `bdk-craft` (design "Plugins"), and a diagram standard is knowledge, not a step of a BDK flow.

- _A second `mermaid-drawer` in `plugins/bdk/skills/`:_ two sources of the same palette and node budget that drift apart, two skills with the same description competing in a session that loads both plugins, and three more paid cases to measure the same text. Lost.
- _Move it from `bdk-craft` into `bdk`:_ undoes #207's admitted placement, and a user who installs only `bdk-craft` loses it. Lost.

`adr` keeps one line of diagram guidance of its own (D6), because plugins never import from each other (ADR-0002) and `bdk` must work without `bdk-craft`.

### D2. Tools read no configuration and carry no `!` block

Neither tool reads a BDK setting: `commit` reads the project's commit convention, `adr` the project's ADR directory. The architecture's rule that every skill starts with `bdk config show` exists so that a skill that reads the configuration gets it before its first turn, and stops when it is missing. Applied to a tool, it would make `/bdk:commit` refuse to commit in a project that never ran `/bdk:setup`, for nothing it reads. The sentence in "Configuration and extension points" is narrowed to "Every BDK skill that reads the configuration".

- _Follow the sentence as written:_ a stop for no reason, an extra Bash call per use, and a `Bash(bdk *)` grant; in eval runs the bare `bdk` is not on `PATH` (#189). Lost.
- _A `!` block that prints the configuration but never stops:_ injects text the skill never uses. Lost.

### D3. `commit`: the project's convention first, Conventional Commits as the default

The skill reads the convention in this order and takes the first source that states one: a commitlint configuration (`commitlint.config.*`, `.commitlintrc*`, `commitlint` in `package.json`), the commit section of `CONTRIBUTING.md`, then the last 20 subjects of `git log`. Without any, it writes Conventional Commits. A limit the project sets (types, scopes, header length, case) wins over every default. The draft (D1 of v3-t42-tools) chose the same order; v2 delegated to another plugin, which a user without that plugin did not have.

- _Conventional Commits only:_ breaks every project with its own types or scopes, the case where a commit hook rejects the agent's message. Lost.
- _Delegate to `/caveman:caveman-commit` as v2:_ a dependency on another plugin. Lost.

### D4. `commit`: the skill picks what to stage when nothing is staged, and never asks for it

- Something staged: commit exactly that, and name what is left unstaged.
- An argument naming paths or a scope: stage only those.
- Nothing staged and no argument: stage the tracked changes and the new files that belong to them (imported or referenced by the changed code, or their tests). Never stage a file that looks like a secret or a local artefact (`.env*`, keys and certificates, credentials, logs, editor and OS files, build output); list it in the report.
- When the files the skill picked hold unrelated changes, it makes one commit per concern, staging by path. What the user staged is never split.

The skill decides instead of asking, so a commit costs no turn of the user (problem 1 of v3, speed), and the report says what went in and what was left out. A local commit is undone with one `git reset --soft HEAD~1`, which the report does not need to teach.

- _Ask which files to stage (draft):_ a turn of the user on every unstaged commit, and in `claude -p` and evals no answer at all. Lost.
- _`git add -A`:_ commits secrets and local artefacts. Lost.
- _One commit for everything:_ mixes a docs fix into a bug fix, which a reviewer and `git revert` then have to untangle. Lost.

### D5. `commit`: no agent attribution unless the convention has one; hooks are never bypassed; nothing is pushed

- The message gets no `Co-Authored-By` or tool line unless the project's convention shows one (commitlint rule, `CONTRIBUTING.md`, or such trailers in recent history). A commit message is the project's record; the convention decides its shape, as for every other part of the message.
- Never `--no-verify`, never `--amend` unless asked, never `push`. When a hook rejects the message, the skill fixes the message and commits again; when it rejects for another reason (lint, tests), it reports the output and stops.

- _Defer attribution to the host's default:_ the host appends its own trailer to every agent commit, whatever the project does, so the message would not follow the convention the skill just read. Lost.

### D6. `adr`: the project's ADR home and format first, MADR as the default

- **Where:** an existing ADR directory (`.adr-dir` of adr-tools, then `docs/adr/`, `doc/adr/`, `docs/decisions/`, `docs/architecture/decisions/`, `doc/architecture/decisions/`, `adr/`, or any directory holding `NNNN-*.md` records); `docs/adr/` when there is none.
- **Format:** the existing records' sections, status style, title style and number width win. Without records, the MADR template in `references/madr-template.md` (v2 and the draft used MADR; the draft probe showed the plain model does not write its sections, markers and `{TBD}` placeholders without it).
- **Number:** one above the highest existing number.
- **Diagram:** only when the options differ in structure or data flow; one `mermaid` block of at most 15 nodes with labelled edges and no colour, so it reads in any renderer without a palette (D1).
- Writes the record and, when superseding, one status line in the old record (D8). Never commits.

- _Always MADR under `docs/adr/`:_ a second ADR format and directory in a project that already has one. Lost.

### D7. `adr`: two inputs, a free-form decision or a Change's decision

- **Free-form text:** the problem, the options, the drivers and the choice are taken from it.
- **A Change's decision:** `<change>/D<N>` or a sentence naming them ("decision D2 of add-export"). The skill reads `openspec/changes/<change>/design.md`, or the archived `openspec/changes/archive/*-<change>/design.md`, takes the `### D<N>.` section: its choice is the outcome, its alternatives are the other considered options with the reasons they lost as their cons, and "More Information" links the `design.md`. This replaces the draft's `bdk log show` input; the draft (D8 of v3-t42-tools) kept one skill for both inputs, and so does v3.
- **Status:** from the input when it states one; `accepted` for a decision of an archived Change (it shipped); `proposed` for one of an active Change. Otherwise the skill asks in one `AskUserQuestion`, together with anything else it cannot take from the input; when it cannot ask, it writes `proposed` and says so. The people fields stay `{TBD}` unless the input names them.

- _Always ask the status (v2, draft):_ a question whose answer the Change's state already gives. Lost.

### D8. `adr`: a decision that replaces a recorded one supersedes it

When the new decision replaces an existing record (the input says so, or an accepted record decides the same question the other way), the new record says "Supersedes ADR-NNNN" in "More Information" and the old record's status becomes `superseded by ADR-<new>` in the old record's own status style. Nothing else in the old record changes. An ADR log where two accepted records contradict each other misleads the next reader, which is the failure an ADR exists to prevent.

- _Write only the new file (draft):_ leaves two accepted records for one question. Lost.

### D9. Eval cases: three per tool, behaviour graders, `block` tag

Following `skill-evals` and #207 D4: prompts as a user types them, never naming the skill; graders on what the skill changes, never on its own wording; one `tool_used: Skill` indicator per case.

| Case | Workspace | What the graders check |
|---|---|---|
| `commit-commitlint-types` | staged change in `src/billing/`; `commitlint.config.mjs` with its own types, scopes and a 50 character header | the committed header uses an allowed type and the `billing` scope within 50 characters; no `Co-Authored-By` |
| `commit-unstaged-secrets` | nothing staged; a modified file importing a new file and its new test; untracked `.env.local` and `debug.log` | the new file and its test were staged; no `git add` of `-A`, `.`, `--all`, `.env.local` or `debug.log`; a commit ran without `Co-Authored-By`; the reply names what was left out |
| `commit-unrelated-changes` | nothing staged; a README typo fix and an unrelated bug fix in `src/` | a `docs` commit and a `fix` commit; no `Co-Authored-By` |
| `adr-fresh-madr` | no ADR directory; free-form decision with its status | `docs/adr/0001-*.md` created; MADR sections, pros and cons markers, `{TBD}` |
| `adr-supersede-house-format` | `doc/decisions/` with seven Nygard-style records, `0004` accepting polling | `doc/decisions/0008-*.md` created in the house sections; `0004` edited to superseded |
| `adr-from-change` | an archived Change whose `design.md` has `### D2.` with two alternatives | `docs/adr/0001-*.md` created; status `accepted`; both alternatives as options; the `design.md` linked |

Commit cases grant `Bash(git *)`; ADR cases need only `Write` and `Edit`. The free CI check grants `Write Edit` only, and a `tool_used` or `tool_order` grader on `Bash` is reported there as "cannot pass", so commit graders are `regex` graders: on the files `.git/COMMIT_EDITMSG` and `.git/logs/HEAD` for what was committed (the scaffolds clear both, so only the run's commits count), and on the `trace` for the `git add` calls. The `tool_used: Skill` indicator is the step grader of each case.

Measured while writing the cases (probe, Claude Code 2.1.292): on macOS the `/usr/bin/git` shim fails inside the Bash sandbox (`xcrun` cannot write its cache), and the sandbox hides `/Library/Developer` from `PATH` lookup, so paid commit runs set `CLAUDE_CODE_SHELL_PREFIX` to `plugins/bdk/evals/macos-git-prefix.sh`, which defines `git` as the Command Line Tools binary by its full path (eval README).

## Risks / Trade-offs

- [A plain model already writes good commit messages, so `Δ` may be small] -> the cases target what the skill decides differently (house convention, staging, splitting, attribution); the record keeps the numbers whatever they show, and a tool with no effect on any case is reported in the PR as such.
- [Git hooks are off in eval runs, so "never bypass hooks" is not measured] -> stated in the skill and the spec; checked by hand in the separate test project (task 3.1, see Outcome).
- [Heuristic secret detection misses an unusual file name] -> the report lists every untracked file left out and every file that went in, so the user sees the staging.
- [Supersede detection from content can mark the wrong record] -> only when the input says so or an accepted record decides the same question the other way; the report names the edited record.

## Outcome

Measured on 2026-10-08 with the pinned Claude Code 2.1.292, agent `claude-opus-5-5`, judge `claude-sonnet-5-5`, 3 runs per arm (with `bdk`, without any plugin), 5.34 USD (2.40 commit, 2.94 ADR), from `plugins/bdk/`:

```bash
CLAUDE_CODE_SHELL_PREFIX=/Users/Shared/bdk-eval/macos-git-prefix.sh HOME=<clean home> \
  claude plugin eval . --scaffold --allow-tools Write Edit "Bash(git *)" \
  --model claude-opus-5-5 --judge-model claude-sonnet-5-5 --runs 3 --case '<tool>-*'
```

| Case | WITH | W/OUT | Δ | Fired |
|---|---|---|---|---|
| `commit-commitlint-types` | 1.00 | 0.50 | +0.50 | 3/3 |
| `commit-unrelated-changes` | 1.00 | 0.67 | +0.33 | 3/3 |
| `commit-unstaged-secrets` | 1.00 | 0.83 | +0.17 | 3/3 |
| `adr-fresh-madr` | 1.00 | 0.50 | +0.50 | 3/3 |
| `adr-from-change` | 1.00 | 0.75 | +0.25 | 3/3 |
| `adr-supersede-house-format` | 1.00 | 1.00 | +0.00 | 3/3 |

Mean `Δ`: `commit` +0.33, `adr` +0.25. Both skills fired in every with-arm run, and every with-arm run passed every grader.

What the runs showed:

- A plain Opus already reads commitlint, splits unrelated changes, stages by name and keeps `.env.local` and `debug.log` out. Without the skill every commit carried the host's `Co-Authored-By` trailer, which no project convention in the cases asked for; that grader is the whole `commit` difference. The skill also makes the order of work fixed (status, convention, message, commit, confirm), which `/bdk:close` composes.
- Without the skill, a fresh project gets a MADR-like record with "Good, because" and no people fields, and a Change's decision gets a Nygard-style record with "Alternatives considered"; with it, both get the MADR shape of `references/madr-template.md`.
- `adr-supersede-house-format` shows no difference: a plain Opus already follows the house format, numbers the record 8 and marks record 4 superseded. The case stays as a regression check of the supersede rule (D8).
- Probe findings before the measured run: graders on `git commit`'s `[main <sha>]` line missed commits made with `-q`, so the commit graders read `.git/COMMIT_EDITMSG` and `.git/logs/HEAD`, which the scaffolds clear; graders that required the `Read` tool for a file failed a plain agent that used `cat`, so they were dropped. The git workaround (`plugins/bdk/evals/macos-git-prefix.sh`) and its reason are in "Host limits" of the eval README.
- In a separate test project (`claude -p --plugin-dir`), a failing `pre-commit` hook stopped the commit: the skill reported the hook output and did not retry with `--no-verify`. `/bdk:adr add-export/D1` on an active Change wrote status `proposed` and said so.
