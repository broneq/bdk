# Design

## Context

The `bdk` CLI frame, the slice architecture and its lint exist (v3-178, spec `bdk-cli`); no product slice does. This Change adds the `git` slice, the first or one of the first: #179 (`config`), #187 (`findings`) and #188 (`run`) add theirs in parallel and touch the same shared spots (`src/slices.ts`, `src/main.ts`, `src/shared/`, `package.json`).

Input: architecture "Review round" (the lead calls `bdk git groups`, scope since the last round), "Run state, run artifacts and resume" (`review/round-N/` under `.bdk/runs/<change>/`, a round directory without `report.md` is a crashed round), "CLI" (`bdk git groups`, `scope`), and draft 1 `kernel-cli/review` "bdk review plan", whose grouping rules held up in run B1 and are taken over. What draft 1 needed and v3 drops: the ledger as the store of the last round, the active Change, the Change base derived from `change.md`, `.bdk/` exclusion, and `measure`.

## Goals / Non-Goals

**Goals:**

- One call gives the lead the range and the reviewer groups of a round; same repository state, same groups (issue acceptance signal).
- A later round covers only what changed since the last finished round, so a round of two fixes does not review the whole branch again (findings, "Review reruns everything every round").
- Every rule runs in unit tests without git or a file system.

**Non-Goals:**

- No review skill, no reviewer prompt, no judge. The callers come with their own issues.
- No configuration read. `bdk config` (#179) is not merged; the target is a flag (D6).
- No line counts or "measure" of the range: no caller needs them yet.

## Decisions

### D1. Two commands, one slice `git`

`bdk git scope <base> [--rounds <dir>]` and `bdk git groups <base> [--rounds <dir>] [--plan <dir>] [--max-files <n>] [--record <round-dir>]`, as named in the architecture "CLI" table. `groups` prints the whole scope result plus `groups`, so the lead needs one call per round; `scope` exists for callers that want the range without groups (an E2E or check run scoped to the fixes).

Layout per `bdk-cli` "Slice anatomy": `commands/{scope,groups}.ts`, `use-cases/{scope,groups}.ts` plus `use-cases/deps.ts` (the injected OS interface, which needs the `Files` type of `shared/fs` and so cannot sit in `domain/`), `domain/` (pure rules: `range.ts` for git output parsing and round choice, `pack.ts` for module packing, `groups.ts` for part grouping, `plan.ts` for frontmatter parsing), `store/` (the slice's own files: `rounds.ts` reads and writes the round records, `plan.ts` reads the plan parts), `render/{scope,groups}.ts`, `schema/{scope,groups}.ts`, `tests/`. The `groups` use case calls the `scope` use case and `schema/groups.ts` extends `schema/scope.ts`: imports inside one layer of one slice are allowed by the architecture lint, and the groups result is the scope result plus `groups` by definition.

Alternatives: one command `bdk git groups` with the scope inside (lost: the architecture names both, and a scope-only caller would get groups it ignores); a slice named `review` like draft 1 (lost: the architecture names the group `git`, and review is the skills' business, not the CLI's).

### D2. The base is a required argument, not a derived "Change base"

The first round's anchor is `git merge-base HEAD <base>`; `<base>` is a required positional argument, the branch the work will merge into (`staging/v3`, `main`, the PR base). Draft 1 derived a "Change base" from the commit that added `change.md` and a stamped base for review Changes; that needed the ledger and an active Change, both gone in v3 (ADR-0003, principle 6). The lead and `/bdk:pr-review` know the base branch: the run's branch was created from it, and a PR names it. A stacked branch passes its parent branch, which is what draft 1's `--base` did.

Alternative: default `<base>` to `origin/HEAD` or `main`. Lost: a wrong guess silently reviews the wrong range; the frame turns a missing argument into `usage/missing-argument` with a hint, which is cheaper than a wrong round.

### D3. The round record (issue: "How the last round's commit is recorded")

The lead calls `bdk git groups ... --record <run>/review/round-N` when it starts round N. The command writes its full JSON result to `round-N/groups.json`; its `head` is the commit the round reviewed. The next call with `--rounds <run>/review` takes the finished round with the highest `N` (one whose directory holds `report.md`, written by the judge at the end of the round) and anchors at its `head`.

- **Why the start-of-round head.** Fix commits land after the reviewers read the code; the next round must cover exactly those commits, so the anchor is what the last round looked at, not the head at its end.
- **Why `report.md` marks a finished round.** It is the architecture's own marker ("a round directory without `report.md` (the round crashed)", resume table row 6). A rerun of a crashed round N ignores its own half-written directory and anchors where its first run did; with `--record` it then replaces `round-N/groups.json`.
- **Why the CLI writes the record.** `bdk-cli` allows a command to write what it was asked to write. A shell redirect (`--json > groups.json`) would leave an error object in the file on failure, and the record's shape would be a convention in skill text; `--record` writes only a computed result, in the schema the command declares.
- **The head is a full object name**: 40 hexadecimal digits, or 64 in a SHA-256 repository.
- **Never an error.** A missing or unreadable record, a `head` that is no commit, or one that is not an ancestor of `HEAD` (a rebase or amend rewrote history) falls back to the merge base with `anchor.fallback` saying why. The round then reviews more than needed, never less; refusing would stop a skill for a bookkeeping file (findings 5, "Process was moved into the kernel").
- **The record is also the round's group list**, so a reviewer, the judge or a resumed lead reads which files each group held without recomputing.

Alternatives: a git ref per round (`refs/bdk/review/<change>/round-N`) - lost: refs are shared across worktrees and branches, survive the run directory, and need cleanup; the run state lives in `.bdk/runs/` (architecture "Run state"). The head written into `report.md` and parsed back - lost: Markdown written by a model is a fragile store. `round-N/head` as a one-line file - lost: a second file per round for one field the group record already carries. The latest round directory regardless of `report.md` - lost: a crashed round would anchor its own rerun at its own head and review nothing.

### D4. What counts as a changed file

Computed with `git diff --no-ext-diff --no-relative --no-renames -z` between the anchor and `HEAD` (`--no-ext-diff` and `--no-relative` so a user's `diff.external` or `diff.relative` setting cannot change the output):

- `--numstat` lists every changed path; a `-` in both counts marks it binary.
- `--diff-filter=D --name-only` lists the deleted paths, which go to `deleted` and nowhere else: a reviewer cannot read a file that is gone, and the integration reviewer sees the deletion in the list.
- `--no-renames` makes a rename a deletion plus an addition, so the result does not depend on git's similarity threshold or the user's `diff.renames` setting; `-c core.quotepath=off` plus `-z` keep paths byte-exact.
- `dirty` is the union of `git diff --name-only HEAD` (work tree against `HEAD`) and `git diff --cached --name-only` (index against `HEAD`), tracked files only, and never changes the range: a reviewer reads committed code, and the lead decides whether to commit first.
- Draft 1 excluded `.bdk/`. Dropped: run files live in `.bdk/runs/`, which is git-ignored, and the committed `.bdk/settings.yaml` deserves review like any file.
- Lists are sorted by code unit (`a < b`), not `localeCompare`, so the order does not depend on the locale.

### D5. Grouping rules taken over from draft 1

The part, `unplanned`, module and `integration` rules and the packing algorithm of draft 1 `bdk review plan` are taken over unchanged (spec, "Review groups"); they ran in B1 without a finding. Two adaptations to the v3 plan format, agreed with #180, which owns it (`plan/parts/NN.md`, architecture "Change artifacts"):

- A part's group id comes from its file name (`02.md` gives `p02`), and `id` in the frontmatter is not read: #180 fixes `id` as the quoted two-digit file stem, so the file name is the same value and cannot drift or collide.
- `files` in the frontmatter is a YAML list of repository-relative paths, matched exactly (#180: no globs, no directories). Draft 1 read `Files:` lines of tasks.

The module is the first two directory segments (`src/auth`), and `.` for a file at the repository root, as draft 1's `bdk measure` counted it.

Frontmatter is parsed with `yaml` (the library #179 pins) from the text between a first line `---` and the next line `---`. Anything else in the frontmatter is ignored, so #180 can add keys without breaking this command.

`yaml`'s Node export is CommonJS and calls `require`, which the ESM bundle lacks ("Dynamic require of ... is not supported", found by `tests/cli.test.ts`). `build.ts` adds a banner that defines `require` through `createRequire(import.meta.url)`, the standard esbuild fix for CommonJS dependencies in an ESM bundle; it holds for any later CommonJS dependency too. Alternative: resolve `yaml`'s browser build through esbuild `conditions` - lost: it fixes one package and depends on that package's export map.

### D6. The file target is a flag

`--max-files <n>`, default 30 (draft 1's `review.group.max-files` default, which B1 ran with). The architecture's configuration table has no review key yet, and `bdk config` (#179) is not merged; reading configuration here would add a matrix edge to a slice that does not exist on this branch. When a review key is added, the lead passes its value to `--max-files`; the command stays a pure function of its arguments.

Alternative: read `.bdk/settings.yaml` directly - lost: a second configuration reader next to #179's, which `bdk-cli` "Import matrix" forbids in spirit (data several slices read goes through one owner).

### D7. OS boundaries: `shared/git` and `shared/fs`

- `shared/git` (admitted `os-boundary`, "child processes: the git executable") exports `git(cwd, args): string`, which runs `git -c core.quotepath=off <args>` synchronously with `execFileSync` (no shell) and returns stdout, throws a `GitError` with git's stderr on a non-zero exit, and `CliError` `env/git-missing` on `ENOENT`. Synchronous like the frame and like #179's `fs`: the CLI runs one command and exits, so there is nothing to overlap.
- `shared/fs` is the module #179 ships, with the API agreed between #179, #186 and #188 (`readText`, `list`, `writeText`, `appendText`, sync, `undefined` for a missing path). This Change carries a copy of that agreed API so it can land first; whichever of the three merges later drops its copy and keeps the merged one.
- The slice never calls either directly from its use cases: `use-cases/deps.ts` declares `GitDeps` (`git(cwd, args)`, `files`, `cwd`), `index.ts` exports `gitGroup(deps)`, and `main.ts` passes `{ git, files, cwd }`, the wiring pattern #179 sets for every slice (`GROUPS = [configGroup(deps), ...]`). Use cases are unit-tested with a fake `Git` that answers by argument list and an in-memory `Files`.

Alternatives: `isomorphic-git` or another library - lost: a dependency that reimplements what the user's `git` does, with its own config and attribute handling, for five plumbing calls. Async `execFile` - lost: no concurrency to gain.

- Coordination (recorded as decided without waiting, per the orchestrator): #179 and #188 announced the same `shared/fs`; the API above is #179's final one, and #187 ships it too. `shared/git` was announced by this Change and claimed by no other.

### D8. Output

JSON is the result object (zod schemas in `schema/`, `bdk-cli` design D7 of v3-178). Text is written for a model reading a Bash result:

```
range 1a2b3c4..5d6e7f8, since round 2
binary, in no group (1):
  img/logo.png
deleted (1):
  src/old.ts
dirty, not in the range (0)
group p01 (part 01, 2 files)
  src/auth/login.test.ts
  src/auth/login.ts
group integration (5 files)
  ...
```

`scope` prints the same header and then `files (N):` with one path per line; `groups` leaves that list out, because `integration` holds it.

The text names `fallback` when the anchor fell back, so the lead sees that the round reviews the whole branch and why. Short shas (7) in text, full shas in JSON.

## Risks / Trade-offs

- [The record depends on the lead passing `--record` at the start of every round] - Without it a later round falls back to the merge base and reviews more, never less; `fallback` says so in the output. The review-round skill's eval checks the call.
- [Parallel slices ship the same `shared/fs`] - The API is agreed word for word with #179 and #188; a rebase keeps one copy. A test of the module travels with it.
- [Exact path matching misses a file a part names differently] - It lands in `unplanned`, which is reviewed; nothing is lost.
- [Part order follows file names, not `depends-on`] - A file listed by two parts goes to the lower number, which is the earlier part in #180's numbering; review does not depend on execution order.

## Migration Plan

None: a new command group. Rollback is reverting the commit.

## Open Questions

None.
