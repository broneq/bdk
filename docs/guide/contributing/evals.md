# Evals

A change to a skill's wording, a rule or a model choice can make BDK better or
worse, and one session cannot tell which: two runs of the same prompt differ on
their own. The evals answer such a question with numbers. They run real Claude
Code sessions with the BDK plugin on a pinned fixture repository, repeat each
cell, and count a difference only when it is larger than the noise between
identical cells. The harness is in `evals/`, and `evals/README.md` holds the
command synopsis.

## Why the evals exist

**The A/A noise floor and the difference rule.** Every measurement that
compares cells includes an A/A pair: two cells with identical inputs, such as
`sonnet` and `sonnet-prime`. Their spread is the noise floor. A gap between two
cells counts as measurable only when their medians are further apart than the
larger of the two within-cell ranges; otherwise the result is "no measurable
difference". The rule needs a range, so a measured series has at least 2 runs
per cell, 5 by default.

The measurements so far, and the decisions they fed:

| Measurement       | Question                                                                                                  | Decision                                                                                                                                            | Record                       |
| ----------------- | --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| Execute A/B       | Does a thin stage skill that loops `bdk next` do its job as well as a long one that spells the order out? | Thin is no worse on acceptance and completeness, so every stage skill is thin and the kernel holds the order                                        | `docs/V3-EVAL-EXECUTE-AB.md` |
| Rules no-op       | For each shipped rule, does the model already know it, and does it change what a review finds?            | A provisional class per rule, which decided what entered the rule pack                                                                              | `docs/V3-EVAL-RULES-NOOP.md` |
| Review models     | Does an Opus part reviewer find more seeded defects than a Sonnet one, at what cost?                      | No measured series yet ([issue #141](https://github.com/broneq/bdk/issues/141)); the `reviewer` adapter stays on Sonnet until one decides otherwise | the suite's report, when run |
| Craft admission   | Does each `bdk-craft` skill change the agent's output in the direction it promises?                       | A skill ships only when its `with` cell passes more assertions than `without`; `craft-skills.test.ts` reads the verdict column                      | `docs/V3-EVAL-CRAFT.md`      |
| Stage skill cases | Does each stage skill, typed as its slash command, leave the kernel state it should?                      | A probe per stage skill before it shipped; the cases are the regression check for later edits                                                       | `evals/results/stages/`      |

The regression eval of plain Claude Code against BDK (T43) was folded into
per-skill evals, tracked in [issue #135](https://github.com/broneq/bdk/issues/135):
every skill gets its own cases instead of one end-to-end comparison.

## The suites

| Suite           | What it measures                                                                                                                                          | Cells                                                                    |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `execute-ab`    | One fixture task executed by three arms of the execute stage; acceptance (hidden tests) and completeness                                                  | `v2`, `v3-long`, `v3-long-prime` (A/A), `v3-thin`                        |
| `review-models` | `/bdk:cr` on an executed Change with seeded defects (`suites/review-models/key.yaml`): recall per defect class and false alarms after triage              | `sonnet`, `sonnet-prime` (A/A), `opus`                                   |
| `rules-noop`    | M1: each rule's question answered blind by Haiku and Sonnet; M2: seeded patches reviewed with and without the rules (`suites/rules-noop/violations.yaml`) | M1 `haiku`, `sonnet`, `sonnet-prime`; M2 `with`, `with-prime`, `without` |
| `stages`        | One stage skill or `cr`: each case typed as its slash command, checked against the kernel state the run leaves (`suites/stages/cases/<skill>.yaml`)       | `bdk`                                                                    |
| `with-without`  | Any `bdk` or `bdk-craft` skill: each task of a task file with the skill and without it                                                                    | `with`, `without`                                                        |

## Running a suite

A run needs the Node and pnpm the repository pins, git, Claude Code, network
access and credentials: an `ANTHROPIC_API_KEY` or a Claude Code login. `pnpm eval`
installs its pinned tools (promptfoo and the Agent SDK) into `evals/node_modules`
on first use and fetches the fixture itself.

```sh
pnpm eval <suite> --probe        # one run per cell, and the projected cost of the series
pnpm eval <suite> [--runs N]     # the measured series, 5 runs per cell by default
pnpm eval report <suite>         # evals/results/<suite>/report.md from the committed rows
```

**Probe first.** Every session costs money, and a series multiplies it by the
cells and the runs. A probe runs each cell once, shows that the suite works on
the current code and prints what the full series would cost. Start the series
only after that projection is approved. `--run-cap` (15 USD by default) caps
each session; nothing caps a whole series, which is why the probe comes first.

A measured series refuses to start on a working tree with uncommitted changes
outside `evals/results/`, because every row records the commit its plugin
copies came from.

**Reading a report.** `pnpm eval report <suite>` writes, per metric, each cell's
median and range, the A/A noise floor, and for each compared pair whether the
gap is measurable by the difference rule. Probe rows (`probe-*.jsonl`) are left
out of reports, since one run has no range. Runs discarded for an isolation
leak (another plugin, a claude.ai connector, an MCP call) are listed with their
reason and not counted.

## Where results live

- **Rows**: each run appends one JSON line to
  `evals/results/<suite>/<series>.jsonl`, committed. A series name ends with the
  UTC time it started, so two branches never write the same file. A row holds
  the metrics, the cost, the models, the fixture and BDK commits and the hashes
  of the variant and its templates.
- **Reports**: `evals/results/<suite>/report.md`, regenerated from the rows.
  A measurement that decided something also gets a record in `docs/V3-EVAL-*.md`
  with its criterion written before the runs.
- **Raw output**: session output, debug logs and judge answers stay in
  `evals/.runs/`, which git ignores.
- **Sandboxes**: the working and plugin copies of a session live outside the
  repository, under `${XDG_CACHE_HOME:-~/.cache}/bdk-evals/`, so a session
  cannot find BDK's own kernel or skills by walking up from its working copy.

## Adding a with / without task file

```sh
pnpm eval with-without --skill bdk-craft:tdd --tasks <file> [--fixture default|none] --probe
```

The two cells differ only in the plugin copy: the `without` copy lacks the
skill's directory. A `bdk-craft` skill runs on copies of `plugins/bdk-craft`
alone, so a passing `with` cell also shows the skill working without `bdk`. The
task file is a YAML list of tasks with an `id`, a `prompt` written the way a
user would ask, without the skill's slash command, and optional promptfoo
assertions on the final reply:

````yaml
- id: login-sequence
  prompt: Draw a diagram of how the SPA logs a user in. Reply with the diagram only.
  assert:
    - type: javascript
      value: "/```mermaid\\s*\\n\\s*sequenceDiagram/.test(String(output))"
````

Assert on a behaviour the skill changes, not on wording. The task files of
every `bdk-craft` skill are in `evals/suites/with-without/examples/craft/`.

## Adding a stage case

```sh
pnpm eval stages --skill change [--case <id,...>] --probe
```

A case in `evals/suites/stages/cases/<skill>.yaml` types a command in a fresh
working copy and checks what the session left:

```yaml
- id: existing-change
  base: fixture # or empty: a repository with one empty commit
  command: /bdk:change "Add a dark mode toggle"
  prepare:
    - bdk change new "Translate the login page" >/dev/null
  answers: # question pattern -> option pattern
    branch: stay|current
  expect:
    - run: change list # a kernel command, run with --json
      json: { items.length: 1 }
    - shell: git worktree list --porcelain | grep -c '^worktree '
      stdout: "^1\n$"
    - reply: change status # the final reply mentions it
```

The model words its own questions, so `answers` matches them by pattern; a hook
the suite installs answers every `AskUserQuestion` from that map, or with the
first option. A run passes when every expectation holds, and `checks.json` in
its raw records names each one that failed.

## Why CI runs only the check

CI runs `pnpm eval check` in the `eval-config` job: it renders and validates
every suite's configuration, with no credentials and no model call, so a broken
suite fails the pull request. The sessions themselves stay out of CI: they need
credentials, cost real money on every push, and a single run per pull request
would be noise by the difference rule anyway. A measurement is a decision a
person starts, with an approved probe.

## Provider facts

What the harness relies on was probed on 2026-09-28 with Claude Code 2.1.284,
promptfoo 0.123.1 and `@anthropic-ai/claude-agent-sdk` 0.3.284. When one of
these versions moves, probe the fact again before trusting a series. The
probes behind each fact are recorded in the T40 design,
`openspec/changes/archive/2026-09-30-v3-t40-promptfoo-harness/design.md`.

| Fact                                                              | Consequence                                                                                                                                                                                                |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The SDK must resolve from the config's directory                  | The tools live in `evals/package.json` and install into `evals/node_modules`; configs are rendered under `evals/.runs/`                                                                                    |
| Auth works without `ANTHROPIC_API_KEY`                            | A logged-in Claude Code is enough (`apiKeyRequired: false`)                                                                                                                                                |
| Each run reports its cost                                         | The probe projection uses the reported cost; there is no price table                                                                                                                                       |
| Background subagents start new turns                              | Unpatched promptfoo returns the first turn's result; `patches/promptfoo@0.123.1.patch` returns the last one, whose cost is cumulative, and sums the turns. pnpm refuses an install where it does not apply |
| Plugin hooks and agents load                                      | The guards under test are active, and subagent work is measurable                                                                                                                                          |
| Tools are read-only by default                                    | Every cell sets `allow_all_tools: true`                                                                                                                                                                    |
| Subagent transcripts are stripped by default                      | Every cell sets `forward_subagent_text: true`, so the orchestrator sees what Claude Code shows it                                                                                                          |
| Slash commands in the prompt expand as typed                      | Cells start with the stage command, as a user would, and its `UserPromptExpansion` hook runs                                                                                                               |
| The `Workflow` tool is absent in SDK sessions                     | A cell that would use it runs its subagent strategy only, and the report says so                                                                                                                           |
| `disable-model-invocation: true` skills are hidden from the model | They are started by their slash command                                                                                                                                                                    |
| The default `skills/` scan runs beside the manifest               | A plugin copy keeps only the skills of its cell                                                                                                                                                            |
| `beforeEach` runs before each repeat                              | Each run gets a fresh fixture copy; an assertion reads metrics from it before the next run                                                                                                                 |
| claude.ai connectors load unless disabled                         | Every cell sets `ENABLE_CLAUDEAI_MCP_SERVERS=false` and `setting_sources: ["project"]`; the per-run debug log is the isolation evidence                                                                    |
| `claude-opus-5-5` is unknown to promptfoo 0.123.1                 | The id is passed through; the rows' `models` confirm what ran                                                                                                                                              |
| `agents-md` and `telemetry` load in every session                 | The same in every cell, not an isolation leak                                                                                                                                                              |
