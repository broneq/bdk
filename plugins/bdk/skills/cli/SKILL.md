---
name: cli
description: Answers questions about the state of a BDK project with the bdk command line - the resolved configuration and where a value comes from, where an autopilot run stands, the findings of a review round, plan part limits, check results, the rules for a stage - and routes work to the right /bdk:* skill. Use when asked to show a BDK setting, why a run or review stopped, what a round holds, or which bdk command does something.
allowed-tools: Bash(${CLAUDE_PLUGIN_ROOT}/bin/bdk *) Bash(openspec status *) Read Glob Grep
metadata:
  fronts-cli: bdk
---

Answer from `bdk`, not from memory or by reading `.bdk/` files. Run it as `"${CLAUDE_PLUGIN_ROOT}/bin/bdk"`, one command per call. `bdk --help` lists the groups, `bdk <group> --help` the commands; read the help of a command before its first use. Add `--json` to parse the result. Exit 1 means "the answer is no" with a normal result (a red check): read stdout. Exit 2 is a usage error, 3 an environment error, 4 a bug.

Questions you answer with a read command:
- Which value a setting has and where it comes from, or whether the configuration is valid: `bdk config show [<key>]` and `bdk config check`.
- Where the autopilot run stands, which Change is current, what stage each is in: `bdk run status`.
- What a review round holds, by level and decision: `bdk findings list <log>`; the log is `.bdk/runs/<change>/review/round-<N>/findings.jsonl`.
- Whether the plan parts of a Change fit the limits: `bdk plan check <dir>`.
- Which rules a role reads for its stage and files: `bdk rules for`.
- What a branch changes and how reviewers split it: `bdk git scope <base>` and `bdk git groups <base>`.
- How long a finished run took, what it cost per stage and agent, and what the detectors flag in its transcripts: `bdk diagnostics report [<change>]`. For the analysed report, with the run files and fixes, use `/bdk:diagnose-run`.
- The state of a Change is `openspec status --change <name>`, not a `bdk` command.

Commands that write belong to a stage skill; call one yourself only when the user asks for exactly that: `bdk config set` (user's request), `bdk findings add`, `bdk findings level` and `bdk findings decide` (review, judge, triage), `bdk findings report` (rewrites review.md), `bdk check run` (execute, review), `bdk openspec install` (`/bdk:setup`). The host runs `bdk hooks session-start` and `bdk hooks pre-tool-use`; never call them.

The CLI never runs a stage. For work, not a question, use the skill: `/bdk:run` for an intent or issues to pull requests, `/bdk:propose`, `/bdk:design`, `/bdk:plan`, `/bdk:execute`, `/bdk:auto-review`, `/bdk:close` for one stage, `/bdk:debug` for a bug, `/bdk:pr-review` for a pull request, `/bdk:diagnose-run` to analyse a finished run.

Done when the reply states what the command printed, in your words, and names the command you ran.
