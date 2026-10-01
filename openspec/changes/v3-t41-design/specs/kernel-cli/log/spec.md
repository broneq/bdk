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
  - `--ticket <ticket>`. The ticket the caller works under; required inside a dispatch and for `report`, sets source: agent:<role>.
  - `--category <id>`. The entry's category; a verifier blocker needs one from policy.verifier.blocking-categories (P8).
  - `--review`. Mark the entry to be shown at the next gate.
  - `--supersedes <id>`.
  - `--applies <glob>`. Repeatable; only with `learning`: the files the lesson is about (`kernel-state`, Ledger entry). Default: the `Files:` of the ticket's task when `--ticket` names a task ticket, none otherwise.
  - `--status proposed|accepted|superseded|resolved`.
  - stdin: Body text when --body - is given.
- **Behaviour:** Available to subagents: every role writes its own entries (T23-D14). `type: transition` is not accepted here and `--source` does not exist: `source` is `agent:<role>` when `--ticket` names an open ticket whose active package (`kernel-state`, Attempt record, `package`) names the role, and `kernel` for the main thread without a ticket; passing `id`, `at`, `author`, `source` or `fingerprint` as a flag in any form is `input/forbidden-field` (P1, T20 acceptance: `--source user` exits 3). A ticket without an open attempt record or without a dispatch package is `policy/no-open-ticket`. Validation: type from the list, summary 1-120 characters, >= 1 ref, the T14 entry schema; `--category` only with `finding` or `blocker`, the types that carry the field (`input/invalid-argument`); `--status` defaults to `proposed`, `superseded` is refused (`input/invalid-argument`, it is derived from `--supersedes`) and `--applies` with any type but `learning` is `input/invalid-argument`. A `learning` records a lesson for the audit (`kernel-cli/rules`, bdk rules stats) and never becomes a rule by itself (T02 decision Q-6). `--supersedes` must name an existing entry (`input/not-found`). A `blocker` under a ticket whose active package's role is `verifier` or `design-verifier` and whose `--category` is missing or not an `id` of the resolved `policy.verifier.blocking-categories` is written as an `observation` with `review: true` (an observation has no `category` field, so the category is named in the body) and a body that starts with `Downgraded from blocker: category <id|none> is not a blocking category (P8).` followed by the given body; the output's `downgraded` names the original type and category (P8). Nothing caps the number of entries per ticket (T23-D13). The kernel stamps `id` (retrying when the id exists in the Change), `at` from its clock, `author` from git (`user.name <user.email>`), `source`, `ticket` and, for `learning`, `fingerprint`, and writes `log/<ts>-<type>-<id>.md`. Dedupe by key (`kernel-state`, Ledger deduplication) returns the existing entry with `deduplicated: true` and writes nothing. A `report` entry records the report `log ingest` stored under `--ticket` (`kernel-pipeline`, Artifact kinds: a verdict node reads the latest `report` naming it): `report` without `--ticket` is `input/missing-argument`; the kernel sets the entry's `report` field to the active package's `report` path, relative to the Change directory, and refuses with `input/not-found` naming that path while no report is stored there; it appends the ticket's `target` to the refs when no ref names it; and it never deduplicates a `report`, because each verification round is its own report.
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

#### Scenario: report entry of a verifier ticket

- **WHEN** a `design-verifier` under ticket `A-9c2d4f6h` with target `design-verify` has stored its report through `log ingest` and runs `bdk log add report "design verified" --ref design.md --ticket A-9c2d4f6h`
- **THEN** the entry has `source: agent:design-verifier`, `refs: [design.md, design-verify]` and `report: reports/design-verify-design-verifier-A-9c2d4f6h.md`, and a second call writes a second entry

#### Scenario: report before ingest

- **WHEN** `bdk log add report "design verified" --ref design-verify --ticket A-9c2d4f6h` runs before any report is stored at the package's `report` path
- **THEN** the exit code is 3, the error object carries `rule: input/not-found` naming that path, and nothing is written
