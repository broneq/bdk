# Design

## Context

See proposal.md - Why. The current state that shapes the approach:

- `bdk review plan` (`kernel/src/review/domain/groups.ts`) groups the changed files by plan part, `unplanned` or module, and adds an `integration` group with every changed file. It never looks at file content, so a PNG counts like a source file.
- `/bdk:cr` builds every package, the integration one without `--file`, and starts all agents in one dispatch round. `reviewText` (`kernel/src/dispatch/domain/review.ts`) then tells the integration reviewer to read `git diff <range>`, which for a large range does not fit a Bash result.
- Group reports are already stored per group at `<change>/reports/...-<ticket>-<group>.md` by `bdk log ingest`. Nothing reads them back for another agent.
- The only binary detection is in `measure` (`parseNumstat` in `kernel/src/measure/domain/measure.ts`, private), which turns numstat's `-` into 0 and drops the fact that the file is binary. `review plan` runs two git calls on the range: numstat through `measure`, and `git diff --name-only -M` for the group files.
- `dispatch build` finds a ticket's packages through `packageRoles` (`shared/store/tickets.ts`), which matches only ungrouped `-<ticket>.md` files; nothing lists the group packages of a ticket. Every package embeds the target's ledger entries section, with the bodies of accepted decisions and open blockers.
- The integration reviewer shares the `reader` adapter with `verifier` and `design-verifier` (`ROLE_ADAPTERS` in `kernel/src/export/domain/adapters.ts`). The adapter list is also hard-coded in the export schema enum, `guards.ts`, the `pre-tool.sh` prefilter and four test files.
- Spec deltas live at `.bdk/changes/<id>/spec-delta/<capability>.md` and are parsed by the `spec` slice (`parseDelta` in `spec/domain/grammar.ts`, not exported from `spec/index.ts`). It trims names and matches them exactly, case included. Only `feature` and `bug` Changes have them. The dependency matrix lets `review` import only `measure`, and `dispatch` import `review` but not `measure` or `spec`.
- Triage is `main`'s, in the `cr` skill, from the entry text alone (`bdk log list`, `bdk log show`); `main` reads no code. `bdk log triage` is `orchestrator`: the guard denies it to every subagent (`guard/subagent-kernel-command`), with one precedent for a scoped exception, the lead's four verbs (`LEAD_VERBS` in `guards.ts`).
- A finding body is free Markdown. `bdk review render` parses `Problem:`, `Why it matters:` and `Suggested fix:`, and when all three are present it drops any other paragraph (`splitBody` in `review/domain/report.ts`). `bdk log add` has no `--severity`, although the reviewer contracts ask for one. The P8 lists reach only the `verifier` and `design-verifier` packages, although the reviewer contracts name them.
- The `review-models` eval counts a defect as found even when its entry was triaged `not-a-problem` (`found_<id>` ignores `level`), so a triage that throws away a real defect is invisible today.
- `guard/reader-write` already treats a heredoc on stdin as no write (`kernel/src/hooks/domain/shell.ts` skips heredoc bodies and records no redirect for `<<`). The readers that were blocked used `cat > /tmp/...` because the package's own Return section (`kernel/src/dispatch/domain/template.ts`) shows `bdk log ingest --ticket <ref> < <report-file>`, and no contract shows another form.
- The lead exception of the guard needs only the target of the lead's registry row. The registry links an agent to its package on the parent's `PostToolUse`, so an agent started in the foreground has no package until it ends.
- Role body sizes: `integration-reviewer` 3 968 of 4 096 bytes, `reviewer` 3 723; the `reviewer` skill description is 223 of 250 characters. The `reviewer` adapter description says "code review with test runs".

## Goals / Non-Goals

**Goals:**

- The integration reviewer works from the group reports and the spec deltas, and reads code only to confirm a row or a seam.
- The human sees at the gate which promised scenario has code and a proving test, from a table the kernel checks against the spec deltas.
- No reviewer slot or token is spent on a file no text reviewer can judge.

**Non-Goals:**

- No new bdk command. Everything the integration reviewer needs reaches it through its package.
- No change to the gate runner, the merge report or the fix round. The triage changes owner (D10, D11) but not its levels, its verdict check or its fallback in `main`.
- No semantic check that a named code or test file really proves a scenario. The kernel checks the table's shape and coverage of scenarios; the judgement stays the reviewer's and the human's.
- No content review of binary files (image diffing, snapshot approval).
- The judge does not look for problems the reviewers missed; recall stays the reviewers' and the integration reviewer's.
- No record of who set a level: the `Triaged as` body line keeps its format, so the report's history parsing does not change.

## Decisions

### D1. The integration reviewer runs after the group reviewers

`/bdk:cr` starts the reviewers and the gate runner first, and builds and starts the integration package only when every reviewer has returned.

- **Why:** the integration reviewer's findings in the diagnosed run were all about seams and intent. With the group reports and their `## Seams` in hand, it needs no full read of the range. Building the package late lets the kernel name the stored reports and the groups that have none.
- **Alternative: keep one parallel round** and give the integration reviewer only a narrower package. Lost: without the group reports it must still read the code of every seam itself, which is the duplicated work that made it the critical path.
- **Alternative: a second `/bdk:cr` round** for integration only. Lost: a round is a ticket with its own triage and merge report; integration findings belong to the same triage as the group findings.
- **Cost:** the group time (about 2.5 min in the diagnosed run) moves onto the critical path. The gate runner keeps running in parallel, so the round's wall time is max(gate, groups + integration).

### D2. Promised behaviour comes from the spec deltas only

The integration reviewer traces the scenarios of the Change's spec deltas. A Change without spec deltas gets seams and risks only, plus one `observation`.

- **Why:** a scenario is the smallest testable promise BDK already writes and validates. It has a stable name, so the kernel can match the reviewer's table against it.
- **Alternative: extend the intent at `/bdk:change`** with a behaviour list. Lost: it adds a second, unvalidated list of promises next to the spec deltas, and drifts from them.
- **Alternative: let the reviewer read the PR description** (`gh pr view`) for a `review` Change. Lost: it depends on a tracker and on free text that the kernel cannot check, and makes the role host-specific.
- **Alternative: a `question` instead of an `observation`** for a Change without spec deltas. Lost: a question blocks the human at the gate for something they cannot fix in the review; the observation informs and is triaged like any entry. The reviewer logs it once per Change, not per round.

### D3. The kernel checks the `## Intent` table at render time, not at ingest

`bdk review render` builds the Intent section from the spec deltas and fills each row from the latest integration report's table. A scenario without a row shows `untraced` with a warning.

- **Why:** the human sees the gap where they decide. The scenario list comes from the kernel, so a reviewer that skips a scenario cannot hide it.
- **Alternative: refuse the report at `bdk log ingest`** when a scenario has no row. Lost: ingest would need the Change's spec deltas and a parser of the report body, coupling the generic report envelope to one role. A refused integration report after 3-5 minutes of work also costs more than a visible `untraced` row.
- **Matching:** by capability, requirement and scenario name, trimmed and otherwise exact, as `spec` matches requirement names; no case or whitespace folding. The scenarios come from `spec`'s own delta parser: `spec/index.ts` exports it and `kernel-architecture` adds the edge `review` to `spec` (a leaf, so the graph stays acyclic). A second parser in `review` would drift from the grammar `spec delta check` enforces. The `## Areas` parser (`areasOf` in `kernel/src/review/use-cases/render.ts`) is the model for reading the table: one parser in `review/domain/report.ts` reads both sections.

### D4. The package names the group reports; no new command lists them

`bdk dispatch build` for `integration-reviewer` reads the other packages of the same ticket and names each group with its files and its report path, or as not reviewed when no report is stored.

- **Why:** the package already is the one input of an agent (`role-contracts`). The kernel knows the ticket's packages from the file layout (`dispatch/<target>-<role>-<ticket>-<group>.md`, frontmatter `group`, `files`, `report`); a new `shared/store` query lists the `reviewer` group packages of a ticket, leaving out `gate`, `integration`, `judge` and scouts, and checks whether each report exists. The agent then reads each report with the Read tool.
- The binary list is not stored by `review plan`, so `dispatch build` recomputes it over `--range` through a function `review/index.ts` exports (dispatch may import `review`, not `measure`).
- **Alternative: a `bdk review reports --ticket` command.** Lost: one more command, availability rule and output schema for data that only this package needs, read once.
- **Alternative: embed the reports in the package.** Lost: it copies every report into a package the agent reads whole, while the agent needs most reports only for their `## Seams` and findings; a path lets it read what it needs, and the package stays far under the 163 840-byte limit.
- `--file` and `--part` are refused for `integration-reviewer`, because its scope is the ticket's groups, not a file list.

### D5. Group reviewers end their report with `## Seams`

One line `- <file>: <contract>` per outward contract their files change, or `- none`.

- **Why:** the reviewer has just read those files; naming the contracts costs it a few lines and saves the integration reviewer a read of every file to find them.
- **Alternative: the kernel computes seam candidates** (files in several modules, manifests, exported symbols). Lost: language-agnostic export detection is not possible from a diff, and file-level heuristics name many files without saying which contract changed.
- The kernel does not parse `## Seams`; it is reviewer-to-reviewer text. A missing section is visible in the integration report and in the eval, not refused.

### D6. Binary files are detected with numstat and returned in `binary`

`bdk review plan` reads the range with `git diff --numstat <range>` through `measure`, whose per-file rows gain a `binary` flag for rows with `-` counts; `measure` exports those rows, and its range measurement aggregates the same rows instead of running git again. Binary files go to `binary`, into no group, and still count in `measure.files`.

- **Why:** numstat is git's own definition of binary (attributes included), costs one call, and `measure` already parses it.
- **Alternative: an extension list** (`.png`, `.jpg`, ...). Lost: language and project specific, misses `-diff` attributes and generated binaries.
- **Alternative: keep binary files in the integration group only.** Lost: the integration reviewer cannot judge them either; naming them in its package is enough to check that a snapshot change fits the intent.
- A range with binary files only has no group, so `cr` opens no ticket and says so.

### D7. A separate `integrator` adapter with the `reader` profile

Same tools, `opus`, effort `high`.

- **Why:** the decision in #158: the integration reviewer's cost and model must be tunable without touching `verifier` and `design-verifier`. Lowering it is a later, measured change.
- **Alternative: keep `reader` and override the model per package.** Lost: per-package `model` is the escalation mechanism (`guard/escalation-model`); using it for a fixed role choice mixes the two.
- Every hard-coded adapter list gains `integrator` and `judge` in the same change: the export schema enum, the adapter enum of `dispatch/schema/outputs.ts`, `ROLE_ADAPTERS`, `guards.ts` (read-only and dispatch-prompt lists), the `pre-tool.sh` prefilter, `CONTRIBUTING.md`, and the tests that list adapters. Neither is added to the `guard/agent-spawn` list of `lead`: only `/bdk:cr` on the main thread starts them. The `reviewer` adapter description drops "with test runs", since reviewers run no tests.

### D8. Readers hand over through a stdin heredoc

The package template's Return section shows `bdk log ingest --ticket <ref> <<'REPORT' ... REPORT` in place of `< <report-file>`, for every role, and the `reviewer`, `integration-reviewer` and `judge` contracts repeat it once. The guard does not change: it already passes heredocs, and a scenario in `kernel-cli/hooks` now pins that. The template change changes the hash of every package, which is expected (packages are built per ticket and never reused).

- **Alternative: let readers write under `.bdk/tmp/`.** Lost: it weakens the read-only adapters for a problem that one example in the contract solves.

### D9. Kept scenario name in `role-contracts`

The scenario "integration reviewer runs on the reader adapter" keeps its name, with a body that says `bdk:integrator` replaces `bdk:reader`. OpenSpec refuses a MODIFIED block that drops a scenario name of the main spec, and the name cannot be changed in the same Change.

### D10. A judge agent triages the round; it falsifies, it does not search

One `judge` agent per round, after the integration reviewer. Its package lists the round's entries and the Change's untriaged ones (ids, summaries, refs, writers), no bodies and no diff: in place of the shared ledger entries section it embeds no entry body, and it stamps the listed ids as `entries` in its frontmatter. For each entry it reads the body and the code at the refs, tests the failure scenario, weighs it against the intent, spec deltas, decisions, `not-a-fail` and cited rules, finds repeats, and sets the level.

- **Why:** checking one claim at its refs costs a fraction of finding it, so the judge does a different job from the reviewers instead of repeating theirs. It replaces `main`'s triage from text, which cannot tell a real failure from a plausible-sounding one.
- **Alternative: per-finding verifier agents.** Lost: one agent per entry (22 in the diagnosed run) multiplies the start-up cost and the rule loading, for claims that one agent checks in sequence in a few minutes.
- **Alternative: reviewers verify their own findings before logging.** Lost: the writer confirms its own claim; the point is a second reader.
- **Alternative: the integration reviewer judges the group findings.** Lost: it mixes two jobs into the critical path, and it would judge its own findings too.
- **Alternative: stronger triage in `main`** (read the code at refs). Lost: it fills the orchestrator's context with code for every entry, on the session model, which is not chosen for this.
- **Timing:** in the diagnosed run the gate ends about 3 minutes after the integration reviewer would; the judge runs in that window, so it costs tokens but no wall time while the gate is the critical path.

### D11. The judge sets the level itself, scoped to its package

The guard lets `bdk:judge` run `log triage`, only on the entries its package lists in the `entries` frontmatter (`guard/judge-scope`). The package comes from the judge's row in the agent registry, as for a lead, but the check is not symmetric with the lead's: the guard reads the package's frontmatter, as it reads `workdir` (`packageWorkdir`), and gathers agent facts for a Bash call of `bdk:judge` as it does for `bdk:lead`. `cr` starts the judge in the background, because the registry links a foreground agent to its package only when it ends.

- **Why:** the judge's reason lands in the entry's history line, where the report shows it, and `main` does not have to read and replay a list of verdicts.
- **Alternative: the judge writes verdicts in its report and `main` applies them.** Lost: `main` would read a report it may not judge, and replay each verdict as a separate call; a mistake in that replay is a silent wrong level.
- **Alternative: make `log triage` an `agent` verb.** Lost: every role could then triage, including the writer of the entry.
- **Alternative: the guard parses the package's `Review` section for ids.** Lost: the ledger entries section names ids too, and a body parse ties the guard to template text; a frontmatter list is data.
- `main` keeps the fallback: an entry without a level after the judge returned is triaged by `main`, and the review verdict still refuses a round with an untriaged entry (`triagedCheck`).

### D12. A failure scenario in every finding

Reviewer and integration reviewer findings carry a `Failure scenario:` paragraph; render shows it as a fourth field and no longer drops unknown paragraphs of a labelled body.

- **Why:** a claim the judge can check needs a concrete consequence. A finding that cannot state one is an opinion, which the judge caps at `nice-to-have`. This one requirement removes most of the noise before anyone judges it.
- **Alternative: a frontmatter field** set with a new `bdk log add` flag. Lost: a multi-line scenario is body text; a field adds schema and CLI surface for something only people and the judge read.
- **Alternative: fold it into `Why it matters:`.** Lost: that paragraph argues importance; mixed with the scenario, the judge cannot tell what to check.

### D13. Measure the judge by false alarms and recall after triage

`review-models` adds raw false alarms, recall after triage and the count of seeded defects dismissed by triage. The judge works when false alarms fall and recall after triage holds. The cells keep varying the reviewer model; the before-and-after comparison is the baseline of tasks group 1 against the series of the last group.

## Risks / Trade-offs

- [The judge dismisses a real defect] → `not-a-problem` keeps the entry in Settled with the reason, so the human sees it; the eval's recall after triage and dismissed-defect count make the rate visible, and the judge needs a scenario that does not hold, a `not-a-fail` item or a repeat to dismiss.
- [The judge outlasts the gate, so it reaches the critical path] → It reads only refs; the eval records its wall time. If it exceeds the gate, a later change can start it per group as reports arrive.
- [Reviewers write a ritual `Failure scenario:` that says nothing] → The judge checks it at the refs; a scenario that names no input, state or change counts as missing.

- [Group time moves onto the critical path] → The target in #158 (integration at 3-5 min) gives a round faster than today's 12 min integration; the eval measures both before and after (tasks groups 1 and 10).
- [A group reviewer returns without `## Seams` or without a report] → The package names the group as not reviewed and the contract tells the integration reviewer to check that group's seams from the code; the eval asserts `## Seams` in every group report.
- [The `integration-reviewer` body grows past its 4 096-byte budget: 128 bytes are free today] → The body is rewritten, not extended: duplication across parts and the whole-range read leave it, and the five checks, the Intent rules and the failure scenario replace them. The budget's old reason (a 12 KB package) went with #150, which raised the package limit to 160 KiB; the budget stays because every agent of a role pays for its body, and `role-contracts` now says so. What varies, such as the `## Intent` table format, goes into the package's `Review` section only when spec deltas exist. Role bodies use no `references/` files: the body is embedded in the package, where a relative link resolves to nothing.
- [Template and package text change, so the hash of every review package changes] → Packages are built per round; no stored package is rebuilt. Template hash tests are updated with the change.
- [Nine hard-coded adapter lists can drift] → The contract test that compares `bdk export agents` with `agents/` and the role-to-adapter test both fail on a missing `integrator` or `judge`; the tasks name every list.
- [Scenario names in the Intent table drift from the spec delta by typos] → Matching is exact after trimming, as in `spec`; a row that names no scenario is not shown, so a typo leaves its scenario `untraced` with a warning, which the human sees at the gate.
- [A round after a fix (delta range) has few files, but the Intent table must still cover every scenario] → The render reads only the latest integration report, so a delta round's integration reviewer traces every scenario again from the code at the head. If that proves costly, a later change can name the earlier integration report in the package and limit delta rounds to the scenarios the delta touches.

## Migration Plan

- No state migration: `binary` is a new output field. A Change reviewed before this change has an integration report without `## Intent`; when it has spec deltas, its Intent section shows every scenario `untraced`, with a warning that names the missing table.
- Projects pick up `integrator.md` and `judge.md` with the plugin update; `pnpm build` generates them, and `STARTUP_INSTRUCTIONS.md` regenerates its agents table.
- Rollback: revert the change; the generated adapter disappears with the next build.
