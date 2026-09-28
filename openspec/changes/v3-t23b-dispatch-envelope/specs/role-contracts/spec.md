## MODIFIED Requirements

### Requirement: Role skills

The plugin SHALL ship exactly seven role skills, one per directory `skills/roles/<role>/SKILL.md`, for the roles `implementer`, `verifier`, `design-verifier`, `reviewer`, `pr-reviewer`, `runner` and `scout`. `.claude-plugin/plugin.json` SHALL declare `"skills": ["./skills/roles/"]`, because the host's default scan reads only `skills/<name>/SKILL.md` (HOST-FACTS `roles-nested-default`, `roles-nested-manifest`); the host then lists each role as `bdk:<role>` next to the skills under `skills/`. Each role skill's frontmatter SHALL carry `name` equal to the directory name, a `description`, `user-invocable: false`, `context: fork` and `agent: bdk:<adapter>`, and SHALL NOT carry `model` or `disable-model-invocation`: the adapter supplies the model, and the orchestrating skill must be able to invoke the role. A role body is plugin content and SHALL NOT be overridable by a project in 3.0: `dispatch build` embeds the plugin's body, so a forked role and a role dispatched through the Agent tool read the same text, and a project adapts behaviour through the rule prompt values and `policy.verifier` (corrects T23-D11). A role skill SHALL contain no `!` block; the agent reads its package and rules through agent-class kernel commands, so a forked role and a role dispatched through the host's Agent tool follow the same contract.

#### Scenario: seven roles discovered

- **WHEN** the plugin loads with the `skills` key in `plugin.json`
- **THEN** the Skill tool resolves `bdk:implementer`, `bdk:verifier`, `bdk:design-verifier`, `bdk:reviewer`, `bdk:pr-reviewer`, `bdk:runner` and `bdk:scout`, the skills under `skills/` keep their names, and the roles stay out of the user's skill and slash-command listings because of `user-invocable: false`

#### Scenario: role frontmatter

- **WHEN** the content test reads `skills/roles/verifier/SKILL.md`
- **THEN** its frontmatter has `name: verifier`, `user-invocable: false`, `context: fork` and `agent: bdk:reader`, and has no `model` and no `disable-model-invocation`

#### Scenario: no bang block in a role

- **WHEN** a role skill contains a line starting with `` !` ``
- **THEN** the content test fails and names the role

#### Scenario: no prompt key for a role

- **WHEN** `.bdk/prompts/roles/verifier.md` exists
- **THEN** `bdk config check` exits 2 with `rule: policy/unknown-config-key` naming `roles/verifier`

### Requirement: Dispatch prompt

An orchestrator SHALL start a role with a prompt that holds the path of the role's dispatch package and at most one further sentence; everything the agent needs SHALL be in the package or in a file or command the package names. Every role contract SHALL state that the agent relies on nothing outside its package and the commands the package names. For a forked role the package path is the skill argument; for a role dispatched through the Agent tool it is the prompt. When an agent returns without a stored report, or with a report `log ingest` refused, the orchestrator SHALL resume that agent at most once, naming the refusal; a second failure closes the ticket `fail` (the swarm skill of T23 part C carries this out).

#### Scenario: contract states the file-only input

- **WHEN** the content test reads any role skill body
- **THEN** it tells the agent to read its package first with `bdk dispatch show` and to rely on nothing else from the conversation

#### Scenario: one resume for a missing report

- **WHEN** an agent returns an envelope but no report exists at the package's `report` path
- **THEN** the orchestrator resumes it once with the missing report named, and closes the ticket `fail` if the report is still missing afterwards

### Requirement: Role contract content

Every role skill body SHALL be the role contract only, in this order: input (read the package with `bdk dispatch show <path>`, then the rules the package names with `bdk rules show --ticket <ticket>`), the role's work, ledger writes, output. The contract SHALL NOT repeat usage documentation of any command (`--help` is the only usage source, T02 decision R-13) and SHALL name no language-specific tool.

- **Ledger writes.** Every role writes its entries itself with `bdk log add <type> ... --ticket <ticket>` (superseding the `bdk-entries` block of T2 for role contracts). An agent reads the entries of other agents with `bdk log list --for <task|part|file>`. A finding that must stop other work goes, in addition, to the orchestrator with `SendMessage` to `main`, naming the ledger id.
- **Output.** Every role, the `implementer` included, pipes its report (the envelope fields `status`, `files`, `entries`, `evidence` and `reason` as frontmatter, then the full report) to `bdk log ingest --ticket <ticket>`, which stamps `schema`, `ticket` and `role` and stores it at the package's `report` path (`kernel-state`, Report envelope). The contract SHALL tell the agent to check that `log ingest` exits 0 and, when it refuses, to fix the named field and call it again before returning. The agent then returns only the envelope of at most 15 lines, plus the report path.
- **No authorisation (P3).** The `verifier`, `design-verifier`, `reviewer` and `pr-reviewer` contracts state a verdict and findings only, and contain no statement that approves, signs off, or tells anyone to merge or proceed.
- **Working tree (T3).** The `implementer` contract carries one sentence forbidding git commands that discard or rewrite work or history, with the reason: return `blocked` with the cause instead.
- **Blocking categories (P8).** The `verifier` and `design-verifier` contracts tell the agent to raise a `blocker` only with a category from the closed list in its package and to treat everything on the package's "not a FAIL" list as an `observation` or nothing; the list itself comes from policy through the package, not from the role body.
- **Size.** A role skill body, without frontmatter, SHALL be at most 4 096 bytes, so that it fits in a 12 KB package next to the task (K4).

#### Scenario: P3 wording

- **WHEN** the content test searches the four reviewing role bodies for approve, LGTM, sign-off, ready to merge, go ahead and proceed
- **THEN** it finds none

#### Scenario: git sentence in the implementer contract

- **WHEN** the content test reads `skills/roles/implementer/SKILL.md`
- **THEN** exactly one sentence forbids discarding or history-writing git commands and tells the agent to return `blocked`

#### Scenario: no bdk-entries block

- **WHEN** the content test searches every role body for `bdk-entries`
- **THEN** it finds none, and every role body names `bdk log add`

#### Scenario: body within budget

- **WHEN** the content test measures each role body without frontmatter
- **THEN** each is at most 4 096 bytes

#### Scenario: every role stores its report through ingest

- **WHEN** the content test reads each of the seven role bodies
- **THEN** each names `bdk log ingest --ticket`, tells the agent to fix a refused report and call again, and none tells the agent to write the report file itself
