## ADDED Requirements

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
