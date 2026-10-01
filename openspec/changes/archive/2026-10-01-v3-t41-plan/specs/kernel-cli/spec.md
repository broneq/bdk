## MODIFIED Requirements

### Requirement: Output modes

Every command SHALL run in exactly one of three output modes, fixed per command in the index (`mode`).

Three modes, fixed per command in the index (`mode`).

**Inject mode (`ctx skill|startup`, `next`, `hooks session-start`, `hooks session-end`, `hooks skill-exists`).**

Called from a skill's `!` block or from a content hook in `hooks.json`; the output is content the model reads. The kernel **always exits 0** in this mode, even on an internal failure, because the host silently drops the output of a `!` block that exits non-zero (decision Q3, live fact) and a content hook that exits non-zero shows only a notice. Errors become a STOP block rendered inside the content, exactly two lines and nothing after them:

```
BDK STOP: <why>
Instead: <instead[0]>; <instead[1]>; ...
```

`<why>` and `<instead>` are the same values the error object of `kernel-cli`, Exit codes and the error object would carry. The model treats a STOP block as an instruction to stop the skill and report the two lines.

A missing Node, a wrong Node version or a crash before the kernel's top-level handler still exits non-zero at shell level. Every `!` block therefore uses one wrapper form whose `||` branch runs in the same shell, so the block as a whole exits 0 and the STOP line is visible in the loaded skill (V1-5):

```
!`node "${CLAUDE_PLUGIN_ROOT}/dist/bdk.mjs" ctx skill debug 2>&1 || echo "BDK STOP: kernel unavailable (exit $?). Install Node >= 22.13 and run /bdk:setup."`
```

The content test (T15 `skill-check`, BDK rule plugin) accepts a `!` block only when the whole line matches this regular expression, which also restricts `!` blocks to `ctx` and `next` (Key boundaries):

```regex content-wrapper
^!`node "\$\{CLAUDE_PLUGIN_ROOT\}/dist/bdk\.mjs" (ctx skill [a-z][a-z0-9-]*|next) 2>&1 \|\| echo "BDK STOP: kernel unavailable \(exit \$\?\)\. Install Node >= 22\.13 and run /bdk:setup\."`$
```

The Node minimum `22.13` is HOST-FACTS `node-sqlite-min`. A skill with such a block SHALL carry `allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/dist/bdk.mjs" *) Bash(echo *)`: HOST-FACTS `wrapper` confirms that this pair pre-approves the wrapper, and `wrapper-old-rule` shows that the unquoted rule alone does not, because the host matches the quoted path literally and asks approval for the `echo` branch with its `$?`. Without the pair the skill is lost whole in `default` permission mode (`allowed-control`). The content test checks the pair next to the wrapper. Content hooks in `hooks.json` (`hooks session-start`, `hooks session-end`) use the same `2>&1 || echo "BDK STOP: ..."` branch without the `!` and backticks.

**Context lines of a skill.** A skill that needs prompt context carries exactly two context lines, as the first two non-empty lines of its body after the frontmatter: the content wrapper calling `ctx skill <name>` with the skill's own name, then the fallback sentence below with the same name. The fallback sentence is the portable base: running a command named in `SKILL.md` is how the Agent Skills standard and every other host work. The `!` line is the Claude Code accelerator, rendered by the host before the model reads the skill (HOST-FACTS `wrapper`). The sentence covers the cases where the `!` line is not rendered: the host setting `disableSkillShellExecution`, which replaces the block with a placeholder, and any host that shows the line verbatim. `bdk export --host` (T23) drops the `!` line for hosts without pre-rendering and keeps the sentence. A skill carries no other `!` line that calls `ctx`. `${CLAUDE_PLUGIN_ROOT}` resolves in skill content (plugins reference, "Where each variable resolves"), so the model runs the command with the absolute path. A content test checks every skill against both regular expressions and checks that the skills with context lines are exactly the entries of the `ctx skill` manifest (`plugin-tooling`, Skill context lines):

```regex content-fallback
^If no "BDK context: ([a-z][a-z0-9-]*)" heading appears above, run `node "\$\{CLAUDE_PLUGIN_ROOT\}/dist/bdk\.mjs" ctx skill \1` first and apply its output; on a `BDK STOP` line, stop and report it\.$
```

**Command mode (everything else).**

Called from Bash by the orchestrator or a subagent, or by a test. stdout is the result, stderr is diagnostics, the exit code is the verdict (`kernel-cli`, Exit codes and the error object). A failing command prints the error object (JSON with `--json`, four labelled lines otherwise) on stdout, not stderr, so that a caller reading stdout always sees either the result or the reason.

**Guard mode (`hooks pre-tool`, `hooks prompt-expansion`).**

Called by the host through `hooks.json` with the hook payload on stdin. A guard must **fail closed**: when the kernel is missing or crashes, the tool call or the stage command must be blocked, not waved through. The `hooks.json` line therefore ends in `|| exit 2`, which the host treats as a blocking error for that one call and shows stderr to the user (hooks reference, exit code 2):

```regex guard-wrapper
node "\$\{CLAUDE_PLUGIN_ROOT\}/dist/bdk\.mjs" hooks (pre-tool|post-tool|prompt-expansion) \|\| exit 2$
```

The shell prefilter that decides whether to start Node at all (T24) precedes this fragment on the same line or in the script it calls; the regex is not anchored at the start for that reason. Within guard mode the kernel itself uses two outcomes only: **pass** is exit 0 with the host's JSON decision or plain context on stdout, **block** is exit 2 with `<rule>: <why>` on stderr followed by a line `instead: <command>; <command>` naming the refusal's `instead`, so every reason the host shows starts with its rule id and tells the user what to do next (and, for `PreToolUse`, the same text in `permissionDecisionReason` on stdout). Under `--json` a pass prints the command's decision record and a block prints the error object, as in command mode. Exit codes 3, 4 and 5 never leave a guard: an unreadable payload, a corrupted state or a missing runtime all become exit 2, because "unknown" is "blocked" (T24: an unknown payload shape means no transition). The exact stdout shapes per hook are in `kernel-cli/hooks`, Hook payloads.

#### Scenario: inject mode never fails the block

- **WHEN** an inject-mode command hits an internal failure
- **THEN** the exit code is 0 and stdout ends with a two-line STOP block (`BDK STOP: <why>` and `Instead: ...`)

#### Scenario: wrapper pre-approved

- **WHEN** a skill's `!` block uses the content wrapper and its `allowed-tools` carries the rule pair
- **THEN** the skill loads in `default` permission mode with the kernel output in place of the block

#### Scenario: guard mode fails closed

- **WHEN** a guard-mode command cannot read its payload, finds corrupted state or a missing runtime
- **THEN** the exit code is 2 with the reason on stderr, never 3, 4 or 5

#### Scenario: block reason carries the rule

- **WHEN** a guard-mode command blocks with any rule
- **THEN** its stderr is the line `<rule>: <why>` followed by the line `instead: ` and the refusal's `instead` joined by `; `, and the exit code is 2

#### Scenario: blocked stage command names the way out

- **WHEN** the user types `/bdk:plan` on a branch without an active Change
- **THEN** the prompt-expansion guard exits 2 and its stderr names `policy/no-active-change` and, on its `instead` line, `/bdk:change`

#### Scenario: guard script without a kernel

- **WHEN** a guard script of `hooks/guard/` reaches its kernel line on a machine without `node` on `PATH` or without `dist/bdk.mjs`
- **THEN** it exits 2 and stderr starts with `guard/kernel-unavailable`

#### Scenario: skill wrapper form

- **WHEN** the content check reads a `!` block in a skill
- **THEN** it accepts the block only when the whole line matches the `content-wrapper` regular expression above

#### Scenario: kernel unavailable in a skill block

- **WHEN** the content wrapper line of a skill runs in a shell where `node` is not on `PATH`
- **THEN** the line's output ends with `BDK STOP: kernel unavailable (exit 127). Install Node >= 22.13 and run /bdk:setup.` and the shell exits 0

#### Scenario: context lines of a skill

- **WHEN** the content test reads a skill whose body calls `ctx skill`
- **THEN** its first two non-empty body lines match `content-wrapper` and `content-fallback` in that order, both name the skill's own directory name, and no other line of the skill calls `ctx`

#### Scenario: shell execution disabled

- **WHEN** the host replaces the `!` line with a placeholder because `disableSkillShellExecution` is set
- **THEN** the loaded skill has no `BDK context: <name>` heading and its fallback sentence names the exact command to run
