# kernel-cli/review Specification

## Purpose

Review planning (`review`): the range a review round covers and the groups its reviewers get, computed by the kernel so the review skills never derive them from git themselves.

Common rules, not repeated per requirement: every command may emit `input/unknown-command`, `input/unknown-flag`, `input/missing-argument`, `input/invalid-argument`, `runtime/node-version`, `runtime/not-a-repo`; every Change-scoped command additionally `policy/no-active-change`, `state/corrupted-index`, `state/ledger-invalid`, `state/change-dir-missing`. Their meaning and exit codes are in `kernel-cli`, Exit codes and the error object; a command's `exits` in the index is derived from the classes of its specific and common rules.

Representative refusal:

```json refusal
{
  "refused": true,
  "rule": "input/invalid-argument",
  "why": "--full reviews from the Change base and --base from a merge base; pass one",
  "instead": ["bdk review plan --full", "bdk review plan --base main"]
}
```

## Requirements

### Requirement: bdk review plan

Compute the range and the reviewer groups of the next review round of the active Change. The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk review plan [--full] [--base <ref>]`
- **Availability:** `read`
- **Mode:** `command`; Change-scoped
- **Arguments:**
  - `--full`. Review from the Change base, ignoring earlier review rounds.
  - `--base <ref>`. Review from `git merge-base HEAD <ref>`; for a branch stacked on another one.
- **Behaviour:** Deterministic for the same repository state and ledger, and writes nothing. **Anchor**: with `--base`, the merge base of `HEAD` and `<ref>` (`kind: base`); with `--full`, the Change base (`kind: full`); otherwise the `head` of the latest `report` entry of the Change with `group: merge` (`kind: delta`, `kernel-state`, Ledger entry), or the Change base when the ledger holds none or its `head` names no commit of the repository, as after rewritten history (`kind: full`). `--full` with `--base`, and an unknown `<ref>`, are `input/invalid-argument`. The **Change base** is the `base` stamped in `change.md` for a `review` Change (`kernel-cli/change`, bdk change new; T42); for any other Change it is the parent of the Change's first commit, the one that added its `change.md` or the first carrying its `BDK-Change` trailer, whichever comes first, since a part agent commits its tasks without the Change directory (#166), or `HEAD` while neither exists; a Change whose first commit is the repository's root commit has the empty tree as its base. **Range**: `<anchor>..HEAD`, committed history only; the changed files are those of `git diff --name-only <anchor>..HEAD` outside `.bdk/`, sorted, and `dirty` lists the tracked files outside `.bdk/` with uncommitted changes, so the caller can commit them first. **Binary files**: a changed file that `git diff --numstat <anchor>..HEAD` counts as binary (`-` for both counts) is listed, sorted, in `binary` and belongs to no group, since no text reviewer can judge it; the groups hold the other changed files, the text files. **Groups**, in this order, each with a kebab-case `id`, a `kind` and its sorted `files`: with plan parts, one group per part with changed text files (`kind: part`, `id: p<nn>`), holding the changed text files its tasks' `Files:` name, a file named by several parts going to the first in plan order; the changed text files no task names go to one group `unplanned` (`kind: unplanned`); without plan parts, the changed text files are grouped by module (`kind: module`, `id: m<k>` from 1), a module being the first two directory segments as `bdk measure` counts them. Reviewer groups are sized by `review.group.max-files` (the target) and a tolerance of a third above it (`floor(max-files * 4 / 3)`, 40 for 30). Modules in sorted order fill a group until the next would pass the target, so small modules share a group, and a module whole up to the tolerance is never cut. A module above the tolerance is cut by its next directory level, those sub-directories packed the same way and cut again by their own next level while above the tolerance; only files with no directory below them are cut into even runs of at most the target. Without plan parts, the packed groups are the module groups (`m<k>`). A part or `unplanned` group with more than the tolerance is packed the same way and gets the suffix `-<k>` from 1 (`p02-1`, `p02-2`, `unplanned-1`); a part up to the tolerance stays whole. Last comes one group `integration` (`kind: integration`) holding every changed text file. A range with no changed text file has no groups, whatever `binary` holds. The output names `measure` for the range (`files`, `added`, `removed`, `modules` as `bdk measure` returns them, binary files included), so the caller sizes the round without a second call.
- **Writes:** nothing
- **Output:** `schema/cli/output/review-plan.json`
- **Exit codes and rules:** `0, 2, 3, 4, 5`. Specific rules: `runtime/git-missing`; plus the common rules of every command and of Change-scoped commands (`kernel-cli`, Exit codes and the error object).
- **Example:**

  ```bash
  bdk review plan --json
  ```

  ```json
  {
    "change": "2026-09-25-passwordless-login",
    "anchor": {
      "kind": "delta",
      "sha": "4f1c2d9a7b3e5f60718293a4b5c6d7e8f9a0b1c2"
    },
    "head": "9a8b7c6d5e4f30211203f4e5d6c7b8a9f0e1d2c3",
    "range": "4f1c2d9a7b3e5f60718293a4b5c6d7e8f9a0b1c2..9a8b7c6d5e4f30211203f4e5d6c7b8a9f0e1d2c3",
    "dirty": [],
    "measure": {
      "files": 4,
      "added": 120,
      "removed": 14,
      "modules": ["src/auth", "src/mail"]
    },
    "binary": ["src/mail/logo.png"],
    "groups": [
      {
        "id": "p01",
        "kind": "part",
        "part": "01",
        "files": ["src/auth/login.ts", "src/auth/login.test.ts"]
      },
      {
        "id": "unplanned",
        "kind": "unplanned",
        "files": ["src/mail/send.ts"]
      },
      {
        "id": "integration",
        "kind": "integration",
        "files": ["src/auth/login.test.ts", "src/auth/login.ts", "src/mail/send.ts"]
      }
    ]
  }
  ```

- **Owner:** T42
- **Slice:** `review`

#### Scenario: example run

- **WHEN** `bdk review plan --json` runs as in the example
- **THEN** the exit code is 0 and stdout validates against `schema/cli/output/review-plan.json`

#### Scenario: runtime/git-missing

- **WHEN** no `git` executable on `PATH`
- **THEN** the exit code is 5 and the error object carries `rule: runtime/git-missing`

#### Scenario: first round reviews from the Change base

- **WHEN** the ledger holds no `merge` report, `change.md` was added in commit `C1` and three commits follow
- **THEN** `anchor.kind` is `full`, `anchor.sha` is the parent of `C1`, and the changed files are those of the three commits and `C1`, without `.bdk/`

#### Scenario: second round reviews the delta

- **WHEN** a `merge` report entry with `head: H1` exists and one fix commit follows `H1`
- **THEN** `anchor.kind` is `delta`, `anchor.sha` is `H1`, and the groups hold only the files of the fix commit

#### Scenario: rewritten history falls back to the Change base

- **WHEN** the latest `merge` report's `head` names no commit of the repository
- **THEN** `anchor.kind` is `full` and the anchor is the Change base

#### Scenario: full overrides the delta

- **WHEN** a `merge` report entry exists and `bdk review plan --full` runs
- **THEN** `anchor.kind` is `full` and the anchor is the Change base

#### Scenario: stacked branch

- **WHEN** `bdk review plan --base feature/a` runs on a branch created from `feature/a`
- **THEN** `anchor.kind` is `base` and `anchor.sha` is `git merge-base HEAD feature/a`

#### Scenario: full and base together

- **WHEN** `bdk review plan --full --base main` runs
- **THEN** the exit code is 3 and the error object carries `rule: input/invalid-argument`

#### Scenario: groups follow the plan parts

- **WHEN** part `01` names `src/auth/login.ts`, part `02` names `src/mail/send.ts`, and the range changes both plus `src/util/date.ts`
- **THEN** the groups are `p01`, `p02`, `unplanned` with `src/util/date.ts`, and `integration` with all three files, in that order

#### Scenario: large part is split by module

- **WHEN** `review.group.max-files` is 30 and part `02` has 25 changed files under `src/api/` and 20 under `src/db/`
- **THEN** the groups of the part are `p02-1` with the 25 files of `src/api` and `p02-2` with the 20 files of `src/db`

#### Scenario: Change without a plan groups by module

- **WHEN** the Change has no plan parts and the range changes files in `src/auth` and `web/forms`
- **THEN** the groups are `m1` with the `src/auth` and `web/forms` files, and `integration`

#### Scenario: small modules are packed

- **WHEN** `review.group.max-files` is 30 and the range changes one file in each of 44 modules
- **THEN** the groups are `m1` with 30 files, `m2` with 14 files, and `integration`

#### Scenario: a module up to the tolerance stays whole

- **WHEN** `review.group.max-files` is 30 and one module has 35 changed files
- **THEN** the 35 files are one group

#### Scenario: a large module is cut by sub-directory

- **WHEN** `review.group.max-files` is 30 and one module has 30 files under `api/`, 30 under `db/` and 24 under `ui/`
- **THEN** the groups are one per sub-directory

#### Scenario: uncommitted work is named

- **WHEN** `src/auth/login.ts` has an unstaged change
- **THEN** `dirty` holds `src/auth/login.ts` and the groups are computed from committed history only

#### Scenario: nothing to review

- **WHEN** the anchor equals `HEAD`
- **THEN** the exit code is 0, `groups` and `binary` are empty and `measure.files` is 0

#### Scenario: review Change starts at its stamped base

- **WHEN** a `review` Change was opened with `base` `B0` on a branch with three commits over `B0`, its `change.md` was committed afterwards, and `bdk review plan --json` runs with no `merge` report in the ledger
- **THEN** `anchor` is `{kind: full, sha: B0}` and the groups hold the files of those three commits, grouped by module

#### Scenario: binary files belong to no group

- **WHEN** the range changes `src/ui/button.ts` and the PNG snapshots `snapshots/a.png` and `snapshots/b.png`
- **THEN** `binary` is `["snapshots/a.png", "snapshots/b.png"]`, no group holds either snapshot, and `integration` holds only `src/ui/button.ts`

#### Scenario: only binary files changed

- **WHEN** the range changes only `snapshots/a.png`
- **THEN** the exit code is 0, `binary` is `["snapshots/a.png"]`, `groups` is empty and `measure.files` is 1

### Requirement: bdk review render

Render the human review report of the active Change, or the decision page of a pull request review, from a fixed template. The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk review render [--format html|md] [--out <path>] [--pr <file|->]`
- **Availability:** `orchestrator`
- **Mode:** `command`; Change-scoped, except with `--pr`
- **Arguments:**
  - `--format html|md`. Default `html`. `md` is the Markdown fallback: the same sections without the form.
  - `--out <path>`. The file to write. Default `.bdk/.machine/review/<change-id>.<format>`. Required with `--pr`.
  - `--pr <file|->`. Render the pull request decision page from the JSON in the file, or from stdin for `-`, instead of the Change report; stdin must deliver its first byte within 3 seconds (`kernel-cli`, Invocation; #166).
  - stdin: The pull request results when `--pr -` is given.
- **Behaviour:**
  - **Purpose and inputs.** The report is what the human reads at `gate:review` (T42-H). The kernel renders it from the ledger, the evidence, the plan parts, the spec deltas and the diff of the whole Change, never from a model's text. The range is the Change base to `HEAD`, as `bdk review plan --full` computes it (Requirement: bdk review plan). Uncommitted files are not part of it. The command writes only the output file.
  - **Determinism.** The same repository state, ledger and settings give a byte-identical file: every list is in a fixed order and no timestamp is rendered. Every text that comes from the ledger, the plan, the spec deltas, a report or the paths is escaped for HTML.
  - **HTML file.** The page is self-contained: no external stylesheet, script, font or image. It follows the light and dark colour scheme of the browser.
  - **Sections of the Change report, in this order:**
    1. **Summary.** The Change id, its intent from `change.md`, its kind, the range, the number of files and lines added and removed, and the count of entries per level and per disposition. When the range holds binary files (Requirement: bdk review plan), the summary lists them, sorted, under `Not reviewed as text`.
    2. **Parts and areas.** A diagram of the plan parts against the modules that the range touches, using the modules of `bdk review plan`. It has one row per plan part and one row `outside the plan` for the changed files that no task's `Files:` declares. Each cell holds the files of that part in that module and their added and removed lines. A Change without plan parts, such as a `review` Change, shows the modules only.
    3. **Intent.** Present only when the Change holds spec deltas (`kernel-state`, Spec delta). One row per scenario of every `ADDED` and `MODIFIED` requirement of the spec deltas, and one row per `REMOVED` requirement with the scenario `-`, in capability, requirement and scenario order. A row shows the capability, requirement, scenario, and the `Code`, `Test` and `State` cells of the matching row of the `## Intent` table of the latest `integration-reviewer` report of the Change (`role-contracts`, Role contract content), matched by capability, requirement and scenario name. A row without a match shows `untraced` as its state, marked as a warning in the HTML. A row of the report's table that names no scenario of the spec deltas is not shown. Names match after trimming, otherwise exactly, as `spec` matches requirement names. When no integration report of the Change holds an `## Intent` table, the section says so in one warning line above the rows, which all show `untraced`. Every name and cell is escaped in the HTML, since they come from a spec delta and a report. A state that names ledger entries links each id to the entry in Decisions or Settled.
    4. **Change map.** One card per enabled `review.risks` item whose `paths` match at least one changed file, or that the area summaries name (`kernel-settings`, Keys of review policy).
       - **What changed.** A card opens with the area summary: the line for its risk id in the `## Areas` section of the latest `integration-reviewer` report of the Change (`role-contracts`, Role contract content). Later reports override earlier ones per risk id. A card without such a line shows no summary.
       - **Files.** A card lists the matched files with their added and removed lines. Each file expands to why and what: the plan tasks whose `Files:` declare it, with their titles, and the commits of the range that changed it, oldest first, with their short sha and subject.
       - **Tags.** Each file is tagged with the live entries that name the risk id or the file in their `refs`. A tag shows the entry's id, level and disposition, and links to the entry in Decisions.
       - A card follows for the files outside the plan, with the `unplanned` summary line when the integration reviewer wrote one.
    5. **Gate.** The verdicts of the latest `tests-full` and `lint-full` evidence, and the diff coverage of each `tools.test` entry with a `coverage` object, with its `min` (`kernel-cli/evidence`, bdk evidence coverage). A tool group declared none (`kernel-settings`, Tool entries) shows `not used` in place of its verdict: `Lint: not used (tools.lint is none)`, and for tests the warning `Tests: not used (tools.test is none): this Change ran no test`, marked as a warning in the HTML (T49).
    6. **Decisions.** Every live `finding`, `observation` and `blocker` whose `level` is not `blocker`. They are grouped as `should-fix`, `nice-to-have` and `untriaged`; `untriaged` is empty after `cr`, which triages every entry first. A legend above the groups says what each disposition does. Each entry shows its id, type, summary, refs, severity, category, writer, current disposition and tracker issue, and, collapsed, its body. A body whose paragraphs start with `Problem:`, `Why it matters:` and `Suggested fix:` is shown as those fields, with a `Failure scenario:` paragraph as a fourth field after Problem when it has one; any other body is shown as written. The triage reason of the entry's latest `Triaged as` line is shown next to its level. In HTML, each one has a choice of `fix`, `defer`, `reject` and, only while `tracker` is set, `track`, plus a reason field. The choice is preselected with the current disposition.
    7. **Settled.** The resolved `finding`, `observation` and `blocker` entries of the Change, collapsed, each with the reason from its body.
    8. **Context.** The live `decision`, `assumption` and `risk` entries.
  - **Form.** The HTML form sends one answer for the whole page through Lavish: a prompt whose data is an `items` array of `{id, disposition, reason}`, one item for each entry of the Decisions section. When the page runs outside Lavish, the form is disabled and names `/bdk:cr --report` as the way to decide in the terminal.
  - **Decision page of a pull request review (`--pr`).** It reads `{prs: [{number, url, title, verdict, findings: [{path, line, severity, category, blocking, problem, why, fix}]}]}`, where `why` is optional. It renders the same template with these sections: one section per PR with its title, link and computed verdict, then each finding. A finding's id is `<number>-<n>`, where `n` counts from 1 in the given order. Each finding has a choice of `blocker`, `nice-to-have`, `tracker` and `drop`, preselected from `blocking`; `tracker` is offered only while `tracker` is set. The page shows the verdict the current choices give: `request-changes` when any finding is a `blocker`, `approve` otherwise. The form sends the `items` array as `{id, disposition}`. This mode reads no Change and no ledger, and needs no active Change. Its output holds `change` and `range` as `null`, every finding id under `undecided`, and an empty `decided`.
  - **Output.** `undecided` and `decided` list the Decisions entries without and with a disposition, in page order; `path` is relative to the project root when the file is inside it, absolute otherwise; `tracker` is the `tracker` kind, or `null` while it is unset.
  - **Refusals.** `--pr` without `--out` is `input/missing-argument`. `--pr` input that is not JSON of that shape is `input/invalid-argument`, naming the first wrong field.
- **Writes:** `<out>`, `.bdk/.machine/review/`
- **Output:** `schema/cli/output/review-render.json`
- **Exit codes and rules:** `0, 2, 3, 4, 5`. Specific rules: `input/stdin-unavailable`, `runtime/git-missing`; plus the common rules of every command and, without `--pr`, of Change-scoped commands (`kernel-cli`, Exit codes and the error object).
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

#### Scenario: intent rows from the spec deltas

- **WHEN** the Change's spec delta `auth/login` adds the requirement `Magic link` with the scenarios `link sent` and `link expired`, and the latest `integration-reviewer` report's `## Intent` table has a row for `link sent` with state `ok` and none for `link expired`
- **THEN** the Intent section shows `link sent` with the report's code, test and `ok`, and `link expired` with the state `untraced` marked as a warning

#### Scenario: no Intent table in the report

- **WHEN** the Change holds the spec delta `auth/login` and its latest integration report has no `## Intent` section
- **THEN** the Intent section has a warning line naming the missing table, and every scenario row shows `untraced`

#### Scenario: no Intent section without spec deltas

- **WHEN** a `review` Change, which holds no spec delta, runs `bdk review render`
- **THEN** the report has no Intent section and its other sections keep their order

#### Scenario: binary files in the summary

- **WHEN** the range changes `snapshots/a.png` and `src/ui/button.ts`
- **THEN** the summary lists `snapshots/a.png` under `Not reviewed as text` and no Change map card or Decisions entry is added for it

#### Scenario: failure scenario as a field

- **WHEN** a finding's body holds the paragraphs `Problem: ...`, `Failure scenario: ...`, `Why it matters: ...` and `Suggested fix: ...`, and its latest triage line is `Triaged as should-fix at <at>: the null body reaches parse`
- **THEN** its Decisions entry shows the four fields in that order and the reason `the null body reaches parse` next to `should-fix`, and no paragraph of the body is dropped

#### Scenario: input/stdin-unavailable

- **WHEN** `bdk review render --pr - --out /tmp/pr.html` runs from a shell whose stdin is a pipe that never closes and no byte arrives
- **THEN** the exit code is 3 within 4 seconds, the error object carries `rule: input/stdin-unavailable`, and nothing is written
