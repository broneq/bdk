## Context

See proposal.md - Why for the reproduction. `npx` (npm 11, `libnpmexec`) runs a bin it finds in `node_modules/.bin` of the workspace or a parent before it resolves anything from the registry, so the stub is reached offline. npm's update notifier (`lib/cli/update-notifier.js`) runs on every command unless `update-notifier` is off or CI is detected, and checks at most weekly against a stamp in the npm cache; under the clean `HOME` of "Host limits" the cache is new, so every call checks. The check is not awaited and its failure is silent, but the run's sandbox reports the denied connection in the tool output.

## Goals / Non-Goals

**Goals:** no `npm`/`npx` call of an eval run makes the update-check request; the Lavish-calling skills never wrap a Lavish command in a compound command; a grader catches a regression of the second.

**Non-Goals:** changing the stubs, the case grants, or how the skills choose between Lavish and `AskUserQuestion`.

## Decisions

**D1. Turn the update check off in the eval script's environment.** `run.ts` passes `npm_config_update_notifier=false` to `claude plugin eval`, whose runs inherit the environment as they inherit `PATH` (the `PATH` handling of `v3-300-eval-openspec-path` D1-D3 relies on the same inheritance). Alternatives: a `.npmrc` with `update-notifier=false` written by each stub scaffold - lost, it is five copies that miss the other `npx` callers (`setup-*`, the OpenSpec `npx` fallback) and puts a file into the workspace the model reads; `CI=true` - lost, it changes how other tools behave (`ci-info` is read by many); a "Host limits" instruction for the contributor - lost, it leaves every run broken by default. The environment is the run's, not the case's, which is where the cause lives.

**D2. Fix the compound command in the skill text, not in the grants.** `design-draft`, `design` and `triage` say what `setup` already says: each command on its own, without `;`, `&&`, pipes or `echo`, because the result shows the exit code and a compound command is not covered by the skill's grant. In a real session a compound command asks the user for permission mid-design; in a run it is denied. Widening the case grants (`Bash(npx *)`) would hide that defect from the suite. Alternative: only D1 - lost, D1 removes the trigger seen on 2026-10-09 but any other surprising output can make the model reach for `; echo $?` again.

**D3. Grade the shape of the Lavish calls.** `design-draft-lavish` and `triage-lavish` gain `lavish-own-command`: a `tool_used` Bash grader with `max: 0` whose `input_match` finds a `lavish-axi` command followed by `;`, `&&`, `||` or `|`. It checks the skill-text rule of D2 directly, so a run fails on the defect itself and not only through the graders downstream of it. The ask cases are not graded for it: their stub fails, and a fallback after a failure is what they measure.

## Risks / Trade-offs

- [Claude Code stops passing the caller's environment to runs] -> the `PATH` handling breaks the same way, and the "Host limits" entry names the setting so a contributor can set it in the shell.
- [The grader's regex misses a form, such as a newline-separated script] -> the denial would still fail the case through its other graders; the regex covers the forms seen in traces.

## Measured

2026-10-09, Claude Code 2.1.292, one arm (`--ablation none`), on a Mac with the "Host limits" setup (clean `HOME`, the `git` shell prefix, a global OpenSpec outside the home directory), each case with its README grants:

| Case | Runs | Score | Cost |
|---|---|---|---|
| `design-draft-lavish` | 3 | 1.00 (was 0.47 on `staging/v3`) | $3.22 |
| `design-draft-ask` | 3 | 1.00 | $1.44 |
| `triage-lavish` | 3 | 1.00 | $1.01 |
| `triage-ask` | 3 | 1.00 | $0.88 |
| `setup-web-app` | 3 | 1.00 | $1.44 |

A further `design-draft-lavish` run with `--keep-temp` (1.00) shows in its transcripts no `<sandbox_violations>` block and three Lavish calls, each a command of its own: `playbook input`, the open, and the main thread's `poll`. The new grader `lavish-own-command` passed in every run.
