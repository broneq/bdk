# Configuration - layers, the commands that change them, and common settings

BDK reads one configuration, merged from three YAML files over the defaults. Every key, with its type, default and meaning, is in the [settings reference](/reference/bdk/settings).

| Layer | File | For |
|---|---|---|
| `default` | built into the plugin | every key not set anywhere |
| `global` | `~/.config/bdk/settings.yaml` (or `$XDG_CONFIG_HOME/bdk/settings.yaml`) | your preferences in all projects |
| `project` | `.bdk/settings.yaml` | the team's settings, committed |
| `local` | `.bdk/settings.local.yaml` | your settings in this project, git-ignored |

A later layer wins over an earlier one. Lists of items with an `id` (`tools.test`, `tools.e2e`, ...) merge item by item, so a local file can change one command without repeating the others.

## Read and change it

The `bdk` command line ships inside the plugin and is on the `PATH` of Claude Code's Bash tool, not of your own terminal: ask Claude to run these commands, for example "run bdk config show policy".

| Command | Does |
|---|---|
| `bdk config show` | every value with the layer it came from |
| `bdk config show policy` | one key and the keys under it |
| `bdk config check` | lists each problem of each file by key, with a suggestion for a misspelt key |
| `bdk config set <key> <value>` | writes one key into `.bdk/settings.yaml`; `--layer local` or `--layer global` for the other files |

```text
bdk config set policy.gates.review auto
bdk config set tools.test.vitest.timeout 900
bdk config set models.implementer opus --layer local
```

An item of a list is addressed by its `id`: `tools.test.vitest.timeout` is the `timeout` of the `tools.test` item whose `id` is `vitest`. Editing the files by hand works as well; run `bdk config check` afterwards. Every BDK command reads the configuration when it starts, so a change applies to the next command.

## Examples

Each example is a whole `.bdk/settings.yaml` unless it says otherwise; `/bdk:setup` writes the `tools` part for you, so you mostly adjust it. The [settings reference](/reference/bdk/settings) shows each section whole, such as [`policy`](/reference/bdk/settings#policy): every key with what it is for and its default.

### A web app with a browser E2E check

```yaml
languages: [typescript, react]
tools:
  test:
    - id: vitest
      command: pnpm test
      scoped: pnpm vitest run {files}
  lint:
    - id: eslint
      command: pnpm lint
      scoped: pnpm eslint {files}
  build:
    - id: vite
      command: pnpm build
  e2e:
    - id: web
      start: pnpm dev
      ready: http://localhost:5173
      driver: browser
```

`scoped` runs a check on the files a plan part changed instead of the whole project. `{files}` becomes those files, as paths from the project root, and the command runs in the project root. In a repository of several packages, give each item `paths` too, as in the next example.

### A Python API and a React frontend in one repository

```yaml
languages: [typescript, react]
tools:
  test:
    - id: api
      command: uv run pytest api/tests
      paths: ["api/**"]
    - id: web
      command: pnpm --dir web test
      paths: ["web/**"]
  lint:
    - id: ruff
      command: uv run ruff check api
      scoped: uv run ruff check {files}
      paths: ["api/**/*.py"]
    - id: eslint
      command: pnpm --dir web lint
      paths: ["web/**"]
  e2e:
    - id: api
      start: uv run uvicorn api.main:app --port 8000
      ready: http://localhost:8000/health
      driver: http
      env:
        DATABASE_URL: sqlite:///./e2e.db
    - id: web
      start: pnpm --dir web dev --port 5173
      ready: http://localhost:5173
      driver: browser
```

`paths` tells each check item which files are its own, with the globs of [rule paths](/concepts/rules): `*` stays inside one directory, `**` spans any number of them. On a part that changes only `web/src/App.tsx`, `bdk check run --scope` runs the `web` tests and `eslint`, and skips `api` and `ruff`, which own none of the changed files; the result lists them as skipped. On a part that changes `api/app.py`, `ruff` checks only that file, since its `scoped` variant gets just the changed files its `paths` match. An item without `paths` gets every changed file. `paths` matters only to a scoped run: a full run, such as a review round's, runs every item's `command`.

`languages` lists the packs the rule pack has; for Python, add your own rules under `.bdk/rules/languages/python/` and list `python` ([rules](/concepts/rules)).

### A command-line tool

```yaml
tools:
  test:
    - id: unit
      command: npm test
  e2e:
    - id: cli
      start: npm run build
      ready: node dist/cli.js --version
      driver: cli
```

For `driver: cli`, `start` runs once to its end and `ready` must then exit 0; the tester runs the commands of each scenario in a fresh directory.

### Team settings and your own

The team commits `.bdk/settings.yaml`; each developer can put personal values in `.bdk/settings.local.yaml`, which is git-ignored:

```yaml
# .bdk/settings.yaml - the team's choices
policy:
  gates:
    design: manual
    review: manual
rules:
  disabled: [BDK-DP-2]
```

```yaml
# .bdk/settings.local.yaml - one developer
execution:
  lead: foreground
models:
  implementer: opus
```

A key a later layer sets replaces the earlier value as a whole, except lists of items with an `id`, which merge item by item. So a local `rules.disabled` replaces the team's list rather than adding to it.

### Spend less, or check more

```yaml
# fewer, cheaper runs
models:
  verifier: sonnet
  integration-reviewer: sonnet
execution:
  max-parallel: 3
policy:
  budgets:
    review-rounds: 1
    verifier: 2
```

```yaml
# more thorough
models:
  implementer: opus
  reviewer: opus
policy:
  budgets:
    part-attempts: 4
    review-rounds: 4
plan:
  part:
    max-tasks: 4
hooks:
  subagent-git: true
```

What these settings cost in time and money is on [cost and footprint](./footprint.md).

## Common changes

### Run without stopping for decisions

```yaml
policy:
  gates:
    design: auto
    review: auto
  questions: decide-and-record
```

`/bdk:run` then takes a queue from intent to pull requests, deciding open questions with the recommended answer and recording each decision in the Change, which the final report lists. It still stops on a blocked part or a spent budget. What each setting skips is on [gates and budgets](/concepts/gates-and-budgets).

### Choose models

Each agent role runs on its agent's model unless `models.<role>` sets another:

```yaml
models:
  implementer: opus
  reviewer: sonnet
```

The roles and their default models are in the [agents reference](/reference/bdk/agents). [`policy.escalation.model`](/reference/bdk/settings#policy-escalation-model) is the model of the last attempt at a part that keeps failing.

### More or fewer retries

```yaml
policy:
  budgets:
    part-attempts: 4
    review-rounds: 2
    verifier: 3
```

### When a part keeps failing: retries and escalation

The execute lead gives each plan part a budget of implementer runs per `/bdk:execute` run, `policy.budgets.part-attempts` (3). A part is run again when its implementer reports a blocker of kind `other` or its conformer fails it; the next run reads the failed report. The last run within the budget uses `policy.escalation.model` (`opus`) instead of the implementer's model, so a stronger model gets the hardest case. With `part-attempts: 1` that single run is the last one and already runs on the escalation model.

When the budget is spent, the part is marked `blocked`, later waves do not start, and `execute/result.md` names the reason and the command that unblocks it. Two kinds of blocker skip the retries: a plan defect (`/bdk:plan <change>` fixes it) and a missing tool or environment problem (`/bdk:setup`). A merge conflict gets one more attempt at resolving it on the escalation model, then blocks too. Each new `/bdk:execute` run gives the blocked parts a fresh budget; under `policy.questions: stop` BDK asks you whether to retry them now.

```yaml
policy:
  budgets:
    part-attempts: 4       # up to 4 implementer runs per part in one execute run
  escalation:
    model: opus            # the model of the last of them
models:
  implementer: sonnet      # the model of the runs before it
```

### Plan parts size

[`plan.part.max-tasks`](/reference/bdk/settings#plan-part-max-tasks), [`plan.part.max-files`](/reference/bdk/settings#plan-part-max-files) and [`plan.part.max-bytes`](/reference/bdk/settings#plan-part-max-bytes) bound one part, so one agent can finish it; `bdk plan check` reports a part over a limit.

### Parallel work

[`execution.max-parallel`](/reference/bdk/settings#execution-max-parallel) (10) is how many part agents the execute lead runs at once. [`execution.lead`](/reference/bdk/settings#execution-lead) `foreground` runs the lead agents in your session instead of the background.

### Rules

BDK ships a rule pack that implementers and reviewers read for the files they touch (`bdk rules for`). [`languages`](/reference/bdk/settings#languages) picks the language rules; [`rules.disabled`](/reference/bdk/settings#rules-disabled) switches single rules off for the project.

### Guard git history in subagents

[`hooks.subagent-git`](/reference/bdk/settings#hooks-subagent-git) `true` makes the `PreToolUse` hook deny commands that change git history (commit, merge, rebase, reset, ...) to every subagent except the lead, which commits for them.
