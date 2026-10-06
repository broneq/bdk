## MODIFIED Requirements

### Requirement: Asking the user in two tiers

A stage skill SHALL ask the user through the `Asking the user` section of its context, which states two tiers:

- **Simple decision**: every option is described by a label and one sentence, as in "new branch or the current one", "keep these commands". It SHALL go to `AskUserQuestion` in the terminal, also when `features.lavish` is on.
- **Rich decision**: an option needs a diagram, a side-by-side comparison, a schema delta or an annotated draft to be judged, as the approaches of a design or the review of a draft design. When the section is the Lavish one (`features.lavish` on and `lavish-axi` on `PATH`), it SHALL go to a Lavish review page; otherwise the skill SHALL print the comparison in the terminal and then ask with `AskUserQuestion`.

`/bdk:setup` is the exception: it asks every question, simple or rich, on its setup page (Requirement: setup asks on one page), since its questions are answered together before anything is written.

Inside a run (Requirement: run decides instead of asking) the stage skill asks nothing: it takes the recommended option and records the choice as the run's decision. Either way the recommended option comes first with the tradeoff of each option, and a decision the user did not answer stays open. Each ask through Lavish SHALL write its page to a file name under `.lavish/` that no earlier ask of the project used, since `lavish-axi` never reopens a path whose session the user ended, even after the file is written again. When the Lavish page fails (non-zero exit, a reply that does not parse, a session the user ended), the skill SHALL ask the same decision with `AskUserQuestion` and SHALL NOT reopen a session the user ended.

#### Scenario: branch question with Lavish on

- **WHEN** `features.lavish` is on, `lavish-axi` is on `PATH` and `/bdk:change "<intent>"` asks for the branch
- **THEN** the question goes through `AskUserQuestion` and no `lavish-axi` command runs

#### Scenario: approaches with Lavish off

- **WHEN** `features.lavish` is off and `/bdk:design` reaches a choice between two approaches
- **THEN** both approaches with their diagrams are printed before one `AskUserQuestion` call whose first option is the recommended approach

#### Scenario: a second ask in one Change

- **WHEN** the user ended the Lavish session of a design's approaches and the design asks again through Lavish
- **THEN** the new page is written to a file name under `.lavish/` that differs from the first page's, and `lavish-axi` opens it

### Requirement: setup asks on one page

`/bdk:setup` SHALL detect everything it asks about before its first question and write nothing before the user has answered. Its only earlier question is whether to install Lavish (requirement "setup checks Lavish"). When `features.lavish` is on and `lavish-axi` runs, it SHALL ask every other question on one Lavish page made from `skills/stages/setup/references/setup-page.html`, filling only the page's JSON data block: the v2 ignore rule and the v2 files, the detected commands and a `test` or `lint` group without one, the derived values, the exclusions of `.bdk/` from the project's tools, the gates, the review risks and the tracker, each as a section of its own that the page leaves out when it has nothing to ask. Each section SHALL return its answer as one queued prompt whose data is `{question, answer}`.

A section the page leaves unanswered, a non-zero exit of `lavish-axi`, a reply that does not parse, and every question when Lavish is off or declined, SHALL be asked in the terminal with one `AskUserQuestion` call per section, in the page's order; a list longer than the four options a question takes SHALL be split into multi-select questions of at most four. An answer the skill cannot apply as given, such as a command no tool of the project runs, SHALL be asked again in the terminal with the reason. The skill SHALL NOT reopen a session the user ended.

After the answers, the skill SHALL write them, with two orderings: an accepted replacement of the v2 ignore rule comes before the first `bdk config set`, since git would otherwise ignore `.bdk/settings.yaml`; and the lint run that looks for paths under `.bdk/` comes after the commands and the accepted exclusions are written. The other writes have no order.

#### Scenario: one page

- **WHEN** `/bdk:setup` runs with Lavish installed in a project with detected commands, derived values and a markdownlint config
- **THEN** one `lavish-axi` page holds the sections `commands`, `derived`, `exclusions`, `gates`, `risks` and `tracker`, no `AskUserQuestion` call is made for an answer the skill can apply, and `bdk config set` runs only after the page's answers arrive

#### Scenario: Lavish declined

- **WHEN** Lavish is missing and the user declines the install
- **THEN** each section is asked in an `AskUserQuestion` call of its own, and `bdk config show features.lavish --json` reports `false` from the project layer

#### Scenario: the page's contract

- **WHEN** the content test reads `setup-page.html` and `SKILL.md`
- **THEN** the page's example data holds every section with the six default risks, each section queues one prompt, and the skill's sections that detect come before "Ask", which names the answer of every section, and "Apply" follows it, names both orderings and holds no numbered list
