# Design

## Context

`execute-waves` (`plugins/bdk/skills/execute-waves/SKILL.md`) prepares a wave in step 4: a `shared` part runs in the main checkout, a `worktree` part in `<run dir>/worktrees/<id>` on `bdk/<change>/part-<id>`. Step 5 commits a passed part in its work directory; step 6 merges each done worktree part with `git merge --no-ff`. Step 3 stops on any uncommitted change in the main checkout. `implement-part` already continues "from the files as they are now" on a retry, and `conform-part` reads the uncommitted diff (`git status --porcelain`, `git diff HEAD`). `bdk plan check` computes waves and `isolation`; the CLI decides no order (ADR-0003, D1), so the rule lives in the skill.

## Goals / Non-Goals

**Goals:**

- No worktree, no merge commit and no cold caches for a part that runs alone.
- No earlier work lost on a resumed run, wherever the part ran.

**Non-Goals:**

- Changing `bdk plan check`, the part format or `isolation`'s meaning for the planner.
- Running several parts of a wave one after another in the main checkout.

## Decisions

### D1. The count is per wave, after done parts are skipped

A part runs in the main checkout when it is the only part of its wave not `done`, counted when the wave is prepared (step 4). This resolves the issue's "To resolve in the spec" item: the rule reads "one part not done in the wave", never "one part in the batch".

Alternative: per batch of `execution.max-parallel` - lost. Batches of one wave run one after another, and each part's work must stay apart until it is committed: a part blocked in batch 1 would leave its uncommitted work in the main checkout, and the conformer of the next batch's part, which reads the uncommitted diff, would see it as work outside its part. With `execution.max-parallel: 1` every part of every wave would hit that.

Counting after done parts are skipped is what the issue asks: on a resumed run where one of two parts is done, the remaining part runs alone, so isolation protects nothing.

### D2. An existing worktree or part branch wins

When `<run dir>/worktrees/<id>` or `bdk/<change>/part-<id>` exists, the part runs in that worktree even when it is now alone in its wave. The worktree holds the earlier work of a break or a blocked attempt (a part that was one of two, or a run of an older BDK), and a blocked merge keeps its branch for the next run.

Alternative: move the worktree's work into the main checkout - lost: it needs a patch or a stash (the stash is shared by every worktree of the repository), and committed work on the branch would need a merge anyway.

### D3. Leftover work of a main-checkout part is accepted on resume

A part that ran in the main checkout and ended `blocked` (or a run that broke) leaves its work uncommitted there, and step 3 would stop the next run on "uncommitted changes". This already held for `shared` parts; D1 makes it common. Step 3 now accepts the tree when `state.json` records at least one attempt of the part that runs next in the main checkout and every changed path lies within that part's `files`; the implementer continues from those files, as on a retry within one run. Any other change still stops the stage.

Alternatives:

- Move the work onto a part branch with a WIP commit when the part blocks - lost: the conformer reads the uncommitted diff, so a committed WIP hides the earlier work from it, and the history gains a commit nobody reviewed.
- `git stash` the work - lost: the stash stack is shared by every worktree and session of the repository.
- Keep stopping and let the user commit or stash - lost: it turns every blocked lone part into a manual step and invites a commit of half-done work.

The paths must be among the part's `files`, so a user edit elsewhere still stops the run; the attempt count makes sure the part actually ran, so a dirty tree on a first run still stops.

### D4. No settings key

Isolation of a lone part protects nothing, so there is nothing for a team to choose (ADR-0003: a setting only for a real need). The part file's `isolation` stays as the planner wrote it: it records the planner's judgement for the case where the part shares a wave again (a re-cut plan), and a lead that rewrote parts would become a plan author.

### D5. Eval cases on a three-part fixture

A new shared fixture `ledger-totals-three-parts.sh` adds part `03` (`summary(entries)`, depending on `01` and `02`) to `ledger-totals-planned.sh`; the existing cases keep their two-part fixture. Three cases of the execute lead:

- `execute-single-part-wave`: the acceptance signal - worktrees for `01` and `02`, `03` without `--workdir`, its commit on `add-totals` and no merge of a `part-03` branch.
- `execute-resume-worktree`: `01` and `02` merged, `03` pending with a worktree holding its test; graded on `--workdir` for `03` and a merge of `bdk/add-totals/part-03`.
- `execute-resume-main-checkout`: `01` and `02` merged, `03` blocked with its test uncommitted in the main checkout; graded on no stop, no `--workdir`, `03` done and committed.

## Risks / Trade-offs

- [A lone part's failing work sits in the main checkout between runs] -> D3 keeps it as the part's work; the result names the part, and `git status` shows exactly its files.
- [A changed path the part needed but did not list] -> the run stops on it as before; `files` holds exact paths (`bdk plan check` rejects globs and directories), so the comparison is plain.
- [Warm caches in the main checkout hide a dependency the worktree would have lacked] -> intended: the main checkout is where the user runs the product.

## Trial

`claude plugin eval` and a nested `claude -p --plugin-dir` session could not run from the session that built this Change: its permission layer refused to start them (2026-10-09). The skill was tried instead as dry runs: a `bdk:lead`-equivalent agent (sonnet, the lead's default model) read the skill, ran the read-only commands (`git status`, `git branch --list`, `bdk plan check --json`) on the scaffolded workspace of each new case, and wrote the full trace of commands and Agent calls it would make, assuming every worker succeeds.

| Case | Skill | Trace |
|---|---|---|
| `execute-single-part-wave` | new | worktrees and `--workdir` for `01` and `02`, merged with `--no-ff`; `03` with no `--workdir`, `git add -A` and `git commit` in the main checkout, nothing merged; `Status: done` |
| `execute-resume-worktree` | new | `03` alone but its worktree exists: reused, `--workdir .../worktrees/03`, merged, worktree and branch removed |
| `execute-resume-main-checkout` | new | the untracked `src/summary.test.js` kept as part `03`'s work (1 attempt, in its `files`); `03` with no `--workdir`, committed on `add-totals` |
| `execute-resume-main-checkout` | before this Change | stops at step 3: `uncommitted changes: src/summary.test.js`, no agent starts |

The traces named two gaps that this Change then closed in the skill text: step 3's "Done when" still said "a clean tree", and the result template had no line for a done part that ran in the main checkout. The paid eval runs of the three cases (grants in `evals/README.md`) are left for the next local eval pass.
