## MODIFIED Requirements

### Requirement: bdk log ingest

Store a role's report under its ticket. The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk log ingest --ticket <ticket> --file <path>`
- **Availability:** `agent`
- **Mode:** `command`; Change-scoped
- **Arguments:**
  - `--ticket <ticket>`. Required; a ticket reference (`kernel-cli`, Ticket references). The role and the report path come from the package of the agent working on the ticket, else the ticket's active package, or from the group's package for `<ticket>@<group>` (`kernel-cli`, Ticket references).
  - `--file <path>`. Required; the report: a YAML frontmatter holding the envelope, then the Markdown body. The role writes it with the host's file tool at the `draft` path its package names (`kernel-cli/dispatch`).
- **Behaviour:** Every role, the `implementer` included, stores its report here (T23-D14, `role-contracts`, Role contract content). The report is read from `--file` only and stdin is never read (#166, user decision 2026-10-07): a call without `--file` is `input/missing-argument` at once, with `instead` naming the `--file` form, so an agent's shell never waits on an inherited stdin; a `--file` that does not exist is `input/not-found`. The frontmatter holds the envelope fields the role writes: `status`, `files`, `entries`, `evidence` and, for `blocked` and `needs-context`, `reason` (`kernel-state`, Report envelope); a frontmatter carrying `schema`, `ticket`, `role` or `at` is `input/forbidden-field`, because the kernel stamps them from the ticket, its package and the clock. A missing frontmatter, an unknown field or a field failing the envelope schema is `input/invalid-envelope`, whose `why` names the field and its line. Every id in `entries` must be an entry whose `ticket` is this ticket and, for a grouped reference other than `merge`, whose `group` is this group (`policy/entries-missing` naming the others; for `merge`, `instead` says that entries of earlier rounds belong in the report body); every id in `evidence` must name a manifest recorded under the ticket (`policy/entries-missing` as well). `--ticket` must name an open ticket with a dispatch package, or a group with one (`policy/no-open-ticket`). The reserved group `merge` of an open `review-fix` ticket needs no package: it stores the orchestrator's merged review of the round at `reports/<target>-orchestrator-<ticket>-merge.md`, stamped with `role: orchestrator` and `group: merge`. A grouped report is stamped with its `group`. On success the kernel writes the report to the resolved package's `report` path, so the reports of the ticket's other roles stay, frontmatter first in flow style so the envelope stays within 15 lines, and a later call under the same open ticket replaces it. A refused report writes nothing, so the agent fixes it and calls again before it returns. The command writes no ledger entry: entries come only from `log add` (T23-D14). An empty or null `reason` (`reason: ""`, `reason: null`) reads as an absent `reason` when `status` is `done` or `done-with-concerns`, and the stored report holds no `reason`; on `blocked` and `needs-context` it stays refused with `input/invalid-envelope` naming `reason`.
- **Writes:** `.bdk/changes/<id>/reports/`
- **Output:** `schema/cli/output/log-ingest.json`
- **Exit codes and rules:** `0, 2, 3, 4, 5`. Specific rules: `input/not-found`, `input/invalid-envelope`, `input/forbidden-field`, `policy/no-open-ticket`, `policy/entries-missing`; plus the common rules of every command and of Change-scoped commands (`kernel-cli`, Exit codes and the error object).
- **Example:**

  ```bash
  bdk log ingest --ticket A-9c2d4f6h --file .bdk/.machine/drafts/02-verifier-A-9c2d4f6h.md --json
  ```

  ```json
  {
    "ticket": "A-9c2d4f6h",
    "role": "verifier",
    "path": ".bdk/changes/2026-09-25-passwordless-login/reports/02-verifier-A-9c2d4f6h.md",
    "status": "done-with-concerns",
    "entries": [
      "L-w4m1q7ra"
    ],
    "replaced": false
  }
  ```

- **Owner:** T23
- **Slice:** `log`

#### Scenario: example run

- **WHEN** `bdk log ingest --ticket A-9c2d4f6h --file .bdk/.machine/drafts/02-verifier-A-9c2d4f6h.md --json` runs as in the example
- **THEN** the exit code is 0 and stdout validates against `schema/cli/output/log-ingest.json`

#### Scenario: input/invalid-envelope

- **WHEN** the report passed to `bdk log ingest --ticket A-9c2d4f6h --file <path>` has no frontmatter, or its frontmatter carries the unknown field `verdict`
- **THEN** the exit code is 3, the error object carries `rule: input/invalid-envelope` naming the missing frontmatter or the field, and nothing is written under `reports/`

#### Scenario: policy/entries-missing

- **WHEN** the envelope's `entries` lists an id written under another ticket, or its `evidence` lists a manifest id not recorded under this ticket
- **THEN** the exit code is 2, the error object carries `rule: policy/entries-missing` naming the ids, and nothing is written under `reports/`

#### Scenario: input/invalid-block

- **WHEN** the report's frontmatter has `status: blocked` and no `reason`
- **THEN** the exit code is 3, the error object carries `rule: input/invalid-envelope` naming `reason`, and nothing is written under `reports/`

#### Scenario: input/forbidden-field

- **WHEN** the report's frontmatter carries `ticket` or `role` (P1)
- **THEN** the exit code is 3 and the error object carries `rule: input/forbidden-field`

#### Scenario: policy/no-open-ticket

- **WHEN** the ticket is closed or has no dispatch package
- **THEN** the exit code is 2 and the error object carries `rule: policy/no-open-ticket`

#### Scenario: policy/observation-cap

- **WHEN** the envelope lists six `observation` entries written under the ticket
- **THEN** the exit code is 0: no cap applies (T23-D13)

#### Scenario: wrong type names the line

- **WHEN** the frontmatter's third line is `status: finished`
- **THEN** the exit code is 3, the error object carries `rule: input/invalid-envelope`, and `why` names `status` and line 3

#### Scenario: counter checked at close

- **WHEN** the envelope lists two ids written under ticket `A-9c2d4f6h` and a third that does not exist
- **THEN** `log ingest` exits 2 with `rule: policy/entries-missing` naming the third id and writes nothing, and `attempt close` applies the same check to a report that reached `reports/` another way

#### Scenario: implementer stores its report

- **WHEN** an `implementer` stores a valid report with `bdk log ingest --ticket A-7f3k9m2q --file <draft>`
- **THEN** the report is written at the package's `report` path with `schema`, `ticket: A-7f3k9m2q` and `role: implementer` stamped, and a second call replaces it with `replaced: true`

#### Scenario: each role of a ticket keeps its report

- **WHEN** the implementer of ticket `A-7f3k9m2q` stored its report, `dispatch build 02 conformer A-7f3k9m2q` ran, and the conformer stores its report with `bdk log ingest --ticket A-7f3k9m2q --file <draft>`
- **THEN** the conformer report is written at `reports/02-conformer-A-7f3k9m2q.md` with `role: conformer`, `replaced` is false, and the implementer report is unchanged

#### Scenario: empty reason on a status that needs none

- **WHEN** the envelope holds `status: done` or `status: done-with-concerns` and `reason: ""` or `reason: null`
- **THEN** the report is stored and its frontmatter has no `reason`

#### Scenario: empty reason on blocked

- **WHEN** the envelope holds `status: blocked` and `reason: ""`
- **THEN** it refuses with `input/invalid-envelope` naming `reason`

#### Scenario: parallel group reports

- **WHEN** the reviewers of groups `p01` and `p02` of ticket `A-r1v2w3x4` each store a report with `bdk log ingest --ticket A-r1v2w3x4@p01 --file <draft>` and `--ticket A-r1v2w3x4@p02 --file <draft>`
- **THEN** both reports are stored at their packages' `report` paths, each stamped with its `group`

#### Scenario: merge report without a package

- **WHEN** the orchestrator stores the merged review with `bdk log ingest --ticket A-r1v2w3x4@merge --file <path>` with `entries` naming entries of groups `p01` and `p02`
- **THEN** the report is stored at `reports/<change>-orchestrator-A-r1v2w3x4-merge.md` with `role: orchestrator` and `group: merge`

#### Scenario: group entries stay in their group

- **WHEN** the `p01` report's `entries` names an entry written under `A-r1v2w3x4@p02`
- **THEN** the exit code is 2, the error object carries `rule: policy/entries-missing` naming that entry, and nothing is stored

#### Scenario: no file never waits

- **WHEN** `bdk log ingest --ticket A-9c2d4f6h` runs without `--file` from a shell whose stdin is a pipe that never closes
- **THEN** it exits 3 within one second with `rule: input/missing-argument` naming `--file`, and nothing is written under `reports/`

#### Scenario: input/not-found

- **WHEN** `--file` names a path that does not exist
- **THEN** the exit code is 3, the error object carries `rule: input/not-found` naming the path, and nothing is written

### Requirement: bdk log add

Append one ledger entry; the kernel stamps id, time, author and source. The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk log add decision|finding|observation|blocker|question|assumption|risk|learning|report <summary> [--ref <ref>] [--body <text>] [--ticket <ticket>] [--category <id>] [--review] [--supersedes <id>] [--applies <glob>] [--status proposed|accepted|superseded|resolved]`
- **Availability:** `agent`
- **Mode:** `command`; Change-scoped
- **Arguments:**
  - `decision|finding|observation|blocker|question|assumption|risk|learning|report` (required).
  - `<summary>` (required). <= 120 characters.
  - `--ref <ref>`. Repeatable; at least one (file, symbol, part, task, rule or entry id).
  - `--body <text>`. Markdown body; - reads it from stdin, which must deliver its first byte within 3 seconds (`kernel-cli`, Invocation; #166).
  - `--ticket <ticket>`. The ticket reference the caller works under (`kernel-cli`, Ticket references); required inside a dispatch and for `report`, sets source: agent:<role>.
  - `--category <id>`. The entry's category; a verifier blocker needs one from policy.verifier.blocking-categories (P8).
  - `--review`. Mark the entry to be shown at the next gate.
  - `--supersedes <id>`.
  - `--applies <glob>`. Repeatable; only with `learning`: the files the lesson is about (`kernel-state`, Ledger entry). Default, when `--ticket` names a ticket of a part: the `Files:` of the part's tasks that `--ref` names, or of the whole part when it names none; none otherwise.
  - `--status proposed|accepted|superseded|resolved`.
  - stdin: Body text when --body - is given.
- **Behaviour:** Available to subagents: every role writes its own entries (T23-D14). `type: transition` is not accepted here and `--source` does not exist: `source` is `agent:<role>` when `--ticket` names an open ticket whose package (the working agent's, else the active one; `kernel-cli`, Ticket references), or for `<ticket>@<group>` whose group package, names the role, `kernel` for the reserved group `merge` and for the main thread without a ticket; a grouped reference also stamps `group`; passing `id`, `at`, `author`, `source` or `fingerprint` as a flag in any form is `input/forbidden-field` (P1, T20 acceptance: `--source user` exits 3). A ticket without an open attempt record, a ticket without a dispatch package and a group without a package are `policy/no-open-ticket`; `<ticket>@merge` needs no package but accepts only `report` (`input/invalid-argument` otherwise). Validation: type from the list, summary 1-120 characters, >= 1 ref, the T14 entry schema; `--category` only with `finding` or `blocker`, the types that carry the field (`input/invalid-argument`); `--status` defaults to `proposed`, `superseded` is refused (`input/invalid-argument`, it is derived from `--supersedes`) and `--applies` with any type but `learning` is `input/invalid-argument`. A `learning` records a lesson for the audit (`kernel-cli/rules`, bdk rules stats) and never becomes a rule by itself (T02 decision Q-6). `--supersedes` must name an existing entry (`input/not-found`). A `blocker` under a ticket whose active package's role is `verifier` or `design-verifier` and whose `--category` is missing or not an `id` of the resolved `policy.verifier.blocking-categories` is written as an `observation` with `review: true` (an observation has no `category` field, so the category is named in the body) and a body that starts with `Downgraded from blocker: category <id|none> is not a blocking category (P8).` followed by the given body; the output's `downgraded` names the original type and category (P8). Nothing caps the number of entries per ticket (T23-D13). The kernel stamps `id` (retrying when the id exists in the Change), `at` from its clock, `author` from git (`user.name <user.email>`), `source`, `ticket` and, for `learning`, `fingerprint`, and writes `log/<ts>-<type>-<id>.md`. Dedupe by key (`kernel-state`, Ledger deduplication) returns the existing entry with `deduplicated: true` and writes nothing. A `report` entry records the report `log ingest` stored under `--ticket` (`kernel-pipeline`, Artifact kinds: a verdict node reads the latest `report` naming it): `report` without `--ticket` is `input/missing-argument`; the kernel sets the entry's `report` field to the active package's `report` path (the group package's for `<ticket>@<group>`, the merge report path of `log ingest` for `<ticket>@merge`), relative to the Change directory, and refuses with `input/not-found` naming that path while no report is stored there; it appends the ticket's `target` to the refs when no ref names it, and for `<ticket>@merge` also `review`, and then stamps `head` with the commit `HEAD` names, the anchor of the next delta review (`kernel-cli/review`, bdk review plan); and it never deduplicates a `report`, because each verification round is its own report. A `blocker` under a ticket names the ticket's target the same way: the kernel appends the active package's `target` to its refs when no ref names it, so the verdict node of that target counts the blocker while it is live, whichever file the role named.
- **Writes:** `.bdk/changes/<id>/log/`
- **Output:** `schema/cli/output/log-add.json`
- **Exit codes and rules:** `0, 2, 3, 4, 5`. Specific rules: `input/forbidden-field`, `input/not-found`, `input/stdin-unavailable`, `policy/no-open-ticket`, `runtime/git-missing`; plus the common rules of every command and of Change-scoped commands (`kernel-cli`, Exit codes and the error object).
- **Example:**

  ```bash
  bdk log add finding "expired magic link still accepted" --ref src/auth/login.ts --ref 02-3 --ticket A-7f3k9m2q --json
  ```

  ```json
  {
    "entry": {
      "id": "L-e8k2s5vw",
      "type": "finding",
      "summary": "expired magic link still accepted",
      "status": "proposed",
      "source": "agent:implementer",
      "author": "Przemysław Broniszewski <przemek@example.com>",
      "at": "2026-09-25T10:15:02.640Z",
      "refs": [
        "src/auth/login.ts",
        "02-3"
      ],
      "review": false
    },
    "path": ".bdk/changes/2026-09-25-add-passwordless-login/log/20260925T101502Z-finding-L-e8k2s5vw.md",
    "deduplicated": false
  }
  ```

- **Owner:** T20
- **Slice:** `log`

#### Scenario: example run

- **WHEN** `bdk log add finding "expired magic link still accepted" --ref src/auth/login.ts --ref 02-3 --ticket A-7f3k9m2q --json` runs as in the example
- **THEN** the exit code is 0 and stdout validates against `schema/cli/output/log-add.json`

#### Scenario: input/forbidden-field

- **WHEN** a kernel-stamped field (`id`, `at`, `author`, `source`) was passed as input (P1)
- **THEN** the exit code is 3 and the error object carries `rule: input/forbidden-field`

#### Scenario: input/not-found

- **WHEN** `--supersedes` names an entry that does not exist
- **THEN** the exit code is 3 and the error object carries `rule: input/not-found`

#### Scenario: policy/no-open-ticket

- **WHEN** no open ticket for the task, or the ticket named does not match
- **THEN** the exit code is 2 and the error object carries `rule: policy/no-open-ticket`

#### Scenario: policy/observation-cap

- **WHEN** a ticket already holds five `observation` entries and a sixth is added
- **THEN** the exit code is 0: the per-dispatch cap and its rule are gone (T23-D13)

#### Scenario: runtime/git-missing

- **WHEN** no `git` executable on `PATH`
- **THEN** the exit code is 5 and the error object carries `rule: runtime/git-missing`

#### Scenario: source user is unreachable

- **WHEN** `bdk log add decision "approved" --ref design.md --source user` runs
- **THEN** the exit code is 3 with `rule: input/forbidden-field` and no file is written under `log/`

#### Scenario: fifteen parallel writers

- **WHEN** fifteen `bdk log add` processes with different summaries run at the same time in one Change
- **THEN** all fifteen exit 0, `log/` holds fifteen new files with fifteen distinct ids, and no lock or marker file exists

#### Scenario: deduplicated entry

- **WHEN** `bdk log add` repeats the type, summary (up to case, punctuation and digits) and refs of a `proposed` entry
- **THEN** the exit code is 0, `deduplicated` is `true`, `entry.id` is the existing id and no file is written

#### Scenario: verifier blocker without a category

- **WHEN** under a `verifier` ticket `bdk log add blocker "naming is inconsistent" --ref 02-3 --ticket A-9c2d4f6h` runs without `--category`
- **THEN** the exit code is 0, the entry is an `observation` with `review: true` whose body starts with `Downgraded from blocker: category none`, and `downgraded` is `{type: blocker, category: null}`

#### Scenario: verifier blocker in a blocking category

- **WHEN** under a `verifier` ticket the same command runs with `--category false-code-claim`
- **THEN** the entry is a `blocker` with `category: false-code-claim` and `downgraded` is absent

#### Scenario: implementer blocker is never downgraded

- **WHEN** under an `implementer` ticket `bdk log add blocker "stop-rule fired" --ref 02-3 --ticket A-7f3k9m2q` runs without `--category`
- **THEN** the entry is a `blocker`

#### Scenario: learning with applies

- **WHEN** under an `implementer` ticket of part `02` whose task `02-3` has the `Files:` `web/Form.tsx`, `bdk log add learning "forms lost the pending state" --ref 02-3 --ticket A-7f3k9m2q` runs
- **THEN** the entry carries `applies: [web/Form.tsx]` and a kernel-stamped `fingerprint`, and no file under `.bdk/rules/` changes

#### Scenario: applies on another type

- **WHEN** `bdk log add finding "x" --ref 02-3 --applies "src/**"` runs
- **THEN** the exit code is 3 with `rule: input/invalid-argument`

#### Scenario: report entry of a verifier ticket

- **WHEN** a `design-verifier` under ticket `A-9c2d4f6h` with target `design-verify` has stored its report through `log ingest` and runs `bdk log add report "design verified" --ref design.md --ticket A-9c2d4f6h`
- **THEN** the entry has `source: agent:design-verifier`, `refs: [design.md, design-verify]` and `report: reports/design-verify-design-verifier-A-9c2d4f6h.md`, and a second call writes a second entry

#### Scenario: report before ingest

- **WHEN** `bdk log add report "design verified" --ref design-verify --ticket A-9c2d4f6h` runs before any report is stored at the package's `report` path
- **THEN** the exit code is 3, the error object carries `rule: input/not-found` naming that path, and nothing is written

#### Scenario: blocker under a verifier ticket names the target

- **WHEN** under a `design-verifier` ticket `A-9c2d4f6h` with target `design-verify`, `bdk log add blocker "LocaleRegistry does not exist" --ref design.md --category false-code-claim --ticket A-9c2d4f6h` runs
- **THEN** the entry is a `blocker` with `refs: [design.md, design-verify]`, and `bdk explain design-verify` names it as a live blocker

#### Scenario: grouped entry names its group

- **WHEN** the `p02` reviewer of `review-fix` ticket `A-r1v2w3x4` runs `bdk log add finding "token compared with ==" --ref src/auth/login.ts --ref BDK-SEC-4 --ticket A-r1v2w3x4@p02`
- **THEN** the entry holds `ticket: A-r1v2w3x4`, `group: p02` and `source: agent:reviewer`

#### Scenario: merge report stamps head

- **WHEN** the orchestrator stored the merged report with `log ingest --ticket A-r1v2w3x4@merge` and runs `bdk log add report "2 blockers, 3 should-fix" --ticket A-r1v2w3x4@merge` at commit `H1`
- **THEN** the entry holds `group: merge`, `source: kernel`, `head: H1`, refs naming the Change and `review`, and `report` naming the merge report path

#### Scenario: merge accepts only report

- **WHEN** `bdk log add finding "x" --ref a.ts --ticket A-r1v2w3x4@merge` runs
- **THEN** the exit code is 3 and the error object carries `rule: input/invalid-argument`

#### Scenario: input/stdin-unavailable

- **WHEN** `bdk log add decision "Keep magic links" --ref design.md --body -` runs from a shell whose stdin is a pipe that never closes and no byte arrives
- **THEN** the exit code is 3 within 4 seconds, the error object carries `rule: input/stdin-unavailable`, and nothing is written
