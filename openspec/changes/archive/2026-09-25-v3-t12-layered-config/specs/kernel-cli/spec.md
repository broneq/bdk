# Spec Delta

## MODIFIED Requirements

### Requirement: Output modes

Every command SHALL run in exactly one of three output modes, fixed per command in the index (`mode`).

Three modes, fixed per command in the index (`mode`).

**Inject mode (`ctx skill|role|startup`, `next`, `hooks session-start`, `hooks session-end`).**

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
^!`node "\$\{CLAUDE_PLUGIN_ROOT\}/dist/bdk\.mjs" (ctx (skill|role) [a-z][a-z0-9-]*|ctx startup|next) 2>&1 \|\| echo "BDK STOP: kernel unavailable \(exit \$\?\)\. Install Node >= 22\.13 and run /bdk:setup\."`$
```

The Node minimum `22.13` is HOST-FACTS `node-sqlite-min`. A skill with such a block SHALL carry `allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/dist/bdk.mjs" *) Bash(echo *)`: HOST-FACTS `wrapper` confirms that this pair pre-approves the wrapper, and `wrapper-old-rule` shows that the unquoted rule alone does not, because the host matches the quoted path literally and asks approval for the `echo` branch with its `$?`. Without the pair the skill is lost whole in `default` permission mode (`allowed-control`). The content test checks the pair next to the wrapper. Content hooks in `hooks.json` (`hooks session-start`, `hooks session-end`) use the same `2>&1 || echo "BDK STOP: ..."` branch without the `!` and backticks.

**Command mode (everything else).**

Called from Bash by the orchestrator or a subagent, or by a test. stdout is the result, stderr is diagnostics, the exit code is the verdict (`kernel-cli`, Exit codes and the error object). A failing command prints the error object (JSON with `--json`, four labelled lines otherwise) on stdout, not stderr, so that a caller reading stdout always sees either the result or the reason.

**Guard mode (`hooks pre-tool`, `hooks prompt-expansion`).**

Called by the host through `hooks.json` with the hook payload on stdin. A guard must **fail closed**: when the kernel is missing or crashes, the tool call or the stage command must be blocked, not waved through. The `hooks.json` line therefore ends in `|| exit 2`, which the host treats as a blocking error for that one call and shows stderr to the user (hooks reference, exit code 2):

```regex guard-wrapper
node "\$\{CLAUDE_PLUGIN_ROOT\}/dist/bdk\.mjs" hooks (pre-tool|prompt-expansion) \|\| exit 2$
```

The shell prefilter that decides whether to start Node at all (T24) precedes this fragment on the same line or in the script it calls; the regex is not anchored at the start for that reason. Within guard mode the kernel itself uses two outcomes only: **pass** is exit 0 with the host's JSON decision or plain context on stdout, **block** is exit 2 with the reason on stderr (and, for `PreToolUse`, the same reason in `permissionDecisionReason` on stdout). Exit codes 3, 4 and 5 never leave a guard: an unreadable payload, a corrupted state or a missing runtime all become exit 2, because "unknown" is "blocked" (T24: an unknown payload shape means no transition). The exact stdout shapes per hook are in `kernel-cli/hooks`, Hook payloads.

#### Scenario: inject mode never fails the block

- **WHEN** an inject-mode command hits an internal failure
- **THEN** the exit code is 0 and stdout ends with a two-line STOP block (`BDK STOP: <why>` and `Instead: ...`)

#### Scenario: wrapper pre-approved

- **WHEN** a skill's `!` block uses the content wrapper and its `allowed-tools` carries the rule pair
- **THEN** the skill loads in `default` permission mode with the kernel output in place of the block

#### Scenario: guard mode fails closed

- **WHEN** a guard-mode command cannot read its payload, finds corrupted state or a missing runtime
- **THEN** the exit code is 2 with the reason on stderr, never 3, 4 or 5

#### Scenario: skill wrapper form

- **WHEN** the content check reads a `!` block in a skill
- **THEN** it accepts the block only when the whole line matches the `content-wrapper` regular expression above
