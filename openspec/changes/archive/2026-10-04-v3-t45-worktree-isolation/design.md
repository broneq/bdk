# Design

## Context

T41 runs the parts of one wave in one working tree. Three facts of the current kernel shape this design:

- **State is per checkout.** `.bdk/.machine/` (index, agent registry, `commit.lock`) is ignored by git (`kernel-state`, Ignored paths), so a linked worktree has none of it, and its `.bdk/changes/<id>/` would be a stale copy from `HEAD`. `findProjectRoot` (`kernel/src/shared/store/store.ts`) walks up to the nearest `.bdk/`, so a command run inside a worktree would find the copy. The Change is bound to the home branch (Branch binding), and the worktree's branch differs.
- **The commit and diff code assume one root.** `bdk commit` (`kernel/src/commit/use-cases/commit.ts`) stages the task's paths together with `.bdk/changes/<id>/` in `change.projectRoot`. `diffCheck` (`kernel/src/part/use-cases/diff.ts`) and `taskProgress` read git there, and the tree hash (`kernel/src/evidence/use-cases/scope.ts`) reads files there.
- **The tree hash hashes file bytes.** It covers a target's `Files:` plus the build-config files and hashes their content, not git trees (`kernel-state`, Evidence manifest). Evidence therefore depends on file bytes, not on commit identity.

Host facts, checked on 2026-10-04 against https://code.claude.com/docs/en/plugins-reference and https://code.claude.com/docs/en/worktrees:

- In a plugin's `settings.json` (or its `settings` key) only `agent` and `subagentStatusLine` take effect. A plugin cannot set `worktree.baseRef`.
- Subagent worktrees (`isolation: worktree`) branch from the default branch unless the user sets `worktree.baseRef: "head"`.
- `.worktreeinclude` (gitignore syntax: a file is copied when it matches a pattern and is ignored by git) applies only to worktrees Claude Code creates.
- The Agent tool has no working-directory parameter.
- Hooks receive `cwd`, which follows the agent, while `${CLAUDE_PROJECT_DIR}` stays at the session root.

## Goals / Non-Goals

**Goals:**

- The planner decides isolation per part. The kernel creates, sets up, merges and removes the worktree deterministically. No agent negotiates shared state, and a merge conflict is resolved only inside a budgeted, verified merge ticket.
- One ledger and one index, whatever directory a command runs in.
- The part's commits, trailers and evidence survive the merge back unchanged.
- The worktree is host-independent: any host that can tell an agent a directory can run it.

**Non-Goals:**

- Parallel runs of parts with overlapping `Files:` (T41-D13 stays).
- A kernel-run regeneration of conflicted files (D6).
- A kernel command that merges the default branch into a Change (D11).
- Worktree isolation inside one part (between tasks).
- Non-git version control.
- The release-time acceptance E2E (T50).

## Decisions

### D1. Per part, decided by the planner; the kernel never downgrades on its own

`isolation` is a plan part field. `/bdk:plan` sets it under `BDK-PL-4`, and the verifier checks it. The only downgrade is `execution.worktree.enabled: false`, under which the wave runs a `worktree` part alone, so the hidden shared state still cannot collide. A failed setup refuses (user decision 2026-10-04).

- _Per wave_ lost: two parts of one wave can differ. A shared docs part next to a part that regenerates a lockfile needs one worktree, not two.
- _`/bdk:execute` downgrades when setup is costly_ lost: a skill judging the cost is the agent negotiation the task removes, and a silent downgrade to parallel `shared` brings the collision back.
- _Auto-downgrade with a finding on setup failure_ lost (user decision): a broken setup usually means a broken environment, which the user has to fix anyway.

### D2. The kernel owns the worktree, never the host

`part start` runs `git worktree add -b bdk-part/<change>/<part> <path> HEAD` in the home checkout. Packages carry `workdir`, and contracts tell agents to work there.

- _Claude Code's `isolation: worktree`_ lost: it branches from the default branch, and a plugin cannot set `worktree.baseRef`. Its worktrees are per agent, but a part has several agents in sequence (implementer, simplifier, runner) who must share one tree. Its cleanup prompts or sweeps on the host's schedule.
- _`WorktreeCreate` hook_ lost: it replaces worktree creation for the user's own sessions too, and it is specific to one host.

The branch prefix `bdk-part/` differs from any Change branch name, so `refs/heads/<x>` and `refs/heads/<x>/<part>` never collide.

### D3. One ledger: commands resolve the home checkout (user decision 2026-10-04)

The worktree's git directory holds `bdk-home` (home project root, Change id). `findProjectRoot` checks for it first, so every Change-scoped command run inside a worktree reads and writes the home `.bdk/`. `bdk commit` in a worktree stages only the task's paths. Its kernel entries stay in the home Change directory until the next home commit or checkpoint, and `part done` runs a checkpoint after the merge.

- _A ledger per worktree, merged at `part done` by opaque ids_ (the issue's Scope) lost: it needs a second index and registry per worktree, a merge of entries, and a meaning for a ledger conflict. It also leaves the main thread blind to a lead's entries until the merge, while `SendMessage` (T41-D5) cites entry ids that must resolve at once.
- _The marker in the worktree's `.bdk/`_ lost: `.bdk/` is tracked, so the marker would show as a change and could be committed. The git directory is never committed, and Claude Code puts its own marker there too.

### D4. Work root per target

One resolver in `shared/store` maps a task or part target to its work root: the `workdir` of the part's latest start marker when the part has `isolation: worktree`, is not done and the directory exists; the home checkout otherwise. The diff check, `commit`, `taskProgress`, the tree hash and the `execute-part` checks call it. Because the resolver lives in `shared/store` and reads committed entries, no new slice edge is needed (`kernel-architecture`, Dependency matrix: reads of committed state never need a slice import). `evidence` stays a leaf.

- _Resolving from the process's working directory_ lost: the lead and the main thread run `bdk commit` from the home checkout, and an agent's shell can be anywhere. The target already says where its work is.

### D5. Merge back by merge commit, computed off-tree (user decision 2026-10-04)

`part done` runs under the commit lock:

1. Classify the worktree's leftovers.
2. `git merge-tree --write-tree` against home `HEAD`.
3. `git commit-tree` with two parents and the trailers `BDK-Change` and `BDK-Part`.
4. `git merge --ff-only` in the home checkout.
5. `git worktree remove --force` and `git branch -D`.

- _Rebase onto the Change branch, then fast-forward_ lost: it rewrites the part's SHAs, which the `part done` output and any recorded SHA name. It can conflict once per commit, and it runs in the worktree's working tree.
- _`git merge` in the home checkout_ lost: a conflict would leave markers in the tree where shared parts' agents are working, and `git merge --abort` would discard their uncommitted work. `merge-tree` decides without touching any tree, and `--ff-only` changes only the merged paths and refuses rather than overwrite a dirty one.
- _Squash_ lost: it drops the task trailers from the history that `rebuild` reads (`kernel-loops`, Progress from git).

How the trailers and tree hashes survive: the task commits stay reachable with their trailers through the merge commit's second parent. The progress rule gains the part merge commit as a known shape. Evidence of a task or part is hashed over its `Files:` and the build-config files. After the merge those bytes equal the worktree's unless the home side changed one of them. A lockfile changed by both sides makes the evidence stale, which is correct, because the combination was never tested. `tests-full` and `lint-full` at the review stage run on the merged tree anyway.

### D6. A conflict is resolved in a merge ticket, under the project's merge instruction (user decision 2026-10-04)

`policy/merge-conflict` (both sides changed a path differently) sends the part to `bdk attempt open verify-fix <part>`. That ticket is a merge ticket:

1. The kernel runs `git merge --no-commit <Change branch>` inside the part's worktree. Subagents may not run `git merge` (T3), and the markers stay inside the isolated worktree.
2. The package gets a `Conflict` section: the unmerged paths and the resolved prompt `fragments/merge-conflicts`.
3. The implementer edits only those paths, following the instruction.
4. The ticket's usual `tests-scoped` and `lint` steps run on the merged state.
5. `attempt close ok` refuses while a path is unmerged or holds a marker (`policy/merge-unresolved`). Otherwise the kernel commits the merge on the part branch and answers `part-done`.
6. The second `part done` is clean, because the part branch now contains the Change branch.

The budget and the ladder are those of `verify-fix`, so a conflict the instruction cannot settle parks the Change for the user. This is what the issue allows ("sends the part to `verify-fix` or to the user"): the agent works inside a ticket, on named paths, under a written instruction, and its result is verified. The issue excludes an agent that resolves freely, and this is not one.

The default instruction carries the rules common to every language. A package manager's lockfile is never merged by hand: take either side and regenerate it from the merged manifests. Other generated files are regenerated by their command. Colliding migrations are renumbered. Source code keeps the intent of both sides. A project extends the instruction with its own commands. The instruction names no BDK flow, so it reads the same for any merge.

- _A conflict always goes to the user_ (the first draft) lost: lockfile and codegen conflicts are routine and mechanical, and stopping a parallel run on each one costs more than the worktree saves.
- _A `regenerate` settings list (paths plus command, run by the kernel)_ lost (user decision 2026-10-04): it covers only regenerable files and only part merges. An instruction covers every conflict and every merge, and the project states its commands in prose once.
- _The orchestrator or the lead resolves the conflict_ lost: they write no files, and an unverified resolution is what the issue excludes.

`policy/merge-blocked` is a timing matter: a shared task has not committed a path yet. The orchestrator retries `part done` after the next commit.

Leftovers are recorded before removal, because a worktree holds only one part's work. A changed path the part's tasks declare blocks (`policy/worktree-dirty`), since it may be real work. Any other leftover (generated output, a regenerated lockfile no task committed) is listed and dropped.

### D7. Settings: `execution.worktree`, `.worktreeinclude`, and nothing in the host's `settings.json`

```yaml
execution:
  worktree:
    enabled: true # false: worktree parts run alone in the home checkout
    dir: .bdk/.machine/worktrees # relative to the project root, or absolute
    setup:
      command: pnpm install --frozen-lockfile # absent: no setup
      timeout: 300 # seconds, 10 to 540
    max-live: 3 # kernel worktrees alive at once
```

- `dir` defaults to `.bdk/.machine/worktrees` (user decision 2026-10-04: a key with a default). The kernel already ignores that directory, and it lies inside the project, so the host's agents can edit there without extra permission. Claude Code would otherwise need `permissions.additionalDirectories` in the user's `settings.json`. A project whose test runner or linter crawls ignored nested directories can move `dir` outside the repository and grant that permission itself. `part start` refuses a `dir` inside the repository that git does not ignore.
- `setup.timeout` tops out at 540 s because `part start` runs the setup synchronously and Claude Code's Bash tool stops at 600 s. The default of 300 s covers a cold `npm ci` on a mid-size project. A longer setup belongs in a cache, not in this key.
- `max-live` bounds the disk use of the worktrees. Every worktree is a full checkout plus whatever setup writes, for example `node_modules`. The default of 3 sits below `execution.concurrency` (5), since a worktree part is the exception.
- Gitignored files come from `.worktreeinclude`, with the semantics Claude Code documents. A project that already has one for Claude Code gets the same files, and one file serves both.
  - _A settings list (`execution.worktree.include`)_ lost: two places for one list, and they drift.
- Nothing goes into the plugin's or the user's `settings.json`. The plugin cannot set `worktree.baseRef` (Context), and BDK does not rely on it, since D2 takes the host's worktree out of the path.
- The setup records go into the start marker's body, not an evidence manifest. A manifest belongs to a ticket (`kernel-state`, Evidence manifest), and `part start` has none.

### D8. Agents: package `workdir`, `Work root` section, and a file-edit guard

The package names the work root, and every role that touches files carries one sentence about it. `guard/worktree-scope` denies `Edit`, `Write` and `NotebookEdit` outside `workdir` for a subagent whose registry row names a package with `workdir`.

- _Guarding Bash too_ lost: the guard cannot see where a shell command writes. The package's rule and the diff check, which reads the worktree, catch what a shell misplaces. A write into the home checkout shows as an undeclared path or a `do-not-touch` refusal there.

### D9. Recovery in `rebuild`

`rebuild` reconciles `git worktree list` and the `bdk-part/*` branches against the part states:

- It removes a worktree whose part is done or never started.
- It keeps a live one.
- It recreates a missing live worktree from its branch.
- It never deletes an unmerged branch.

Worktrees without the home marker are the user's and are never touched.

### D10. Git 2.38 or later for worktree parts only

`merge-tree --write-tree` arrived in git 2.38 (October 2022). Only `part start` of a `worktree` part checks it (`runtime/git-too-old`), so projects that never use a worktree keep running on older git.

### D11. Lockfiles in the rule pack, admitted without measurement (user decision 2026-10-04)

The lockfile rule holds for every merge, not only a part merge: when `main` moves under a long Change, its merge conflicts in the same lockfiles. `BDK-CQ-9` (`kind: house`, `applies` set to the lockfile globs) states it once. Rule selection by `applies` puts it into every package whose files include a lockfile, and into nothing else.

- _A kernel command that syncs a Change with `main`_ lost: nothing in the kernel breaks on such a merge. Evidence freshness follows file content, a merge from `main` carries no `BDK-Change` trailer and so no mismatch, and the user's main-thread git stays the user's (T3). The only gap was the instruction, which the rule closes.
- _A line in `STARTUP_INSTRUCTIONS.md`_ lost: it costs context in every session, also in sessions that never merge.
- _Admission through M1/M2_ waived: M1 asks the rule's question blind, and models answer "regenerate the lockfile" correctly, so the rule would read COVERED and be refused. The failure is behaviour while a conflict is being resolved, which M1 does not measure. This makes `BDK-CQ-9` the second exception after the `SEC` rules (`rule-pack`, Pack admission).

## Risks / Trade-offs

- **Tools that crawl `.bdk/.machine/worktrees/`** (a test runner that ignores `.gitignore`) see duplicate files → mitigation: the user guide names the risk and the `dir` key. `.claude/worktrees/` has the same property for Claude Code's own worktrees.
- **Task commits of a live worktree part exist only on a local branch** until `part done`. A lost disk loses them, the same as uncommitted work. `rebuild` recreates the worktree from the branch when the branch survives.
- **The setup blocks `part start` for up to `setup.timeout`.** Other parts of the wave start first when the skill orders them that way. The skill starts `shared` parts before `worktree` parts.
- **Divergent lockfile changes still conflict.** The worktree removes in-flight interference (half-done code seen by a build, concurrent writes, shared ports). Two different lockfiles cost one merge ticket at `part done`, which regenerates the file under the instruction and verifies the result with the ticket's steps.
- **The diff check during a merge** must not count the paths the merge brought in from other parts. Paths equal to their Change-branch version are left out, and the record's `conflicts` are declared (`kernel-loops`, Diff check).
- **Bash writes outside the worktree are not guarded** (D8). The diff check in both roots catches them after the fact.
