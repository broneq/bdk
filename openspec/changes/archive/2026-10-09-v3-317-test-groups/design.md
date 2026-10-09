# Design

## Context

See proposal.md - Why. Where each check ran before this Change (`staging/v3` at `12fc6957`):

| Run | Who | Items | Files |
|---|---|---|---|
| `NN-red` | `implement-part` step 4 | every `tools.test` item | the new acceptance tests (`--scope`) |
| `NN` | `implement-part` step 6, up to 3 runs | every test, lint and build item | the part's planned `files` (`--scope`) |
| `conform-NN` | `conform-part` step 5, always | the same | the same |
| `merge-NN` | `resolve-conflict`, only after a conflict | the same | conflicted files and their parts' files |
| (none) | after a wave is merged | - | - |
| `round-N` | `review-round` step 3, next to the reviewers and the E2E tester | every item, full command | none |

An item with a `scoped` variant ran it on the scope paths its `paths` match; one without ran its full `command`; one whose `paths` matched no scope path was skipped.

The example project `ocean-recap` (read only) has 1312 vitest files in six vitest projects (`npm test` runs `guards`, `unit`, `convex`, `types`; `integration` and `heavy` run apart) and 221 Playwright specs behind `scripts/run-e2e.sh`. That script allows 5 spec slots on the machine, gives a full suite all 5, allows one run per `E2E_INSTANCE` (port `3001 + N`, state files in `/tmp`), and exits 1 with `BUSY` instead of waiting. Worktrees have no `.env.local`, so every worktree resolves `E2E_INSTANCE=0`.

The design was decided with the user on a Lavish review page (2026-10-09): the current flow as a diagram, then ten decisions with two or three options and a recommendation each. The user approved D1, D2, D3, D5, D6 and D10 as recommended; asked for a more readable item than `command` + `scoped` + `paths`, which became D4; capped the live E2E check per proposal process instead of a fixed 5 (D7, moved to #321); said ports and instances are each project's own business (D8, D9). The settings file is YAML (`.bdk/settings.yaml`), and every example here is.

## Goals / Non-Goals

**Goals:**

- A project says per test group when it runs: after each part on the changed files, after each wave, at review.
- Execute gets faster: no second identical check run in the conformer, no heavy item in every part unless the project wants it.
- The Change branch is checked after every wave, not first in review.
- One readable item shape: one command per item.

**Non-Goals:**

- The live E2E check derived from the proposal (D7): #321.
- Managing ports, instances or machine budgets of a project's suites (D9).
- Copying untracked environment files into worktrees: #311 proposes one tree by default.
- Narrowing the E2E check in later rounds: #264.

## Decisions

### D1. An item is a test group; `when` names its check points

Each `tools.test`, `tools.lint` and `tools.build` item gains `when`, a non-empty list of distinct points among `part`, `wave` and `review`. The group the user described ("fast", "unit", "integration", "e2e") is exactly one command line, which an item already is, with an `id` the team chooses.

Alternatives: a new `tools.groups` map holding commands and triggers (lost: a command described in two places, every config migrated); fixed tiers `fast`, `unit`, `integration`, `e2e` with fixed points (lost: projects whose tiers differ cannot express theirs).

### D2. Three points: `part`, `wave`, `review`

- `part`: after a part's code, in `implement-part` (red run and part checks), `conform-part` (after an edit) and `resolve-conflict` (merged files).
- `wave`: once per wave in `execute-waves`, after every part of the wave is on the Change branch. The last wave's check is the end-of-execute check.
- `review`: once per review round in `review-round`.

"A test of the group was written or changed" is not a point: an item whose command holds `{files}` and whose `paths` name its test files already runs at `part` only when the part changed such a file (the Playwright example in D4).

Alternatives: a fourth point `final` after the last wave (lost: in `/bdk:run` review round 1 starts right after, so it repeats `review`); a point `touched` (lost: it duplicates `part` with `paths`).

Refinement made while writing the specs: the red run of new acceptance tests runs `--at part`, not every point as the page said. Without `--at`, a whole-suite item such as `npm test` at `wave` would run the full suite once per part. `/bdk:setup` always writes a `part` test item that takes `{files}`; a project without one gets the existing `environment` blocker, which names `/bdk:setup`.

### D3. `bdk check run --changed <ref>` finds the changed files

The CLI asks git, in the project root: `git diff --name-only --relative --no-renames --diff-filter=d -z <ref>` (tracked files changed in the working tree or the index against `<ref>`, deleted files left out because no tool can check them) and `git ls-files --others --exclude-standard -z` (untracked files), deduplicated and sorted. The callers pass:

| Point | `<ref>` |
|---|---|
| part (implementer, conformer) | `HEAD`: the part is not committed yet |
| wave | the Change branch's commit before the wave's first part was committed or merged, recorded in `state.json` |
| review | the base branch the round's `bdk git groups` uses |

`--scope` stays for explicit lists (`resolve-conflict`, the red run's test files) and adds to `--changed` when both are given. A `<ref>` git cannot resolve is `usage/invalid-argument`.

Alternatives: the part's planned `files` (lost: planned but untouched files are checked, and a wave or a round has no such list); the project's command finds the diff itself, as `vitest --changed` (lost: works only for tools that support it, each needs the right base; a project can still put such a command in an item without `{files}`).

### D4. One command per item; `{files}` replaces `scoped` (**BREAKING**)

The user found `command` + `scoped` + `paths` with per-point rules unreadable. An item now holds one `command`:

- A command holding `{files}` runs on the changed files, filtered by the item's `paths` when it has them; it is skipped when no file is left, and when the run has no files at all (neither `--changed` nor `--scope`).
- A command without `{files}` runs whole. When the run has files and the item has `paths`, it runs only when a changed file matches them (a package's suite after a change in that package); without `paths` it always runs.

A team that wants an item both on the changed files and whole writes two items:

```yaml
tools:
  lint:
    - id: eslint-changed
      command: npx eslint {files}
      paths: ["**/*.{ts,tsx,js,mjs}"]
      when: [part]
    - id: tsc
      command: npm run type-check
      when: [wave, review]
  test:
    - id: vitest-related
      command: npx vitest related --run {files}
      paths: ["**/*.{ts,tsx}"]
      when: [part]
    - id: unit
      command: npm test
      when: [wave, review]
    - id: integration
      command: npm run test:integration
      when: [review]
    - id: playwright-changed
      command: npm run test:e2e -- {files}
      paths: ["e2e/**/*.spec.ts"]
      when: [part]
    - id: playwright
      command: npm run test:e2e
      when: [review]
      timeout: 3600
  build:
    - id: next
      command: npm run build
      when: [review]
```

`scoped` is removed from the schema. `bdk config check` reports a `scoped` field as a problem whose message names the rewrite (`scoped was removed: put {files} into the command of a second item that runs at part`), not as a plain unknown key. The result's per-check `scoped` field keeps its name and now says whether the command held `{files}`.

Alternatives: a command per point inside one item (`part: npx eslint {files}`, `review: npm run lint`; lost: an item stops being one group and D1's `when` goes); keeping `scoped` with per-point rules (lost: the user's objection).

### D5. The conformer checks only after an edit

`conform-part` runs `bdk check run <run-dir> conform-<id> --at part --changed HEAD` only when it edited a file; a pass that changed nothing keeps the implementer's green run, and its report names that run. Before the conformer, the implementer's part check stays as it is.

Alternatives: never (lost: a broken rename would reach the merge, found only by the wave check, and attributed to the wrong worker); always, as before (lost: an identical second run for most parts).

### D6. A red wave check goes to `resolve-conflict`

Parts green alone and red together is the same problem as a merge conflict: two parts that do not fit. `resolve-conflict` gets a second mode, `--wave <n>`: it reads `checks/wave-<n>.json` and the red outputs, the wave's parts, and fixes the cause within the wave's parts' files, running `bdk check run <run-dir> wave-<n> --at wave --changed <base>` again, three runs in all; it writes `execute/wave-<n>.md` and leaves the changes for the lead to commit. The lead runs it once more on `policy.escalation.model` when it fails, as for a conflict; still red, the wave is `blocked` and execute stops with the result naming `execute/wave-<n>.md`.

Alternatives: execute stops at once (lost: every red wave needs a person, although the block that reads both sides can fix most); continue and leave it to review (lost: later waves build on a red branch).

### D7. Live E2E from the proposal: moved to #321

Approved as: the tester lists the user processes the proposal adds or changes and drives up to 5 paths per process (main path, variants, at least one that tries to break it), no global cap, each path traced to a proposal line; the spec scenarios are the project's own tests. It changes a different block (`e2e-check`), its spec and its eval cases, so it is its own issue, #321, blocked by this one.

### D8. In a round: checks next to the reviewers, the E2E tester after the checks

`review-round` step 3 starts the group reviewers and `bdk check run --at review --changed <base> --round <N>` in one message; step 4 starts the E2E tester and the integration reviewer in one message (the integration reviewer reads the group findings, not the E2E verdict). The full suite and the tester never run at the same time. BDK does not manage ports or instances: it only does not start its two heavy things at once.

The round's critical path changes from `max(reviewers, checks, tester) + integration` to `max(reviewers, checks) + max(integration, tester)`.

Alternatives: in parallel with separate instances (lost: needs each project to support instance ports, and the user ruled ports out of BDK's role); tester first (lost: the same total, and a red suite is learnt later).

### D9. Host contention stays the project's

BDK adds no lock, retry or instance variable. The Guide says a check command must wait for or isolate its own resources (ports, instances, machine budgets), and that an exit such as `run-e2e.sh`'s `BUSY` is a red check. Parallel parts in a wave that each run a heavy `part` item can collide on such a project; the project's runner decides.

Alternatives (not chosen by the user): an `exclusive` lock per item in `bdk check run`; a retry on an output pattern.

### D10. No `when` means every point; setup writes `when`

An item without `when` runs at `part`, `wave` and `review`, so an existing configuration keeps every check it had, plus the wave check. `/bdk:setup` writes an explicit `when` on every item it detects:

| Item | `command` | `when` |
|---|---|---|
| linter or formatter check that takes files | `<runner> {files}` | `[part]` |
| the same, whole | the project's script | `[review]` |
| type check (`tsc`, `mypy`) | the project's script | `[wave, review]` |
| tests related to changed files (`vitest related`, `jest --findRelatedTests`) or the test runner on changed test files | `<runner> {files}` | `[part]` |
| the project's main test script | the script | `[wave, review]` |
| integration or slow test script | the script | `[review]` |
| Playwright or Cypress on changed specs | `<runner> {files}`, `paths` on the spec files | `[part]` |
| the whole E2E suite | the script | `[review]` |
| build | the script | `[review]` |

Every `{files}` item also gets `paths` naming the files its tool reads (`**/*.ts` and the like for a linter or test runner, the spec files for an E2E runner), so a changed Markdown or YAML file is never handed to it; an item whose command covers the whole repository gets no `paths` unless the repository holds several packages (#284).

A re-run of setup on a configuration holding `scoped` rewrites each such item into the two items of D4.

Alternatives: `when` required (lost: every configuration breaks); defaults by kind (lost: hidden rules a reader must learn).

### D11. Wave state in `state.json`

`execute-waves` writes `waves` next to `parts`: `{"1": {"base": "<sha>", "status": "pending" | "done" | "blocked", "reason": "..."}}`. `base` is `git rev-parse HEAD` on the Change branch when the wave's first part starts, written before any part of the wave runs, so a resumed run checks the same range. A wave is `done` when its check passed or ran no check (`none`). A resumed run whose wave has every part `done` but the wave not `done` runs the wave check (and its repair) before the next wave.

`bdk run status` reads `waves` (optional, so older state files stay valid) and keeps row 4 (`execute`) while a wave is not `done`, naming it in the reason; `state.json` keeps `version: 1` because the field is optional and an older file means the same thing.

Alternatives: mark the wave's parts `blocked` (lost: a resumed run would re-implement merged parts); keep the wave state only in the result file (lost: `bdk run status` would report execute done on a red Change branch).

### D12. Result file `version: 2`

The result gains `at` (the point, or `null`) and `changed` (the ref, or `null`), and each `skipped` entry gains `reason`: `paths` (its `paths` match no file) or `no-files` (its command holds `{files}` and the run has no file). Because the meaning of `scoped` changed with D4, `version` becomes `2`.

## Risks / Trade-offs

- [Breaking `scoped`] An existing configuration fails `bdk config check` until rewritten. Mitigation: the problem message names the rewrite, and `/bdk:setup` rewrites it.
- [Default `when` runs more] An existing item without `when` now also runs after each wave. That is slower, never less safe; setup writes explicit `when`.
- [Wave base on resume] A base written after the first part committed would hide that part's changes from the wave check. Mitigation: the lead writes `base` before starting the wave's first implementer.
- [Parallel parts on a strict host] With D9, two parts of a wave that each run a `part` E2E item can still collide on a host like `ocean-recap`'s. Accepted by the user; #311 removes most of it.
- [Round slower when the tester is the long pole] D8 adds the tester after the checks. Accepted: correctness over overlap; the integration reviewer now overlaps the tester instead.
