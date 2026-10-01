## MODIFIED Requirements

### Requirement: BDK conventions as kit rule settings

BDK SHALL carry no rule code of its own. Each BDK convention below SHALL be enforced at error severity by a rule of `bdk-skill-kit`, enabled and parametrised in `skill-check.config.ts`:

| Convention                 | Setting                                                                                                                                                |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Kernel wrapper form        | Every occurrence of a `!` block opener, in prose or in a code fence, is a whole line matching the `content-wrapper` regex of `kernel-cli`, Invocation. |
| Wrapper permission         | A skill with a `!` block lists the `allowed-tools` pair that `kernel-cli`, Invocation names.                                                           |
| No MCP tools               | No file names a `mcp__plugin_bdk_` tool.                                                                                                               |
| User-only gates            | The skills `setup`, `change`, `plan`, `execute`, `close` and `run` set `disable-model-invocation: true`.                                               |
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

#### Scenario: entry skill invocable by the model

- **WHEN** the skill `change` omits `disable-model-invocation: true`
- **THEN** `pnpm skill-check` reports an error

#### Scenario: bare reference to a BDK skill

- **WHEN** a skill body tells the reader to run `/commit` and `commit` is a BDK skill
- **THEN** `pnpm skill-check` reports an error asking for `/bdk:commit`
