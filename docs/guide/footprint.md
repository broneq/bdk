# Cost and footprint - what a run costs, what it may do, and what it leaves behind

## Time and cost

One measured run, for scale: a Change of 7 plan parts, 27 tasks and 62 files, with both gates on `auto`, went from an approved plan to an open pull request in 22.9 minutes of machine time and cost $7.42 (execute 7.8 min, two review rounds 11.6 min, close 3.0 min; the main conversation on opus, every agent on its default model). Design and plan come before that and add their own time, mostly the verifier's passes. A small Change of one or two parts takes a fraction of it; your own numbers depend on the project, the models and how often a stage waits for you.

What drives the spend:

| Setting | Effect |
|---|---|
| `models.<role>.model`, `models.<role>.effort` | the agents' models and effort; by default the [verifier and the integration reviewer run on opus](/reference/bdk/agents), the designer and the planner on your session's model, every other role, the explorer included, on sonnet, all at your session's effort |
| `policy.budgets.verifier` | how many design and plan verification passes a stage may spend |
| `policy.budgets.part-attempts`, `policy.escalation.model`, `policy.escalation.effort` | retries of a failing part; the last one runs on opus |
| `policy.budgets.review-rounds` | review rounds, each with a reviewer per group of files, the spec check on the verifier (opus), the integration reviewer, the E2E tester and the judge |
| `execution.max-parallel` | how many reviewers run at once: wall-clock time more than total cost |

[Configuration](./configuration.md#spend-less-or-check-more) has a cheaper and a more thorough profile.

To see where one of your runs spent its time and money, run [`/bdk:diagnose-run`](./diagnostics.md) after it.

BDK is worth its cost on a change with behaviour to specify and check. A typo, a version bump or a one-line fix you can see whole is faster done directly.

## What it may do without asking

`/bdk:setup` adds these rules to `.claude/settings.json`, so the stages run their commands without a prompt each time: `Bash(bdk *)` and `Bash(*/bin/bdk *)`, `Bash(openspec *)`, `Bash(git *)`, `Bash(gh *)`, your project's test, lint, build and E2E commands, and `Edit(.bdk/runs/**)`, so an agent running a check command can write its output file under `.bdk/runs/`. When a check item's `timeout` is above 600 seconds it also sets `env.BASH_MAX_TIMEOUT_MS`, the cap of one Bash call ([long checks](/guide/configuration#long-checks)). `git *` includes `git push`, and `gh *` includes `gh pr create`. Claude Code asks you before it writes these rules; narrow or remove any of them in `.claude/settings.json` and the stages ask instead.

What the stages actually do with them:

- The Change's commits never land on your base branch: `/bdk:execute` and `/bdk:close` switch to a branch named after the Change when they start on the base.
- `/bdk:close` pushes that branch with `git push -u origin <branch>`, never with `--force`, and opens one pull request into the base. Nothing in BDK merges a pull request.
- `/bdk:pr-review` posts one review to a pull request only after you agree, or when `policy.questions` is `decide-and-record`.
- `/bdk:propose`, `/bdk:run` and `/bdk:debug` read issues with `gh issue view`; triage creates an issue only for a finding you defer with "create one".
- With `hooks.subagent-git: true`, every subagent except the lead is refused commands that change git history.

## What it leaves in your repository

| Path | Committed | Written by |
|---|---|---|
| `.bdk/settings.yaml` | yes | `/bdk:setup`, then you |
| `.bdk/settings.local.yaml` | no (git-ignored) | you |
| `openspec/config.yaml`, `openspec/schemas/bdk/` | yes | `/bdk:setup` |
| `openspec/changes/<change>/` | yes, with the Change | propose, design, plan |
| `openspec/changes/archive/`, `openspec/specs/` | yes | `/bdk:close` (the archive and the merged specs) |
| `.bdk/runs/` | no (git-ignored) | every stage ([run state](/concepts/run-state)); the checks write `checks/<id>/plan.json`, one output file per command and `checks/<id>.json`; `/bdk:setup` keeps its project map in `.bdk/runs/setup/` |
| `.claude/settings.json` | yours to decide | `/bdk:setup` (the permission rules above, and `env.BASH_MAX_TIMEOUT_MS` for a long check) |
| `.gitignore` | yes | `/bdk:setup` (two lines, plus one per local path under `.bdk/` that a BDK v2 `/.bdk/` rule hid) |
| `.bdk/tmp/` | no (ignored by its own `.gitignore`) | scratch files of BDK plugins, such as the pages of [`bdk-explain`](./explain.md); delete it at any time |

## What leaves your machine

- Everything the agents read and write goes through Claude Code to the model, as in any Claude Code session.
- `gh` talks to GitHub: issues read, a pull request opened, a review posted.
- `npx` downloads `lavish-axi` (the decision pages) from npm when a stage first needs it; the browser E2E check installs Playwright from npm into the run directory when your project has none.

The `bdk` command line itself makes no network calls; it runs none of your project's commands: `bdk check plan` prints them and the agents run them, and they do whatever they do.

## Sources

- `plugins/bdk/evals/README.md` (the measured run), `plugins/bdk/agents/*.md` (default models)
- `plugins/bdk/skills/setup/`, `execute-waves/`, `close/`, `pr-review/`, `triage/`
