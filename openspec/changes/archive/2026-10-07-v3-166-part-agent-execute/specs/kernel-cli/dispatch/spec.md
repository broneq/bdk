## MODIFIED Requirements

### Requirement: bdk dispatch build

Build the dispatch package file for a target, role and ticket. The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk dispatch build <target> <role> <ticket> [--group <group>] [--file <path>] [--part <nn>] [--range <range>] [--focus <text>]`
- **Availability:** `orchestrator`
- **Mode:** `command`; Change-scoped
- **Arguments:**
  - `<target>` (required). The ticket's target: a part id, the Change id or an artifact id (`kernel-state`, Attempt record).
  - `<role>` (required). Role skill under skills/roles/: implementer, conformer, verifier, design-verifier, reviewer, integration-reviewer, pr-reviewer, runner, scout.
  - `<ticket>` (required).
  - `--group <group>`. A review group of a `review-fix` ticket (`kernel-cli`, Ticket references); the package becomes that group's package.
  - `--file <path>`. Repeatable; only with `--group`. The group's files, repository-relative, usually the `files` of a group of `bdk review plan`.
  - `--part <nn>`. Only with `--group`. The plan part the group reviews; the package names its file as the contract to review against.
  - `--range <range>`. Only with `--group`; required for `reviewer` and `integration-reviewer`. The reviewed range `<base>..<head>` from `bdk review plan`.
  - `--focus <text>`. Only with `--group`; at most 500 characters. The user's focus for the round, embedded as given.
- **Behaviour:** The ticket must be open and its `target` must equal `<target>` (`policy/no-open-ticket` otherwise); a role outside the nine is `input/invalid-argument`, and so is a task id as `<target>`, since no ticket targets a task (#166), and an ungrouped `runner`, since the checks of a part run in `bdk check run` (`kernel-cli/check`); a target the Change does not hold is `input/not-found`. **Groups (T42-A1).** `--group` is allowed only on a ticket of loop `review-fix` and only for `reviewer`, `integration-reviewer`, `runner` and `scout`; `--group merge` (reserved), a group id that is not kebab-case or longer than 32 characters, `--file`, `--part`, `--range` or `--focus` without `--group`, a missing `--range` for a reviewing role, a `--part` the Change does not hold and a malformed range are `input/invalid-argument`. A grouped build writes `dispatch/<target>-<role>-<ticket>-<group>.md` with `group` and `files` in its frontmatter and `report` set to `reports/<target>-<role>-<ticket>-<group>.md`, replacing an earlier package of the same ticket and group whatever its role; it never stamps the attempt record's `package`, because `<ticket>@<group>` finds its package by group (`kernel-cli`, Ticket references), so the groups of one round run in parallel under one ticket. The group's file set for rule selection is the `--file` paths, else the `Files:` of the `--part` tasks, else the work tree files. **Review fix (T42).** An `implementer` package on a `review-fix` ticket embeds in full, beside the entries of its target, every entry the `review` verdict counts as blocking (`kernel-pipeline`, Artifact kinds: a live `blocker` naming `review`, and a live entry triaged `blocker`), whatever its refs, so the implementer receives the round's blockers from the package alone, and a `Checks` section naming `bdk check run <change-id> --ticket <ticket>`, the step kinds and commands it runs, and that the fix is committed by `bdk commit <change-id>` and not by the agent (#166); its file set for rule selection is the file refs of the entries it embeds in full, `#symbol` dropped, or the target's when they name no file. Every package names its report draft `.bdk/.machine/drafts/<package file name>`, stamped as `draft` in the frontmatter: the agent writes its report there with the host's file tool and stores it with `bdk log ingest --ticket <ref> --file <draft>` (`kernel-cli/log`). The kernel writes `dispatch/<target>-<role>-<ticket>.md` for a build without `--group`, replacing an earlier package of the same ticket and role; the packages of the ticket's other roles stay (T23-D42). It then stamps the package path as `package` in the ticket's attempt record: the ticket's active package, through which `dispatch show <ticket>`, `rules show --ticket`, `log add --ticket`, `log ingest --ticket` and `evidence record --ticket` find the role. The orchestrator builds a ticket's next package only after the agent of the active one has returned (`role-contracts`, Dispatch prompt). The frontmatter is `kernel-state`, Dispatch package, stamped whole by the kernel, with `adapter` from the role-to-adapter map of `role-contracts` and `report` set to `reports/<target>-<role>-<ticket>.md`. On an escalation ticket every package but a `runner` or `scout` one carries the record's `model`, and the output returns it: the orchestrator starts that agent on it, and `hooks pre-tool` denies an `Agent` call that does not (`guard/escalation-model`, T41-D14). The body comes from one template held in the kernel and not overridable (T23-D11), in this order: the Change intent summary; the target (a part target embeds the whole part file, its preamble, `do-not-touch`, `stop-rule` and every task with its `Files:` included, its headings one level down, so no task loses the context its part states once (#166); any other target names the artifact paths to read); for a target whose work root is a live part worktree (a task of the part, or the part itself; `kernel-state`, Part worktree) a `Work root` section (T45) naming the worktree's absolute path and stating that every file the agent reads or edits and every command it runs, the `Checks` included, is inside that path (each shell command starts with `cd <workdir>`, each file tool gets an absolute path under it), that the plan, the ledger and the package stay in the home checkout and are reached through the kernel only, and that `hooks pre-tool` denies a file edit outside it (`guard/worktree-scope`); the same path is stamped as `workdir` in the frontmatter; for the `implementer` package of a merge ticket (`kernel-cli/attempt`, bdk attempt open) a `Conflict` section naming the branch merged in, the record's `conflicts`, the resolved prompt `fragments/merge-conflicts` (`kernel-settings`, Prompt values), and the statements that only those paths are edited, that no git command is run because the kernel commits the merge at `attempt close`, and that a conflict the instruction does not settle is returned `blocked` with the paths; the `conformer` package of the ticket carries no `Conflict` section, since it checks the merged state and resolves nothing, but a `Merge` section naming the branch merged in and stating that the kernel commits the merge at `attempt close`, so a merge in progress and unmerged paths are expected and not reported; the rule selection of a merge ticket adds the record's `conflicts` to the target's file set, so a rule whose `paths` names a conflicted lockfile (`BDK-CQ-9`) is selected; for the `implementer` and the `conformer` of a part a `Tasks` section listing each task of the part in plan order with its `Files:`, its `**Depends on:**` tasks and whether a commit trailer already carries it (`committed` or `open`), so the agent of a later ticket of the part continues with the tasks not committed, and a `Checks` section naming the exact `bdk check run <task|part> --ticket <ticket>` the agent runs, the step kinds and commands it runs (`kernel-cli/check`), and that the agent commits with the `git` command `check run` prints and with no other; for the `conformer` a `Range` section naming the ticket's `base` and the commands `git log --format='%h %s' <base>..HEAD` and `git diff <base>..HEAD -- <the part's Files:>`, and a `Project instructions` section listing, of `CLAUDE.md`, `AGENTS.md` and `.claude/rules/*.md` in the work root, the paths that exist, for the conformer to read and answer; the `conformer` of a `review-fix` ticket gets, in place of `Range`, a `Fix` section naming `git diff HEAD`, the round's uncommitted fix, and the `Project instructions` and `Checks` of the review fix's implementer; for an `implementer` package a `Craft` section (T42, R-8) when at least one of its craft skills is installed: the skills are `tdd`, and `debugging` before it when the Change is of kind `bug`; the section lists, in that order, each skill `bdk ctx craft <name>` would find (`kernel-cli/ctx`, bdk ctx craft) and tells the agent to print each with that command before it starts and to follow it; a skill not installed is left out, and with none installed the section is absent; the section names skills, never a path, so the package stays the same on every machine with the same installs; the ledger entries of the target (every `decision` with `status: accepted` and every `blocker` not `resolved` whose refs name the target, its part or one of its `Files:`, in full; for every other entry type only a count and the command `bdk log list --for <target>`, T23-D13); the role skill body from the plugin, without frontmatter and with its headings one level down so its `# Role: <role>` sits beside the package sections; the command `bdk rules show --ticket <ticket>` (T23-D5); for `verifier` and `design-verifier` the resolved `policy.verifier.blocking-categories` and `policy.verifier.not-a-fail` lists (P8); for a grouped package a `Review` section naming the group, its files (or, without `--file`, the command `git diff --name-only <range>`), the range and the command `git diff <range> -- <files>`, the plan part file of `--part`, the paths of `change.md`, `design.md`, `architecture.md` and the plan index that exist, and the `--focus` text; for `integration-reviewer` a `Risks` section listing every enabled item of `review.risks` (`kernel-settings`, Keys of review policy) as its `id` and `instruction`; for a grouped `runner` package a `Checks` section with the full checks of the review stage: under `tests-full` the `command` of every `tools.test` entry, and for an entry with `coverage` its `coverage.command` followed by the line `bdk evidence coverage <id> <coverage.report> --ticket <ticket>@<group>`; under `lint-full` the `command` of every `tools.lint` entry; each kind followed by its `bdk evidence record` line with `--ticket <ticket>@<group>`; a kind the Change's graph skips, because its tool group is declared none (`kernel-pipeline`, Tool group nodes), has no section; the return contract (write the report to the `draft` path, store it with `bdk log ingest --ticket <ticket> --file <draft>`, or `<ticket>@<group>` for a grouped package, return only the envelope). Before writing, the kernel selects the ticket's rules as `kernel-cli/rules`, bdk rules show, Selection, describes, and stamps the selected ids in order as `rules`, all of them: there is no cap; `rules show --ticket` prints exactly those rules, so the package records which rules the agent was given. `template-hash` is the sha256 of the template skeleton, the role body and the texts of the selected rules, each with its id, each normalised to LF, without trailing whitespace and without frontmatter (T23-D10, P10). A part target whose tasks' executable fields contain a placeholder is `policy/placeholder` (the task grammar check of `validate`). A package above 163 840 bytes (160 KiB, about 40-50k tokens; a review group package lists the files of its group) is `policy/package-too-large`, whose `why` names the size, the limit and the largest section, and nothing is written; for a grouped package `instead` names `review.group.max-files` and fewer `--file` paths, not `bdk part split`. The orchestrator hands the agent the package path only (`role-contracts`, Dispatch prompt).
- **Writes:** `.bdk/changes/<id>/dispatch/`, `.bdk/changes/<id>/attempts/`
- **Output:** `schema/cli/output/dispatch-build.json`
- **Exit codes and rules:** `0, 2, 3, 4, 5`. Specific rules: `input/not-found`, `policy/no-open-ticket`, `policy/package-too-large`, `policy/placeholder`; plus the common rules of every command and of Change-scoped commands (`kernel-cli`, Exit codes and the error object).
- **Example:**

  ```bash
  bdk dispatch build 02 implementer A-7f3k9m2q --json
  ```

  ```json
  {
    "path": ".bdk/changes/2026-09-25-passwordless-login/dispatch/02-implementer-A-7f3k9m2q.md",
    "bytes": 9814,
    "ticket": "A-7f3k9m2q",
    "target": "02",
    "role": "implementer",
    "adapter": "worker",
    "scope": "high+",
    "kernelVersion": "3.0.0",
    "templateHash": "sha256:2222222222222222222222222222222222222222222222222222222222222222",
    "report": ".bdk/changes/2026-09-25-passwordless-login/reports/02-implementer-A-7f3k9m2q.md",
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

- **WHEN** `bdk dispatch build 02 implementer A-7f3k9m2q --json` runs as in the example
- **THEN** the exit code is 0 and stdout validates against `schema/cli/output/dispatch-build.json`

#### Scenario: input/not-found

- **WHEN** the target does not exist in the active Change
- **THEN** the exit code is 3 and the error object carries `rule: input/not-found`

#### Scenario: policy/no-open-ticket

- **WHEN** the ticket is closed, does not exist, or its target is not `<target>`
- **THEN** the exit code is 2 and the error object carries `rule: policy/no-open-ticket`

#### Scenario: policy/package-too-large

- **WHEN** the rendered package is 170 210 bytes
- **THEN** the exit code is 2, the error object carries `rule: policy/package-too-large`, `why` names 170 210 bytes and the largest section, and no file is written under `dispatch/`

#### Scenario: a group of the default plan builds

- **WHEN** `bdk dispatch build --group` runs for every group `bdk review plan` makes at the default `review.group.max-files`
- **THEN** every package builds; only a package above 163 840 bytes is `policy/package-too-large`, and its `instead` names `review.group.max-files`

#### Scenario: policy/placeholder

- **WHEN** the task's `Files:` line contains `TODO` (P6, P7)
- **THEN** the exit code is 2 and the error object carries `rule: policy/placeholder`

#### Scenario: verifier categories

- **WHEN** `.bdk/settings.yaml` adds the blocking category `accessibility` and a package for role `verifier` is built
- **THEN** the package lists the seven default categories and `accessibility`, followed by the `not-a-fail` list; an `implementer` package lists neither

#### Scenario: template hash is stable

- **WHEN** the same package is built twice with no change to the plugin, the rules or the settings
- **THEN** both builds carry the same `template-hash`, and a change to the role body changes it

#### Scenario: a rule edit changes the hash

- **WHEN** the text of a selected rule changes and the same package is built again
- **THEN** its `template-hash` differs from the first build's

#### Scenario: review groups under one ticket

- **WHEN** a `review-fix` ticket `A-r1v2w3x4` of the Change is open and `dispatch build <change> reviewer A-r1v2w3x4 --group p01 --part 01 --range H0..H1 --file src/auth/login.ts` and `dispatch build <change> reviewer A-r1v2w3x4 --group p02 --part 02 --range H0..H1 --file src/mail/send.ts` run
- **THEN** `dispatch/` holds `<change>-reviewer-A-r1v2w3x4-p01.md` and `<change>-reviewer-A-r1v2w3x4-p02.md`, each with its `group`, `files` and `report`, the attempt record's `package` is unchanged, and `bdk dispatch show A-r1v2w3x4@p02` prints the second package

#### Scenario: group rules follow the group's files

- **WHEN** the project has `API-1` with `paths: [src/api/**]` and `UI-1` with `paths: [web/**]`, both with `stages: [review]`, and a `reviewer` package of group `p01` is built with `--file src/api/login.ts`
- **THEN** its `rules` contains `API-1` and not `UI-1`

#### Scenario: merge is not a package group

- **WHEN** `dispatch build <change> reviewer A-r1v2w3x4 --group merge --range H0..H1` runs
- **THEN** the exit code is 3 and the error object carries `rule: input/invalid-argument`

#### Scenario: integration reviewer package

- **WHEN** `review.risks` holds the five default items and `dispatch build <change> integration-reviewer A-r1v2w3x4 --group integration --range H0..H1` runs
- **THEN** the package has `adapter: reader`, its `Review` section names `git diff --name-only H0..H1` and the intent and plan paths, and its `Risks` section lists `auth`, `migration`, `secrets`, `public-api` and `dependencies` with their instructions

#### Scenario: gate runner checks

- **WHEN** `tools.test` holds `unit` with `command: "vitest run"` and `coverage: {command: "vitest run --coverage", report: coverage/lcov.info, format: lcov, min: 90}`, `tools.lint` holds `eslint` with `command: "eslint ."`, and `dispatch build <change> runner A-r1v2w3x4 --group gate` runs
- **THEN** its `Checks` section names `vitest run` under `tests-full`, then `vitest run --coverage` and `bdk evidence coverage unit coverage/lcov.info --ticket A-r1v2w3x4@gate`, then `eslint .` under `lint-full`, each kind with its `bdk evidence record` line on `A-r1v2w3x4@gate`

#### Scenario: review fix package embeds the blockers

- **WHEN** finding `L-f1n2d3g4` with ref `src/auth/login.ts` is triaged `blocker`, finding `L-n5c6e7h8` is triaged `nice-to-have`, `review-fix` ticket `A-r2v2w3x4` is open, and `dispatch build <change> implementer A-r2v2w3x4` runs
- **THEN** the package embeds `L-f1n2d3g4` in full and not `L-n5c6e7h8`, and its `rules` equal the selection of `rules explain src/auth/login.ts --role implementer`

#### Scenario: package of a merge ticket

- **WHEN** the merge ticket of part `02` has `conflicts: [pnpm-lock.yaml]` and `bdk dispatch build 02 implementer <ticket>` runs
- **THEN** the package holds a `Work root` section and a `Conflict` section naming `pnpm-lock.yaml`, the Change branch and the text of `fragments/merge-conflicts`, which states that a lockfile is regenerated and never merged by hand, and its `rules` hold `BDK-CQ-9`

#### Scenario: no craft section without bdk-craft

- **WHEN** the build runs and no `bdk-craft` install exists
- **THEN** the package has no `Craft` section and the build succeeds

#### Scenario: artifact target selects over the work tree

- **WHEN** the project holds `PY-1` with `paths: ["**/*.py"]` and `stages: [design]`, the work tree holds no `.py` file, and a `design-verifier` package is built for the design
- **THEN** its `rules` does not contain `PY-1`

#### Scenario: package content

- **WHEN** part `02` has a preamble naming the copy source, tasks `02-1` (committed) and `02-2`, one accepted decision, one proposed decision, one open blocker and two findings referencing it, and `dispatch build 02 implementer A-7f3k9m2q` runs
- **THEN** the package embeds the preamble and both tasks' text, its `Tasks` section marks `02-1` committed and `02-2` open, its `Checks` section names `bdk check run 02-2 --ticket A-7f3k9m2q`, it embeds the accepted decision and the blocker in full, counts two findings and one decision next to `bdk log list --for 02`, embeds the body of `skills/roles/implementer/SKILL.md`, and names `bdk rules show --ticket A-7f3k9m2q` and `bdk log ingest --ticket A-7f3k9m2q --file .bdk/.machine/drafts/02-implementer-A-7f3k9m2q.md`

#### Scenario: a task target is refused

- **WHEN** `bdk dispatch build 02-3 implementer A-7f3k9m2q` runs on a `part 02` ticket
- **THEN** the exit code is 3, the error object carries `rule: input/invalid-argument` naming part `02`, and nothing is written

#### Scenario: conformer package

- **WHEN** the `part 02` ticket has `base` `4c1d2e3`, the work root holds `CLAUDE.md` and `.claude/rules/api.md` and no `AGENTS.md`, and `dispatch build 02 conformer A-7f3k9m2q` runs
- **THEN** the package has `adapter: worker`, its `Range` section names `git diff 4c1d2e3..HEAD -- ` with the part's `Files:`, its `Project instructions` section lists `CLAUDE.md` and `.claude/rules/api.md` only, and its `Checks` section names `bdk check run 02 --ticket A-7f3k9m2q`

#### Scenario: conformer package of a review fix

- **WHEN** `review-fix` ticket `A-r2v2w3x4` is open and `dispatch build <change> conformer A-r2v2w3x4` runs
- **THEN** the package has no `Range` section, its `Fix` section names `git diff HEAD`, and its `Checks` section names `bdk check run <change> --ticket A-r2v2w3x4` and `bdk commit <change>`

#### Scenario: one package per role in a ticket

- **WHEN** `dispatch build 02 implementer A-7f3k9m2q`, then `dispatch build 02 conformer A-7f3k9m2q` run
- **THEN** `dispatch/` holds the two packages, the attempt record's `package` names the conformer package, and `bdk dispatch show A-7f3k9m2q` prints the conformer package

#### Scenario: rebuilt role package replaces its earlier one

- **WHEN** `dispatch build 02 conformer A-7f3k9m2q` runs twice
- **THEN** `dispatch/` holds one conformer package for the ticket

#### Scenario: an ungrouped runner is refused

- **WHEN** `dispatch build 02 runner A-7f3k9m2q` runs on a `part` ticket
- **THEN** the exit code is 3 and the error object carries `rule: input/invalid-argument` naming `bdk check run`

#### Scenario: group declared none

- **WHEN** `tools.lint` is `none` and the gate runner package `dispatch build <change> runner A-r1v2w3x4 --group gate` is built
- **THEN** its `Checks` section holds no `lint-full` section and still holds the `tests-full` section

#### Scenario: selected rule ids are stamped

- **WHEN** `dispatch build 02 implementer A-7f3k9m2q` runs for a part whose only `Files:` path is `web/Form.tsx` with `languages: [react]`
- **THEN** the package frontmatter holds `rules` with the ids of the selected rules, among them `REACT` rules, and no rule whose `paths` miss `web/Form.tsx` or whose `stages` lack `execute`

#### Scenario: reviewer package holds only applicable ids of its role

- **WHEN** a `reviewer` package of group `p01` is built with `--file src/api/login.ts`, and the project has `API-1` with `paths: [src/api/**]` and `UI-1` with `paths: [web/**]`, both with `stages: [review]`, and `PLAN-1` with `paths: ["**"]` and `stages: [plan]`
- **THEN** its `rules` contains `API-1` and no `UI-1`, no `PLAN-1` and no `PL`, `EJ` or disabled rule

#### Scenario: escalation package carries its model

- **WHEN** `bdk dispatch build 02 implementer A-7f3k9m2q --json` runs on the escalation ticket of `part 02`, opened with `policy.escalation.model: opus`
- **THEN** the output and the package frontmatter hold `model: opus`, and the text output names `model opus`

#### Scenario: group on another loop

- **WHEN** `dispatch build 02 reviewer A-7f3k9m2q --group p01 --range H0..H1` runs on a `part` ticket
- **THEN** the exit code is 3 and the error object carries `rule: input/invalid-argument`

#### Scenario: step package of a merge ticket

- **WHEN** the merge ticket of part `02` has `conflicts: [pnpm-lock.yaml]` and `bdk dispatch build 02 conformer <ticket>` runs
- **THEN** the package holds a `Work root` section, a `Merge` section and no `Conflict` section

#### Scenario: package of a worktree part

- **WHEN** part `02` is a live worktree part and `bdk dispatch build 02 implementer <ticket>` runs
- **THEN** the package's frontmatter holds `workdir` with the worktree's absolute path, and its body holds a `Work root` section naming that path before the ledger entries

#### Scenario: package of a shared part

- **WHEN** part `01` is `shared` and `bdk dispatch build 01 implementer <ticket>` runs
- **THEN** the package has no `workdir` and no `Work root` section

#### Scenario: craft section with bdk-craft installed

- **WHEN** `bdk dispatch build 02 implementer A-7f3k9m2q` runs on a Change of kind `feature` and `bdk ctx craft tdd` finds the skill
- **THEN** the package has a `Craft` section naming `tdd` and the command `bdk ctx craft tdd`, and no path to the skill

#### Scenario: bug Change adds debugging

- **WHEN** the same build runs on a Change of kind `bug` with `debugging` and `tdd` installed
- **THEN** the `Craft` section names `debugging`, then `tdd`

#### Scenario: only implementer packages

- **WHEN** a `conformer`, `runner` or `reviewer` package is built with `bdk-craft` installed
- **THEN** it has no `Craft` section

#### Scenario: runner checks section

- **WHEN** `dispatch build 02 runner <ticket>` runs without `--group` on a `part` ticket
- **THEN** the exit code is 3 with `rule: input/invalid-argument` naming `bdk check run`, which runs the checks of a part

#### Scenario: kind without a configured command

- **WHEN** `tools.lint` is unset, so a Change opened before the setting was removed still runs `lint`, and an implementer package of part `02` is built
- **THEN** its `Checks` section names `bdk check run`, which records `lint` as `not-run` with the reason

#### Scenario: lead package

- **WHEN** `bdk dispatch build 02 lead A-3h5j7k9m` runs
- **THEN** the exit code is 3 with `rule: input/invalid-argument`, since `lead` is no role (#166)

#### Scenario: lead on a task ticket

- **WHEN** `bdk dispatch build 02-3 lead A-7f3k9m2q` runs
- **THEN** the exit code is 3 with `rule: input/invalid-argument`

#### Scenario: package of a worktree task

- **WHEN** part `02` is a live worktree part and `bdk dispatch build 02-1 implementer <ticket>` runs
- **THEN** the exit code is 3 with `rule: input/invalid-argument` naming part `02`, whose package carries the `Work root` section

#### Scenario: package of a shared task

- **WHEN** part `01` is `shared` and `bdk dispatch build 01-1 implementer <ticket>` runs
- **THEN** the exit code is 3 with `rule: input/invalid-argument` naming part `01`

#### Scenario: step packages of a merge ticket

- **WHEN** the merge ticket of part `02` has `conflicts: [pnpm-lock.yaml]` and `bdk dispatch build 02 runner <ticket>` runs without `--group`
- **THEN** the exit code is 3 with `rule: input/invalid-argument`, and the conformer package of the ticket carries the `Merge` section

### Requirement: bdk dispatch show

Print a dispatch package by path or ticket. The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk dispatch show <ticket|path>`
- **Availability:** `agent`
- **Mode:** `command`; Change-scoped
- **Arguments:**
  - `<ticket|path>` (required). A ticket reference (`kernel-cli`, Ticket references), or a package path relative to the working directory or absolute.
- **Behaviour:** Available to subagents, so an agent reads its package without touching `.bdk/` directly (Key boundaries). A path must name a file under the active Change's `dispatch/`; a ticket resolves to the package of the agent working on it, else its active package (`kernel-cli`, Ticket references; `kernel-state`, Attempt record, `package`), and `<ticket>@<group>` to the package of that group. Text mode prints the file verbatim; `--json` adds the parsed frontmatter. A path outside `dispatch/`, a missing file or a ticket or a group without a package is `input/not-found`.
- **Writes:** nothing
- **Output:** `schema/cli/output/dispatch-show.json`
- **Exit codes and rules:** `0, 2, 3, 4, 5`. Specific rules: `input/not-found`; plus the common rules of every command and of Change-scoped commands (`kernel-cli`, Exit codes and the error object).
- **Example:**

  ```bash
  bdk dispatch show A-7f3k9m2q --json
  ```

  ```json
  {
    "path": ".bdk/changes/2026-09-25-passwordless-login/dispatch/02-implementer-A-7f3k9m2q.md",
    "content": "---\nschema: 1\nticket: A-7f3k9m2q\n...",
    "frontmatter": {
      "ticket": "A-7f3k9m2q",
      "target": "02",
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

- **WHEN** a subagent runs `bdk dispatch show .bdk/changes/<id>/dispatch/02-implementer-A-7f3k9m2q.md`
- **THEN** the exit code is 0 and stdout is the package file byte for byte
