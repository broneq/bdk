# Design

## Context

See proposal.md - Why for the measurements. The execute stage today (`skills/stages/execute`, T23, T41) opens one `task-redispatch` ticket per task and dispatches the ticket's `steps` (`simplify`, `tests-scoped`, `lint`) as `simplifier` and `runner` agents under it; in tree mode a `part-lead` agent does the same one level down. The kernel already owns the facts this design builds on: the plan part file with its tasks, `Files:` and `Depends on:` (`kernel-state`, Plan part file), the diff check (`kernel-loops`, Diff check), the tree hash of a target's files (`kernel-state`, Evidence manifest), progress from trailer commits (`kernel-loops`, Progress from git), and the escalation ladder per loop and target.

Constraints:

- The kernel stays the only writer of state (P1); agents never write a report file or an evidence manifest themselves.
- Parts of one wave share the home checkout unless a part asks for `isolation: worktree` (T45); their `Files:` are disjoint, so the wave rule of `bdk next` is unchanged.
- Subagents run no git command that discards or hides work (T3), and no orchestrator command.
- Review stays as #158 leaves it: `review-fix` tickets, the gate runner and `bdk commit <change-id>`.

## Goals / Non-Goals

**Goals:**

- At most two agents per plan part in execute: one `implementer`, one `conformer`; a retry adds one more of each.
- No LLM between a check and its evidence.
- No kernel command blocks on stdin.
- The part's preamble reaches the agent that implements its tasks.

**Non-Goals:**

- Parallel tasks inside one part. The plan splits a part whose tasks should run at once into parts of the same wave.
- Changing the review stage, its packages or its gate runner (#158).
- Reducing the machine records committed into the repository (#164).

## Decisions

### D-1. One `part` loop replaces `task-redispatch` and `part-lead`

The ticket of execute is per part: `bdk attempt open part <nn>`, budget `policy.budgets.part` (default 3), the ladder of `kernel-loops` unchanged (narrow, escalate, park). A later ticket of the same part gets a package that marks the committed tasks, so it continues with the rest, as the lead package did (T41-D11). `attempt close ok` of a `part` ticket requires every task of the part to carry a trailer commit (`policy/tasks-uncommitted` otherwise) and the post-task step evidence of the part (`conform`, `tests-scoped`, `lint`) fresh, and answers `next.action: part-done`.

Alternatives: keep `task-redispatch` and add a part ticket above it (the lead model) - loses the point, the per-task ladder needs a ticket and a package per task; keep the name `part-lead` for the new loop - the ticket has no lead any more, and a name that lies costs more than a rename in an unreleased v3.

### D-2. The implementer is the part agent; the lead is removed

The `implementer` role keeps its name, adapter (`bdk:worker`) and its `review-fix` and merge duties; in execute its target is a part. Its package embeds the whole part file (D-6). The contract: take open tasks in `Depends on:` order; per task a failing test, the code, `bdk check run <task>`, and on `verdict: pass` the commit command the check printed (D-5). On a blocker in the middle of a part, it stops and returns `blocked` with the tasks it committed; the main thread fixes the plan and opens the next ticket. The `lead` role, its adapter, the lead verbs of `hooks pre-tool` and the `SPAWNS` entry of `bdk:lead` go.

Alternative: a new role `part-agent` - two roles with one contract (implementer for review fixes, part agent for execute) would drift; the work is the same.

### D-3. `conformer` replaces `simplifier`; the step `conform` replaces `simplify`

The conformer runs once per part, after the implementer returned, under the same ticket, with fresh context. Input: its package, which carries the part file (the task contracts), the part's commit range (D-5), the rules selected for the part's files and languages (selection is unchanged: stage `execute`, the part's `Files:`; `kernel-cli/rules`, Selection) and the project instruction files that exist (`CLAUDE.md`, `AGENTS.md`, `.claude/rules/*.md`). Work: for each selected rule, each project instruction and each task contract, a yes or a violation with `file:line`; it fixes what fits its contract (simplification, names, comments, a missing test, using an existing helper) inside the part's `Files:`, records every other violation as a `finding` with the rule id as a ref, runs `bdk check run <part>`, and commits its fixes with the command that run prints. The kernel records the `conform` evidence from its stored report at `attempt close ok`, as it recorded `simplify` (T23-D43).

Alternatives: keep `simplifier` with a wider contract - the name would keep steering the model toward "simplify only", which is what the B1 data shows; run the rule check inside the implementer - the issue's risk "the agent checks its own work" stands, a second agent with fresh context is the cheapest independent check.

### D-4. `bdk check run`: the kernel runs the checks

`bdk check run <task|part> --ticket <ticket>` is a new command group (`kernel/src/check/`, availability `agent`). For an open `part` or `verify-fix` ticket whose part holds the target, it:

1. runs the diff check of the target (D-5) and refuses `policy/do-not-touch` before running anything;
2. composes each step kind's commands from `tools` exactly as the runner package does today (`tests-scoped`: the `fast` test entries' `related`, `scoped` or `command` with `{files}` filled; `lint`: each lint entry's `scoped` or `command`), over the target's executable files;
3. runs each command through `/bin/sh -c` in the target's work root with stdin closed, a timeout of `execution.checks.timeout` seconds (default 300, at most 540, so the call ends inside a 600 s shell limit), and a combined stdout and stderr capture;
4. writes each output to `.bdk/.machine/checks/<ticket>/<target>-<kind>-<tool>.txt`, ending with `exit <code>`, or `timeout <seconds>`;
5. records one manifest per kind with `source: kernel`: `pass` when every command of the kind exited 0, `not-run` when the kind has no command, the target no executable file, or a command was not found (exit 127), `fail` otherwise;
6. answers with each check's command, exit code, verdict, file and the last 20 lines of a failing output, the evidence ids, the overall verdict, and for a passing task the commit command (D-5).

A step kind the graph skips (a tool group declared `none`, T49) is not run. The exit code is 0 whenever the checks ran, whatever their verdict, as for `bdk evidence check --json`: the verdict is data the agent acts on.

Alternatives: keep the runner and only fix its check paths - keeps the cold start and the haiku misuse of shell; let the agent run the tools and call `evidence record` - the B1 refusals (26 missing citations) and cross-ticket citations are exactly that path.

### D-5. Plain git commits; the diff check moves to `check run` and to the part close

User decision 2026-10-07. For a passing task, `bdk check run` prints:

```
git add -- <touched declared paths> && git commit -m "<task title>" --trailer "BDK-Change: <id>" --trailer "BDK-Part: <nn>" --trailer "BDK-Task: <nn-m>" -- <same paths>
```

and for a passing part target with touched paths, the same form with `--trailer "BDK-Ticket: <ticket>"` instead of `BDK-Task` and the subject `refactor(<nn>): conform part <nn>`. The paths are the touched paths the target declares, so a path of another part's work in flight never enters the commit. Progress from git (`kernel-loops`) accepts a commit with `BDK-Part` and the `BDK-Ticket` of a `part` or `verify-fix` ticket of that part as part work that commits no task.

`hooks pre-tool` allows `git add` and `git commit` to the `bdk:worker` adapter only, and denies `git commit` with `--amend`, `--no-verify`, `-n`, `-a`, `--all`, a short cluster holding `a` or `n`, `--fixup`, `--squash` or `--allow-empty`, and `git add` with `-A`, `--all`, `-u`, `--update`, `-f`, `--force` or the pathspecs `.`, `./`, `:/` and `*`; stash, reset, clean, restore, merge, rebase, cherry-pick and push stay denied. Two part agents committing at once may meet git's `index.lock`; the contract has the agent run the same command again.

`attempt open part` stamps `base`, the `HEAD` commit at open, on the record. The diff check of a `part` ticket (at `attempt close`) classifies the union of the working tree's touched paths and the paths of the commits in `base..HEAD` that carry `BDK-Part: <nn>`; so a committed path outside `Files:` is still reported, and a committed `do-not-touch` path still refuses, with `instead` naming the commit. `bdk commit <task>` is removed; the commit lock stays and covers `bdk commit <change-id>`, the only kernel commit left besides the checkpoint, and the merge back of `part done`. A part agent's `git commit` takes no kernel lock; it meets git's own `index.lock` and runs again. `bdk part done` runs the checkpoint of the Change directory, so attempt records, reports and evidence reach git once per part instead of with every task; the checkpoint already skips while another ticket is open, and the last part of a wave catches up.

Alternatives: a thin `bdk commit <task>` run by the agent (recommended to the user, declined: the user prefers the agent to use git directly); a git pre-commit hook installed by `bdk:setup` - writes into the user's `.git/hooks`, which other tools own.

### D-6. Packages per part

`bdk dispatch build <part> implementer <ticket>` embeds the part file's body (headings demoted), its `do-not-touch`, a `Tasks` section (each task with its title, `Files:`, `Depends on:` and `committed` or `open`, from trailers), and a `Checks` section naming `bdk check run <task> --ticket <ticket>`. `bdk dispatch build <part> conformer <ticket>` embeds the part file and adds `Range` (the `base` of the ticket and the part's commits since, as `git log`/`git diff` commands) and `Project instructions` (the files of D-3 that exist). Both packages carry a `draft` path for the report (D-7). A task target is refused (`input/invalid-argument`), since no ticket targets a task any more. The package limit stays 160 KiB; a part within D-9's limits fits well inside it.

Alternative: keep the `Read:` list for the part file - the B1 implementer of task 02-2 had the path and still missed the preamble because its package held only the task; the part agent reads the whole file either way, but embedding it puts it in front of the agent before anything else.

### D-7. Reports come from a file; stdin readers never wait

`bdk log ingest --ticket <t> --file <path>` reads only the file; there is no stdin form. A role writes its report with the host's `Write` tool to the package's `draft` path, `.bdk/.machine/drafts/<package name>`, then ingests it. The read-only adapters (`reader`, `reviewer`, `scout`) and `runner` gain `Write`; `hooks pre-tool` denies an `Edit` or `Write` of a read-only adapter or the runner outside `.bdk/.machine/drafts/` (`guard/draft-only`), and Bash writes stay denied to read-only adapters as today.

The process runtime's stdin read, used by `log add --body -`, `rules accept -`, `review render --pr -`, `diagnostics write` and the hooks, becomes asynchronous: a terminal refuses at once with `input/stdin-unavailable`; a pipe that gives no byte within 3 seconds refuses with the same rule; after the first byte it reads to the end. A hook's payload arrives at once, so hooks are unaffected.

Alternatives: keep the stdin form of `log ingest` with a TTY check (declined by the user: two forms, and the B1 hang was not a terminal but an inherited pipe that never closed, which only a timeout catches); write the draft with a heredoc - the B1 `cat > /tmp/r.md` hang is that form going wrong.

### D-8. Evidence files belong to their ticket

`bdk evidence record` refuses, for an agent (not kernel) record, a file outside `.bdk/.machine/checks/<ticket>/` with `policy/evidence-outside-ticket`, where `<ticket>` is the ticket id without a group. The gate runner of review (its package's `Checks` intro) names that directory. `bdk check run` writes there itself.

### D-9. Part size in the kernel

Two settings under a new `plan.part` module: `max-tasks` (default 5, 1 to 8) and `max-files` (default 10, 1 to 30, distinct `Files:` paths of the part). The `tasks` check of a plan part uses `max-tasks` instead of the constant 8, and a new `files` check refuses with `policy/part-too-many-files`; both name `bdk part split <nn> <task-ids>`. The byte limit stays the constant 8192 (S1). `/bdk:plan` writes parts within the limits, and the verifier treats a part over them as a blocker the kernel would refuse anyway.

Alternative: constants only, like the byte limit - the user chose settings, since the right size depends on the project's file granularity.

### D-10. One execute model in `bdk next`

`executeWave` drops `mode`; the wave rules (disjoint `Files:`, worktree isolation, `max-live`) are unchanged. `execution.tree` is removed from the settings registry; a layer that still sets it fails validation as an unknown key, the treatment of every removed key in an unreleased v3.

### D-11. Costly commands

`/bdk:plan` writes each acceptance as the exact commands to run, never "every command except"; the verifier's blocking categories gain `costly-command` (an acceptance that can run a command that spends money, needs credentials or reaches a shared system, or names its commands by exclusion); the implementer contract forbids running such a command without an accepted `decision` entry naming it, and has it return `blocked` instead.

## Risks / Trade-offs

- [The part agent's context grows with each task] → D-9 caps a part at 5 tasks and 10 files; the agent reads one part file, not the plan.
- [No parallelism inside a part (B1 ran 04-2 to 04-5 in parallel)] → the plan splits such a part into parts of one wave; `bdk next` already runs a wave's parts in parallel.
- [The agent checks its own work] → evidence comes from `bdk check run`, never the agent's account, and `conform` is a separate agent; `attempt close` refuses without fresh step evidence.
- [A plain `git commit` without trailers or with extra paths] → the task stays uncommitted for `attempt close` (`policy/tasks-uncommitted`, `instead` naming the amend command the main thread runs), and the part close's diff check reads the part's commits, so an extra path is reported or refused.
- [Two part agents committing at once hit `index.lock`] → the contract repeats the command; the window is a few milliseconds.
- [A check command that runs longer than `execution.checks.timeout`] → recorded `fail` with `timeout <seconds>` in the file; the project raises the setting or narrows the command.
- [A blocker in the middle of a part] → the agent returns `blocked` with its committed tasks; the next ticket's package marks them committed.
- [Breaking settings and loop names] → v3 is unreleased; validation names the unknown keys, and `bdk config` shows the new ones.

## Migration Plan

No migration: v3 is unreleased, and no Change in flight survives a kernel change of this size. An attempt record with loop `task-redispatch` or `part-lead`, a manifest of kind `simplify` and a settings layer with `execution.tree` or `policy.budgets.task-redispatch` fail validation with the field named; the user finishes such a Change on the earlier kernel or starts it again.

## Open Questions

None.
