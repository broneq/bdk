## ADDED Requirements

### Requirement: A question page a developer can decide from

Every card of a `design-draft` Lavish page (one card per open decision) SHALL hold three sections, each marked in the markup with `data-bdk-section` so it can be found in any language: `context`, what the proposal (or the issue it tracks) says about the decision and what the code does today, with at least one `file:line` of code the decision touches, or a statement that the project has no code for it yet; `options`, every option with its consequences: what it costs, what it risks, what it leaves uncovered and what it breaks, each named or stated as none; and `recommendation`, the recommended option and the reason, tied to the proposal, the code or a project rule. A card holding only a question and bare options SHALL be invalid. The page's layout and look SHALL follow Lavish's own guidance (`npx -y lavish-axi design` and its playbooks); BDK SHALL fix only what a card says and its section markers.

The thread that starts `bdk:designer` SHALL name in the designer's prompt the language the user writes in, and the designer SHALL write the page in that language, English when the prompt names none. Before it opens a page, a new one or one it opens again on resume, the designer SHALL read the page back and check every card against this contract and the language, and fix the page in place until every card passes; it SHALL NOT open a page with an invalid card.

#### Scenario: Cards in the user's language

- **WHEN** the user asks in Polish for the design of a Change with open decisions on the CSV delimiter and the amount format, and the Lavish page opens
- **THEN** every card of the page holds a `context` section that cites a `file:line` of the project, an `options` section that names the consequences of each option, and a `recommendation` section with its reason, and the page's text is in Polish

#### Scenario: Bare page caught before it opens

- **WHEN** the design resumes on a round's page from an earlier run whose cards hold only a question and radio options, with no `design.md` and no answers
- **THEN** the designer rewrites that page so every card holds the three sections before `npx -y lavish-axi <page>` opens it

## MODIFIED Requirements

### Requirement: Eval cases of the design blocks

`plugins/bdk/evals/` SHALL hold, tagged `block` and built on a shared fixture of a configured project with an OpenSpec Change, at least one case for `explore`, one for `explore` settling a CLI's options with its help command, one for `explore` naming the project's test wrapper, test setup and test hook (`explore-project-facts`), one for `verify-design` with a false claim about the code, one for `verify-design` on a second pass, eight for `design-draft`: the Lavish path, the path without Lavish, `policy.questions: decide-and-record`, a project rule of stage `design` the design must follow and cite (`design-draft-rules`), a follow-up round opened by a note, an answer that drops a capability of the proposal, a page in the user's language whose every card holds the three sections of the page contract (`design-draft-page-contract`), and a bare page from an earlier round caught and rewritten before it opens again (`design-draft-page-resume-bare`), and one for `verify-design` on a design that breaks a project rule of stage `design` (`verify-design-rules`). Run with and without the plugin, each block SHALL score higher with it than without it, and the results SHALL be recorded in the Change.

#### Scenario: Effect over no plugin

- **WHEN** `pnpm --filter @bdk/bdk run eval` runs the cases `explore-*`, `design-draft-*` and `verify-design-*` with and without the plugin
- **THEN** each block's mean `WITH` score is above its `W/OUT` score

#### Scenario: Design rule cases

- **WHEN** `pnpm --filter @bdk/bdk run eval` runs `design-draft-rules` and `verify-design-rules` with the plugin
- **THEN** `design-draft-rules` grades that `design.md` follows the rule and names its id, and `verify-design-rules` grades that the report fails and names the rule's id

#### Scenario: Page contract cases

- **WHEN** `pnpm --filter @bdk/bdk run eval` runs `design-draft-page-contract` and `design-draft-page-resume-bare` with the plugin
- **THEN** the first grades that every card of the opened page holds the three sections and is in Polish, and the second that the bare page is rewritten with the three sections before the command that opens it
