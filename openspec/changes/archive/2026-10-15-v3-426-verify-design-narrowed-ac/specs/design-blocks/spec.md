## MODIFIED Requirements

### Requirement: Acceptance criteria checked by verify-design

`verify-design` SHALL treat `source/issue.md`, `## Intent` and `## Acceptance` of `proposal.md` and `scope-log.md` as the reference. A `Must address` item SHALL be: an acceptance point of `source/issue.md` that `## Acceptance` lacks or states differently with no `By: user` entry for it; an AC the spec deltas or `design.md` drop, narrow or reinterpret with no `By: user` entry naming it (an entry `By: setting` or an open `By: needs-user` entry does not cover it, and neither does a `Decided without the user:` line); an AC no requirement, decision or, with `skip_specs: true`, design section answers. An AC outside the proposal's other sections SHALL NOT be excused as "outside the proposal". When `source/issue.md` is missing, the check SHALL run against `## Acceptance` and the report SHALL say so under `## Checked`; when the proposal has no `## Acceptance` either, that SHALL be a `Should consider` item.

Each AC SHALL be checked as it stands, with its condition (an AC without one holds in every case), against every requirement, scenario and decision that touches its subject, also those written for another AC, under every option, mode or input the deltas bring in. A requirement or scenario that, under one of them, gives an outcome the AC rules out or holds the AC for fewer cases than its condition SHALL count as narrowing the AC. A list in `design.md` naming the AC it answers SHALL count as a claim to check, not as evidence. `## Checked` SHALL hold one line per AC naming its id, its quoted condition and the requirements and scenarios read.

#### Scenario: AC dropped without the user

- **WHEN** `## Acceptance` holds `AC-3`, `design.md` leaves `AC-3` out with a `Decided without the user:` line, and `scope-log.md` holds no entry for `AC-3`
- **THEN** the report starts with `Verdict: FAIL` and its `## Must address` names `AC-3`

#### Scenario: AC dropped by the user

- **WHEN** `scope-log.md` holds an entry `AC: AC-3`, `After: dropped`, `By: user`, and the design leaves `AC-3` out
- **THEN** no `Must address` item names `AC-3`, and `## Checked` names the entry

#### Scenario: AC narrowed under one option

- **WHEN** `AC-3` says "A label holding a comma is quoted" with no condition, the delta adds a `delimiter` option for `AC-4` and quotes only a field holding the delimiter in use, a scenario writes the label `food, drinks` without quotes under `delimiter: ";"`, `design.md` lists `AC-3` as answered, and `scope-log.md` holds no entry
- **THEN** the report starts with `Verdict: FAIL` and its `## Must address` names `AC-3`

### Requirement: Eval cases of the design blocks

`plugins/bdk/evals/` SHALL hold, tagged `block` and built on a shared fixture of a configured project with an OpenSpec Change, at least one case for `explore`, one for `explore` settling a CLI's options with its help command, one for `explore` naming the project's test wrapper, test setup and test hook (`explore-project-facts`), one for `verify-design` with a false claim about the code, one for `verify-design` on a second pass, nine for `design-draft`: the Lavish path, the path without Lavish, `policy.questions: decide-and-record`, every AC of a proposal from the new propose answered under `policy.questions: decide-and-record` (`design-draft-acceptance`, graded that the spec delta answers AC-1 to AC-4, writes no scenario that leaves a comma label unquoted, reuses `listEntries` and `formatCents` in `design.md`, and appends no `needs-user` entry), a project rule of stage `design` the design must follow and cite (`design-draft-rules`), a follow-up round opened by a note, an answer that drops a capability of the proposal, a page in the user's language whose every card holds the three sections of the page contract (`design-draft-page-contract`), and a bare page from an earlier round caught and rewritten before it opens again (`design-draft-page-resume-bare`), one for `verify-design` on a design that breaks a project rule of stage `design` (`verify-design-rules`), and two for `verify-design` on a design that drops an AC of the source: without a scope-log entry (`verify-design-dropped-ac`, graded `Verdict: FAIL` with a `Must address` item naming the AC) and with an entry `By: user` that drops it (`verify-design-dropped-ac-user`, graded `Verdict: PASS`), and one for `verify-design` on a design whose delta narrows an AC under one option with an empty scope log (`verify-design-narrowed-ac`, graded `Verdict: FAIL` with a `Must address` item naming the AC). Run with and without the plugin, each block SHALL score higher with it than without it, and the results SHALL be recorded in the Change.

#### Scenario: Effect over no plugin

- **WHEN** `pnpm --filter @bdk/bdk run eval` runs the cases `explore-*`, `design-draft-*` and `verify-design-*` with and without the plugin
- **THEN** each block's mean `WITH` score is above its `W/OUT` score

#### Scenario: Design rule cases

- **WHEN** `pnpm --filter @bdk/bdk run eval` runs `design-draft-rules` and `verify-design-rules` with the plugin
- **THEN** `design-draft-rules` grades that `design.md` follows the rule and names its id, and `verify-design-rules` grades that the report fails and names the rule's id

#### Scenario: Page contract cases

- **WHEN** `pnpm --filter @bdk/bdk run eval` runs `design-draft-page-contract` and `design-draft-page-resume-bare` with the plugin
- **THEN** the first grades that every card of the opened page holds the three sections and is in Polish, and the second that the bare page is rewritten with the three sections before the command that opens it

#### Scenario: Dropped AC cases

- **WHEN** `pnpm --filter @bdk/bdk run eval` runs `verify-design-dropped-ac` and `verify-design-dropped-ac-user` with the plugin
- **THEN** the first report starts with `Verdict: FAIL` and names the dropped AC under `## Must address`, and the second starts with `Verdict: PASS`

#### Scenario: Narrowed AC case

- **WHEN** `pnpm --filter @bdk/bdk run eval` runs `verify-design-narrowed-ac` with the plugin, 3 runs
- **THEN** each report starts with `Verdict: FAIL` and names `AC-3` under `## Must address`

#### Scenario: Acceptance case

- **WHEN** `pnpm --filter @bdk/bdk run eval` runs `design-draft-acceptance` with the plugin
- **THEN** the spec delta answers AC-1 to AC-4 with scenarios, no scenario writes a label holding a comma without quotes, `design.md` names `listEntries` and `formatCents`, and `scope-log.md` holds no `needs-user` entry
