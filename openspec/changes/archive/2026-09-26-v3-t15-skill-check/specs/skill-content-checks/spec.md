# Spec Delta

## Purpose

Defines how BDK checks the content of its own skills and agents with `skill-check`, whose contract is the `skill-kit` spec in the kit repository (`broneq/bdk-skill-kit`, `openspec/specs/skill-kit/spec.md`). It covers the BDK conventions as settings of the kit's rules, BDK's targets and limits, the baseline for v2 content, and where the check runs (CI, pre-commit).

## ADDED Requirements

### Requirement: Pinned kit and one configuration

BDK SHALL depend on `bdk-skill-kit` as a devDependency pinned to a release tag. BDK SHALL run the kit through one repository-root config, `skill-check.config.ts`, invoked as `pnpm skill-check`. The config SHALL declare:

- a skills target over `skills/` in the `claude-code` profile;
- an agents target over `agents/`;
- the rule settings of the BDK conventions;
- the baseline file `skill-check.baseline.json`.

It SHALL override these limits:

- `line-limit` at 200 (S1);
- `description` at 250 characters;
- `description-front-loaded` at error;
- `require-model` on for agents;
- `layout` allowing only `references`, `examples`, `scripts` and `assets`.

#### Scenario: whole-tree run

- **WHEN** `pnpm skill-check` runs on the repository
- **THEN** it checks every skill under `skills/` and every agent under `agents/` with the kit's rules in BDK's settings, and exits 0

### Requirement: Marketplace listing

The BDK marketplace SHALL list `bdk-skill-kit` with a `github` source, unpinned like `git-identity`.

#### Scenario: marketplace entry

- **WHEN** `claude plugin validate` runs on BDK's marketplace
- **THEN** it passes, and the marketplace lists `bdk-skill-kit` with source `{ "source": "github", "repo": "broneq/bdk-skill-kit" }`

### Requirement: BDK conventions as kit rule settings

BDK SHALL carry no rule code of its own. Each BDK convention below SHALL be enforced at error severity by a rule of `bdk-skill-kit`, enabled and parametrised in `skill-check.config.ts`:

| Convention                 | Setting                                                                                                                                                |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Kernel wrapper form        | Every occurrence of a `!` block opener, in prose or in a code fence, is a whole line matching the `content-wrapper` regex of `kernel-cli`, Invocation. |
| Wrapper permission         | A skill with a `!` block lists the `allowed-tools` pair that `kernel-cli`, Invocation names.                                                           |
| No MCP tools               | No file names a `mcp__plugin_bdk_` tool.                                                                                                               |
| User-only gates            | The skills `plan`, `execute`, `close` and `run` set `disable-model-invocation: true`.                                                                  |
| Read-only gates            | The skills `execute` and `close` list `Edit`, `Write` and `NotebookEdit` in `disallowed-tools`.                                                        |
| Adapter shape              | An agent file in an adapter target is frontmatter plus a body of exactly one sentence.                                                                 |
| Portable craft skills      | A skill in a portable target has no `!` block and no `${CLAUDE_PLUGIN_ROOT}` reference.                                                                |
| Language-agnostic commands | No hardcoded test runner, build tool or linter command. The `setup` skill is exempt, because stack detection must name what it maps.                   |
| Namespaced references      | A reference to a skill or agent of a BDK target is written `/bdk:<name>` or `bdk:<name>`. A reference to another plugin's skill is a warning.          |

#### Scenario: v2 inject block

- **WHEN** a skill contains the line ``!`python3 ${CLAUDE_PLUGIN_ROOT}/scripts/inject.py --if features.x --then f.md` ``
- **THEN** `pnpm skill-check` reports a wrapper form error for that line

#### Scenario: correct wrapper without its permission rule

- **WHEN** a skill contains a line matching the `content-wrapper` regex and its `allowed-tools` lacks the kernel rule
- **THEN** `pnpm skill-check` reports a permission error naming the missing rule, and no wrapper form error

#### Scenario: unquoted kernel rule

- **WHEN** a skill with the wrapper lists `Bash(node ${CLAUDE_PLUGIN_ROOT}/dist/bdk.mjs *) Bash(echo *)`, without the quotes around the path
- **THEN** `pnpm skill-check` reports a permission error naming the quoted rule

#### Scenario: gate skill invocable by the model

- **WHEN** the skill `execute` omits `disable-model-invocation: true`
- **THEN** `pnpm skill-check` reports an error

#### Scenario: bare reference to a BDK skill

- **WHEN** a skill body tells the reader to run `/commit` and `commit` is a BDK skill
- **THEN** `pnpm skill-check` reports an error asking for `/bdk:commit`

### Requirement: Wrapper form read from the spec

`skill-check.config.ts` SHALL read the ` ```regex content-wrapper ` block and the `allowed-tools` pair from the Invocation section of `openspec/specs/kernel-cli/spec.md` when it loads, and SHALL hold no copy of either. When the block or the pair cannot be found, loading the config SHALL fail, so `pnpm skill-check` exits 2 with a reason naming the spec.

#### Scenario: spec edited alone

- **WHEN** the `content-wrapper` regex in the spec changes and nothing else does
- **THEN** the next `pnpm skill-check` run applies the new regex

#### Scenario: spec block missing

- **WHEN** the ` ```regex content-wrapper ` block is removed or renamed in the spec
- **THEN** `pnpm skill-check` exits 2 and names the spec file

### Requirement: Baseline for v2 content

BDK SHALL keep a `skill-check` baseline that holds only findings in v2 skills and agents that existed when the check was introduced. The baseline SHALL shrink as T41 and T42 replace them, and SHALL NOT gain entries except through a reviewed hand edit.

#### Scenario: a v2 skill gains a new violation

- **WHEN** a v2 skill is edited and the edit introduces a violation not in the baseline
- **THEN** `pnpm skill-check` exits 1

#### Scenario: a v2 skill is deleted

- **WHEN** a v2 skill directory is removed and its baseline entries remain
- **THEN** `pnpm skill-check` reports `baseline-stale` and exits 1 until the entries are pruned

### Requirement: Rule tests live in the kit

BDK SHALL carry no rule tests and no seeded-violation fixtures. Every kit rule that BDK's config enables SHALL have unit tests and a seeded-violation fixture in the kit's own CI, and BDK SHALL pin only a kit release tag whose CI run is green. The kit's option validation SHALL reject a malformed option in BDK's config with exit 2.

#### Scenario: seeded violations at the pinned tag

- **WHEN** BDK pins a kit release tag
- **THEN** the kit's CI run on that tag shows exit 1 for a seeded violation of every rule, including a `fields` error for a Claude-only field in a portable skill

#### Scenario: malformed option

- **WHEN** BDK's config gives a kit rule an option of the wrong shape
- **THEN** `pnpm skill-check` exits 2 and names the rule

### Requirement: Where the check runs

CI SHALL run `pnpm skill-check` in its skill content job after a frozen install. The pre-commit hook SHALL run the same whole-tree check when a staged path lies under `skills/` or `agents/`. Both SHALL use the repository's Node version from `.nvmrc`.

#### Scenario: violation in a pull request

- **WHEN** a pull request adds a skill that breaks a rule
- **THEN** the skill content job fails and its log names the file, line and rule ID

#### Scenario: commit touching a skill

- **WHEN** a commit stages a change under `skills/` that introduces a violation
- **THEN** the pre-commit hook fails and the commit is not created
