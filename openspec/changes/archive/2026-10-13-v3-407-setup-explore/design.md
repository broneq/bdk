# Design

## Context

See proposal.md, "Why". `/bdk:setup` (`plugins/bdk/skills/setup/`) detects from manifests, lockfiles, scripts and "the configs they name" (step 2), so a fact that lives in `CLAUDE.md`, a hook, a wrapper script or a test setup file never reaches it. #410 moved `bdk:explorer` to `sonnet` and made the `explore` block follow the test command to its script and setup files and read the project's rules; `explore-project-facts` showed `sonnet` finds a planted wrapper, global setup and hook in 3 of 3 runs. `explore` maps the code one Change touches, starting from the nouns of its proposal, and stops without a configuration; setup has neither a Change nor a configuration.

## Goals / Non-Goals

**Goals:**
- Setup decides from a map of how the project really runs its checks, on any stack.
- Every detected tool setup does not configure is accounted for.

**Non-Goals:**
- Other skills reading the project map.
- Re-measuring the explorer model (#410 settled it).

## Decisions

### D1. A block of its own: `explore-project`

The map is written by a new block `explore-project` on `bdk:explorer`, which setup starts as an agent. The agent's instructions already say "your prompt names a skill; run it", so the brief has to be a skill, and CLAUDE.md asks for one block, one job, each runnable alone with its own case.

- Alternative: a mode of `explore` (no Change argument maps the project). Lost: two jobs with different inputs, sections and stop rules in one skill; `explore` stops without a configuration, which a setup map must not.
- Alternative: setup reads the extra files itself on `opus`. Lost: the issue asks for `bdk:explorer`; a `sonnet` explorer reads cheaper than an `opus` main thread, and it keeps the main thread's context to the map.

### D2. The brief names roles, never a stack

The skill lists what to find by its role (rules, hooks, manifests at any depth, suites with their wrappers and server setup, lint and build with skipped folders and side effects, how a user starts the product, CI) and gives examples from several stacks side by side (`package.json` scripts, Maven and Gradle, `Makefile`, `justfile`, `tox.ini`, a shell script; Playwright `globalSetup`, Cypress `setupNodeEvents`, a pytest fixture, a Testcontainers class, `docker-compose`). It says to Glob for them, never to assume one from the first manifest found: a Java build can carry a Node E2E suite in a sub-folder.

- Alternative: a stack table in the brief. Lost: the issue rules it out; a table invites a stack guess and misses a mix it does not list.

### D3. The map lives in `.bdk/runs/setup/project-map.md`

A run file, ignored with `.bdk/runs/` (step 8 adds the rule on a first run), rewritten on every setup run that detects, so it never goes stale across runs. `run` reads only the Change directories its `run.json` names (`plugins/bdk/src/run/store/status.ts`), so a `setup/` directory there disturbs nothing.

- Alternative: `.bdk/tmp/`. Lost: not BDK's (it belongs to `bdk-explain`, `plugins/bdk-explain/skills/explain/SKILL.md:37`) and not covered by the ignore rules setup writes.
- Alternative: keep the map only in the agent's reply. Lost: the main thread would hold the whole map in context, and a user cannot read what setup decided from.

### D4. Setup runs on `opus` through its frontmatter

`model: opus` in `SKILL.md` applies to the main thread for the rest of the turn the skill runs in and returns to the session model with the next prompt (Claude Code skills reference, frontmatter field `model`, fetched 2026-10-13). Setup runs once per project, so the cost is small against a wrong configuration every later stage runs on.

- Alternative: a `models.setup` role. Lost: no configuration exists before setup; `models` roles are agents (spec `bdk-cli/config`, "Every agent is a models role").

### D5. A left-out tool goes into the report only

One report line per left-out tool: `Left out: <tool> (<file:line>) - <reason>`. `.bdk/settings.yaml` holds settings; a comment about a tool BDK does not run goes stale when the project changes and no `bdk` command reads it.

- Alternative: also a comment in `settings.yaml`. Lost: unread by every command and kept forever by re-runs, which preserve comments.

### D6. A wrapper decides the command, a hook forbids the bare runner

`references/stacks.md` gains "Wrapper scripts": a script is a wrapper when it starts a test runner with something around it (a budget, a server, a container, an environment, a retry). The item runs the wrapper as the project calls it; the `{files}` item goes through the wrapper only when it passes extra arguments on (`"$@"`, `process.argv.slice(2)`), and is left out with a report line otherwise. A budget over 600 s becomes `timeout`. A heavy suite a rule runs for some changes gets `[review]`, the rule named in the report, because `when` has no condition.

### D7. A suite that owns its server gives the E2E `start`

`references/e2e.md` gains "Suite owns the server": the `start` is the server command the suite's setup runs (port, profile, non-secret env), `ready` the URL it drives. A `dev` script the map shows needs a cloud deployment or secrets is not taken. When the suite also starts a service no one command starts, a project script that starts both wins; otherwise setup asks, recommending the suite's server command, and names the service in the report.

### D8. Untracked `.bdk/` content keeps its ignore

When step 8 removes `/.bdk/`, setup lists the untracked paths under `.bdk/` (`git ls-files --others --exclude-standard --directory .bdk/`) and adds `/.bdk/<name>` (with `/` for a directory) for each top-level entry the BDK rules do not cover: what v2 hid stays hidden, and nothing is deleted or asked. The report lists the entries.

- Alternative: ignore only `.bdk/tmp/`. Lost: any other local content (v2 files the user kept) would show up as new files.

### D9. Setup runs no project command

A regression run of `setup-multi-package` ran `uv run --directory api python -m pytest -q` to try the command it had chosen; the eval grants no such command, the call was denied ("don't ask mode"), and setup then gave up every Bash call: no `bdk openspec install`, no `bdk config check` (score 0.78, "Measurement"). Outside an eval the same habit runs a suite that can take minutes, deploy (`setup-node-wrapper`'s `build`) or need secrets. The skill now says setup decides from the files and the map and runs no project command, except the Playwright install the user agreed to.

- Alternative: grant the project commands in the case. Lost: the habit itself is the defect, a user's session would ask for each of them.

### D10. The existing setup cases start the explorer

The nine earlier `setup-*` cases listed no `Agent` among their `allowed_tools`, so their first regression run passed with setup detecting from files alone. Each now lists `Agent` and gets `max_turns: 60` (the explorer adds turns). `setup-existing-openspec` also plants an untracked `.bdk/notes/todo.md` that the v2 `/.bdk/` rule hid, and grades the `/.bdk/notes/` ignore line. A `file_exists` grader on that file failed although the file was there (checked in the kept workspace): the harness does not see a file the scaffold left ignored, so the case grades only the ignore line and the report.

## Measurement

2026-10-13, Claude Code 2.1.292, clean `HOME` and the `git` entry of "Host limits" (`plugins/bdk/evals/README.md`), `--ablation none`, session model default (the setup frontmatter puts the main thread on `opus`; transcripts show `claude-opus-5-5`), explorer on `sonnet`. Cost and time as `claude plugin eval` reports them.

| Series | Result | Cost | Time |
|---|---|---|---|
| Probe `explore-project-map` | 1.00 | $0.35 | 44 s |
| Probe `setup-node-wrapper`, `setup-java-cypress` | 1.00, 1.00 | $1.38 | 196 s |
| `setup-node-wrapper` 3 runs | 0.98: run 2 replaced the deploying `build` with `pnpm exec next build` and gave the reason there, not under "Left out"; the grader read that as missing | $2.20 | 123 s |
| `setup-java-cypress` 3 runs | 1.00 | $2.01 | 98 s |
| Regression `setup-*` (11 cases, 1 run), before D10 | 1.00 each, but the nine earlier cases ran without the explorer | $6.51 | 305 s |
| `setup-node-wrapper` 3 runs, grader accepts a side-effect-free replacement with its reason | 1.00 | $2.15 | 110 s |
| Regression `setup-*` (1 run), after D10 | 8 of 11 at 1.00; `setup-multi-package` 0.89 (paths judge), `setup-existing-openspec` 0.89 (`file_exists` on the ignored file, D10), `setup-node-wrapper` 0.93 (`chromatic` given "calls the Chromatic service" as its reason; the grader now accepts the external service) | $6.45 | 298 s |
| `setup-existing-openspec`, `setup-multi-package`, 1 run each, kept workspaces | `setup-multi-package` 0.78: the D9 defect; `setup-existing-openspec` 0.89: the file was present (D10) | $1.18 | 104 s |
| `setup-multi-package` 3 runs after D9 | 0.78, all three timed out at 300 s on an overloaded host (load average 14-16 from other sessions; the transcripts stall after `openspec schema which bdk`, as "Host limits" describes) | $1.47 | 3345 s |
| `setup-multi-package` 2 runs, host load below 8 | 1.00 | $1.38 | 116 s |
| `setup-existing-openspec`, `setup-node-wrapper`, 1 run each | 1.00, 1.00 | $1.29 | 175 s |

Total: $26.37 and 5014 s of eval time over every run above, failed and repeated runs included. Budget (#407): at most $45.

The maps named every planted fact on both fixtures. On `setup-node-wrapper` setup wrote `pnpm test:e2e` and `pnpm test:e2e {files}` with `timeout: 960`, `start: pnpm exec next dev --port 3100` with `env: {BACKEND_MODE: memory}`, and left out `pnpm build` and `chromatic` with their `file:line`. On `setup-java-cypress` it wrote `./mvnw test`, `scripts/e2e.sh` at `review`, a `start` running the jar with `--spring.profiles.active=e2e` and `ready: http://localhost:8081`, left out Gatling, and left out a Cypress `{files}` item because the wrapper runs Cypress inside `e2e/` where root-relative paths do not resolve.

## Risks / Trade-offs

- [A longer setup run: one more agent] -> the explorer runs on `sonnet` and reads excerpts; setup runs once per project.
- [The map misses a fact] -> setup still reads the manifests and configs itself, and the report names every tool it found and left out, so the user sees what was decided.
