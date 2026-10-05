## MODIFIED Requirements

### Requirement: bdk review render

Render the human review report of the active Change, or the decision page of a pull request review, from a fixed template. The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk review render [--format html|md] [--out <path>] [--pr <file|->]`
- **Availability:** `orchestrator`
- **Mode:** `command`; Change-scoped, except with `--pr`
- **Arguments:**
  - `--format html|md`. Default `html`. `md` is the Markdown fallback: the same sections without the form.
  - `--out <path>`. The file to write. Default `.bdk/.machine/review/<change-id>.<format>`. Required with `--pr`.
  - `--pr <file|->`. Render the pull request decision page from the JSON in the file, or from stdin for `-`, instead of the Change report.
  - stdin: The pull request results when `--pr -` is given.
- **Behaviour:**
  - **Purpose and inputs.** The report is what the human reads at `gate:review` (T42-H). The kernel renders it from the ledger, the evidence, the plan parts and the diff of the whole Change, never from a model's text. The range is the Change base to `HEAD`, as `bdk review plan --full` computes it (Requirement: bdk review plan). Uncommitted files are not part of it. The command writes only the output file.
  - **Determinism.** The same repository state, ledger and settings give a byte-identical file: every list is in a fixed order and no timestamp is rendered. Every text that comes from the ledger, the plan or the paths is escaped for HTML.
  - **HTML file.** The page is self-contained: no external stylesheet, script, font or image. It follows the light and dark colour scheme of the browser.
  - **Sections of the Change report, in this order:**
    1. **Summary.** The Change id, its intent from `change.md`, its kind, the range, the number of files and lines added and removed, and the count of entries per level and per disposition.
    2. **Parts and areas.** A diagram of the plan parts against the modules that the range touches, using the modules of `bdk review plan`. It has one row per plan part and one row `outside the plan` for the changed files that no task's `Files:` declares. Each cell holds the files of that part in that module and their added and removed lines. A Change without plan parts, such as a `review` Change, shows the modules only.
    3. **Change map.** One card per enabled `review.risks` item whose `paths` match at least one changed file, or that the area summaries name (`kernel-settings`, Keys of review policy).
       - **What changed.** A card opens with the area summary: the line for its risk id in the `## Areas` section of the latest `integration-reviewer` report of the Change (`role-contracts`, Role contract content). Later reports override earlier ones per risk id. A card without such a line shows no summary.
       - **Files.** A card lists the matched files with their added and removed lines. Each file expands to why and what: the plan tasks whose `Files:` declare it, with their titles, and the commits of the range that changed it, oldest first, with their short sha and subject.
       - **Tags.** Each file is tagged with the live entries that name the risk id or the file in their `refs`. A tag shows the entry's id, level and disposition, and links to the entry in Decisions.
       - A card follows for the files outside the plan, with the `unplanned` summary line when the integration reviewer wrote one.
    4. **Gate.** The verdicts of the latest `tests-full` and `lint-full` evidence, and the diff coverage of each `tools.test` entry with a `coverage` object, with its `min` (`kernel-cli/evidence`, bdk evidence coverage). A tool group declared none (`kernel-settings`, Tool entries) shows `not used` in place of its verdict: `Lint: not used (tools.lint is none)`, and for tests the warning `Tests: not used (tools.test is none): this Change ran no test`, marked as a warning in the HTML (T49).
    5. **Decisions.** Every live `finding`, `observation` and `blocker` whose `level` is not `blocker`. They are grouped as `should-fix`, `nice-to-have` and `untriaged`; `untriaged` is empty after `cr`, which triages every entry first. A legend above the groups says what each disposition does. Each entry shows its id, type, summary, refs, severity, category, writer, current disposition and tracker issue, and, collapsed, its body. A body whose paragraphs start with `Problem:`, `Why it matters:` and `Suggested fix:` is shown as those three fields; any other body is shown as written. In HTML, each one has a choice of `fix`, `defer`, `reject` and, only while `tracker` is set, `track`, plus a reason field. The choice is preselected with the current disposition.
    6. **Settled.** The resolved `finding`, `observation` and `blocker` entries of the Change, collapsed, each with the reason from its body.
    7. **Context.** The live `decision`, `assumption` and `risk` entries.
  - **Form.** The HTML form sends one answer for the whole page through Lavish: a prompt whose data is an `items` array of `{id, disposition, reason}`, one item for each entry of the Decisions section. When the page runs outside Lavish, the form is disabled and names `/bdk:cr --report` as the way to decide in the terminal.
  - **Decision page of a pull request review (`--pr`).** It reads `{prs: [{number, url, title, verdict, findings: [{path, line, severity, category, blocking, problem, why, fix}]}]}`, where `why` is optional. It renders the same template with these sections: one section per PR with its title, link and computed verdict, then each finding. A finding's id is `<number>-<n>`, where `n` counts from 1 in the given order. Each finding has a choice of `blocker`, `nice-to-have`, `tracker` and `drop`, preselected from `blocking`; `tracker` is offered only while `tracker` is set. The page shows the verdict the current choices give: `request-changes` when any finding is a `blocker`, `approve` otherwise. The form sends the `items` array as `{id, disposition}`. This mode reads no Change and no ledger, and needs no active Change. Its output holds `change` and `range` as `null`, every finding id under `undecided`, and an empty `decided`.
  - **Output.** `undecided` and `decided` list the Decisions entries without and with a disposition, in page order; `path` is relative to the project root when the file is inside it, absolute otherwise; `tracker` is the `tracker` kind, or `null` while it is unset.
  - **Refusals.** `--pr` without `--out` is `input/missing-argument`. `--pr` input that is not JSON of that shape is `input/invalid-argument`, naming the first wrong field.
- **Writes:** `<out>`, `.bdk/.machine/review/`
- **Output:** `schema/cli/output/review-render.json`
- **Exit codes and rules:** `0, 2, 3, 4, 5`. Specific rules: `runtime/git-missing`; plus the common rules of every command and, without `--pr`, of Change-scoped commands (`kernel-cli`, Exit codes and the error object).
- **Example:**

  ```bash
  bdk review render --json
  ```

  ```json
  {
    "change": "2026-09-25-passwordless-login",
    "format": "html",
    "path": ".bdk/.machine/review/2026-09-25-passwordless-login.html",
    "range": "4f1c2d9a7b3e5f60718293a4b5c6d7e8f9a0b1c2..9a8b7c6d5e4f30211203f4e5d6c7b8a9f0e1d2c3",
    "undecided": ["L-q2w3e4r5"],
    "decided": ["L-m3n4b5v6"],
    "tracker": "github"
  }
  ```

- **Owner:** T42
- **Slice:** `review`

#### Scenario: example run

- **WHEN** `bdk review render --json` runs as in the example
- **THEN** the exit code is 0 and stdout validates against `schema/cli/output/review-render.json`

#### Scenario: runtime/git-missing

- **WHEN** no `git` executable on `PATH`
- **THEN** the exit code is 5 and the error object carries `rule: runtime/git-missing`

#### Scenario: same state, same file

- **WHEN** `bdk review render` runs twice on an unchanged repository and ledger
- **THEN** both runs write byte-identical files

#### Scenario: report sections from the ledger

- **WHEN** the Change has two plan parts, a file outside the plan, a `should-fix` finding naming `src/auth/login.ts`, a `nice-to-have` finding deferred, and passing `tests-full` and `lint-full` evidence
- **THEN** the HTML holds, in order: the summary; the parts and areas diagram with a row `outside the plan`; an `auth` card listing `src/auth/login.ts` with the task that declares it and the commit that changed it, tagged with the finding's id; the gate verdicts; both findings in Decisions, the deferred one preselected `defer`; and no reference to an external resource

#### Scenario: area summary from the integration reviewer

- **WHEN** the latest `integration-reviewer` report of the Change ends with `## Areas` holding `- auth: Login gains a magic link path; password login is unchanged.`
- **THEN** the `auth` card opens with that sentence, and a card for a risk without a line opens with no summary

#### Scenario: finding body as three fields

- **WHEN** a finding's body holds the paragraphs `Problem: ...`, `Why it matters: ...` and `Suggested fix: ...`
- **THEN** its Decisions entry shows them as the fields Problem, Why it matters and Suggested fix, and a finding whose body has no such labels shows its body as written

#### Scenario: ledger text is escaped

- **WHEN** a finding's summary is `<script>alert(1)</script>`
- **THEN** the HTML holds `&lt;script&gt;` and no `<script>alert(1)` element

#### Scenario: track only with a tracker

- **WHEN** `tracker` is unset and `bdk review render` runs
- **THEN** no entry offers `track`, and `tracker` in the output is `null`

#### Scenario: no test tool in the gate

- **WHEN** `tools.test` is `none`, `tools.lint` is configured with a passing `lint-full` manifest, and `bdk review render` runs
- **THEN** the Gate section holds `Tests: not used (tools.test is none): this Change ran no test` marked as a warning and `Lint: pass`

#### Scenario: Markdown fallback

- **WHEN** `bdk review render --format md --json` runs
- **THEN** the file is Markdown with the same sections and entry ids as the HTML, and holds no form

#### Scenario: pull request page

- **WHEN** `bdk review render --pr - --out /tmp/pr.html --json` reads two PRs, the first with one blocking and one non-blocking finding
- **THEN** the page holds the findings `<number>-1` preselected `blocker` and `<number>-2` preselected `nice-to-have`, the first PR shows `request-changes`, and no file under `.bdk/` is written

#### Scenario: pull request page needs an output path

- **WHEN** `bdk review render --pr -` runs without `--out`
- **THEN** the exit code is 3 and the error object carries `rule: input/missing-argument`

#### Scenario: malformed pull request input

- **WHEN** `--pr -` reads `{prs: [{number: "x"}]}`
- **THEN** the exit code is 3 and the error object carries `rule: input/invalid-argument` naming `prs[0].number`
