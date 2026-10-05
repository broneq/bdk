## Context

See proposal.md, Why. Today `kernel-cli`, Invocation says that `node ${CLAUDE_PLUGIN_ROOT}/dist/bdk.mjs <args>` is the only supported invocation and that `bdk <args>` is shorthand. Every skill repeats one sentence that maps the shorthand to the path, and the kernel's own hints (`instead`, the `doneBy.command` of a graph kind) already write `bdk <command>`. The kernel guard already counts the command word `bdk` as a kernel call (`kernel-cli/hooks`, Bash command parsing), because models define a `bdk` shell function; only the shell prefilter of `pre-tool.sh` still looks for `bdk.mjs`.

A probe on Claude Code 2.1.289 (a scratch plugin with `bin/ppbin`, run headless) gave these host facts, which this Change records in `docs/HOST-FACTS.md` through a new host-probe check:

| Where the command runs                                                       | Plugin `bin/` on `PATH`             |
| ---------------------------------------------------------------------------- | ----------------------------------- |
| Bash tool, main thread                                                       | yes                                 |
| Bash tool, general-purpose subagent                                          | yes                                 |
| Skill `!` block, `allowed-tools: Bash(ppbin *) Bash(echo *)`, `default` mode | yes, block rendered                 |
| Same skill without `allowed-tools`                                           | skill aborts (as `allowed-control`) |
| `command` hook (`UserPromptSubmit`)                                          | **no**: `ppbin: command not found`  |

## Goals / Non-Goals

**Goals:**

- One spelling of a kernel call for every agent and skill: `bdk <command>`, which the agent runs as written.
- The guards treat `bdk <command>` exactly like the `node .../bdk.mjs` form.
- The host facts the design rests on are recorded and can be re-probed.

**Non-Goals:**

- Changing how hooks start the kernel.
- A shim for hosts that do not put a plugin's `bin/` on `PATH`.
- Detecting another `bdk` executable that shadows the plugin's (see Risks).

## Decisions

### D1. The launcher is a POSIX `sh` script

`bin/bdk` is `#!/bin/sh`, finds the plugin root from `$0` (the host puts the directory itself on `PATH`, so `$0` is the absolute path of the script, not a symlink), checks that `node` is on `PATH` and that `dist/bdk.mjs` exists, and then `exec`s `node "<root>/dist/bdk.mjs" "$@"`. A failed check writes one line to stderr, `bdk: kernel unavailable: <cause>; <repair>`, with the same causes and repairs as the guard scripts (`install Node >= 22.13 and run /bdk:setup`, `reinstall the BDK plugin`), and exits 5, the exit code of the kernel's `runtime/*` refusals (`kernel-cli`, Exit codes). The Node version check stays in the kernel, which already refuses with `runtime/node-version` and an install line; the launcher does not duplicate the minimum.

Alternatives:

- **Node shebang (`#!/usr/bin/env node`) importing the bundle.** Lost: without `node` the user gets `env: node: No such file or directory`, not the repair line, and the script costs nothing less than `exec`.
- **A symlink `bin/bdk -> ../dist/bdk.mjs` with a shebang in the bundle.** Lost: `dist/` is not tracked (`kernel-architecture`, Generated outputs), so the link dangles in a fresh checkout, and the same `env: node` message applies.

Windows: Claude Code runs the Bash tool through Git Bash on Windows, which runs a `sh` script with a shebang. A user who switches the shell tool to PowerShell gets no `bdk`; that is not supported in 3.0. `.gitattributes` pins `bin/bdk` to LF, so a checkout with `core.autocrlf` does not break the shebang line, and git tracks the file with mode `100755`.

### D2. Hooks keep the `node` form

The host does not put a plugin's `bin/` on a hook's `PATH` (Context, last row), so `hooks.json` and `hooks/guard/*.sh` keep `node "${CLAUDE_PLUGIN_ROOT}/dist/bdk.mjs" ...`. Calling `"${CLAUDE_PLUGIN_ROOT}/bin/bdk"` from the hooks was considered and lost: it adds one `sh` process to every hook that reaches Node (the hooks have wall-clock budgets in `pnpm test:perf`), and the guard scripts already check `node` and the bundle themselves, with the fail-closed exit 2 that the launcher's exit 5 would not give. The `guard-wrapper` regex of `kernel-cli` stays as it is.

### D3. `kernel-cli`, Invocation names two forms by caller

`bdk <args>` is the form for agents and skills: the Bash tool, a subagent's Bash and a skill's `!` block. `node "${CLAUDE_PLUGIN_ROOT}/dist/bdk.mjs" <args>` is the form for hooks, and `node dist/bdk.mjs <args>` the form for tests and the eval harness, none of which has the plugin's `bin/` on `PATH`. Both reach the same bundle; the kernel's behaviour does not depend on the form. The sentence "No PATH shim is installed" goes.

The kernel's hints need no change: they already write `bdk <command>`, which is now a runnable command instead of a shorthand.

### D4. Skill content: wrapper, fallback and permission pair

- Content wrapper: ``!`bdk (ctx skill <name>|next) 2>&1 || echo "BDK STOP: kernel unavailable (exit $?). Install Node >= 22.13 and run /bdk:setup."` ``. With the plugin disabled or `bin/` missing, `bdk` is not found, the `||` branch prints the STOP line with exit 127, and the skill stops visibly as today.
- Fallback sentence: ``run `bdk ctx skill <name>` first``.
- `allowed-tools` pair: `Bash(bdk *) Bash(echo *)`. The probe shows the pair pre-approves the wrapper in `default` mode; the quoting question of `wrapper-old-rule` disappears, because there is no path to quote.
- The sentence "Run kernel commands as `node ...`; this skill (contract) writes them as `bdk <command>`" is removed from every skill and role contract: the commands are already written as `bdk <command>`. `/bdk:bdk-cli` keeps one line that says to call the kernel as `bdk <group> <verb> --json`.

`skill-check.config.ts` and the contract tests read the regexes and the pair from the spec (`skill-content-checks`, Wrapper form read from the spec; `plugin-tooling`, Skill context lines), so the change is one spec edit plus the content.

### D5. The prefilter matches `bdk ` as well as `bdk.mjs`

`pre-tool.sh` lets a payload through to the kernel when it contains `bdk.mjs` or `bdk ` (the word followed by a space) wherever it looks for `bdk.mjs` today: with `hooks` for every thread, and with `"agent_id"` for a subagent. The prefilter only over-approximates; the kernel parses the command and decides (`kernel-cli/hooks`, Bash command parsing already counts the command word `bdk`). Matching the exact JSON position of a command word (`"command":"bdk `, `&& bdk `, `; bdk `, `| bdk `, `$(bdk `) was considered and lost: it is a longer list that a new shell construct silently escapes, which is the failure the prefilter must not have, while a payload that holds `bdk ` without calling the kernel costs one Node start.

### D6. Hosts without `bin/` are not supported

claude.ai and Cowork do not install a plugin that has a top-level `bin/` (plugins reference, Standard layout). BDK depends on command hooks and a local Node in any case, so a documented `node` fallback form would keep a second spelling alive in every skill for hosts the plugin does not run on. README and the user guide's installation page say that BDK needs Claude Code (CLI, desktop or IDE) and does not install in claude.ai or Cowork.

### D7. Kernel `--version`

The issue's acceptance signal runs `bdk --version`, and `--version` is the flag users try first. The registry maps a first argument `--version` to the `version` command (same output, same `--json` form) before it resolves the command. The index gains no record: like `--help`, it is an implicit spelling, listed in the global help.

### D8. Evals put the plugin's `bin/` on `PATH`

The stages suite's `prepare` lines and seeds run in a plain shell, not in a session, so the harness prepends `<plugin copy>/bin` to their `PATH` and the case files write `bdk config set ...`. `$BDK` goes: one spelling in case files and in skills. The harness's own kernel reads keep calling the bundle through `process.execPath`, because they are not shell lines. A plugin copy built from a ref before this Change has no `bin/`, so a stage case run on such a ref fails in `prepare` with `bdk: not found`; the stages suite only runs the current tree, so no case needs the old form.

A stage run fails when its transcript holds a Bash call whose command contains `dist/bdk.mjs`: the acceptance signal of #119, checked on every run instead of by reading transcripts. The execute probe's kernel call count (`skill-evals`, The execute probe counts kernel refusals) counts a Bash call as a kernel call when its command runs `bdk` as a command word or names `bdk.mjs`, so a variant written for either form is measured the same way.

## Risks / Trade-offs

- [A plugin's `bin/` comes after the user's own `PATH` entries, so another executable named `bdk` shadows the launcher] → The `!` wrapper then runs the foreign tool, which most likely fails, and the skill stops with the STOP line naming its exit code. A check is not possible from inside `bdk` (a shadowed `bdk` never reaches the kernel), and a check from a hook would read the hook's `PATH`, which is not the Bash tool's. README names the cause next to the STOP line's repair.
- [The launcher's failure is a stderr line, not the JSON error object a `--json` caller parses] → It only happens when the kernel cannot start, where the guard scripts and the `!` wrapper already handle the exit code; a caller sees exit 5 and the reason.
- [A host version that stops putting `bin/` on a skill's `!` block `PATH`] → The host-probe check `plugin-bin` re-records the fact on every probe run, and the wrapper's `||` branch turns the failure into a visible STOP line.

## Migration Plan

One PR into `staging/v3`. A user who updates the plugin gets `bin/bdk` and the new skills together, because both are in the same plugin version. Rollback is a revert of the PR.
