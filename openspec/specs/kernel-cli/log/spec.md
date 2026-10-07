# kernel-cli/log Specification

## Purpose

Ledger (`log`). The append-only ledger of the Change (K2, P1): `add` writes one entry, `ingest` stores a role's report under its ticket and writes no entries, `list` and `show` read, `resolve` changes a status, `route` sorts `learning` entries at close.

Common rules, not repeated per requirement: every command may emit `input/unknown-command`, `input/unknown-flag`, `input/missing-argument`, `input/invalid-argument`, `runtime/node-version`, `runtime/not-a-repo`; every Change-scoped command additionally `policy/no-active-change`, `state/corrupted-index`, `state/ledger-invalid`, `state/change-dir-missing`. Their meaning and exit codes are in `kernel-cli`, Exit codes and the error object; a command's `exits` in the index is derived from the classes of its specific and common rules.

Representative refusal:

```json refusal
{
  "refused": true,
  "rule": "input/forbidden-field",
  "why": "--source is not a flag of log add: source is stamped from the ticket's role (P1)",
  "instead": [
    "bdk log add finding \"...\" --ref <ref> --ticket A-7f3k",
    "bdk log add --help"
  ]
}
```

## Requirements

### Requirement: bdk log add

Append one ledger entry; the kernel stamps id, time, author and source. The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk log add decision|finding|observation|blocker|question|assumption|risk|learning|report <summary> [--ref <ref>] [--body <text>] [--ticket <ticket>] [--category <id>] [--severity critical|high|medium|low] [--review] [--supersedes <id>] [--applies <glob>] [--status proposed|accepted|superseded|resolved]`
- **Availability:** `agent`
- **Mode:** `command`; Change-scoped
- **Arguments:**
  - `decision|finding|observation|blocker|question|assumption|risk|learning|report` (required).
  - `<summary>` (required). <= 120 characters.
  - `--ref <ref>`. Repeatable; at least one (file, symbol, part, task, rule or entry id).
  - `--body <text>`. Markdown body; - reads it from stdin, which must deliver its first byte within 3 seconds (`kernel-cli`, Invocation; #166).
  - `--ticket <ticket>`. The ticket reference the caller works under (`kernel-cli`, Ticket references); required inside a dispatch and for `report`, sets source: agent:<role>.
  - `--category <id>`. The entry's category; a verifier blocker needs one from policy.verifier.blocking-categories (P8).
  - `--severity critical|high|medium|low`. The writer's severity of a `finding` or `observation`, the types that carry the field.
  - `--review`. Mark the entry to be shown at the next gate.
  - `--supersedes <id>`.
  - `--applies <glob>`. Repeatable; only with `learning`: the files the lesson is about (`kernel-state`, Ledger entry). Default, when `--ticket` names a ticket of a part: the `Files:` of the part's tasks that `--ref` names, or of the whole part when it names none; none otherwise.
  - `--status proposed|accepted|superseded|resolved`.
  - stdin: Body text when --body - is given.
- **Behaviour:** Available to subagents: every role writes its own entries (T23-D14). `type: transition` is not accepted here and `--source` does not exist: `source` is `agent:<role>` when `--ticket` names an open ticket whose package (the working agent's, else the active one; `kernel-cli`, Ticket references), or for `<ticket>@<group>` whose group package, names the role, `kernel` for the reserved group `merge` and for the main thread without a ticket; a grouped reference also stamps `group`; passing `id`, `at`, `author`, `source` or `fingerprint` as a flag in any form is `input/forbidden-field` (P1, T20 acceptance: `--source user` exits 3). A ticket without an open attempt record, a ticket without a dispatch package and a group without a package are `policy/no-open-ticket`; `<ticket>@merge` needs no package but accepts only `report` (`input/invalid-argument` otherwise). Validation: type from the list, summary 1-120 characters, >= 1 ref, the T14 entry schema; `--category` only with `finding` or `blocker`, the types that carry the field (`input/invalid-argument`); `--severity` only with `finding` or `observation`, and only one of the four values (`input/invalid-argument`); `--status` defaults to `proposed`, `superseded` is refused (`input/invalid-argument`, it is derived from `--supersedes`) and `--applies` with any type but `learning` is `input/invalid-argument`. A `learning` records a lesson for the audit (`kernel-cli/rules`, bdk rules stats) and never becomes a rule by itself (T02 decision Q-6). `--supersedes` must name an existing entry (`input/not-found`). A `blocker` under a ticket whose active package's role is `verifier` or `design-verifier` and whose `--category` is missing or not an `id` of the resolved `policy.verifier.blocking-categories` is written as an `observation` with `review: true` (an observation has no `category` field, so the category is named in the body) and a body that starts with `Downgraded from blocker: category <id|none> is not a blocking category (P8).` followed by the given body; the output's `downgraded` names the original type and category (P8). Nothing caps the number of entries per ticket (T23-D13). The kernel stamps `id` (retrying when the id exists in the Change), `at` from its clock, `author` from git (`user.name <user.email>`), `source`, `ticket` and, for `learning`, `fingerprint`, and writes `log/<ts>-<type>-<id>.md`. Dedupe by key (`kernel-state`, Ledger deduplication) returns the existing entry with `deduplicated: true` and writes nothing. A `report` entry records the report `log ingest` stored under `--ticket` (`kernel-pipeline`, Artifact kinds: a verdict node reads the latest `report` naming it): `report` without `--ticket` is `input/missing-argument`; the kernel sets the entry's `report` field to the active package's `report` path (the group package's for `<ticket>@<group>`, the merge report path of `log ingest` for `<ticket>@merge`), relative to the Change directory, and refuses with `input/not-found` naming that path while no report is stored there; it appends the ticket's `target` to the refs when no ref names it, and for `<ticket>@merge` also `review`, and then stamps `head` with the commit `HEAD` names, the anchor of the next delta review (`kernel-cli/review`, bdk review plan); and it never deduplicates a `report`, because each verification round is its own report. A `blocker` under a ticket names the ticket's target the same way: the kernel appends the active package's `target` to its refs when no ref names it, so the verdict node of that target counts the blocker while it is live, whichever file the role named.
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

#### Scenario: severity of a finding

- **WHEN** `bdk log add finding "null body crashes parse" --ref src/api/http.ts --severity high --ticket A-r1v2w3x4@m1 --json` runs
- **THEN** the exit code is 0 and the stored entry holds `severity: high`

#### Scenario: severity on a blocker

- **WHEN** `bdk log add blocker "x" --ref a.ts --severity high --ticket A-r1v2w3x4@m1` runs
- **THEN** the exit code is 3 and the error object carries `rule: input/invalid-argument`

#### Scenario: input/stdin-unavailable

- **WHEN** `bdk log add decision "Keep magic links" --ref design.md --body -` runs from a shell whose stdin is a pipe that never closes and no byte arrives
- **THEN** the exit code is 3 within 4 seconds, the error object carries `rule: input/stdin-unavailable`, and nothing is written

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

### Requirement: bdk log list

Ledger entries as summaries, filtered by type, status, review flag or reference. The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk log list [--type decision|finding|observation|blocker|question|assumption|risk|learning|report|transition] [--status proposed|accepted|superseded|resolved] [--review] [--for <task|part|file>] [--since-ticket-start <ticket>] [--all]`
- **Availability:** `read`
- **Mode:** `command`; Change-scoped
- **Arguments:**
  - `--type decision|finding|observation|blocker|question|assumption|risk|learning|report|transition`.
  - `--status proposed|accepted|superseded|resolved`.
  - `--review`. Only review: true entries.
  - `--for <task|part|file>`.
  - `--since-ticket-start <ticket>`. Only entries written at or after the ticket's `opened-at`.
  - `--all`.
- **Behaviour:** Summaries only, read from the index, ordered by `at` then id; a summary carries `category` when the entry has one, so a caller sorts blockers by category without `log show`. `status` is the derived status (`superseded` when another entry names the entry in `supersedes`). `--for` keeps entries with a ref equal to the value, a task ref of the part (`02` matches `02-3`) or a symbol ref of the file (`src/a.ts` matches `src/a.ts#login`). `--since-ticket-start` keeps entries whose `at` is at or after the `opened-at` of the ticket, open or closed, so an orchestrator reads what other agents logged while the ticket ran (swarm skill, T23-D49); a ticket the Change does not hold is `input/not-found`. The filters combine. `< 200 ms` at 1 000 entries is the T20 target, met by the index. Every run appends one line (`at`, duration in milliseconds, entry count, whether the index was refreshed) to `.bdk/.machine/telemetry/log-list.jsonl`, kept below 256 KB by dropping the oldest half.
- **Writes:** nothing
- **Output:** `schema/cli/output/log-list.json`
- **Exit codes and rules:** `0, 2, 3, 4, 5`. Specific rules: `input/not-found`; plus the common rules of every command and of Change-scoped commands (`kernel-cli`, Exit codes and the error object).
- **Example:**

  ```bash
  bdk log list --type decision --status accepted --json
  ```

  ```json
  {
    "items": [
      {
        "id": "L-a2s5d8fg",
        "type": "decision",
        "summary": "magic links, no passwords, WebAuthn later",
        "status": "accepted",
        "source": "kernel",
        "at": "2026-09-25T09:12:30.256Z",
        "refs": [
          "design.md"
        ]
      }
    ],
    "total": 1,
    "truncated": false
  }
  ```

- **Owner:** T20
- **Slice:** `log`

#### Scenario: example run

- **WHEN** `bdk log list --type decision --status accepted --json` runs as in the example
- **THEN** the exit code is 0 and stdout validates against `schema/cli/output/log-list.json`

#### Scenario: 1 000 entries under 200 ms

- **WHEN** `bdk log list --json` runs twice on a Change with 1 000 entries and the second run finds the index fresh
- **THEN** the second run takes less than 200 ms end to end and its telemetry line records the duration

#### Scenario: input/not-found

- **WHEN** `--since-ticket-start` names a ticket the active Change does not hold
- **THEN** the exit code is 3 and the error object carries `rule: input/not-found`

#### Scenario: entries since a ticket started

- **WHEN** entry `L-1` was written before ticket `A-7f3k9m2q` was opened and entries `L-2` and `L-3` after it, and `bdk log list --since-ticket-start A-7f3k9m2q --json` runs
- **THEN** `items` holds `L-2` and `L-3` and not `L-1`

### Requirement: bdk log show

One entry in full, by bare or qualified id. The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk log show <id>`
- **Availability:** `agent`
- **Mode:** `command`; Change-scoped
- **Arguments:**
  - `<id>` (required). L-xxxx or <changeId>/L-xxxx.
- **Behaviour:** Available to subagents: a dispatch package carries summaries, and a worker fetches the full text of an entry it needs (K3). A qualified id reads the named Change, archived or not; a malformed id is `input/invalid-argument`. `supersededBy` names the entry that supersedes this one.
- **Writes:** nothing
- **Output:** `schema/cli/output/log-show.json`
- **Exit codes and rules:** `0, 2, 3, 4, 5`. Specific rules: `input/not-found`; plus the common rules of every command and of Change-scoped commands (`kernel-cli`, Exit codes and the error object).
- **Example:**

  ```bash
  bdk log show L-a2s5d8fg --json
  ```

  ```json
  {
    "entry": {
      "id": "L-a2s5d8fg",
      "type": "decision",
      "summary": "magic links, no passwords, WebAuthn later",
      "status": "accepted",
      "source": "kernel",
      "author": "Przemysław Broniszewski <przemek@example.com>",
      "at": "2026-09-25T09:12:30.256Z",
      "refs": [
        "design.md"
      ],
      "body": "We ship magic links first ...",
      "path": ".bdk/changes/2026-09-25-add-passwordless-login/log/20260925T091230Z-decision-L-a2s5d8fg.md"
    }
  }
  ```

- **Owner:** T20
- **Slice:** `log`

#### Scenario: example run

- **WHEN** `bdk log show L-a2s5d8fg --json` runs as in the example
- **THEN** the exit code is 0 and stdout validates against `schema/cli/output/log-show.json`

#### Scenario: input/not-found

- **WHEN** the referenced object does not exist in the active Change, the configuration or the bundle
- **THEN** the exit code is 3 and the error object carries `rule: input/not-found`

### Requirement: bdk log resolve

Set an entry's status (resolved, accepted, superseded) with a reason. The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk log resolve <id> accepted|resolved|superseded [--by <id>] [--reason <text>]`
- **Availability:** `orchestrator`
- **Mode:** `command`; Change-scoped
- **Arguments:**
  - `<id>` (required).
  - `accepted|resolved|superseded` (required).
  - `--by <id>`. Superseding entry; required with superseded.
  - `--reason <text>`.
- **Behaviour:** The status change rewrites the entry's frontmatter in place and appends the reason to its body (a line `Resolved as <status> at <at>: <reason>`), one of the mutations `kernel-state` allows (Derived state and mutation) and that its two-branch merge test covers. Allowed moves: `proposed` to `accepted` or `resolved`, `accepted` to `resolved`, and `superseded` from `proposed` or `accepted`; every other move, a repeated one, a `transition` entry and an already superseded entry are `policy/invalid-transition` naming the current status. `superseded` is never stored: the kernel writes `supersedes: <id>` into the `--by` entry (missing `--by` is `input/missing-argument`; a `--by` entry that already supersedes another is `policy/invalid-transition`), and the status is derived from it. `record` names the rewritten entry: `<id>`, or the `--by` entry for `superseded`. `source: user` cannot be produced here.
- **Writes:** `.bdk/changes/<id>/log/`
- **Output:** `schema/cli/output/log-resolve.json`
- **Exit codes and rules:** `0, 2, 3, 4, 5`. Specific rules: `input/not-found`, `policy/invalid-transition`; plus the common rules of every command and of Change-scoped commands (`kernel-cli`, Exit codes and the error object).
- **Example:**

  ```bash
  bdk log resolve L-e8k2s5vw resolved --reason "fixed in A-7f3k9m2q retry" --json
  ```

  ```json
  {
    "entry": "L-e8k2s5vw",
    "status": "resolved",
    "record": "L-e8k2s5vw",
    "reason": "fixed in A-7f3k9m2q retry"
  }
  ```

- **Owner:** T20
- **Slice:** `log`

#### Scenario: example run

- **WHEN** `bdk log resolve L-e8k2s5vw resolved --reason "fixed in A-7f3k9m2q retry" --json` runs as in the example
- **THEN** the exit code is 0 and stdout validates against `schema/cli/output/log-resolve.json`

#### Scenario: input/not-found

- **WHEN** the referenced object does not exist in the active Change, the configuration or the bundle
- **THEN** the exit code is 3 and the error object carries `rule: input/not-found`

#### Scenario: policy/invalid-transition

- **WHEN** the Change or part is not in a state from which the verb applies
- **THEN** the exit code is 2 and the error object carries `rule: policy/invalid-transition`

#### Scenario: superseded is derived

- **WHEN** `bdk log resolve L-aaaaaaaa superseded --by L-bbbbbbbb` runs
- **THEN** `L-bbbbbbbb`'s file gains `supersedes: L-aaaaaaaa`, `L-aaaaaaaa`'s file is unchanged, and `log list` shows `L-aaaaaaaa` as `superseded`

### Requirement: bdk log triage

Set the project-level triage level of a finding, blocker or observation. The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk log triage <id> blocker|should-fix|nice-to-have|not-a-problem [--reason <text>]`
- **Availability:** `orchestrator`
- **Mode:** `command`; Change-scoped
- **Arguments:**
  - `<id>` (required). A `finding`, `blocker` or `observation` entry.
  - `blocker|should-fix|nice-to-have|not-a-problem` (required). The level (T42-T).
  - `--reason <text>`. Required for `not-a-problem`.
- **Behaviour:** The orchestrator's judgement of what an entry means for this project, separate from the writer's `severity` and `category`. The command rewrites the entry's frontmatter in place, setting `level`, and appends a line `Triaged as <level> at <at>: <reason>` to its body (`kernel-state`, Derived state and mutation). `not-a-problem` also sets `status: resolved`, so the entry stops being live in the same write; the other levels leave `status` alone. An entry of another type is `input/invalid-argument`; a resolved or superseded entry is `policy/invalid-transition` naming its status; `not-a-problem` without `--reason` is `input/missing-argument`. A later call may change the level of a live entry, and each call appends its line. A `blocker` level is what the `review` verdict counts (`kernel-pipeline`, Artifact kinds); the levels never change `type`, `severity` or `category`, and never stamp `source: user`.
- **Writes:** `.bdk/changes/<id>/log/`
- **Output:** `schema/cli/output/log-triage.json`
- **Exit codes and rules:** `0, 2, 3, 4, 5`. Specific rules: `input/not-found`, `policy/invalid-transition`; plus the common rules of every command and of Change-scoped commands (`kernel-cli`, Exit codes and the error object).
- **Example:**

  ```bash
  bdk log triage L-q2w3e4r5 should-fix --reason "real but outside the auth path" --json
  ```

  ```json
  {
    "record": "L-q2w3e4r5",
    "level": "should-fix",
    "status": "proposed"
  }
  ```

- **Owner:** T42
- **Slice:** `log`

#### Scenario: example run

- **WHEN** `bdk log triage L-q2w3e4r5 should-fix --reason "real but outside the auth path" --json` runs as in the example
- **THEN** the exit code is 0 and stdout validates against `schema/cli/output/log-triage.json`

#### Scenario: input/not-found

- **WHEN** `<id>` names no entry of the active Change
- **THEN** the exit code is 3 and the error object carries `rule: input/not-found`

#### Scenario: policy/invalid-transition

- **WHEN** the entry is already `resolved`
- **THEN** the exit code is 2 and the error object carries `rule: policy/invalid-transition` naming `resolved`

#### Scenario: not a problem resolves

- **WHEN** `bdk log triage L-q2w3e4r5 not-a-problem --reason "the value is validated by the caller"` runs on a live finding
- **THEN** the entry holds `level: not-a-problem` and `status: resolved`, and its body ends with the triage line naming the reason

#### Scenario: reason required for not a problem

- **WHEN** `bdk log triage L-q2w3e4r5 not-a-problem` runs without `--reason`
- **THEN** the exit code is 3 and the error object carries `rule: input/missing-argument`

#### Scenario: decision cannot be triaged

- **WHEN** `<id>` names a `decision`
- **THEN** the exit code is 3 and the error object carries `rule: input/invalid-argument`

#### Scenario: level changes on a live entry

- **WHEN** an entry triaged `nice-to-have` is triaged `blocker`
- **THEN** it holds `level: blocker` and its body holds both triage lines in order

### Requirement: bdk log decide

Record the human's disposition of a finding, observation or blocker. The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk log decide <id> fix|defer|reject|track [--reason <text>] [--issue <ref>] [--review]`
- **Availability:** `orchestrator`
- **Mode:** `command`; Change-scoped
- **Arguments:**
  - `<id>` (required). A `finding`, `observation` or `blocker` entry.
  - `fix|defer|reject|track` (required). The disposition (T42-H).
  - `--reason <text>`. Required for `reject`.
  - `--issue <ref>`. The tracker issue: a URL or a key such as `PAY-123`. Required for `track`, refused with any other disposition.
  - `--review`. Also set `review: true`, so the entry is shown at the next gate and in the PR summary as a decision someone still has to look at.
- **Behaviour:**
  - **What it records.** The human's decision on an entry the review left open, separate from the orchestrator's `level`. The command rewrites the entry's frontmatter in place and appends the line `Decided <disposition> at <at>: <reason>` to its body (`kernel-state`, Derived state and mutation).
  - **Effect of each disposition:**

    | Disposition | `disposition` | Other fields                                              | `status`                   |
    | ----------- | ------------- | --------------------------------------------------------- | -------------------------- |
    | `fix`       | `fix`         | `level: blocker`, so the next `review-fix` round fixes it | unchanged                  |
    | `defer`     | `defer`       | none                                                      | `accepted` when `proposed` |
    | `reject`    | `reject`      | none                                                      | `resolved`                 |
    | `track`     | `track`       | `issue`                                                   | `accepted` when `proposed` |

  - **Changing a disposition.** A later call may change the disposition of a live entry, and each call appends its line. `track` replaces `issue`, and any other disposition removes it.
  - **Refusals:**
    - An entry of another type is `input/invalid-argument`.
    - A resolved or superseded entry is `policy/invalid-transition`, naming its status.
    - A live entry whose `level` is `blocker` and whose `disposition` is not `fix` is `policy/invalid-transition`, naming `blocker`: the review already fixes it before its verdict passes.
    - `reject` without `--reason` and `track` without `--issue` are `input/missing-argument`.
    - `--issue` with another disposition is `input/invalid-argument`.
  - **What it never does.** The command never changes `type`, `severity` or `category`, and never stamps `source: user`.
- **Writes:** `.bdk/changes/<id>/log/`
- **Output:** `schema/cli/output/log-decide.json`
- **Exit codes and rules:** `0, 2, 3, 4, 5`. Specific rules: `input/not-found`, `policy/invalid-transition`; plus the common rules of every command and of Change-scoped commands (`kernel-cli`, Exit codes and the error object).
- **Example:**

  ```bash
  bdk log decide L-q2w3e4r5 track --issue https://github.com/acme/app/issues/88 --json
  ```

  ```json
  {
    "record": "L-q2w3e4r5",
    "disposition": "track",
    "issue": "https://github.com/acme/app/issues/88",
    "level": "should-fix",
    "status": "accepted",
    "review": false
  }
  ```

- **Owner:** T42
- **Slice:** `log`

#### Scenario: example run

- **WHEN** `bdk log decide L-q2w3e4r5 track --issue https://github.com/acme/app/issues/88 --json` runs as in the example
- **THEN** the exit code is 0 and stdout validates against `schema/cli/output/log-decide.json`

#### Scenario: input/not-found

- **WHEN** `<id>` names no entry of the active Change
- **THEN** the exit code is 3 and the error object carries `rule: input/not-found`

#### Scenario: policy/invalid-transition

- **WHEN** the entry is already `resolved`
- **THEN** the exit code is 2 and the error object carries `rule: policy/invalid-transition` naming `resolved`

#### Scenario: fix makes the entry a blocker

- **WHEN** `bdk log decide L-q2w3e4r5 fix` runs on a live finding triaged `should-fix`
- **THEN** the entry holds `disposition: fix` and `level: blocker`, its `status` is unchanged, and `bdk attempt open review-fix <change-id>` followed by `bdk dispatch build <change-id> implementer <ticket>` embeds it

#### Scenario: defer accepts

- **WHEN** `bdk log decide L-q2w3e4r5 defer --review` runs on a `proposed` finding
- **THEN** the entry holds `disposition: defer`, `status: accepted` and `review: true`, and stays live

#### Scenario: reject resolves and needs a reason

- **WHEN** `bdk log decide L-q2w3e4r5 reject` runs without `--reason`
- **THEN** the exit code is 3 and the error object carries `rule: input/missing-argument`; with `--reason "duplicate of #12"` the entry holds `disposition: reject` and `status: resolved`

#### Scenario: track needs an issue

- **WHEN** `bdk log decide L-q2w3e4r5 track` runs without `--issue`
- **THEN** the exit code is 3 and the error object carries `rule: input/missing-argument`

#### Scenario: issue only with track

- **WHEN** `bdk log decide L-q2w3e4r5 defer --issue PAY-1` runs
- **THEN** the exit code is 3 and the error object carries `rule: input/invalid-argument`

#### Scenario: a blocker is not deferred

- **WHEN** `bdk log decide` runs with `defer` on a live entry triaged `blocker`
- **THEN** the exit code is 2 and the error object carries `rule: policy/invalid-transition` naming `blocker`

#### Scenario: disposition changes on a live entry

- **WHEN** an entry decided `track` with an issue is decided `defer`
- **THEN** it holds `disposition: defer` and no `issue`, and its body holds both decision lines in order

#### Scenario: decision cannot be decided

- **WHEN** `<id>` names a `decision`
- **THEN** the exit code is 3 and the error object carries `rule: input/invalid-argument`
