# Design

## Context

See proposal.md, "Why". `bdk:explorer` (`plugins/bdk/agents/explorer.md`) runs `explore`, the first block of `/bdk:design`; its map feeds `design-draft` and `verify-design`. `models.explorer.model` already overrides the frontmatter (archived Change `v3-274-models-per-agent`), so the frontmatter is only the default.

The existing explore cases (`explore-csv-export`, `explore-cli-options`, `explore-model-set`) grade the sections, a `file:line` on the store and a CLI's options; none plants a fact of the kind #410 lost, so none can tell the models apart on it.

## Goals / Non-Goals

**Goals:**
- A case that reproduces the #410 miss, and a default explorer model chosen from its result and cost.

**Non-Goals:**
- Tuning other agents' models; a CLI helper for exploration.

## Decisions

### D1. Reproduce first: `explore-project-facts`

The case plants the three facts of #410's Input on the shared ledger fixture: `npm test` runs `scripts/test-budget.mjs` (a 60 s budget around `node --test --test-global-setup=test/global-setup.mjs`), the global setup starts `src/server.js` on a port, and `.claude/settings.json` holds a `PreToolUse` hook (`.claude/hooks/test-guard.sh`) that blocks a direct `node --test`, the command the fixture's `part` check item runs. Three `regex` graders on `explore.md` require each name. A run loads no `.claude/` of its workspace (README, "Host limits"), so the hook is only a file to find.

- Alternative: re-run only the existing cases. Lost: they pass on haiku already (they were recorded on it), so they cannot decide the model.

### D2. The skill names where these facts live

`explore` step 2 told the explorer to read "the manifest that names the test command", not the script behind it, and nothing about the project's rules. A hook in `.claude/settings.json` is reachable from no noun of a proposal, so a stronger model alone has no reason to look there. The step now follows the test command to its script and the runner's setup files, and reads `CLAUDE.md` / `AGENTS.md`, the hooks of `.claude/settings.json` and the build, test and run docs.

- Alternative: model change alone, as the issue's Scope says. Lost: the issue's Goal is a map good enough for its callers, and its Input names "the project's rules and its docs" as where the facts live; the measurement is taken with the skill line in place, on every compared model, so the model choice is still decided on equal text.
- Cost of this order: no run measures the skill line without a model change, to stay inside the Budget (one run per model). The haiku run on the new text shows how much the text alone carries.

### D3. Explorer model: `sonnet`

`sonnet` and `opus` both named every planted fact in 3 of 3 runs, where `haiku` missed the hook in 2 of 3 ("Measurement"). `opus` found nothing more and cost about 1.6 times as much per run ($0.32 against $0.20 on `explore-project-facts`), so the default is `sonnet`, the issue's floor. A project that wants more sets `models.explorer.model: opus`; one that wants the old cost sets `haiku`.

- Alternative: `opus`. Lost: same score on every case, higher cost and time per map.

### D4. The help command runs as written

On the D2 text, `sonnet` and `opus` called the upload CLI's help as `node /<absolute workspace path>/bin/upload.js --help`, which the grant `Bash(node bin/upload.js --help)` denies (`haiku` wrote the relative form). The map then put `--folder` under `Unsure` ("the command was refused"): `explore-cli-options` 0.87 on `sonnet` and 0.80 on `opus`. Outside an eval the same call asks the user for approval of a form no rule allows. Step 2 now says to run the help from the project root as a Bash command of its own, with the tool's path as the project writes it, and to read files with `Read`, `Grep` and `Glob` rather than `cat` through Bash, which both stronger models also did.

- Alternative: widen the case's grant to any `node */upload.js --help`. Lost: a user's permission rule is written the way the project calls the tool, so the denial is real, not an artefact of the case.

`models.explorer.model` in `explore-model-set` and `design-models-per-role` stays `sonnet`, now the default: their graders require `"model": "sonnet"` in the `Agent` call's input, so a skill that leaves the field out still fails them.

## Measurement

2026-10-13, Claude Code 2.1.292, clean `HOME` and the `git` entry of "Host limits" (`plugins/bdk/evals/README.md`), `--model sonnet` for the main thread, `--ablation none`, `--runs 3`, `-j 3`; the explorer's model set in its frontmatter for each series. Cost and time as `claude plugin eval` reports them.

| Series | `explore-csv-export` | `explore-cli-options` | `explore-project-facts` | Cost | Time |
|---|---|---|---|---|---|
| `haiku`, D2 text | 1.00 | 1.00 | 0.89 (hook missed in 2 of 3) | $1.61 | 201 s |
| `sonnet`, D2 text | 1.00 | 0.87 (help denied 1, `--folder` under `Unsure` 1) | 1.00 | $1.81 | 109 s |
| `opus`, D2 text | 1.00 | 0.80 (`--folder` under `Unsure` 3) | 1.00 | $2.92 | 172 s |
| `sonnet`, D2 + D4 text | 1.00 | 1.00 | 1.00 | $1.74 | 101 s |

Then, on `sonnet` with the final text, one run each: `explore-model-set` 1.00 ($0.19, 28 s) and `design-fresh-auto-gate` (the explore step of `/bdk:design`, `--tag orchestrator`) 1.00 ($0.64, 105 s).

A `sonnet` map of `explore-project-facts` names the hook with `.claude/hooks/test-guard.sh:5-7` and `.claude/settings.json:3-8`, and under `Gaps` that the configured `part` check `node --test {files}` is the command the hook rejects; the `haiku` maps that missed the hook listed the wrapper and the global setup under `Patterns` and nothing from `.claude/`.

Total: $8.91 and 716 s of eval time over the six series and runs above, plus a one-line `claude -p` login probe under the clean `HOME` (cost not reported, under one cent). Two more invocations stopped before any run (untrusted plugin directory, a `--case` glob with brackets) and cost nothing. Budget (#410): one series per compared model, plus one series on `sonnet` to confirm D4, a fix the series themselves showed; recorded here as over the issue's literal budget by that one series ($1.74).

## Risks / Trade-offs

- [A higher per-run cost of every `/bdk:design`] -> the map runs once per design; a team sets `models.explorer.model: haiku` to keep the old cost.
- [The case plants facts a regex finds by name, not understanding] -> each grader requires the file's name in the map; the skill requires `file:line`, which the existing `map-cites-code` grader covers on the store.
