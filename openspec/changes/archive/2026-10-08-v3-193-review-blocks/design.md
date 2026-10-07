## Context

A review round (design "Flows", "Review round"; "Findings and triage") runs, per round: `bdk git groups --record` for the groups, one reviewer per group in parallel with `bdk check run` and `e2e-check`, then one integration reviewer, then the judge, which leaves `review/round-N/report.md`. This Change builds the three review blocks of that round. What it builds on:

- `bdk git scope|groups` (#186, spec `bdk-cli/git`): the range, the groups (`p<NN>` per plan part, `unplanned`, `m<k>` per module, `integration` with every file), and `groups.json` as the round record. A round counts as finished when its directory holds `report.md`.
- `bdk findings add|level|decide|list` (#187, spec `bdk-cli/findings`): the append-only event log `findings.jsonl`, ids stamped by the CLI from a dedupe key, and the fold.
- `bdk rules for --stage review --files ...` (#184, spec `bdk-cli/rules`): the rules of the review stage for a set of files, as Markdown for a prompt.
- The eval suite (#189, spec `skill-evals`): cases under `plugins/bdk/evals/`, shared fixtures, free CI check with the grants `Write Edit`; `"${CLAUDE_PLUGIN_ROOT}/bin/bdk"` because `bin/` is not on `PATH` in eval runs.
- [D2](../../../docs/design/2026-10-07-v3-skills-decisions.md#d2-definitions-of-the-finding-levels): the level definitions, decided; the issue leaves nothing to resolve in the spec.
- Material read, not copied: `draft/v3-1:skills/roles/{reviewer,integration-reviewer,judge}`, `draft/v3-1:skills/tools/cr`, v2 `skills/cr` and `agents/code-reviewer.md`. They carry what this Change drops: dispatch packages, tickets, `bdk log ingest`, envelopes, `SendMessage` protocols, ledger entry types, severity and category vocabularies, and per-reviewer report files. What they teach and this Change keeps: the group/integration/judge split; a finding states a failure scenario that the judge checks at its place in the code; reviewers run no checks (the round runs them once); integration reads the intent top down and checks seams; the judge looks for nothing new.

Probes run for this Change on Claude Code 2.1.293 (`claude -p --plugin-dir <probe>`, model haiku):

| Probe | Result |
|---|---|
| A subagent writes `.bdk/runs/c/review/round-1/report.md` with `Write` | Refused by the host: "Subagents should return findings as text, not write report files." Nothing written. |
| An agent preloads a skill with `skills:`; the skill has a `!` block running `"${CLAUDE_PLUGIN_ROOT}/bin/<tool>"` and the text `${CLAUDE_PLUGIN_ROOT}` | The block ran and its output was in the agent's context; the variable was substituted. This answers the architecture's open probe "does `!` resolve in a skill preloaded into an agent with `skills:`?": yes. |

## Goals / Non-Goals

**Goals:**

- Three blocks, one job each: `review-group` finds problems inside one group, `review-integration` finds problems of the whole Change and between its parts, `judge` sets levels and finishes the round (ADR-0003 principle 2).
- Each block runs alone (`/bdk:<block>`) and as one `Agent` call of a lead, with the same skill text.
- Eval cases per block that show an effect over no plugin, the integration case catching a seam bug between parts (issue, "Acceptance signal").

**Non-Goals:**

- No lead, no orchestration of a round, no `bdk git groups --record` or `bdk check run` call by the lead path, no triage, no decisions (#195).
- No severity or category vocabulary: the finding event has `rule` and the judge has four levels; a category would be a second classification nobody reads.
- No reviewer report files: everything a later step reads is in `findings.jsonl` (draft 1 stored a report per reviewer through `bdk log ingest`, one of the top five bookkeeping calls of B1).

## Decisions

### D1. Plain skills preloaded into agents, no `context: fork`

Each block is `plugins/bdk/skills/<block>/SKILL.md`, and each agent file lists its block under `skills:`:

| Block | Agent | Model | Tools |
|---|---|---|---|
| `review-group` | `bdk:reviewer` | sonnet | Read, Grep, Glob, Bash |
| `review-integration` | `bdk:integration-reviewer` | opus | Read, Grep, Glob, Bash |
| `judge` | `bdk:judge` | sonnet | Read, Grep, Glob, Bash |

A lead starts a block with one `Agent` call (`subagent_type: bdk:reviewer`, the round directory and group in the prompt; `model` from `models.<role>` when the configuration sets it). A user runs it alone as `/bdk:review-group <round-dir> <group>` in the main thread. No agent has `Write` or `Edit`: the blocks change no project file, and their only output is `bdk` calls. The skills keep `disable-model-invocation` off, so a user's request ("review group p01 of round 1") fires them (eval cases).

Alternatives: `context: fork` with `agent:` - lost: a forked skill returns no agent id, so it cannot be continued with `SendMessage` (measured by #190), and the agent would carry the skill twice when it also preloads it. The process in the agent body instead of a skill - lost: an agent cannot run as `/bdk:<block>` and has no with/without skill eval. One `review` skill with three modes - lost: one block, one job.

### D2. Input: a round directory and, for a reviewer, a group

The caller passes the absolute path of a round directory, `.bdk/runs/<change>/review/round-<N>/`, which holds `groups.json` (written by `bdk git groups --record`) and the log `findings.jsonl`; `review-group` also gets a group id. The blocks derive the rest from files:

- the range and the group's files from `groups.json` (`range`, `groups[].id`, `groups[].files`);
- the Change from the directory name `<change>`: `openspec/changes/<change>/` with `proposal.md`, `specs/`, `design.md` and `plan/parts/<NN>.md` (a group `p<NN>` reviews against part `<NN>`);
- the rules from `bdk rules for --stage review --files <file>...` over the group's files (the block calls it itself, so it works the same alone and under a lead; design "Rules").

Without a round directory (a user running a block alone on a branch), the block prepares one: `.bdk/runs/manual/review/round-<N>/`, where `N` is the lowest round without `report.md`, and, when it has no `groups.json` yet, `bdk git groups <base> --rounds .bdk/runs/manual/review [--plan <parts>] --record <round-dir>`, with `<base>` the base branch (`origin/HEAD`, else `main`) or the `--base` the user gave, and `--plan` the plan parts of the one active Change when there is exactly one. `manual` keeps standalone rounds out of the directories `/bdk:run` derives its stage from (spec `bdk-cli/run`, rows 5-8). A standalone `review-group` without a group reviews every group except `integration`, one after another.

Alternatives: the caller pastes files, range, part text and rules into the prompt (draft 1's dispatch package) - lost: a second place for the flow of the stage, and a block that cannot run alone. The Change name as a separate argument - lost: the round directory already names it.

### D3. What `review-group` checks and writes

Per file of the group: read the whole file and its diff over the range (`git diff <range> -- <file>`), and the tests that cover it. Check, in this order:

1. Behaviour: the code does what the part's tasks and the spec scenarios it names say, for every input the scenario allows; logic errors inside functions; error and empty paths.
2. Tests: a changed behaviour has a test that would fail if the behaviour broke; a test that cannot fail is a finding.
3. Rules: each rule `bdk rules for` printed for the group's files.
4. Security: input from outside the process reaching a query, a shell, a path or an eval.

It runs no test, linter or build (the round runs `bdk check run` once) and leaves style a linter checks to the linter. One `bdk findings add <log> --source review-group --file --line --summary --evidence [--rule]` per problem, where `--evidence` is the failure scenario: the input and the wrong result, or the change that breaks the behaviour while every test passes; `--rule` only with an id `bdk rules for` printed. A problem with no failure scenario is still added, with evidence naming what it costs. A finding is about a file of the group; a problem that needs another group's file to see is left to `review-integration`. It ends with one line per finding id and nothing else to return (the lead reads counts from the log).

### D4. What `review-integration` checks and writes

It runs after every group of the round and reads the Change top down: `proposal.md` (intent), every scenario of `specs/`, `design.md`, the plan parts, `groups.json` and the findings so far (`bdk findings list <log>`, so it does not repeat them). It reads code to confirm a scenario or a seam, not to repeat the group reviews. Checks:

1. Intent and scenarios to code: each scenario of the spec deltas is reached by the product as a user runs it - from the entry point (command, route, page, configuration) to the code that makes it true; behaviour that no scenario or intent names is a finding.
2. Scenarios to tests: each scenario has a test that would fail without it, at the level that proves it (a unit test does not prove a command's output).
3. Seams: each contract a part changes that code in another part or outside the Change uses - an exported function or type, a field and its unit, null and empty values, an error contract, a configuration key, a file format, a command - against every user of it.
4. Files changed that no plan part lists (`unplanned` group) and parts whose files the range does not touch.

Same `bdk findings add` form as D3 with `--source review-integration`. A finding of a seam names the file where the wrong assumption lives and puts the other side in the evidence.

Alternatives: the integration reviewer gets a summary of seams from each group reviewer (draft 1 `## Seams` section) - lost: it needs a reviewer report file again, and the reviewer of one group cannot see who uses its contract; reading the `integration` group's diff costs one opus agent per round, which the design already budgets.

### D5. The judge applies D2 and finishes the round

The judge reads `bdk findings list <log> --level unleveled --json` and judges each finding once: it reads the code at `file:line` and the evidence, and asks (1) does the failure scenario hold, or does a guard, a type or a test already prevent it; (2) which D2 level fits. It sets the level with `bdk findings level <log> <id> <level> --reason "<one sentence>"`:

| Level | When (D2) |
|---|---|
| `blocker` | The product breaks a spec scenario or the intent of the Change; a check is red (`source: check`); a security hole; data loss; a regression of existing behaviour |
| `should-fix` | The product works, but the change breaks a rule or a project instruction, or has a concrete maintenance cost that the finding names |
| `nice-to-have` | An improvement whose absence costs nothing concrete |
| `not-a-problem` | A false positive (the scenario does not hold), out of the Change's scope, already handled, or a repeat of another finding (the reason names its id) |

A rule violation alone is at most `should-fix`. The judge writes no finding and no decision, edits no file, and decides nothing about the Change (triage does). When every finding has a level, it runs `bdk findings report <log>` and returns the report path and the counts line.

Findings already folded by the CLI (same dedupe key) are one finding; the judge only catches repeats the key misses. Levels the judge set in this round stay; a finding that already has a level is not judged again, so a crashed judge restarts where it stopped.

### D6. `bdk findings report`, because a subagent cannot write `report.md`

`bdk findings report <log>` folds the log as `list` does and writes `report.md` in the log's directory, replacing an earlier one, and prints the report path and the counts line (`--json`: `report`, `counts`). The report is a pure function of the log:

```markdown
# Review round report

3 findings. Level: 1 blocker, 1 should-fix, 0 nice-to-have, 1 not-a-problem, 0 unleveled. Decision: 0 fix, 0 accept, 0 defer, 3 undecided.

## blocker

- f-0a1b2c3d4e5f `src/report.js:12` Totals print cents as dollars (review-integration)
  - Evidence: ...
  - Level reason: ...

## should-fix
...
## nice-to-have

None.

## not-a-problem
...
## unleveled

None.
```

Every heading is always there, so a reader (the lead, triage, `/bdk:run`) finds a section by name. Lines the fold skipped are listed under `## Skipped lines` only when there are some. A log in an existing directory without the file gives a report of zero findings (a round with nothing to report is finished too); a missing directory is `env/log-dir-missing`, exit 3, as for `list`. The command writes whatever the levels are: the order "level every finding, then report" lives in the judge's skill text (`.claude/rules/bdk-cli.md`).

Recorded problem (CLAUDE.md "Building skills (v3)"): the probe in "Context" shows that the host refuses a subagent's `Write` of `report.md`; the judge is a subagent under the round lead, and the lead is a subagent too. Alternatives: the judge returns the report text and the lead writes it - lost: the lead is a subagent and gets the same refusal. Another file name (`round.md`) - lost: `report.md` is the round record of specs `bdk-cli/git` and `bdk-cli/run`, and the name heuristic of the host could change; a deterministic render also costs the judge no tokens and cannot drift from the log. Writing through a shell heredoc - lost: a compound command needs approval and the text is model-written.

### D7. Eval cases on one shared fixture

`evals/fixtures/monthly-report.sh` builds a configured BDK project (`.bdk/settings.yaml`, `openspec/`) with a small Node CLI `ledger` on `main` and a branch with the Change `monthly-report` committed in two parts:

- Part 01, `src/parse.js`: `parseEntries(csv)` returns `{ date, amount }` with `amount` in integer cents. Seeded bug inside the part: the amount is parsed by dropping the decimal point, so `12.50` gives 1250 but `12.5` gives 125 and `7` gives 7; the part's tests use only two-decimal amounts, and the spec scenario allows zero to two decimals.
- Part 02, `src/report.js` and `bin/ledger.js`: `monthlyTotals(entries)` and `ledger report <file>`. Seeded seam bug: it formats the summed `amount` with `toFixed(2)` as if it were dollars, so `ledger report` prints `1250.00` for `12.50`; part 02's tests build entries by hand with dollar amounts (`amount: 12.5`), so every test passes and each part looks right alone.
- `.bdk/runs/monthly-report/review/round-1/groups.json` as `bdk git groups main --plan ... --record` writes it (`p01`, `p02`, `integration`).

| Case | Prompt (as the lead briefs the block) | Graders on the result | Graders on the steps |
|---|---|---|---|
| `review-group-logic-bug` | review group `p01` of round 1 | `regex` on `findings.jsonl`: a `review-group` finding on `src/parse.js`; `llm` on `findings.jsonl`: names the decimal-place bug | `tool_used Read` of `src/parse.js`; `tool_used Edit` 0 times (both arms); `tool_used Skill` |
| `review-integration-seam` | the group reviews of round 1 are in, review the Change as a whole | `regex`: a `review-integration` finding; `llm` on `findings.jsonl`: names the cents/dollars seam between `parse.js` and `report.js` | `tool_used Read` of the spec; `tool_used Edit` 0 times; `tool_used Skill` |
| `judge-levels` | set the level of every finding of round 1 | `regex` per finding on `findings.jsonl`: the parse bug `blocker`, the rule violation (`BDK-CQ-1`) `should-fix`, the false positive `not-a-problem`, the improvement `nice-to-have`; `file_exists` `report.md` | `tool_used Edit` 0 times; `tool_used Skill` |

`review-integration-seam` and `judge-levels` start with a `findings.jsonl` the scaffold writes (the group findings; the four findings to judge, ids computed with the CLI's dedupe rule). Graders use only `Read`, `Edit` and `Skill` steps, so the free CI check loads them with the grants `Write Edit`; a paid run adds `Bash(*/bin/bdk *)` and `Bash(git *)`. Without the plugin the model has no `bdk` and no D2, so the regex graders on the log measure what the block contributes; the `llm` graders measure whether the bug was found at all, which a baseline may also do.

Results (Claude Code 2.1.292, 3 runs per arm, `--allow-tools "Bash(*/bin/bdk *)" "Bash(git *)"`):

| Case | With | Without | Δ | Cost |
|---|---|---|---|---|
| `review-group-logic-bug` | 1.00 | 0.33 | +0.67 | $1.35 |
| `review-integration-seam` | 1.00 | 0.50 | +0.50 | $1.50 |
| `judge-levels` | 0.89 | 0.17 | +0.72 | $1.28 |

Without the plugin the model finds the parse bug but logs nothing through `bdk`, misses the seam (3 of 3 runs), and sets no level. In one `judge-levels` run the judge set the improvement finding `not-a-problem` as "out of scope"; the skill now says that scope means code the Change does not touch, and a re-run of the plugin arm scored 1.00 in 3 of 3 runs ($0.67).

These runs used no shell prefix for `git`; on a Mac with the Command Line Tools a sandboxed `git` fails (found in #206), so the blocks' `git diff` steps may have failed and the scores rest on `Read` of the recorded round and the code. The end-to-end runs below ran outside the eval sandbox, with `git`.

End to end (task 4.1), a lead started two `bdk:reviewer` agents in parallel, then `bdk:integration-reviewer`, then `bdk:judge` on the fixture: 6 findings, both seeded bugs `blocker`, `report.md` written, 3 minutes, $0.67.

Alternatives: one fixture per case - lost, the three blocks review the same round, and a shared fixture is the suite rule for a workspace used by more than one case (spec `skill-evals`). A standalone case without a round directory - the standalone path is checked by hand in a test project (task 4.2); a paid case per path doubles the cost.

## Risks / Trade-offs

- [A reviewer reports the seam bug too, or the integration reviewer repeats a group finding] -> the dedupe key folds same-line repeats; the judge marks other repeats `not-a-problem` naming the kept id.
- [The judge levels a rule violation `blocker`] -> D2 is in the skill text and the `judge-levels` case checks the rule finding is `should-fix`.
- [`report.md` written while findings are unleveled] -> the judge's text says to level every finding first; the report lists the unleveled ones under their own heading, so the lead sees them.
- [Opus cost of `review-integration` on every round] -> one agent per round, as the design budgets; a later round's scope is only the fixes (spec `bdk-cli/git`).
- [Standalone rounds under `.bdk/runs/manual/` grow] -> they are run artifacts outside git (setup's ignore rule), like every other run directory.
- [The host's report-file refusal changes] -> the command stays useful: a deterministic report costs the judge no turn.

## Open Questions

None.
