## MODIFIED Requirements

### Requirement: bdk dispatch build

Build the dispatch package file for a target, role and ticket. The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk dispatch build <target> <role> <ticket>`
- **Availability:** `orchestrator`
- **Mode:** `command`; Change-scoped
- **Arguments:**
  - `<target>` (required). The ticket's target: a task id, a part id, the Change id or an artifact id (`kernel-state`, Attempt record).
  - `<role>` (required). Role skill under skills/roles/: implementer, verifier, design-verifier, reviewer, pr-reviewer, runner, scout.
  - `<ticket>` (required).
- **Behaviour:** The ticket must be open and its `target` must equal `<target>` (`policy/no-open-ticket` otherwise); a role outside the seven is `input/invalid-argument`, a target the Change does not hold is `input/not-found`. The kernel writes `dispatch/<target>-<role>-<ticket>.md` and replaces an earlier package of the same ticket. The frontmatter is `kernel-state`, Dispatch package, stamped whole by the kernel, with `adapter` from the role-to-adapter map of `role-contracts` and `report` set to `reports/<target>-<role>-<ticket>.md`. The body comes from one template held in the kernel and not overridable (T23-D11), in this order: the Change intent summary; the target (a task target embeds the task's full text from its plan part, `Files:`, `do-not-touch` and `stop-rule` included; any other target names the artifact paths to read); the ledger entries of the target (every `decision` with `status: accepted` and every `blocker` not `resolved` whose refs name the target, its part or one of its `Files:`, in full; for every other entry type only a count and the command `bdk log list --for <target>`, T23-D13); the role skill body from the plugin, without frontmatter; the command `bdk rules show --ticket <ticket>` (T23-D5); for `verifier` and `design-verifier` the resolved `policy.verifier.blocking-categories` and `policy.verifier.not-a-fail` lists (P8); the return contract (store the report with `bdk log ingest --ticket <ticket>`, return only the envelope). `template-hash` is the sha256 of the template skeleton, the role body and the texts `rules show --ticket` would print for the ticket, each normalised to LF, without trailing whitespace and without frontmatter (T23-D10, P10). A task target whose executable fields contain a placeholder is `policy/placeholder` (the task grammar check of `validate`). A package above 12 288 bytes is `policy/package-too-large`, whose `why` names the size and the largest section, and nothing is written. The orchestrator hands the agent the package path only (`role-contracts`, Dispatch prompt).
- **Writes:** `.bdk/changes/<id>/dispatch/`
- **Output:** `schema/cli/output/dispatch-build.json`
- **Exit codes and rules:** `0, 2, 3, 4, 5`. Specific rules: `input/not-found`, `policy/no-open-ticket`, `policy/package-too-large`, `policy/placeholder`; plus the common rules of every command and of Change-scoped commands (`kernel-cli`, Exit codes and the error object).
- **Example:**

  ```bash
  bdk dispatch build 02-3 implementer A-7f3k9m2q --json
  ```

  ```json
  {
    "path": ".bdk/changes/2026-09-25-passwordless-login/dispatch/02-3-implementer-A-7f3k9m2q.md",
    "bytes": 9814,
    "ticket": "A-7f3k9m2q",
    "target": "02-3",
    "role": "implementer",
    "adapter": "worker",
    "scope": "high+",
    "kernelVersion": "3.0.0",
    "templateHash": "sha256:2222222222222222222222222222222222222222222222222222222222222222",
    "report": ".bdk/changes/2026-09-25-passwordless-login/reports/02-3-implementer-A-7f3k9m2q.md",
    "entries": {
      "full": [
        "L-a2s5d7k1"
      ],
      "counted": {
        "finding": 2,
        "observation": 1
      }
    }
  }
  ```

- **Owner:** T23
- **Slice:** `dispatch`

#### Scenario: example run

- **WHEN** `bdk dispatch build 02-3 implementer A-7f3k9m2q --json` runs as in the example
- **THEN** the exit code is 0 and stdout validates against `schema/cli/output/dispatch-build.json`

#### Scenario: input/not-found

- **WHEN** the target does not exist in the active Change
- **THEN** the exit code is 3 and the error object carries `rule: input/not-found`

#### Scenario: policy/no-open-ticket

- **WHEN** the ticket is closed, does not exist, or its target is not `<target>`
- **THEN** the exit code is 2 and the error object carries `rule: policy/no-open-ticket`

#### Scenario: policy/package-too-large

- **WHEN** the rendered package is 13 210 bytes
- **THEN** the exit code is 2, the error object carries `rule: policy/package-too-large`, `why` names 13 210 bytes and the largest section, and no file is written under `dispatch/`

#### Scenario: policy/placeholder

- **WHEN** the task's `Files:` line contains `TODO` (P6, P7)
- **THEN** the exit code is 2 and the error object carries `rule: policy/placeholder`

#### Scenario: package content

- **WHEN** task `02-3` has one accepted decision, one proposed decision, one open blocker and two findings referencing it, and `dispatch build 02-3 implementer A-7f3k9m2q` runs
- **THEN** the package embeds the task text, the accepted decision and the blocker in full, counts two findings and one decision next to `bdk log list --for 02-3`, embeds the body of `skills/roles/implementer/SKILL.md`, and names `bdk rules show --ticket A-7f3k9m2q` and `bdk log ingest --ticket A-7f3k9m2q`

#### Scenario: verifier categories

- **WHEN** `.bdk/settings.yaml` adds the blocking category `accessibility` and a package for role `verifier` is built
- **THEN** the package lists the six default categories and `accessibility`, followed by the `not-a-fail` list; an `implementer` package lists neither

#### Scenario: template hash is stable

- **WHEN** the same package is built twice with no change to the plugin, the rules or the settings
- **THEN** both builds carry the same `template-hash`, and a change to the role body changes it

### Requirement: bdk dispatch show

Print a dispatch package by path or ticket. The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk dispatch show <ticket|path>`
- **Availability:** `agent`
- **Mode:** `command`; Change-scoped
- **Arguments:**
  - `<ticket|path>` (required). A ticket id, or a package path relative to the working directory or absolute.
- **Behaviour:** Available to subagents, so an agent reads its package without touching `.bdk/` directly (Key boundaries). A path must name a file under the active Change's `dispatch/`; a ticket resolves to its package. Text mode prints the file verbatim; `--json` adds the parsed frontmatter. A path outside `dispatch/`, a missing file or a ticket without a package is `input/not-found`.
- **Writes:** nothing
- **Output:** `schema/cli/output/dispatch-show.json`
- **Exit codes and rules:** `0, 2, 3, 4, 5`. Specific rules: `input/not-found`; plus the common rules of every command and of Change-scoped commands (`kernel-cli`, Exit codes and the error object).
- **Example:**

  ```bash
  bdk dispatch show A-7f3k9m2q --json
  ```

  ```json
  {
    "path": ".bdk/changes/2026-09-25-passwordless-login/dispatch/02-3-implementer-A-7f3k9m2q.md",
    "content": "---\nschema: 1\nticket: A-7f3k9m2q\n...",
    "frontmatter": {
      "ticket": "A-7f3k9m2q",
      "target": "02-3",
      "role": "implementer",
      "adapter": "worker"
    }
  }
  ```

- **Owner:** T23
- **Slice:** `dispatch`

#### Scenario: example run

- **WHEN** `bdk dispatch show A-7f3k9m2q --json` runs as in the example
- **THEN** the exit code is 0 and stdout validates against `schema/cli/output/dispatch-show.json`

#### Scenario: input/not-found

- **WHEN** the ticket has no package, or the path does not name a file under the active Change's `dispatch/`
- **THEN** the exit code is 3 and the error object carries `rule: input/not-found`

#### Scenario: agent reads its package by path

- **WHEN** a subagent runs `bdk dispatch show .bdk/changes/<id>/dispatch/02-3-implementer-A-7f3k9m2q.md`
- **THEN** the exit code is 0 and stdout is the package file byte for byte
