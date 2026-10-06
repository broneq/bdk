## ADDED Requirements

### Requirement: setup asks on one page

`/bdk:setup` SHALL detect everything it asks about before its first question and write nothing before the user has answered. Its only earlier question is whether to install Lavish (requirement "setup checks Lavish"). When `features.lavish` is on and `lavish-axi` runs, it SHALL ask every other question on one Lavish page made from `skills/stages/setup/references/setup-page.html`, filling only the page's JSON data block: the v2 ignore rule and the v2 files, the detected commands and a `test` or `lint` group without one, the derived values, the exclusions of `.bdk/` from the project's tools, the gates, the review risks, the tracker and the hand-written rules, each as a section of its own that the page leaves out when it has nothing to ask. Each section SHALL return its answer as one queued prompt whose data is `{question, answer}`.

A section the page leaves unanswered, a non-zero exit of `lavish-axi`, a reply that does not parse, and every question when Lavish is off or declined, SHALL be asked in the terminal with one `AskUserQuestion` call per section, in the page's order; a list longer than the four options a question takes SHALL be split into multi-select questions of at most four. An answer the skill cannot apply as given, such as a command no tool of the project runs, SHALL be asked again in the terminal with the reason. The skill SHALL NOT reopen a session the user ended.

After the answers, the skill SHALL write in this order: the v2 ignore rule and the v2 files, the commands, the derived values, the asked keys, `features.lavish`, the exclusions with their lint run and commit, and the rule import.

#### Scenario: one page

- **WHEN** `/bdk:setup` runs with Lavish installed in a project with detected commands, derived values and a markdownlint config
- **THEN** one `lavish-axi` page holds the sections `commands`, `derived`, `exclusions`, `gates`, `risks` and `tracker`, no `AskUserQuestion` call is made for an answer the skill can apply, and `bdk config set` runs only after the page's answers arrive

#### Scenario: Lavish declined

- **WHEN** Lavish is missing and the user declines the install
- **THEN** each section is asked in an `AskUserQuestion` call of its own, and `bdk config show features.lavish --json` reports `false` from the project layer

#### Scenario: the page's contract

- **WHEN** the content test reads `setup-page.html` and `SKILL.md`
- **THEN** the page's example data holds every section with the six default risks, each section queues one prompt, and the skill's sections that detect come before "Ask", which names the answer of every section, and "Apply" follows it

### Requirement: setup covers every derived and asked key

`/bdk:setup` SHALL handle every key its context lists under `#### Derived` and `#### Asked` (`kernel-cli/ctx`, bdk ctx skill, part `setup-coverage`), and no key listed under `#### Not set by setup`. Its manifest entry SHALL carry the `setup-coverage` part after the three `tools` parts.

For the `derived` keys beyond the toolchain, the skill SHALL read the value from the project files without a question about the key, and show it for confirmation with the detected commands:

- `execution.worktree.setup.command`: the dependency install command the lockfile names, from the stack table of `references/stacks.md` (`pnpm install --frozen-lockfile` for `pnpm-lock.yaml`); none when the stack has no lockfile.
- `policy.evidence.build-config`: the globs of Markdown or text files the project builds or tests from, which the default `non-executable` list would otherwise exclude from the tree hash: the source directory of a documentation build the stack table names (`mkdocs.yml` gives `docs/**`) and test fixture directories holding such files.
- `policy.evidence.non-executable`: the documentation and image formats the project holds beyond the default globs, from the stack table.
- `spec.normative-word`: the word the requirement statements of the project's existing living specs carry (`.bdk/specs/`, or the specification files the project used before BDK), when one word other than `SHALL` holds the majority.

For the `asked` keys, the skill SHALL ask who passes the design and review gates (`policy.gates.design`, `policy.gates.review`), which default `review.risks` to keep, showing for each risk the project files its `paths` match, and which risks to add, and the `tracker` proposal (requirement "setup detects the tracker"), each as a question of its own, through requirement "setup asks on one page". On a project where the asked keys already have a non-default value, it SHALL show them and ask only on the user's request (requirement "setup brings a project to a working layout", scenario "settings already present").

The skill SHALL write a key only when the value differs from the one it resolves to, one key or id entry per `bdk config set` call: a risk turned off is `review.risks.<id>.enabled false`, a risk added is `review.risks.<id>` with its `instruction` and `paths`, and an evidence glob is appended to the list.

A contract test SHALL fail when a key the registry classifies `derived` or `asked` is named neither in `skills/stages/setup/SKILL.md` nor in a file of `skills/stages/setup/references/`.

#### Scenario: fixture project sets the derived keys

- **WHEN** `/bdk:setup` runs in a fixture git repository with a `pnpm-lock.yaml`, a `package.json` whose scripts are `test` (vitest) and `lint` (eslint), a `mkdocs.yml` with a `docs/` directory, and no `.bdk/`, and the user confirms the detected values
- **THEN** `bdk config show --json` reports `execution.worktree.setup.command` as `pnpm install --frozen-lockfile` and a `policy.evidence.build-config` that ends with `docs/**`, both from the project layer, besides the `tools` entries of requirement "setup brings a project to a working layout"

#### Scenario: fixture project asks the asked keys

- **WHEN** the same run reaches the questions
- **THEN** the gates, the review risks and the tracker are asked as sections of the setup page, each apart from the others, and no question names a key the context lists under `Not set by setup`

#### Scenario: defaults accepted write nothing

- **WHEN** the user keeps both gates manual and every default risk
- **THEN** `.bdk/settings.yaml` holds no `policy.gates` and no `review` key

#### Scenario: risk turned off and added

- **WHEN** the user drops `secrets` and adds `billing` with the instruction "Anything that computes or stores a price" and the path `src/billing/**`
- **THEN** the resolved `review.risks` holds `secrets` with `enabled: false` and `billing` after the six defaults

#### Scenario: key without coverage in the skill

- **WHEN** a module classifies a new key `asked` and neither `skills/stages/setup/SKILL.md` nor its `references/` name it
- **THEN** `pnpm test:contract` fails naming the key

### Requirement: setup reports the keys it leaves on defaults

The Finish report of `/bdk:setup` SHALL name every key its context lists under `#### Not set by setup`, grouped by its first key segment, each with its value, and SHALL mark a key a layer sets with that layer, so the user sees the whole settings surface once. It SHALL say that any of them is changed with `bdk config set <key> <value>` and that `docs/guide/reference/configuration.md` describes each. It SHALL also report each `derived` value it wrote with the project file it came from.

#### Scenario: Finish names the defaults

- **WHEN** `/bdk:setup` finishes on the fixture project of requirement "setup covers every derived and asked key"
- **THEN** the report names `policy.budgets.task-redispatch`, `execution.concurrency`, `agents.ttl` and `diagnostics.verbose` with their values, and states how to change one

#### Scenario: Finish marks a layer value

- **WHEN** `.bdk/settings.local.yaml` sets `diagnostics.verbose: true` and `/bdk:setup` finishes
- **THEN** the report shows `diagnostics.verbose` as `true` from the `local` layer

## MODIFIED Requirements

### Requirement: Asking the user in two tiers

A stage skill SHALL ask the user through the `Asking the user` section of its context, which states two tiers:

- **Simple decision**: every option is described by a label and one sentence, as in "new branch or the current one", "keep these commands". It SHALL go to `AskUserQuestion` in the terminal, also when `features.lavish` is on.
- **Rich decision**: an option needs a diagram, a side-by-side comparison, a schema delta or an annotated draft to be judged, as the approaches of a design or the review of a draft design. When the section is the Lavish one (`features.lavish` on and `lavish-axi` on `PATH`), it SHALL go to a Lavish review page; otherwise the skill SHALL print the comparison in the terminal and then ask with `AskUserQuestion`.

`/bdk:setup` is the exception: it asks every question, simple or rich, on its setup page (Requirement: setup asks on one page), since its questions are answered together before anything is written.

Inside a run (Requirement: run decides instead of asking) the stage skill asks nothing: it takes the recommended option and records the choice as the run's decision. Either way the recommended option comes first with the tradeoff of each option, and a decision the user did not answer stays open. When the Lavish page fails (non-zero exit, a reply that does not parse, a session the user ended), the skill SHALL ask the same decision with `AskUserQuestion` and SHALL NOT reopen a session the user ended.

#### Scenario: branch question with Lavish on

- **WHEN** `features.lavish` is on, `lavish-axi` is on `PATH` and `/bdk:change "<intent>"` asks for the branch
- **THEN** the question goes through `AskUserQuestion` and no `lavish-axi` command runs

#### Scenario: approaches with Lavish off

- **WHEN** `features.lavish` is off and `/bdk:design` reaches a choice between two approaches
- **THEN** both approaches with their diagrams are printed before one `AskUserQuestion` call whose first option is the recommended approach

### Requirement: setup checks Lavish

`/bdk:setup` SHALL check whether `npx -y lavish-axi --help` succeeds before any other question. When it fails, the skill SHALL offer to install Lavish with `AskUserQuestion` and, when the user declines, set `features.lavish` to `false` through `bdk config set` with the other answers (T02 R-11).

#### Scenario: Lavish missing and declined

- **WHEN** `npx -y lavish-axi --help` fails and the user declines the install
- **THEN** `bdk config show features.lavish --json` reports `false` from the project layer

### Requirement: setup keeps .bdk/ out of the project's tools

`/bdk:setup` SHALL find the configuration of every tool of the project that reads Markdown, YAML or JSON, and every project script that lists files itself, using the ignore column of `references/stacks.md`, and SHALL skip a tool whose ignore list already covers `.bdk/`. It SHALL ask once, with one multi-select holding one option per file and the entry that file gets, as a section of the setup page (requirement "setup asks on one page"), and after the settings SHALL write only the accepted entries, each as the smallest edit to the tool's own ignore list. It SHALL then run the `command` of every `tools.lint` entry once, never a formatter's write mode, and report every path under `.bdk/` in their output. It SHALL commit exactly the files it edited, in a commit of their own, and SHALL still never edit a file under `.bdk/`. A declined exclusion SHALL be named in the closing report. `bdk doctor` does not check the exclusion.

The `allowed-tools` of `setup` SHALL include `Edit`, `Write`, `Bash(git add *)` and `Bash(git commit *)`.

#### Scenario: fixture with a markdownlint config

- **WHEN** `/bdk:setup` runs on the eval fixture, whose `.markdownlint-cli2.mjs` sets `globs: ['**/*.md']`, and the user accepts the proposed exclusion
- **THEN** `.markdownlint-cli2.mjs` names `.bdk/` in its `ignores`, and the last commit that touches it is the setup's own commit, which touches no file under `.bdk/`

#### Scenario: exclusion declined

- **WHEN** the user declines every proposed exclusion
- **THEN** no project file outside `.bdk/` and `.gitignore` changes, no commit is made, and the closing report names each declined tool

#### Scenario: the skill text

- **WHEN** the content test reads `skills/stages/setup/SKILL.md` and `references/stacks.md`
- **THEN** the skill has a section on keeping `.bdk/` out of the project's tools that names one multi-select question, and its "Apply" names the run of the `tools.lint` commands, paths under `.bdk/` and a commit of only the edited files; `stacks.md` has an ignore column naming `.markdownlint-cli2`, `.prettierignore`, `ignores` of `eslint.config` and `extend-exclude` of `ruff`; and `allowed-tools` holds `Edit`, `Write`, `Bash(git add *)` and `Bash(git commit *)`
