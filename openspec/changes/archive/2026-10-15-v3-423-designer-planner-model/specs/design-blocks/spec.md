## MODIFIED Requirements

### Requirement: Eval cases of the design blocks

`plugins/bdk/evals/` SHALL hold, tagged `block` and built on a shared fixture of a configured project with an OpenSpec Change, at least one case for `explore`, one for `explore` settling a CLI's options with its help command, one for `explore` naming the project's test wrapper, test setup and test hook (`explore-project-facts`), one for `verify-design` with a false claim about the code, one for `verify-design` on a second pass, nine for `design-draft`: the Lavish path, the path without Lavish, `policy.questions: decide-and-record`, every AC of a proposal from the new propose answered under `policy.questions: decide-and-record` (`design-draft-acceptance`, graded that the spec delta answers AC-1 to AC-4, writes no scenario that leaves a comma label unquoted, reuses `listEntries` and `formatCents` in `design.md`, and appends no `needs-user` entry), a project rule of stage `design` the design must follow and cite (`design-draft-rules`), a follow-up round opened by a note, an answer that drops a capability of the proposal, a page in the user's language whose every card holds the three sections of the page contract (`design-draft-page-contract`), and a bare page from an earlier round caught and rewritten before it opens again (`design-draft-page-resume-bare`), one for `verify-design` on a design that breaks a project rule of stage `design` (`verify-design-rules`), and two for `verify-design` on a design that drops an AC of the source: without a scope-log entry (`verify-design-dropped-ac`, graded `Verdict: FAIL` with a `Must address` item naming the AC) and with an entry `By: user` that drops it (`verify-design-dropped-ac-user`, graded `Verdict: PASS`). Run with and without the plugin, each block SHALL score higher with it than without it, and the results SHALL be recorded in the Change.

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

#### Scenario: Acceptance case

- **WHEN** `pnpm --filter @bdk/bdk run eval` runs `design-draft-acceptance` with the plugin
- **THEN** the spec delta answers AC-1 to AC-4 with scenarios, no scenario writes a label holding a comma without quotes, `design.md` names `listEntries` and `formatCents`, and `scope-log.md` holds no `needs-user` entry

## ADDED Requirements

### Requirement: Designer agent on opus

The `bdk` plugin SHALL ship the agent `bdk:designer` (`agents/designer.md`), which runs the skill `bdk:design-draft` its prompt names with the `Skill` tool, on the model `opus`, chosen by the #423 measurement (archived Change `v3-423-designer-planner-model`), so that, with `models.designer` not set, the design runs on `opus` whatever the session's model, and the tools `Read`, `Write`, `Edit`, `Bash`, `Grep`, `Glob` and `Skill`.

#### Scenario: Designer on its own model

- **WHEN** `/bdk:design add-csv-export` drafts the design in a `sonnet` session and the configuration sets nothing under `models.designer`
- **THEN** the `Agent` call that starts `bdk:designer` has neither `model` nor `effort`, and the designer runs on `opus`, the model of its frontmatter

#### Scenario: Designer model set by the project

- **WHEN** the configuration sets `models.designer.model: sonnet`
- **THEN** the `Agent` call that starts `bdk:designer` has `model` `sonnet`

## REMOVED Requirements

### Requirement: Designer agent

**Reason**: The designer no longer inherits the session's model; the #423 measurement moved it to `opus`.

**Migration**: Replaced by "Designer agent on opus"; a project that wants the old behaviour sets `models.designer.model` to its session's model.
