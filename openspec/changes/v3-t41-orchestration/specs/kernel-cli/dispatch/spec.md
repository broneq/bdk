## MODIFIED Requirements

### Requirement: bdk dispatch build

Build the dispatch package file for a target, role and ticket. The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk dispatch build <target> <role> <ticket>`
- **Availability:** `orchestrator`
- **Mode:** `command`; Change-scoped
- **Arguments:**
  - `<target>` (required). The ticket's target: a task id, a part id, the Change id or an artifact id (`kernel-state`, Attempt record).
  - `<role>` (required). Role skill under skills/roles/: implementer, simplifier, verifier, design-verifier, reviewer, pr-reviewer, runner, scout, lead.
  - `<ticket>` (required).
- **Behaviour:** The ticket must be open and its `target` must equal `<target>` (`policy/no-open-ticket` otherwise); a role outside the nine is `input/invalid-argument`, and so is `lead` on a ticket of another loop than `part-lead` or any other role on a `part-lead` ticket, a target the Change does not hold is `input/not-found`. The kernel writes `dispatch/<target>-<role>-<ticket>.md`, replacing an earlier package of the same ticket and role; the packages of the ticket's other roles stay (T23-D42). It then stamps the package path as `package` in the ticket's attempt record: the ticket's active package, through which `dispatch show <ticket>`, `rules show --ticket`, `log add --ticket`, `log ingest --ticket` and `evidence record --ticket` find the role. The orchestrator builds a ticket's next package only after the agent of the active one has returned (`role-contracts`, Dispatch prompt). The frontmatter is `kernel-state`, Dispatch package, stamped whole by the kernel, with `adapter` from the role-to-adapter map of `role-contracts` and `report` set to `reports/<target>-<role>-<ticket>.md`. The body comes from one template held in the kernel and not overridable (T23-D11), in this order: the Change intent summary; the target (a task target embeds the task's full text from its plan part, `Files:`, `do-not-touch` and `stop-rule` included, its heading one level down; any other target names the artifact paths to read); for `lead` a `Tasks` section (T41-D11) listing each task of the part in plan order with its `Files:`, its `**Depends on:**` tasks and whether a commit trailer already carries it, so a lead that replaces an earlier one continues with the tasks not committed; the ledger entries of the target (every `decision` with `status: accepted` and every `blocker` not `resolved` whose refs name the target, its part or one of its `Files:`, in full; for every other entry type only a count and the command `bdk log list --for <target>`, T23-D13); the role skill body from the plugin, without frontmatter and with its headings one level down so its `# Role: <role>` sits beside the package sections; the command `bdk rules show --ticket <ticket>` (T23-D5); for `verifier` and `design-verifier` the resolved `policy.verifier.blocking-categories` and `policy.verifier.not-a-fail` lists (P8); for `runner` a `Checks` section (T23-D44) holding, for each post-task step kind the runner runs (`kernel-pipeline`, Artifact kinds), the configured commands with `{files}` replaced by the target's executable files (for `tests-scoped` every `tools.test` entry of tier `fast`, its `related` form, else its `scoped` form, else its `command`; for `lint` every `tools.lint` entry, its `scoped` form, else its `command`), the kind's `when` texts, and the exact line `bdk evidence record <kind> <file> --ticket <ticket> --verdict pass|fail|not-run --cite <citation>`, with the sentence that a kind without a configured command is recorded `not-run` with the reason; the return contract (store the report with `bdk log ingest --ticket <ticket>`, return only the envelope). Before writing, the kernel selects the ticket's rules as `kernel-cli/rules`, bdk rules show, Selection, describes, and stamps the selected ids in order as `rules`, all of them: there is no cap; `rules show --ticket` prints exactly those rules, so the package records which rules the agent was given. `template-hash` is the sha256 of the template skeleton, the role body and the texts of the selected rules, each with its id, each normalised to LF, without trailing whitespace and without frontmatter (T23-D10, P10). A task target whose executable fields contain a placeholder is `policy/placeholder` (the task grammar check of `validate`). A package above 12 288 bytes is `policy/package-too-large`, whose `why` names the size and the largest section, and nothing is written. The orchestrator hands the agent the package path only (`role-contracts`, Dispatch prompt).
- **Writes:** `.bdk/changes/<id>/dispatch/`, `.bdk/changes/<id>/attempts/`
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

#### Scenario: one package per role in a ticket

- **WHEN** `dispatch build 02-3 implementer A-7f3k9m2q`, then `dispatch build 02-3 simplifier A-7f3k9m2q`, then `dispatch build 02-3 runner A-7f3k9m2q` run
- **THEN** `dispatch/` holds the three packages, the attempt record's `package` names the runner package, and `bdk dispatch show A-7f3k9m2q` prints the runner package

#### Scenario: rebuilt role package replaces its earlier one

- **WHEN** `dispatch build 02-3 runner A-7f3k9m2q` runs twice
- **THEN** `dispatch/` holds one runner package for the ticket

#### Scenario: runner checks section

- **WHEN** `tools.test` holds a `fast` entry with `related: "vitest related {files}"`, `tools.lint` holds an entry with `scoped: "eslint {files}"`, task `02-3` has `Files: src/auth/login.ts, docs/login.md`, and `dispatch build 02-3 runner <ticket>` runs
- **THEN** the `Checks` section names the `vitest related` command under `tests-scoped` and the `eslint` command under `lint`, each with `src/auth/login.ts` in place of `{files}` and without `docs/login.md`, each followed by its `bdk evidence record` line with the ticket

#### Scenario: kind without a configured command

- **WHEN** `tools.lint` is empty and a runner package is built
- **THEN** the `lint` entry of the `Checks` section tells the runner to record `lint` as `not-run` with the reason

#### Scenario: selected rule ids are stamped

- **WHEN** `dispatch build 02-3 implementer A-7f3k9m2q` runs for a task whose `Files:` is `web/Form.tsx` with `languages: [react]`
- **THEN** the package frontmatter holds `rules` with the ids of the selected rules, among them `REACT` rules and no rule whose `applies` misses `web/Form.tsx`

#### Scenario: reviewer package holds only applicable ids of its role

- **WHEN** a `reviewer` package is built for a task whose `Files:` is `src/api/login.ts`, and the project has `API-1` with `applies: [src/api/**]`, `UI-1` with `applies: [web/**]` and `PLAN-1` with `roles: [verifier]`
- **THEN** its `rules` contains `API-1` and no `UI-1`, no `PLAN-1` and no `PL`, `EJ` or disabled rule

#### Scenario: a rule edit changes the hash

- **WHEN** the text of a selected rule changes and the same package is built again
- **THEN** its `template-hash` differs from the first build's

#### Scenario: lead package

- **WHEN** part `02` has tasks `02-1` (committed), `02-2` and `02-3`, a `part-lead` ticket of `02` is open and `bdk dispatch build 02 lead A-3h5j7k9m` runs
- **THEN** the package has `role: lead` and `adapter: lead`, names the part file to read, and its `Tasks` section lists the three tasks with their `Files:` and marks `02-1` committed

#### Scenario: lead on a task ticket

- **WHEN** `bdk dispatch build 02-3 lead A-7f3k9m2q` runs on a `task-redispatch` ticket
- **THEN** the exit code is 3 and the error object carries `rule: input/invalid-argument`
