## Why

Scope: #119. Tracks #119.

Agents run the kernel through a path they rebuild in every shell, `node "<plugin root>/dist/bdk.mjs" <command>`, while every skill, role contract and kernel hint writes the command as `bdk <command>`. The T42 `run-auto` stage probe (2026-10-04) counted 15 shell failures from agents that defined `B="node ..."` and called `$B` in zsh, where an unquoted variable does not split into words. The plugins reference (Standard layout, "Executables") puts a plugin's `bin/` on the Bash tool's `PATH` while the plugin is enabled, so `bdk` can be the real command instead of a shorthand.

## What Changes

- **New launcher `bin/bdk`**: a POSIX `sh` script that runs `node <plugin root>/dist/bdk.mjs "$@"`, located from its own path. It reports a missing `node` or a missing bundle on stderr with the same repair lines the guard scripts use, and leaves the Node version check to the kernel (`kernel-cli`, Invocation: `runtime/node-version`).
- **`bdk <command>` is the invocation**: `kernel-cli`, Invocation names `bdk <args>` as the form agents and skills use, and `node "${CLAUDE_PLUGIN_ROOT}/dist/bdk.mjs" <args>` as the form for hooks and tests, which have no plugin `bin/` on `PATH`. The kernel gains `bdk --version`, the same output as `bdk version`.
- **Skills and role contracts**: the content wrapper becomes ``!`bdk ctx skill <name> 2>&1 || echo "BDK STOP: ..."` ``, the fallback sentence names `bdk ctx skill <name>`, the `allowed-tools` pair becomes `Bash(bdk *) Bash(echo *)`, and the sentence "Run kernel commands as `node ...`; this skill writes them as `bdk <command>`" leaves every skill and role contract. `/bdk:bdk-cli` names `bdk <group> <verb>` as the invocation.
- **Hooks**: `hooks.json` and the guard scripts keep calling `node "${CLAUDE_PLUGIN_ROOT}/dist/bdk.mjs"` (a probe on Claude Code 2.1.289 shows that a plugin's `bin/` is not on a hook's `PATH`). The `hooks pre-tool` prefilter starts Node for a `bdk <command>` call as it does for `bdk.mjs`, so the guards deny `bdk commit` in a subagent and `bdk hooks ...` from Bash exactly as they deny the `node .../bdk.mjs` form.
- **Unsupported hosts**: claude.ai and Cowork do not install a plugin with a top-level `bin/`. BDK is not supported there (no `node` fallback form); README and the user guide say so.
- **Host facts**: `docs/HOST-FACTS.md` and the host probe gain three rows: a plugin's `bin/` on the Bash `PATH` of the main thread and of a subagent, in a skill's `!` block with `Bash(bdk *) Bash(echo *)` in `default` mode, and not on a hook's `PATH`.
- **Evals**: case preparation runs with the plugin copy's `bin/` on `PATH` and writes `bdk ...` instead of `node "$BDK" ...`; a stage run whose transcript holds a Bash call to `bdk.mjs` fails; the execute probe counts `bdk` calls as kernel calls.
- Docs: README, CONTRIBUTING.md, CLAUDE.md, `.claude/rules/skills.md`, `openspec/config.yaml` context, `evals/README.md` and the user guide name `bdk <command>`.

Out of scope: committing `dist/bdk.mjs` to a branch (T48, #114; `bin/bdk` runs the bundle whether it is committed or built); hosts other than Claude Code (T50).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `kernel-cli`: Invocation names `bdk <args>` through the plugin's `bin/bdk` and the `node` form for hooks and tests, adds `--version`; Output modes changes the `content-wrapper` and `content-fallback` regexes and the `allowed-tools` pair; the `guard/hooks-from-bash` row and the availability scenarios name `bdk <command>`.
- `kernel-cli/hooks`: the `pre-tool.sh` prefilter lets a `bdk <command>` call through.
- `kernel-architecture`: the plugin ships `bin/bdk`, a tracked launcher with the executable bit and LF line endings.
- `skill-content-checks`: the unquoted-rule scenario becomes a scenario for the old `node` pair.
- `tools-skills`: `/bdk:bdk-cli` names `bdk <group> <verb>` as the invocation form.
- `skill-evals`: case preparation calls `bdk` with the plugin copy's `bin/` on `PATH`; a stage run that calls the kernel by its bundle path fails.

## Impact

- New: `bin/bdk`, a test of the launcher, a host-probe check and its fixture.
- Kernel: top-level `--version` (`kernel/src/main.ts` or the CLI dispatcher), `schema/cli/commands.json` if the index records it.
- Hooks: `hooks/guard/pre-tool.sh` prefilter; `kernel/src/hooks/` tests.
- Content: every `SKILL.md` under `skills/`, `evals/suites/execute-ab/variants/`, `skill-check.config.ts` (reads the new pair from the spec), contract tests under `kernel/tests/contract/`.
- Evals: `evals/suites/stages/` (prepare `PATH`, case files, transcript check), `evals/suites/execute-ab/metrics.ts`.
- Docs: README, CONTRIBUTING.md, CLAUDE.md, `.claude/rules/skills.md`, `openspec/config.yaml`, `evals/README.md`, `docs/guide/`, `docs/HOST-FACTS.md`, `.gitattributes`.
- Eval spend: one `stages` probe for the acceptance signal; a full series only after its projection is approved.
