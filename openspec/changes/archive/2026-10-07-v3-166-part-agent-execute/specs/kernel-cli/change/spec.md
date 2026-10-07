## MODIFIED Requirements

### Requirement: bdk change takeover

Take over a Change whose previous session died with open tickets. The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk change takeover [--close-tickets]`
- **Availability:** `orchestrator`
- **Mode:** `command`; Change-scoped
- **Arguments:**
  - `--close-tickets`. Close every open ticket as not-run instead of refusing.
- **Behaviour:** Today's `--force`. Without an open ticket there is nothing to take over: `policy/invalid-transition` with `instead` naming `bdk rebuild`. Without `--close-tickets` it refuses with `policy/ticket-open` listing the open tickets. With it, each open ticket is closed as `not-run` with the body `taken over` (its round's `not-run` counter advances, budgets stay; `kernel-loops`, Not-run outcome), a kernel `transition` entry to the Change's current stage records the takeover with the closed tickets in `refs`, and the rebuild of `bdk rebuild` runs for the Change. `previousSession` is the `session` of the latest `transition` entry that carries one and is not later than the oldest open ticket's `opened` time: the stage command typed in the session that started the work (`hooks prompt-expansion` stamps it); it is absent when no such entry exists. The kernel cannot tell whether that session is still alive, so the orchestrator runs takeover only after the user confirmed it is gone, and `--close-tickets` stays required.
- **Writes:** `.bdk/changes/<id>/attempts/`, `.bdk/changes/<id>/log/`, `.bdk/changes/<id>/`, `.bdk/.machine/`, `.bdk/rules/`
- **Output:** `schema/cli/output/change-takeover.json`
- **Exit codes and rules:** `0, 2, 3, 4, 5`. Specific rules: `policy/invalid-transition`, `policy/ticket-open`, `state/trailer-mismatch`, `runtime/git-missing`; plus the common rules of every command and of Change-scoped commands (`kernel-cli`, Exit codes and the error object).
- **Example:**

  ```bash
  bdk change takeover --close-tickets --json
  ```

  ```json
  {
    "change": "2026-09-25-passwordless-login",
    "closedTickets": [
      "A-7f3k9m2q"
    ],
    "rebuilt": true,
    "previousSession": "<SESSION-1>"
  }
  ```

- **Owner:** T22
- **Slice:** `change`

#### Scenario: example run

- **WHEN** `bdk change takeover --close-tickets --json` runs as in the example
- **THEN** the exit code is 0 and stdout validates against `schema/cli/output/change-takeover.json`

#### Scenario: policy/invalid-transition

- **WHEN** the Change has no open ticket
- **THEN** the exit code is 2, the error object carries `rule: policy/invalid-transition` and `instead` names `bdk rebuild`

#### Scenario: policy/ticket-open

- **WHEN** a ticket is open and `--close-tickets` is not given
- **THEN** the exit code is 2 and the error object carries `rule: policy/ticket-open` listing the ticket

#### Scenario: state/trailer-mismatch

- **WHEN** the rebuild finds trailers that disagree with the plan or the attempt records
- **THEN** the exit code is 4 and the error object carries `rule: state/trailer-mismatch`

#### Scenario: runtime/git-missing

- **WHEN** no `git` executable on `PATH`
- **THEN** the exit code is 5 and the error object carries `rule: runtime/git-missing`

#### Scenario: taken-over ticket keeps the budget

- **WHEN** ticket `A-7f3k9m2q` of `part 02` is open after one failed attempt and `bdk change takeover --close-tickets` runs
- **THEN** the ticket's record has `outcome: not-run` and body `taken over`, `attempt list --for 02` shows `budgets.part.used: 1` and `budgets.not-run.used: 1`, and a new `attempt open part 02` exits 0

#### Scenario: previous session named

- **WHEN** `hooks prompt-expansion` wrote a transition with `session: <SESSION-1>` for a typed `/bdk:execute`, then ticket `A-7f3k9m2q` was opened and `bdk change takeover --close-tickets --json` runs
- **THEN** `previousSession` is `<SESSION-1>`
