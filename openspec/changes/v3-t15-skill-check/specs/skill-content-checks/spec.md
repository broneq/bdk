# Spec Delta

## Purpose

Defines how BDK checks the content of its own skills and agents with `skill-check`, whose contract is the `skill-kit` spec in the kit repository (`broneq/bdk-skill-kit`, `openspec/specs/skill-kit/spec.md`). It covers the BDK rule plugin, BDK's targets and limits, the baseline for v2 content, the seeded-violation fixtures, and where the check runs (CI, pre-commit).

## ADDED Requirements

### Requirement: Pinned kit and one configuration

BDK SHALL depend on `bdk-skill-kit` as a devDependency pinned to a release tag. BDK SHALL run the kit through one repository-root config, `skill-check.config.ts`, invoked as `pnpm skill-check`. The config SHALL declare:

- a skills target over `skills/` in the `claude-code` profile;
- an agents target over `agents/`;
- the BDK rule plugin;
- the baseline file.

It SHALL override these limits:

- `line-limit` at 200 (S1);
- `description` at 250 characters;
- `description-front-loaded` at error;
- `require-model` on for agents;
- `layout` allowing only `references`, `examples`, `scripts` and `assets`.

#### Scenario: whole-tree run

- **WHEN** `pnpm skill-check` runs on the repository
- **THEN** it checks every skill under `skills/` and every agent under `agents/` with the generic rules and the `bdk/*` rules, and exits 0

### Requirement: Marketplace listing

The BDK marketplace SHALL list `bdk-skill-kit` with a `github` source, unpinned like `git-identity`.

#### Scenario: marketplace entry

- **WHEN** `claude plugin validate` runs on BDK's marketplace
- **THEN** it passes, and the marketplace lists `bdk-skill-kit` with source `{ "source": "github", "repo": "broneq/bdk-skill-kit" }`

### Requirement: BDK rule plugin

BDK SHALL provide a `skill-check` plugin named `bdk` with these rules, each at error severity:

| ID                          | Rule                                                                                                                                                   |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `bdk/wrapper-form`          | Every occurrence of a `!` block opener, in prose or in a code fence, is a whole line matching the `content-wrapper` regex of `kernel-cli`, Invocation. |
| `bdk/wrapper-allowed-tools` | A skill with a `!` block lists `Bash(node ${CLAUDE_PLUGIN_ROOT}/dist/bdk.mjs *)` in `allowed-tools`.                                                   |
| `bdk/no-mcp-tools`          | No file names a `mcp__plugin_bdk_` tool.                                                                                                               |
| `bdk/gate-invocation`       | The gate skills `plan`, `execute`, `close` and `run` set `disable-model-invocation: true`.                                                             |
| `bdk/gate-disallowed-tools` | The skills `execute` and `close` list `Edit`, `Write` and `NotebookEdit` in `disallowed-tools`.                                                        |
| `bdk/adapter-shape`         | An agent file in an adapter target is frontmatter plus a body of exactly one sentence.                                                                 |
| `bdk/craft-no-kernel`       | A skill in a portable target has no `!` block and no `${CLAUDE_PLUGIN_ROOT}` reference.                                                                |
| `bdk/no-language-commands`  | No hardcoded test runner, build tool or linter command. The `setup` skill is exempt, because stack detection must name what it maps.                   |
| `bdk/namespaced-refs`       | A reference to a skill or agent of a BDK target is written `/bdk:<name>` or `bdk:<name>`. A reference to another plugin's skill is a warning.          |

#### Scenario: v2 inject block

- **WHEN** a skill contains the line ``!`python3 ${CLAUDE_PLUGIN_ROOT}/scripts/inject.py --if features.x --then f.md` ``
- **THEN** a `bdk/wrapper-form` error is reported for that line

#### Scenario: correct wrapper without its permission rule

- **WHEN** a skill contains a line matching the `content-wrapper` regex and its `allowed-tools` lacks the kernel rule
- **THEN** `bdk/wrapper-allowed-tools` reports an error and `bdk/wrapper-form` reports nothing

#### Scenario: gate skill invocable by the model

- **WHEN** the skill `execute` omits `disable-model-invocation: true`
- **THEN** a `bdk/gate-invocation` error is reported

#### Scenario: bare reference to a BDK skill

- **WHEN** a skill body tells the reader to run `/commit` and `commit` is a BDK skill
- **THEN** a `bdk/namespaced-refs` error asks for `/bdk:commit`

### Requirement: Wrapper regex cannot drift from the spec

A contract test SHALL assert that the regex applied by `bdk/wrapper-form` equals the ` ```regex content-wrapper ` block of `openspec/specs/kernel-cli/spec.md`.

#### Scenario: spec edited alone

- **WHEN** the `content-wrapper` regex in the spec changes and the plugin does not
- **THEN** the contract test fails

### Requirement: Baseline for v2 content

BDK SHALL keep a `skill-check` baseline that holds only findings in v2 skills and agents that existed when the check was introduced. The baseline SHALL shrink as T41 and T42 replace them, and SHALL NOT gain entries except through a reviewed hand edit.

#### Scenario: a v2 skill gains a new violation

- **WHEN** a v2 skill is edited and the edit introduces a violation not in the baseline
- **THEN** `pnpm skill-check` exits 1

#### Scenario: a v2 skill is deleted

- **WHEN** a v2 skill directory is removed and its baseline entries remain
- **THEN** `pnpm skill-check` reports `baseline-stale` and exits 1 until the entries are pruned

### Requirement: Seeded violations for every rule

BDK SHALL carry one clean fixture tree and one fixture per enabled rule. Each rule fixture SHALL be the clean tree with exactly one seeded violation of that rule. The clean tree SHALL contain a skills target, an agents target with adapters, and a portable target that stands in for `bdk-craft`. A contract test SHALL run the `skill-check` CLI with the BDK plugin over each fixture and assert:

- the clean tree exits 0 without findings;
- each rule fixture exits 1, and the rule ID of every finding is that fixture's rule;
- the set of rule fixtures equals the set of rules the fixture config enables, both generic and `bdk/*`.

The test SHALL skip, with a stated reason, on a Node line that cannot load a TypeScript config (below 22.18).

#### Scenario: CI fails on each seeded rule

- **WHEN** the contract step runs the fixture test
- **THEN** every rule fixture produces exit 1 with findings of only its own rule

#### Scenario: portable target rejects a Claude-only field

- **WHEN** the fixture for `fields` in the portable target has a craft skill that sets `disable-model-invocation`
- **THEN** `skill-check` exits 1 with a `fields` error naming the portable profile

#### Scenario: new rule without a fixture

- **WHEN** a rule is enabled in the fixture config and has no fixture directory
- **THEN** the contract test fails and names the rule

### Requirement: Where the check runs

CI SHALL run `pnpm skill-check` in its skill content job after a frozen install. The pre-commit hook SHALL run the same whole-tree check when a staged path lies under `skills/` or `agents/`. Both SHALL use the repository's Node version from `.nvmrc`.

#### Scenario: violation in a pull request

- **WHEN** a pull request adds a skill that breaks a rule
- **THEN** the skill content job fails and its log names the file, line and rule ID

#### Scenario: commit touching a skill

- **WHEN** a commit stages a change under `skills/` that introduces a violation
- **THEN** the pre-commit hook fails and the commit is not created
