# kernel-cli/review Specification

## Purpose

Review planning (`review`): the range a review round covers and the groups its reviewers get, computed by the kernel so the review skills never derive them from git themselves.

Common rules, not repeated per requirement: every command may emit `input/unknown-command`, `input/unknown-flag`, `input/missing-argument`, `input/invalid-argument`, `runtime/node-version`, `runtime/not-a-repo`; every Change-scoped command additionally `policy/no-active-change`, `state/corrupted-index`, `state/ledger-invalid`, `state/change-dir-missing`. Their meaning and exit codes are in `kernel-cli`, Exit codes and the error object; a command's `exits` in the index is derived from the classes of its specific and common rules.

Representative refusal:

```json refusal
{
  "refused": true,
  "rule": "input/invalid-argument",
  "why": "--full reviews from the Change base and --base from a merge base; pass one",
  "instead": ["bdk review plan --full", "bdk review plan --base main"]
}
```

## Requirements

### Requirement: bdk review plan

Compute the range and the reviewer groups of the next review round of the active Change. The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk review plan [--full] [--base <ref>]`
- **Availability:** `read`
- **Mode:** `command`; Change-scoped
- **Arguments:**
  - `--full`. Review from the Change base, ignoring earlier review rounds.
  - `--base <ref>`. Review from `git merge-base HEAD <ref>`; for a branch stacked on another one.
- **Behaviour:** Deterministic for the same repository state and ledger, and writes nothing. **Anchor**: with `--base`, the merge base of `HEAD` and `<ref>` (`kind: base`); with `--full`, the Change base (`kind: full`); otherwise the `head` of the latest `report` entry of the Change with `group: merge` (`kind: delta`, `kernel-state`, Ledger entry), or the Change base when the ledger holds none or its `head` names no commit of the repository, as after rewritten history (`kind: full`). `--full` with `--base`, and an unknown `<ref>`, are `input/invalid-argument`. The **Change base** is the `base` stamped in `change.md` for a `review` Change (`kernel-cli/change`, bdk change new; T42); for any other Change it is the parent of the first commit that added the Change's `change.md`, or `HEAD` while `change.md` is not committed; a Change whose first commit is the repository's root commit has the empty tree as its base. **Range**: `<anchor>..HEAD`, committed history only; the changed files are those of `git diff --name-only <anchor>..HEAD` outside `.bdk/`, sorted, and `dirty` lists the tracked files outside `.bdk/` with uncommitted changes, so the caller can commit them first. **Groups**, in this order, each with a kebab-case `id`, a `kind` and its sorted `files`: with plan parts, one group per part with changed files (`kind: part`, `id: p<nn>`), holding the changed files its tasks' `Files:` name, a file named by several parts going to the first in plan order; the changed files no task names go to one group `unplanned` (`kind: unplanned`); without plan parts, the changed files are grouped by module (`kind: module`, `id: m<k>` from 1), a module being the first two directory segments as `bdk measure` counts them. A part, `unplanned` or module group with more than `review.group.max-files` files is split: its files are grouped by module, modules in sorted order fill a group until the next module would pass the limit, a single module above the limit is cut into runs of sorted paths, and the resulting groups get the suffix `-<k>` from 1 (`p02-1`, `p02-2`, `unplanned-1`); modules packed into one group stay whole otherwise. Last comes one group `integration` (`kind: integration`) holding every changed file. An empty range has no groups. The output names `measure` for the range (`files`, `added`, `removed`, `modules` as `bdk measure` returns them), so the caller sizes the round without a second call.
- **Writes:** nothing
- **Output:** `schema/cli/output/review-plan.json`
- **Exit codes and rules:** `0, 2, 3, 4, 5`. Specific rules: `runtime/git-missing`; plus the common rules of every command and of Change-scoped commands (`kernel-cli`, Exit codes and the error object).
- **Example:**

  ```bash
  bdk review plan --json
  ```

  ```json
  {
    "change": "2026-09-25-passwordless-login",
    "anchor": {
      "kind": "delta",
      "sha": "4f1c2d9a7b3e5f60718293a4b5c6d7e8f9a0b1c2"
    },
    "head": "9a8b7c6d5e4f30211203f4e5d6c7b8a9f0e1d2c3",
    "range": "4f1c2d9a7b3e5f60718293a4b5c6d7e8f9a0b1c2..9a8b7c6d5e4f30211203f4e5d6c7b8a9f0e1d2c3",
    "dirty": [],
    "measure": {
      "files": 3,
      "added": 120,
      "removed": 14,
      "modules": ["src/auth", "src/mail"]
    },
    "groups": [
      {
        "id": "p01",
        "kind": "part",
        "part": "01",
        "files": ["src/auth/login.ts", "src/auth/login.test.ts"]
      },
      {
        "id": "unplanned",
        "kind": "unplanned",
        "files": ["src/mail/send.ts"]
      },
      {
        "id": "integration",
        "kind": "integration",
        "files": ["src/auth/login.test.ts", "src/auth/login.ts", "src/mail/send.ts"]
      }
    ]
  }
  ```

- **Owner:** T42
- **Slice:** `review`

#### Scenario: example run

- **WHEN** `bdk review plan --json` runs as in the example
- **THEN** the exit code is 0 and stdout validates against `schema/cli/output/review-plan.json`

#### Scenario: runtime/git-missing

- **WHEN** no `git` executable on `PATH`
- **THEN** the exit code is 5 and the error object carries `rule: runtime/git-missing`

#### Scenario: first round reviews from the Change base

- **WHEN** the ledger holds no `merge` report, `change.md` was added in commit `C1` and three commits follow
- **THEN** `anchor.kind` is `full`, `anchor.sha` is the parent of `C1`, and the changed files are those of the three commits and `C1`, without `.bdk/`

#### Scenario: second round reviews the delta

- **WHEN** a `merge` report entry with `head: H1` exists and one fix commit follows `H1`
- **THEN** `anchor.kind` is `delta`, `anchor.sha` is `H1`, and the groups hold only the files of the fix commit

#### Scenario: rewritten history falls back to the Change base

- **WHEN** the latest `merge` report's `head` names no commit of the repository
- **THEN** `anchor.kind` is `full` and the anchor is the Change base

#### Scenario: full overrides the delta

- **WHEN** a `merge` report entry exists and `bdk review plan --full` runs
- **THEN** `anchor.kind` is `full` and the anchor is the Change base

#### Scenario: stacked branch

- **WHEN** `bdk review plan --base feature/a` runs on a branch created from `feature/a`
- **THEN** `anchor.kind` is `base` and `anchor.sha` is `git merge-base HEAD feature/a`

#### Scenario: full and base together

- **WHEN** `bdk review plan --full --base main` runs
- **THEN** the exit code is 3 and the error object carries `rule: input/invalid-argument`

#### Scenario: groups follow the plan parts

- **WHEN** part `01` names `src/auth/login.ts`, part `02` names `src/mail/send.ts`, and the range changes both plus `src/util/date.ts`
- **THEN** the groups are `p01`, `p02`, `unplanned` with `src/util/date.ts`, and `integration` with all three files, in that order

#### Scenario: large part is split by module

- **WHEN** `review.group.max-files` is 30 and part `02` has 25 changed files under `src/api/` and 20 under `src/db/`
- **THEN** the groups of the part are `p02-1` with the 25 files of `src/api` and `p02-2` with the 20 files of `src/db`

#### Scenario: Change without a plan groups by module

- **WHEN** the Change has no plan parts and the range changes files in `src/auth` and `web/forms`
- **THEN** the groups are `m1` with the `src/auth` files, `m2` with the `web/forms` files, and `integration`

#### Scenario: uncommitted work is named

- **WHEN** `src/auth/login.ts` has an unstaged change
- **THEN** `dirty` holds `src/auth/login.ts` and the groups are computed from committed history only

#### Scenario: nothing to review

- **WHEN** the anchor equals `HEAD`
- **THEN** the exit code is 0, `groups` is empty and `measure.files` is 0

#### Scenario: review Change starts at its stamped base

- **WHEN** a `review` Change was opened with `base` `B0` on a branch with three commits over `B0`, its `change.md` was committed afterwards, and `bdk review plan --json` runs with no `merge` report in the ledger
- **THEN** `anchor` is `{kind: full, sha: B0}` and the groups hold the files of those three commits, grouped by module
