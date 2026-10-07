# kernel-cli/commit Specification

## Purpose

Review fix commits (`commit`). The kernel command that commits a review round's fix under the round's `BDK-Ticket` trailer; a part agent commits a task or a part with the `git` command `bdk check run` prints (#166).

Common rules, not repeated per requirement: every command may emit `input/unknown-command`, `input/unknown-flag`, `input/missing-argument`, `input/invalid-argument`, `runtime/node-version`, `runtime/not-a-repo`; every Change-scoped command additionally `policy/no-active-change`, `state/corrupted-index`, `state/ledger-invalid`, `state/change-dir-missing`. Their meaning and exit codes are in `kernel-cli`, Exit codes and the error object; a command's `exits` in the index is derived from the classes of its specific and common rules.

Representative refusal:

```json refusal
{
  "refused": true,
  "rule": "policy/do-not-touch",
  "why": "diff for 02-3 touches src/billing/invoice.ts, which is under do-not-touch src/billing/** of part 02",
  "instead": [
    "revert the change under src/billing/",
    "bdk log add blocker \"02-3 needs a change in billing\" --ref src/billing/invoice.ts --ref 02-3"
  ]
}
```

## Requirements

### Requirement: bdk commit

Commit the fix of a review round: code plus Change directory, with BDK trailers, after the diff check. The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk commit <change-id> [--message <text>]`
- **Availability:** `orchestrator`
- **Mode:** `command`; Change-scoped
- **Arguments:**
  - `<change-id>` (required). The id of the active Change.
  - `--message <text>`. Subject line; default `fix(review): <ticket>`.
- **Behaviour:** Runs under the commit lock (Serialised commits). A task is committed by its part agent with a plain `git commit` carrying the trailers `bdk check run` prints (`kernel-cli/check`; user decision 2026-10-07, #166), so a task id is no longer an argument: it is `input/invalid-argument` with `instead` naming `bdk check run <task> --ticket <ticket>`. The command needs an open `review-fix` ticket of the Change (`policy/no-open-ticket` otherwise) and commits while that ticket is open, because the round reviews the fix after it is committed (T42). The diff check runs for the Change target (`kernel-loops`, Diff check): a forbidden path refuses and no path is reported undeclared. It stages every touched path and `.bdk/changes/<id>/` in one pathspec commit, so files the user staged elsewhere stay staged and uncommitted; the message is the subject followed by the trailers `BDK-Change: <change id>` and `BDK-Ticket: <ticket>`. The user's git hooks run; a failing hook refuses with `policy/git-hook-failed` and creates no commit. Refuses during a rebase, merge or cherry-pick (`policy/git-in-progress`) and when neither a touched path nor the Change directory changed (`policy/nothing-to-commit`). For a `tiny` Change the tiny guard runs after the commit (`kernel-loops`, Tiny guard) and its entry is part of the next commit. Main-thread git stays the user's (T3).
- **Writes:** `git:commit`, `.bdk/changes/<id>/log/`
- **Output:** `schema/cli/output/commit.json`
- **Exit codes and rules:** `0, 2, 3, 4, 5`. Specific rules: `input/not-found`, `policy/commit-busy`, `policy/do-not-touch`, `policy/git-in-progress`, `policy/git-hook-failed`, `policy/no-open-ticket`, `policy/nothing-to-commit`, `runtime/git-missing`; plus the common rules of every command and of Change-scoped commands (`kernel-cli`, Exit codes and the error object).
- **Example:**

  ```bash
  bdk commit 2026-09-25-passwordless-login --json
  ```

  ```json
  {
    "ticket": "A-r2v2w3x4",
    "commit": "d8e4f21",
    "trailers": {
      "BDK-Change": "2026-09-25-passwordless-login",
      "BDK-Ticket": "A-r2v2w3x4"
    },
    "files": [
      "src/auth/login.ts",
      ".bdk/changes/2026-09-25-passwordless-login/log/20260925T101502Z-finding-L-e8k2s5vw.md"
    ]
  }
  ```

- **Owner:** T22
- **Slice:** `commit`

#### Scenario: example run

- **WHEN** `bdk commit 2026-09-25-passwordless-login --json` runs as in the example with an open `review-fix` ticket
- **THEN** the exit code is 0 and stdout validates against `schema/cli/output/commit.json`

#### Scenario: input/not-found

- **WHEN** the referenced object does not exist in the active Change, the configuration or the bundle
- **THEN** the exit code is 3 and the error object carries `rule: input/not-found`

#### Scenario: a task id is refused

- **WHEN** `bdk commit 02-3` runs
- **THEN** the exit code is 3, the error object carries `rule: input/invalid-argument`, `instead` names `bdk check run 02-3 --ticket <ticket>`, and no commit is created

#### Scenario: policy/do-not-touch

- **WHEN** the real diff touches a `do-not-touch` path (P6)
- **THEN** the exit code is 2 and the error object carries `rule: policy/do-not-touch`

#### Scenario: policy/git-in-progress

- **WHEN** a rebase, merge or cherry-pick is in progress (V1-4)
- **THEN** the exit code is 2 and the error object carries `rule: policy/git-in-progress`

#### Scenario: policy/git-hook-failed

- **WHEN** the repository's `pre-commit` hook exits non-zero
- **THEN** the exit code is 2, the error object carries `rule: policy/git-hook-failed` with the hook's first output line, and `HEAD` is unchanged

#### Scenario: policy/nothing-to-commit

- **WHEN** neither the code nor the Change directory changed since the last commit
- **THEN** the exit code is 2 and the error object carries `rule: policy/nothing-to-commit`

#### Scenario: runtime/git-missing

- **WHEN** no `git` executable on `PATH`
- **THEN** the exit code is 5 and the error object carries `rule: runtime/git-missing`

#### Scenario: review fix committed

- **WHEN** `review-fix` ticket `A-r2v2w3x4` of the Change is open, the user staged `README.md`, its implementer changed `src/auth/login.ts`, and `bdk commit <change-id> --json` runs
- **THEN** the exit code is 0, the output names `ticket: A-r2v2w3x4`, the new commit holds `src/auth/login.ts` and the Change directory but not `README.md`, which is still staged, its trailers are `BDK-Change` and `BDK-Ticket: A-r2v2w3x4`, and the ticket is still open

#### Scenario: policy/commit-busy

- **WHEN** a live process holds `.bdk/.machine/commit.lock` for longer than 60 s and `bdk commit <change-id>` runs
- **THEN** the exit code is 2, the error object carries `rule: policy/commit-busy` naming the holder, and no commit is created

#### Scenario: policy/no-open-ticket

- **WHEN** `bdk commit <change-id>` runs while the Change has no open `review-fix` ticket
- **THEN** the exit code is 2, the error object carries `rule: policy/no-open-ticket`, and no commit is created

#### Scenario: policy/ticket-open

- **WHEN** `bdk commit 02-3` runs while a `part` ticket of part `02` is open
- **THEN** the exit code is 3 with `rule: input/invalid-argument`, not `policy/ticket-open`: a task is committed by its part agent and not by `bdk commit`, so an open ticket no longer refuses the command

#### Scenario: trailers and staged user files

- **WHEN** the user staged `README.md`, a `review-fix` ticket is open, its fix changed `src/auth/login.ts`, and `bdk commit <change-id>` runs
- **THEN** the new commit holds `src/auth/login.ts` and the Change directory but not `README.md`, which is still staged, and `git log -1 --format=%(trailers:key=BDK-Ticket,valueonly)` prints the ticket

### Requirement: Serialised commits

`commit` SHALL serialise with every other `commit` and with the merge back of `part done` in the same repository.

Before it stages anything, `commit` takes an exclusive lock `.bdk/.machine/commit.lock` and holds it until its commit exists or it refuses. A call that finds the lock held waits for it up to 60 s, then refuses with `policy/commit-busy`, whose `why` names the holder's process id and whose `instead` is to run the same `commit` again. A lock whose holder process no longer exists is taken over at once. `part done` takes the same lock for the merge back of a worktree part (`kernel-cli/part`). The lock covers only these kernel commits; a part agent's or the user's `git commit` at the same moment meets git's `index.lock`, which git reports and the agent runs again (`role-contracts`, Role contract content).

#### Scenario: two commits at once

- **WHEN** two processes run `bdk commit <change-id>` at the same moment with an open `review-fix` ticket
- **THEN** one exits 0 with a commit, the other exits 0 with its own commit or 2 with `rule: policy/nothing-to-commit`, and no call fails on git's `index.lock`

#### Scenario: lock of a dead process

- **WHEN** `.bdk/.machine/commit.lock` names a process that no longer exists
- **THEN** `bdk commit <change-id>` takes the lock and exits 0

#### Scenario: two leads commit at once

- **WHEN** two part agents run the `git commit` commands `bdk check run` printed for tasks `02-3` and `03-1` at the same moment
- **THEN** each commit holds only its own task's paths and its own `BDK-Task` trailer; one that meets git's `index.lock` is run again by its agent, and the kernel lock is not involved
