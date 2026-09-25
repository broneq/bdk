# kernel-cli/dispatch Specification

## Purpose

Dispatch packages and the headless runner (`dispatch`). The subagent interface (K3, K4): `build` writes a package file, `show` reads one back, `run` is the headless runner that spawns one host CLI process per package.

Common rules, not repeated per requirement: every command may emit `input/unknown-command`, `input/unknown-flag`, `input/missing-argument`, `input/invalid-argument`, `runtime/node-version`, `runtime/not-a-repo`; every Change-scoped command additionally `policy/no-active-change`, `state/corrupted-index`, `state/ledger-invalid`, `state/change-dir-missing`. Their meaning and exit codes are in `kernel-cli`, Exit codes and the error object; a command's `exits` in the index is derived from the classes of its specific and common rules.

Representative refusal:

```json refusal
{
  "refused": true,
  "rule": "policy/package-too-large",
  "why": "package for 02-3 implementer is 13 210 bytes; the limit is 12 288 (K4)",
  "instead": [
    "bdk part split 02 02-3,02-4",
    "trim the task's Files: and re-run bdk dispatch build 02-3 implementer A-7f3k"
  ]
}
```

## Requirements

### Requirement: bdk dispatch build

Build the dispatch package file for a task, role and ticket. The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk dispatch build <task> <role> <ticket>`
- **Availability:** `orchestrator`
- **Mode:** `command`; Change-scoped
- **Arguments:**
  - `<task>` (required).
  - `<role>` (required). Role skill under skills/roles/: implementer, verifier, design-verifier, reviewer, pr-reviewer, runner, scout.
  - `<ticket>` (required).
- **Behaviour:** Frontmatter `ticket`, `task`, `role`, `adapter`, `attempt n/N`, `scope`, `kernel-version`, `template-hash` (P10); sections per the design's "Dispatch package (K3, K4)" plus the role skill body (T02 decision Q-3). Refuses above 12 KB, on placeholders in executable fields and without an open ticket. The orchestrator hands the subagent the path only.
- **Writes:** `.bdk/changes/<id>/dispatch/`
- **Output:** `schema/cli/output/dispatch-build.json`
- **Exit codes and rules:** `0, 2, 3, 4, 5`. Specific rules: `input/not-found`, `policy/no-open-ticket`, `policy/package-too-large`, `policy/placeholder`; plus the common rules of every command and of Change-scoped commands (`kernel-cli`, Exit codes and the error object).
- **Example:**

  ```bash
  bdk dispatch build 02-3 implementer A-7f3k --json
  ```

  ```json
  {
    "path": ".bdk/changes/2026-09-25-passwordless-login/dispatch/02-3-implementer-2.md",
    "bytes": 9814,
    "ticket": "A-7f3k",
    "task": "02-3",
    "role": "implementer",
    "adapter": "worker",
    "scope": "high+",
    "kernelVersion": "3.0.0",
    "templateHash": "sha256:2222222222222222222222222222222222222222222222222222222222222222",
    "entries": {
      "full": [
        "L-a2s5d"
      ],
      "summaries": [
        "L-e8k2s"
      ]
    },
    "rules": [
      "CQ-4",
      "SEC-2",
      "PL-1"
    ]
  }
  ```

- **Owner:** T23
- **Slice:** `dispatch`

#### Scenario: example run

- **WHEN** `bdk dispatch build 02-3 implementer A-7f3k --json` runs as in the example
- **THEN** the exit code is 0 and stdout validates against `schema/cli/output/dispatch-build.json`

#### Scenario: input/not-found

- **WHEN** the referenced object does not exist in the active Change, the configuration or the bundle
- **THEN** the exit code is 3 and the error object carries `rule: input/not-found`

#### Scenario: policy/no-open-ticket

- **WHEN** no open ticket for the task, or the ticket named does not match
- **THEN** the exit code is 2 and the error object carries `rule: policy/no-open-ticket`

#### Scenario: policy/package-too-large

- **WHEN** the package exceeds 12 KB (K4)
- **THEN** the exit code is 2 and the error object carries `rule: policy/package-too-large`

#### Scenario: policy/placeholder

- **WHEN** an executable field contains `TODO`, `<fill in>` or `...` (P6, P7)
- **THEN** the exit code is 2 and the error object carries `rule: policy/placeholder`

### Requirement: bdk dispatch show

Print a dispatch package by path or ticket. The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk dispatch show <ticket|path>`
- **Availability:** `agent`
- **Mode:** `command`; Change-scoped
- **Arguments:**
  - `<ticket|path>` (required).
- **Behaviour:** Available to subagents so a worker can re-read its package without touching `.bdk/` directly (Key boundaries).
- **Writes:** nothing
- **Output:** `schema/cli/output/dispatch-show.json`
- **Exit codes and rules:** `0, 2, 3, 4, 5`. Specific rules: `input/not-found`; plus the common rules of every command and of Change-scoped commands (`kernel-cli`, Exit codes and the error object).
- **Example:**

  ```bash
  bdk dispatch show A-7f3k --json
  ```

  ```json
  {
    "path": ".bdk/changes/2026-09-25-passwordless-login/dispatch/02-3-implementer-2.md",
    "content": "---\nticket: A-7f3k\n...",
    "frontmatter": {
      "ticket": "A-7f3k",
      "task": "02-3",
      "role": "implementer"
    }
  }
  ```

- **Owner:** T23
- **Slice:** `dispatch`

#### Scenario: example run

- **WHEN** `bdk dispatch show A-7f3k --json` runs as in the example
- **THEN** the exit code is 0 and stdout validates against `schema/cli/output/dispatch-show.json`

#### Scenario: input/not-found

- **WHEN** the referenced object does not exist in the active Change, the configuration or the bundle
- **THEN** the exit code is 3 and the error object carries `rule: input/not-found`

### Requirement: bdk dispatch run

Headless runner: spawn one host CLI process per package of a wave and collect the reports. The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk dispatch run <part> [--wave <n>] [--concurrency <n>]`
- **Availability:** `orchestrator`
- **Mode:** `command`; Change-scoped
- **Arguments:**
  - `<part>` (required).
  - `--wave <n>`. Wave number from plan/index.md; default the next wave with open tickets.
  - `--concurrency <n>`. Cap; default execution.concurrency.
- **Behaviour:** The `headless` runner of T23 (the plan's `bdk execute --wave N` and `bdk run`; renamed here because both collide with stage skill names). Only meaningful when `execution.runner: headless`; with `host-agent` the orchestrator calls the host's Agent tool itself and this command refuses with `policy/invalid-transition`. Each process gets one package, isolated by worktree or `do-not-touch`; reports land as files and the envelopes are returned for `attempt close`.
- **Writes:** `.bdk/changes/<id>/reports/`, `.bdk/.machine/`
- **Output:** `schema/cli/output/dispatch-run.json`
- **Exit codes and rules:** `0, 2, 3, 4, 5`. Specific rules: `input/not-found`, `policy/no-open-ticket`, `policy/invalid-transition`; plus the common rules of every command and of Change-scoped commands (`kernel-cli`, Exit codes and the error object).
- **Example:**

  ```bash
  bdk dispatch run 02 --wave 2 --json
  ```

  ```json
  {
    "part": "02",
    "wave": 2,
    "runner": "headless",
    "runs": [
      {
        "ticket": "A-7f3k",
        "task": "02-3",
        "host": "claude",
        "status": "done",
        "report": ".bdk/changes/2026-09-25-passwordless-login/reports/02-3-implementer-2.md",
        "durationMs": 184000
      }
    ]
  }
  ```

- **Owner:** T23
- **Slice:** `dispatch`

#### Scenario: example run

- **WHEN** `bdk dispatch run 02 --wave 2 --json` runs as in the example
- **THEN** the exit code is 0 and stdout validates against `schema/cli/output/dispatch-run.json`

#### Scenario: input/not-found

- **WHEN** the referenced object does not exist in the active Change, the configuration or the bundle
- **THEN** the exit code is 3 and the error object carries `rule: input/not-found`

#### Scenario: policy/no-open-ticket

- **WHEN** no open ticket for the task, or the ticket named does not match
- **THEN** the exit code is 2 and the error object carries `rule: policy/no-open-ticket`

#### Scenario: policy/invalid-transition

- **WHEN** the Change or part is not in a state from which the verb applies
- **THEN** the exit code is 2 and the error object carries `rule: policy/invalid-transition`
