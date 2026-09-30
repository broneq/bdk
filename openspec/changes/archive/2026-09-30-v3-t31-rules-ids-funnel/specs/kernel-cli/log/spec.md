## MODIFIED Requirements

### Requirement: bdk log add

Append one ledger entry; the kernel stamps id, time, author and source. The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk log add decision|finding|observation|blocker|question|assumption|risk|learning|report <summary> [--ref <ref>] [--body <text>] [--ticket <ticket>] [--category <id>] [--review] [--supersedes <id>] [--applies <glob>] [--status proposed|accepted|superseded|resolved]`
- **Availability:** `agent`
- **Mode:** `command`; Change-scoped
- **Arguments:**
  - `decision|finding|observation|blocker|question|assumption|risk|learning|report` (required).
  - `<summary>` (required). <= 120 characters.
  - `--ref <ref>`. Repeatable; at least one (file, symbol, part, task, rule or entry id).
  - `--body <text>`. Markdown body; - reads it from stdin.
  - `--ticket <ticket>`. The ticket the caller works under; required inside a dispatch, sets source: agent:<role>.
  - `--category <id>`. The entry's category; a verifier blocker needs one from policy.verifier.blocking-categories (P8).
  - `--review`. Mark the entry to be shown at the next gate.
  - `--supersedes <id>`.
  - `--applies <glob>`. Repeatable; only with `learning`: the files the lesson is about (`kernel-state`, Ledger entry). Default: the `Files:` of the ticket's task when `--ticket` names a task ticket, none otherwise.
  - `--status proposed|accepted|superseded|resolved`.
  - stdin: Body text when --body - is given.
- **Behaviour:** Available to subagents: every role writes its own entries (T23-D14). `type: transition` is not accepted here and `--source` does not exist: `source` is `agent:<role>` when `--ticket` names an open ticket whose active package (`kernel-state`, Attempt record, `package`) names the role, and `kernel` for the main thread without a ticket; passing `id`, `at`, `author`, `source` or `fingerprint` as a flag in any form is `input/forbidden-field` (P1, T20 acceptance: `--source user` exits 3). A ticket without an open attempt record or without a dispatch package is `policy/no-open-ticket`. Validation: type from the list, summary 1-120 characters, >= 1 ref, the T14 entry schema; `--category` only with `finding` or `blocker`, the types that carry the field (`input/invalid-argument`); `--status` defaults to `proposed`, `superseded` is refused (`input/invalid-argument`, it is derived from `--supersedes`) and `--applies` with any type but `learning` is `input/invalid-argument`. A `learning` records a lesson for the audit (`kernel-cli/rules`, bdk rules stats) and never becomes a rule by itself (T02 decision Q-6). `--supersedes` must name an existing entry (`input/not-found`). A `blocker` under a ticket whose active package's role is `verifier` or `design-verifier` and whose `--category` is missing or not an `id` of the resolved `policy.verifier.blocking-categories` is written as an `observation` with `review: true` (an observation has no `category` field, so the category is named in the body) and a body that starts with `Downgraded from blocker: category <id|none> is not a blocking category (P8).` followed by the given body; the output's `downgraded` names the original type and category (P8). Nothing caps the number of entries per ticket (T23-D13). The kernel stamps `id` (retrying when the id exists in the Change), `at` from its clock, `author` from git (`user.name <user.email>`), `source`, `ticket` and, for `learning`, `fingerprint`, and writes `log/<ts>-<type>-<id>.md`. Dedupe by key (`kernel-state`, Ledger deduplication) returns the existing entry with `deduplicated: true` and writes nothing.
- **Writes:** `.bdk/changes/<id>/log/`
- **Output:** `schema/cli/output/log-add.json`
- **Exit codes and rules:** `0, 2, 3, 4, 5`. Specific rules: `input/forbidden-field`, `input/not-found`, `policy/no-open-ticket`, `runtime/git-missing`; plus the common rules of every command and of Change-scoped commands (`kernel-cli`, Exit codes and the error object).
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

- **WHEN** under an `implementer` ticket of task `02-3` whose `Files:` is `web/Form.tsx`, `bdk log add learning "forms lost the pending state" --ref 02-3 --ticket A-7f3k9m2q` runs
- **THEN** the entry carries `applies: [web/Form.tsx]` and a kernel-stamped `fingerprint`, and no file under `.bdk/rules/` changes

#### Scenario: applies on another type

- **WHEN** `bdk log add finding "x" --ref 02-3 --applies "src/**"` runs
- **THEN** the exit code is 3 with `rule: input/invalid-argument`

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
- **Behaviour:** Summaries only, read from the index, ordered by `at` then id. `status` is the derived status (`superseded` when another entry names the entry in `supersedes`). `--for` keeps entries with a ref equal to the value, a task ref of the part (`02` matches `02-3`) or a symbol ref of the file (`src/a.ts` matches `src/a.ts#login`). `--since-ticket-start` keeps entries whose `at` is at or after the `opened-at` of the ticket, open or closed, so an orchestrator reads what other agents logged while the ticket ran (swarm skill, T23-D49); a ticket the Change does not hold is `input/not-found`. The filters combine. `< 200 ms` at 1 000 entries is the T20 target, met by the index. Every run appends one line (`at`, duration in milliseconds, entry count, whether the index was refreshed) to `.bdk/.machine/telemetry/log-list.jsonl`, kept below 256 KB by dropping the oldest half.
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

## REMOVED Requirements

### Requirement: bdk log route

**Reason**: User decision 2026-09-30 (route B): nothing is routed or proposed at `close`. Recurring lessons and findings surface in the audit view `bdk rules stats`, read in a separate, manually started audit session; adoption is `bdk rules accept`.

**Migration**: none needed; the command answered `kernel/not-implemented` and never shipped. A caller that wanted proposals runs `bdk rules stats --entries`.
