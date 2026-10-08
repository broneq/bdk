# Design

## Context

- The architecture ("Findings and triage", block table) gives triage to one main-thread block: the model reads the folded findings, writes a Lavish page in manual mode, and in auto mode lets the judge's levels and the policy decide. Decisions are appended as `decision` events with `bdk findings decide` (spec `bdk-cli/findings`, built by #187 in `plugins/bdk/src/findings/`).
- D2 and D3 of `docs/design/2026-10-07-v3-skills-decisions.md` fix the levels and the auto-mode decision per level; D4 makes Lavish optional, with `AskUserQuestion` without it.
- The judge (`plugins/bdk/skills/judge/SKILL.md`, #193) levels a round and writes `report.md`; triage comes after it. The round directory convention and the standalone `manual` run directory come from spec `review-blocks`.
- `design-draft` (#190) already asks through Lavish, then `AskUserQuestion`, then the reply, with a `lavish-axi` stand-in in `node_modules/` for its eval cases (`evals/design-draft-lavish`, `evals/design-draft-ask`). Triage reuses that pattern.
- The draft fragment `draft/v3-1:fragments/decision/lavish.md` taught: read the playbooks before writing a page, give each ask a fresh file name, poll in the foreground, fall back to the terminal on any failure, and never treat an unanswered decision as made.
- The resume table of spec `bdk-cli/run` reads the latest decision per finding: row 7 (a blocker without a decision) sends the run to triage, row 8 (a `fix` decision) to the fix pass.

## Goals / Non-Goals

**Goals:** one plain block skill that decides every undecided finding of a judged round, by policy in auto mode and by the user in manual mode, and records every decision; eval cases for auto mode (the acceptance signal), the Lavish path and the fallback path.

**Non-Goals:** running rounds, the fix pass, and the `policy.budgets.review-rounds` limit on `should-fix` fixes (`/bdk:auto-review`, #201); `/bdk:setup` reporting which decision surface a project gets (D4, setup skill); a configurable policy (D3 keeps it fixed in v3.0).

## Decisions

### D1. Plain main-thread skill, no agent

`triage` is a skill in `plugins/bdk/skills/triage/` with no agent. Manual triage talks to the user (`AskUserQuestion` is not available to a subagent in the background), and auto triage is a handful of `bdk findings decide` calls whose cost an agent start would exceed.

- Alternative: a `bdk:triager` agent for auto mode only. Lost: two code paths for one job, and the architecture names the main thread.

### D2. Only judged rounds, only undecided findings

Triage needs a level per finding; it does not judge. When the fold lists an unleveled finding, triage records nothing and tells the caller to run the judge. It decides only findings whose fold shows no decision, so a run after an interruption (or a second run) never overrides a decision already taken. The user can still change a decision by asking for it; a new `decision` event wins in the fold.

- Alternative: let triage level unleveled findings itself. Lost: one block, one job; the judge reads the code to level, triage does not.
- Alternative: re-ask every finding on each run. Lost: a resumed autopilot would re-decide what the user already chose.

### D3. Round selection

A round directory in the arguments wins; else the highest `round-N` with `report.md` of the Change the arguments name; else of `.bdk/runs/manual/review/`, the run directory standalone review blocks use. A round without `report.md` is not judged yet.

### D4. Auto mode follows D3 of the skills decisions, without a page

`policy.gates.review: auto` is auto mode, the same switch the architecture uses for the review gate. The skill holds the fixed table (blocker and should-fix `fix`, nice-to-have `defer` without an issue, not-a-problem `accept`) and records each decision with the reason `policy.gates.review auto: <level>`. No page, no question, no issue. `policy.questions` does not change triage: it governs open design decisions, and a finding's decision is fully determined by its level in auto mode.

- Alternative: a `bdk findings decide --policy` helper that decides a whole round in one call. Lost for now: the architecture rule is to add a helper only when an eval or a measurement shows a problem; four to a few dozen `decide` calls are cheap, and the eval case measures whether the model applies the table. Added if a run shows a wrong or missing auto decision.

### D5. Manual mode: one ask, Lavish first

All undecided findings go into one ask, sorted by level (blockers first), each with its place, summary, evidence and the judge's reason, and the policy answer preselected. Surfaces in order (D4 of the skills decisions, and the pattern of `design-draft`):

1. Lavish: run `npx -y lavish-axi playbook input` for the page shape, write the first unused `.lavish/triage-<change>-round-<N>-<k>.html` (Lavish never reopens a path whose session the user ended, a draft 1 lesson) with one card per finding (radio inputs `fix`, `accept`, `defer`, `defer with issue`, an issue field and a note), open it with `npx -y lavish-axi <file>`, wait with `npx -y lavish-axi poll <file>`.
2. `AskUserQuestion` when the open command exits non-zero: first print the findings table with the recommendations; one question per `blocker` and `should-fix` finding (up to four per call), and one question per remaining level that offers the recommendation for all of them at once or picking one by one.
3. The reply when `AskUserQuestion` is not available: numbered findings with the recommendation marked; end the turn and record nothing.

A finding the user does not answer stays undecided. "Take your recommendations" from the user decides every finding it covers.

- Alternative: always `AskUserQuestion`. Lost: the draft run triaged 52 entries on one Lavish page; four questions per call do not scale to a real round.
- Alternative: show only blockers to the user and decide the rest by policy. Lost: manual mode exists so the user decides; the preselected recommendations keep the cost of a full page low.

### D6. Defer with an issue only on the user's choice

`defer` with an issue happens only in manual triage. The user either gives a reference (`#42`, a URL), which goes into `--issue`, or asks the block to create one: the block runs `gh issue create` with the finding's summary as title and its place, evidence and the Change as body, and records the printed URL. Auto mode never creates an issue (D3 of the skills decisions).

### D7. `defer` without an issue in the CLI

The `decision` event and `bdk findings decide` required `--issue` for `defer` (#187), while D3 of the skills decisions defers `nice-to-have` findings without an issue and lists them in the PR body. The event schema now makes `issue` optional for `defer` and still forbids it with `fix` and `accept`. The fold, `list` and `report` already treat `issue` as optional, so only the refinement in `domain/events.ts`, the flag description and the tests change.

- Alternative: record `defer --issue none` or `--issue pr-body`. Lost: a fake reference in a field that names an issue.
- Alternative: `accept` nice-to-have findings in auto mode. Lost: it contradicts D3 and loses the "listed in the PR body" signal that `defer` carries.

### D8. Refresh the round report

After its decisions, triage runs `bdk findings report <log>`, so `report.md` (read by the next round, the fix pass and the PR body) shows the decisions. The reply is the report path, the counts per decision, and the `fix` findings by id and summary: what the caller needs for the fix pass.

### D9. Eval cases

A shared fixture `evals/fixtures/monthly-report-judged.sh` runs `monthly-report.sh` and writes round 1 as the judge leaves it: the four findings of `judge-levels` with one `level` line each (blocker, should-fix, nice-to-have, not-a-problem) and the matching `report.md`, so every triage case starts from a judged round.

| Case | Setup | Graders |
|---|---|---|
| `triage-auto-policy` | `policy.gates.review: auto` | `regex` per finding on `findings.jsonl`: `fix`, `fix`, `defer` without `issue`, `accept`; four decision reasons naming `policy.gates.review`; `bdk findings decide` in the trace; `report.md` refreshed; no `AskUserQuestion`, no `lavish-axi` command, no `.lavish/` write, no `gh issue create`; `tool_used Skill` |
| `triage-lavish` | manual; `lavish-axi` stand-in in `node_modules/` whose poll answers "fix the nice-to-have one, take your recommendations for the rest" | `tool_used Write` of `.lavish/*.html`; `regex`: `fix` for the nice-to-have finding and the policy answers for the rest; `bdk findings decide` in the trace; `report.md` refreshed; `tool_used Skill` |
| `triage-ask` | manual; stand-in that exits 1 on open | `llm` on the reply: asks with options and a marked recommendation; `regex` absent: no `decision` line; `tool_used Skill` |

Every case also grades `tool_used Edit` 0 times (both arms).

Without the plugin the model has no `bdk`, no D3 table and no log convention, so the `regex` graders on the log measure what the block adds.

Results (Claude Code pinned in the root `package.json`, 3 runs per arm, clean `HOME` per "Host limits", `--allow-tools Write "Bash(*/bin/bdk *)" "Bash(npx -y lavish-axi *)"`):

| Case | With | Without | Δ | Cost |
|---|---|---|---|---|
| `triage-auto-policy` | 1.00 | 0.64 | +0.36 | $1.27 |
| `triage-lavish` | 1.00 | 0.33 | +0.67 | $1.52 |
| `triage-ask` | 1.00 | 0.67 | +0.33 | $1.38 |

Without the plugin the model often appends `decision` lines by hand in the log's own format, and its choices in auto mode match the policy in 2 of 3 runs, so the per-finding graders alone measured little (a first run showed Δ +0.13). What the block adds is the record: decisions through `bdk findings decide` with a reason naming the policy, and a refreshed `report.md`; those graders now carry the difference. The first run also showed a trace grader matching the skill text itself (`lavish-axi` appears in the loaded skill); the graders now match only Bash commands and `Write` calls. No CLI helper was needed: in every plugin run the model applied the table with one `decide` call per finding (D4). After verification gave each page a fresh name (D5), a re-run of the `triage-lavish` plugin arm scored 1.00 in 3 of 3 runs ($0.86).

## Risks / Trade-offs

- **Bottleneck:** a round of dozens of findings in manual mode means one large page; the cards are grouped by level with the recommendation preselected, so the user reviews blockers and confirms the rest.
- **Failure mode:** the model decides a finding the user left blank or misreads the poll reply. The skill says an unanswered finding stays undecided, and `triage-ask` grades that no decision is invented.
- **Hidden cost:** one `bdk findings decide` call per finding in auto mode; at B1 scale (52 entries) that is 52 short Bash calls. Measured before any batch helper is added (D4).
- **Assumption not confirmed by the user:** `policy.gates.review` is the auto-mode switch for triage. It is the only review policy key, and the architecture's "auto mode" for the review gate means the same thing.
- **Operational risk:** `lavish-axi` changes its commands; the skill reads the playbook each time instead of hard-coding page markup.

## Migration Plan

None: the `defer` change in the CLI only widens what is accepted, and no released log holds a `defer` without an issue.

## Open Questions

None.
