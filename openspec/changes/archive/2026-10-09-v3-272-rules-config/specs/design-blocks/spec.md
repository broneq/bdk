## MODIFIED Requirements

### Requirement: Design draft writes the specs and the design

`design-draft` SHALL run in the main thread. It SHALL read the Change's `proposal.md` and, when present, `.bdk/runs/<change>/design/explore.md`; without it, it SHALL read the code the proposal touches itself before asking anything. It SHALL read the rules `bdk rules for --stage design` selects, without files, and follow each as a constraint on the design; a decision that follows from a rule, or that departs from one with the user's agreement, SHALL name the rule's id. It SHALL write one spec delta per capability the proposal names and the Change's `design.md`, each following the instruction and template of the Change's OpenSpec schema. For each branching decision it SHALL weigh at least two approaches, or say why only one is viable, and `design.md` SHALL record each decision with its reason and the alternatives with why they lost, a Mermaid diagram for each flow or structure that prose alone leaves ambiguous, and risks naming at least one bottleneck, one single point of failure or operational risk, one hidden cost and one assumption the user did not confirm. It SHALL NOT write implementation code or plan parts.

#### Scenario: Specs and design written

- **WHEN** `design-draft` finishes for a Change whose proposal names the capability `ledger-export`
- **THEN** `openspec/changes/<change>/specs/ledger-export/spec.md` holds requirements with `#### Scenario:` blocks in WHEN / THEN form, and `openspec/changes/<change>/design.md` holds numbered decisions with alternatives and a Mermaid diagram

#### Scenario: Design rule followed

- **WHEN** the project layer declares a rule `IO-1` for stage `design`, "every module that reads or writes a file format lives in `src/io/`, one module per format (`src/io/csv.js`)", and `design-draft` designs a Change that adds a CSV export
- **THEN** `design.md` puts the CSV writer into `src/io/csv.js` and names `IO-1` in the decision that does

### Requirement: Verify design checks the design against the code

`verify-design` SHALL read the Change's `proposal.md`, spec deltas and `design.md`, `.bdk/runs/<change>/design/explore.md` when present, and the code they name. It SHALL check that every claim about the code holds, that every capability of the proposal has a spec delta whose requirements have runnable scenarios, that the design answers every requirement and the proposal's changes without contradicting them, that every decision names its alternatives, that the design breaks no rule `bdk rules for --stage design` selects (without files) unless it records the user's agreement to depart from it, that the stated constraints are met or deferred, that diagrams match the prose, that risks are concrete, and that the open questions change neither the specs, the decisions nor the plan. A defect that would make the plan or the product wrong, and a broken design rule, SHALL be a `Must address` item that names the rule's id; every other gap SHALL be a `Should consider` item. It SHALL write the report `.bdk/runs/<change>/design/verify-N.md`, N one more than the highest existing report, with the verifier report body and stable item IDs (spec `bdk-verifier`), and reply with the verdict line and the report path.

#### Scenario: False claim about the code

- **WHEN** `design.md` says the change reuses a function `formatAmount` and no file of the project defines it
- **THEN** `verify-1.md` starts with `Verdict: FAIL` and its `## Must address` names `formatAmount` with evidence from the code

#### Scenario: Sound design

- **WHEN** every claim of the design holds and every requirement has an answer
- **THEN** the report starts with `Verdict: PASS` and its `## Must address` is empty

#### Scenario: Design breaks a design rule

- **WHEN** the project declares `IO-1` for stage `design` and `design.md` puts the CSV writer into `src/export.js`
- **THEN** the report starts with `Verdict: FAIL` and its `## Must address` holds an item naming `IO-1`

### Requirement: Eval cases of the design blocks

`plugins/bdk/evals/` SHALL hold, tagged `block` and built on a shared fixture of a configured project with an OpenSpec Change, at least one case for `explore`, one for `verify-design` with a false claim about the code, one for `verify-design` on a second pass, four for `design-draft`: the Lavish path, the path without Lavish, `policy.questions: decide-and-record`, and a project rule of stage `design` the design must follow and cite (`design-draft-rules`), and one for `verify-design` on a design that breaks a project rule of stage `design` (`verify-design-rules`). Run with and without the plugin, each block SHALL score higher with it than without it, and the results SHALL be recorded in the Change.

#### Scenario: Effect over no plugin

- **WHEN** `pnpm --filter @bdk/bdk run eval` runs the cases `explore-*`, `design-draft-*` and `verify-design-*` with and without the plugin
- **THEN** each block's mean `WITH` score is above its `W/OUT` score

#### Scenario: Design rule cases

- **WHEN** `pnpm --filter @bdk/bdk run eval` runs `design-draft-rules` and `verify-design-rules` with the plugin
- **THEN** `design-draft-rules` grades that `design.md` follows the rule and names its id, and `verify-design-rules` grades that the report fails and names the rule's id
