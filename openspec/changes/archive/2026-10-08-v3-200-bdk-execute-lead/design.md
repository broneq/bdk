# Design

## Context

See proposal.md for why. What this Change builds on:

- Architecture (`docs/design/2026-10-07-v3-architecture.md`): D1 (hybrid: a long mechanical stage runs in a lead subagent), D3-0 (the execute lead is the only writer of `state.json`), "Layers" (`/bdk:execute` is a thin main-thread skill that starts `bdk:lead`; the lead starts workers as foreground `Agent` calls, several in one message, because a subagent does not wait for background children, `lead-detach`), "Flows / Execute" (absolute run directory for every agent; workers never touch git history; the lead commits each part and merges the worktrees in part order after each wave; the implementer of the later part resolves a merge conflict), "Run state, run artifacts and resume", and the risk rows "Guard blocks the merge-back" and "Worktree merge conflicts".
- D8 of `docs/design/2026-10-07-v3-skills-decisions.md`: `execution.max-parallel`, the lead runs a larger wave in batches; this Change measures the default.
- What exists: `implement-part` and `conform-part` on `bdk:implementer` and `bdk:conformer` (#192, spec `bdk-execute-blocks`); `bdk plan check --json` with waves, `overlap` and `shared-not-alone` (#185, spec `bdk-cli/plan`); the `state.json` schema and `bdk run status` (#188, spec `bdk-cli/run`); the guard `hooks.subagent-git`, which exempts `bdk:lead` (#182); `policy.budgets.part-attempts` (3), `policy.escalation.model` (`opus`), `execution.lead` (spec `bdk-cli/config`); the eval suite (#189) and the ledger fixtures; `/bdk:plan` ends naming `/bdk:execute <change>` (#199).
- Inputs read, not copied: draft 1 `skills/stages/execute` and `skills/swarm` (kernel loop `bdk next`, tickets, `dispatch build`, `attempt open|close`, `part start|done`, background workers with the main thread as the waiter, the kernel merging worktrees). Kept: one agent per part, conform after implement under the same part, waves of about 5 at once, escalation to a stronger model, "the host's own `isolation: worktree` branches from the default branch, not from the Change". Dropped: every kernel command, tickets, envelopes and the ledger; the findings record that this bookkeeping made 1,349 of 1,808 Bash calls.

## Goals / Non-Goals

**Goals:**

- One command builds a whole verified plan: waves in order, the parts of a wave in parallel, each part implemented then conformed, committed, merged.
- The main thread gets one result line and a file, not every agent's result (the B1 main thread held 1,037 turns).
- A blocker the lead cannot clear reaches the main thread with its evidence; nothing is worked around.
- A break at any point resumes from `state.json`, the run files and git.

**Non-Goals:**

- Fixing review findings through execute and later rounds on their scope (#201).
- The autopilot `/bdk:run` and its policy decisions across stages (#203).
- Measuring execute time on the B1-sized fixture (follow-up issue; the fixture is #243).

## Decisions

### D1. Two skills and one agent: thin `/bdk:execute`, lead skill `execute-waves`, agent `bdk:lead`

`/bdk:execute` (main thread) checks the configuration and the Change, starts `bdk:lead` with the prompt `Run the skill bdk:execute-waves with the arguments: <change> --run-dir <abs>`, waits, relays the result and handles a blocker. `execute-waves` (`user-invocable: false`) holds the whole stage; started anywhere but on `bdk:lead` it does nothing and names `/bdk:execute`. `bdk:lead` (sonnet, `Read Write Edit Bash Grep Glob Skill Agent`) runs the skill its prompt names, so `review-round` (#201) and `pr-review` can use the same agent.

Why: the architecture names the thin command and the lead (D1 hybrid, "Layers"). The skill is run through `Skill` from the prompt, the pattern of #192 D1: a preloaded skill gets no arguments, and the `Skill` call shows in a transcript. The lead skill does not hand off to the agent by itself (unlike the blocks) because the thin command is the only entry and holds the blocker dialogue.

Alternatives: one skill that is both command and lead, handing off as the blocks do - lost: the main-thread part (relay, ask, `SendMessage`) and the lead part would share one text and each would read the other's steps. `skills:` preload on `bdk:lead` - lost: the lead is shared by several stage skills, and a preload loads all of them into every lead.

### D2. A worktree part's agent works through `--workdir`, not a changed working directory

The lead makes the worktree itself (`git worktree add <run dir>/worktrees/<NN> -b bdk/<change>/part-<NN>`, from the Change branch) and passes `--workdir <worktree>` to `implement-part` and `conform-part`. With `--workdir` a block uses absolute paths under the worktree for every file tool and runs git as `git -C <workdir> <command>` and every other shell command as `cd <workdir> && <command>`, one command per call (the eval runs showed the host denying `cd` followed by `git`, and any longer chain, in a session that grants commands one by one); `bdk check run` then resolves the configuration and runs the checks in the worktree, and writes results under the absolute `--run-dir` in the main checkout.

Why, from the probes under "Measurements": a subagent cannot get a working directory of its own. `cd` does not persist between a subagent's Bash calls (host docs); `EnterWorktree` with the path of an existing worktree is refused in a subagent, and the refused worker wrote its file into the main checkout instead; the host's `isolation: worktree` branches from the remote default branch unless the user sets `worktree.baseRef: "head"`, refuses every `Write` into the main checkout (so reports could not reach the run directory), and makes a new worktree per agent (so the conformer could not see the implementer's work). `cd <dir> && git ...` passes with only `Bash(git *)` granted.

The worktrees live under the run directory, which `/bdk:setup` ignores (`/.bdk/runs/`), so they never show in `git status` of the main checkout. The lead removes each one after its merge.

Alternatives: the host's `isolation: worktree` plus `worktree.baseRef: "head"` written by `/bdk:setup` - lost on the two refusals above and on a setting changed for the user's other sessions. A `bdk -C <dir>` option - lost: `cd <dir> &&` already does it, and no measurement asked for a helper (CLAUDE.md, "Building skills (v3)"). Worktrees outside the project - lost: a sandboxed or default-mode agent may not reach them.

### D3. Waves from `bdk plan check --json`; which problems stop the stage

The lead stops before any part when a part has no wave (frontmatter, cycle, unknown dependency, which make the order unknown) or a `shared` part has company in its wave (the stage's own invariant: a shared part works in the main checkout). Size problems and `overlap` are recorded under `Decisions taken without the user` and do not stop the stage: `/bdk:plan` and `verify-plan` already accepted the plan, and an overlap is the case the merge-back resolves (architecture risk "Worktree merge conflicts").

Alternatives: stop on every problem - lost: the exit code 1 of `plan check` covers advice as well as broken order, and the architecture plans for overlaps at merge time. Compute waves in the skill - lost: that is what the command is for.

### D4. Batches, foreground calls, implement then conform

Per wave, the lead starts the implementers of a batch (at most `execution.max-parallel` parts, in part order) as foreground `Agent` calls in one message, then the conformers of the parts reported done in one message, then the retries. It waits for every call of a message (`lead-fg`), so a part's conform waits for the slowest implementer of its batch.

Why: a lead must start its workers as blocking calls (`lead-detach`); one message per step keeps the parts parallel. Pipelining each part's conform after its own implementer would need background workers, which a lead cannot wait for.

Alternatives: one batch per part chain (implement, conform, commit) - not available with foreground calls; background workers with the main thread waiting - the draft 1 shape, lost on main-thread turns.

### D5. Default `execution.max-parallel` is 10

Measured (see "Measurements"): one lead started 10 and then 19 foreground workers in one message, and all of them ran at the same time; the 20th was refused by the host's limit of 20 running subagents per session (`CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS`), which counts the lead. The default is 10: well inside the measured concurrency, and leaving the other half of the host's slots for the main thread's own agents and a second lead, since a refused spawn tells the model not to retry. A part agent also runs the project's checks, so parts in parallel multiply test processes on the machine; that load is not measured and a team lowers the key if its suite is heavy. B1's widest wave had 4 parts, so the limit rarely binds.

Alternatives: 5 (D8's placeholder) - lost: the measurement showed no reason to halve a wave of 6 to 10. 19 - lost: no headroom; a refused spawn in the middle of a batch is a failure the lead must then handle.

### D6. Retries, escalation and which blockers are final

Within one execute run a part gets `policy.budgets.part-attempts` implementer runs; the last runs on `policy.escalation.model` (architecture "Flows / Execute": "retry, then a stronger model"). A retry follows `Kind: other` (checks stay red), a conform `FAIL`, or a missing report. `Kind: plan-defect` and `Kind: environment` are final at once: a retry cannot fix the plan or install a tool, and the implementer stops before editing on a plan defect (#192 D3), so a retry would only spend a run. A retry reuses the part's worktree, so `implement-part` continues from the files; it now also reads a failed conform report (spec delta), because a conform `FAIL` names a task the part did not deliver.

After a wave with a blocked part, the lead merges the done parts of that wave and stops. Later waves depend on earlier ones by construction; running only the independent remainder would save little and make the result harder to act on.

### D7. Commits and merge-back

The lead commits a part when its conform passes: `git -C <worktree> add -A` and `git -C <worktree> commit`, or the same in the main checkout for a shared part. The message follows the style of `git log` in the project (a Conventional Commits project gets `feat(<scope>): ...`) and names the part. After the wave, the lead merges each done worktree branch into the Change branch in part order with `git merge --no-ff --no-edit`, then removes the worktree and the branch. The main checkout's tree must be clean at the start; worktrees need committed Change artifacts, and a merge into uncommitted work would mix the user's changes into a part's merge.

On a conflict, `resolve-conflict` runs on `bdk:implementer` in the main checkout (D8). On `done` the lead checks `git diff --name-only --diff-filter=U` is empty and no file holds `<<<<<<<`, `git add`s the resolved files and runs `git commit --no-edit`. A second failure aborts the merge and blocks the part, keeping its branch for the user.

Why: the architecture gives commits and merges to the lead only, and the guard exempts `bdk:lead`. `--no-ff` keeps each part visible in the history, which the review's scope since the last round (`bdk git scope`) and a reader both use.

Alternatives: rebase or cherry-pick the parts onto the Change branch - lost: rewrites the part commits the conform report describes, and conflicts then arise per commit. The lead resolving conflicts itself - lost: an orchestrator only composes blocks (principle 2); the architecture names the implementer.

### D8. `resolve-conflict` is its own block on `bdk:implementer`

A merge conflict is a different job from building a part: the input is the unmerged files and the intents of the parts that touched them, the output is a file that keeps both, and the limits differ (only the unmerged files; the merge stays open for the lead). It runs on `bdk:implementer`, as the architecture names, so the agent text names both skills. It checks with `bdk check run <run dir> merge-<NN>` scoped to the unmerged files and the files of the parts it read, so both parts' tests run. A real contradiction between the parts (both define the same function differently) is `Kind: conflict`: picking a side would hide a plan defect the overlap check reported.

Alternatives: a `--conflict` mode inside `implement-part` - lost: the block's steps (contract check, red tests, part checks) do not apply, and one block one job (CLAUDE.md). The implementer resolving inside its worktree by rebasing - lost: workers never touch git history.

### D9. `state.json` and the result

The lead writes `state.json` (schema of spec `bdk-cli/run`) after each batch step: `attempts` counts every implementer run across execute runs, `status` becomes `done` only after a conform `PASS`, and `blocked` carries the reason. A new execute run gives pending and blocked parts a fresh budget, so a user who fixed the plan reruns `/bdk:execute` and the part starts again. `execute/result.md` is the stage's file for the main thread (not `summary.md`: Claude Code refuses a subagent's `Write` to a file named `REPORT*`, `SUMMARY*`, `FINDINGS*` or `ANALYSIS*` `.md`, seen in the first orchestrator eval run and in the 2.1.292 and 2.1.294 code) and for a resumed `/bdk:run`; the lead returns its first line and path only (architecture risk "Bottleneck").

### D10. The blocker dialogue stays in the main thread

`/bdk:execute` relays `Status: blocked` with each blocker's command (`/bdk:plan <change>` for a plan defect, `/bdk:setup` for an environment blocker). With `policy.questions: stop` it asks the user (with `AskUserQuestion`, or in the reply when that tool is not available) whether to retry or stop, and on a retry continues the same lead with `SendMessage`, which resumes a finished agent with its context. With `decide-and-record` it stops and records that it did not retry: no policy can clear a plan defect or a missing tool, and `/bdk:run` (#203) decides the next stage. A subagent cannot use `AskUserQuestion`, so the lead never asks.

### D11. No CLI helper

Every step of the lead is `bdk plan check --json`, `bdk config show`, `git`, a `Read`, a `Write` of `state.json` or the result, and `Agent` calls. No eval or measurement asked for a command; the eval runs are recorded under "Measurements".

### D12. Eval cases

A shared fixture `ledger-totals-planned.sh`: tiny-ledger configured for BDK with the Change `add-totals` (spec delta on `ledger`: `income(entries)` and `expenses(entries)`), its plan of two `worktree` parts in wave 1 that both list `src/ledger.js`, each with its own test file, and a passing `plan/verify-1.md`. Both parts add a function at the end of `src/ledger.js`, so merging the second part conflicts every time.

| Case | Tag | Scaffold | Graders |
|---|---|---|---|
| `execute-wave-conflict` | orchestrator | the fixture | `file_exists` `execute/result.md`, `execute/merge-02.md`; `regex` result `^Status: done`; `regex` `state.json` both parts `done`; `regex` `src/ledger.js` of the branch holds both functions and no marker; `regex` the branch log holds a merge of `bdk/add-totals/part-02`; `tool_order` Skill `execute` before Agent `bdk:lead`; `tool_used` Skill; `regex` on the trace: `git worktree add` before `git merge`; `llm` reply |
| `execute-plan-defect` | orchestrator | the fixture with task 1 of part 02 contradicting its scenario | `file_exists` result; `regex` `^Status: blocked`; `regex` `state.json` part `02` `blocked` with `attempts: 1`; `regex` part `01` `done`; `llm` reply names part 02, the plan defect and `/bdk:plan` |
| `resolve-conflict-two-functions` | block | the fixture with both parts committed on their branches, part 01 merged, the merge of part 02 stopped on the conflict, both part reports | `regex` `src/ledger.js` both functions, no marker; `file_exists` `execute/merge-02.md`; `regex` `^Status: done`; `regex` `checks/merge-02.json` `pass`; `regex` `MERGE_HEAD` still present (merge left to the lead); `tool_used` Agent `bdk:implementer`; `tool_used` Skill |

Prompts ask as a user would. Grants: `Write`, `Edit`, `Bash` narrowed to `bdk`, `git`, `mkdir -p` and `cd`. The orchestrator cases are one arm (`--ablation none`).

## Risks / Trade-offs

- [A worker writes into the main checkout instead of its worktree] -> the blocks name the work directory in every path rule, and the lead checks before each merge that the main checkout's tree is clean; a dirty tree blocks the wave with the paths named, and nothing is merged into it.
- [`cd <worktree> &&` prompts in a default permission mode] -> git never follows a `cd` (`git -C`), each call holds one command, and the worktree is inside the project, so `cd` stays in the allowed directories; the probe in auto mode passed, and the `dontAsk` eval runs pass with `Bash(cd *)`, `Bash(git *)` and the `bdk` binary granted.
- [Test runners in the main checkout pick up test files in a leftover worktree under `.bdk/runs/`] -> the lead removes each worktree after its merge; a blocked part's worktree stays and the result names it; review checks run after execute, when only blocked parts leave one.
- [A merge resolution keeps both sides but breaks behaviour] -> the merge checks run both parts' tests; the review round's integration review reads the merged code.
- [A foreground batch waits for its slowest part] -> wave depth decides the duration (architecture); the B1-sized measurement (follow-up) shows whether pipelining needs background workers and a different waiting scheme.
- [The lead skips a step (a conform, a state write)] -> every step writes a file the next one reads: no commit without `conform-NN.md` `PASS`, no `done` without it; the eval grades `state.json` and the result.

## Measurements

Host probes, Claude Code 2.1.294, `claude -p` with a probe plugin (agents `probe:lead` on haiku with `Agent`, `probe:worker` on haiku) in a scratch git repository outside this one:

| Probe | Result |
|---|---|
| Worker calls `EnterWorktree` with the path of a worktree the caller made under `.claude/worktrees/` | Refused: "the session cwd is the repository root, not a worktree". One of two workers then wrote its file into the main checkout |
| Worker started with `isolation: "worktree"` | Own worktree on `worktree-agent-<id>` from `HEAD` (no remote in the probe; with a remote it is the default branch unless `worktree.baseRef: "head"`); `Write` to the main checkout's `.bdk/runs/` refused ("Edit the worktree copy of this file instead"); a shell redirect there passed |
| Worker runs `cd <worktree under .bdk/> && git status --porcelain && pwd` with only `Agent`, `Bash(git *)` and `Write` granted | Ran in the worktree, no prompt; `Write` with the absolute worktree path landed in the worktree |
| Lead starts 10 foreground workers in one message, each `sleep 30` | All 10 ran at once: starts within 8 s, 45 s for the batch |
| Lead starts 20 foreground workers in one message | 19 ran at once; the 20th was refused by the limit of 20 running subagents (`CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS`, default 20, the lead counted) |
| Main thread in `claude -p` starts the lead with `run_in_background: true`, the lead runs two 40 s workers | The main thread waited for the notification and replied with the lead's result (55 s in all): a background lead works in `-p` |

The last probe answers the architecture's open item "Whether the main thread in `claude -p` keeps running while a background lead works": it does, so `execution.lead` keeps its default `background` in both modes and `foreground` stays a switch.

## Open Questions

None.

### Eval runs (`claude plugin eval`, Claude Code 2.1.292)

| Case | Arms | Result |
|---|---|---|
| `resolve-conflict-two-functions` | with / without, 3 runs each | WITH 1.00, W/OUT 0.33, delta +0.67 |
| `execute-plan-defect` | one arm, 2 runs | 1.00 (2 of 2) |
| `execute-wave-conflict` | one arm, 2 runs | 1.00 (2 of 2), about 140 s and $0.90 a run; an earlier run lost its `reply` vote on a grader that read "worth a look in review" as asking the user to resolve the conflict, so the grader now says that is no FAIL |
| `implement-part-*`, `conform-part-*` after the `--workdir` change | one arm, 1 run each | 1.00 on all 4 |

What the first orchestrator runs showed, and what changed: the host refuses a subagent's `Write` to `summary.md` (the result file became `execute/result.md`); in `dontAsk` mode the host denies `cd <dir> && git ...` and any longer chain (workers run git as `git -C <workdir>` and one command per Bash call); the default case timeout of 300 s was too short for two waves of agents (`timeout_seconds: 900`).
