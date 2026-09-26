# Proposal

## Why

Plan: docs/V3-IMPLEMENTATION-PLAN.md, T13. Tracks #51.

Skills still assemble their prompt context through three Python scripts (`inject.py`, `inject-rules.py`, `inject-language-rules.py`) and a Python bridge to the kernel (`kernel_settings.py`). They also use `bdk config show` blocks and `cat` blocks, so one skill carries up to twelve `!` blocks in four different shapes. The SessionStart hook runs three processes (a static `cat` of STARTUP, the Python rule-drift snapshot, `config check`), and a Python Stop hook blocks turns on rule drift. The STARTUP agents table is hand-written and has drifted (T6: no `bdk:design-verifier`). v3 needs one host-neutral composer in the kernel (design "Configuration", "Hooks (V1-1, V1-2)"; Q3, V1-5, P11, T6) before the stage skills (T41, T42) and the dispatch packages (T23) are built on it.

## What Changes

- **`bdk ctx skill <name>`**: one composer for a skill's context. It works from a typed manifest in the kernel (`ctx/use-cases/manifest.ts`, user decision Q3 = M1), one entry per skill. Each entry lists parts: rule sets by file (`rules/<category>`; by ID from T31), the language rules of every `languages` entry, conditional fragments, the `tools.<group>` entries and plugin files (the former `cat` blocks). The output is one Markdown block that starts with the heading `BDK context: <name>` and has one headed section per part. Inject mode: exit 0 always, and errors become a STOP block.
- **One injection point per skill** (user decision Q2): every skill that needs context has exactly one `!` line in the content-wrapper form, first in its body, followed by one fixed fallback sentence. Prose at each step points to its section instead of carrying its own block. The skills `design`, `create-plan`, `create-adr`, `debug`, `test-driven-development`, `cr`, `pr-review` and the preloaded meta-skills (`bdk-rules-*`, `bdk-test-tools`, `bdk-lint-tools`, `bdk-implementer-return-contract`) are migrated. Their content does not change.
- **Delivery = the model-run command as base, the `!` block as the Claude Code accelerator** (user decision Q1 = E). Running a script named in `SKILL.md` is how the Agent Skills standard and every other host work. `!` pre-rendering exists only in Claude Code, where it gives the determinism. The fallback sentence ("if no `BDK context: <name>` heading appears above, run … first") covers `disableSkillShellExecution` and every host that shows the line verbatim. T23's `export` drops the `!` line for other hosts. No separate `/bdk:inject` skill (rejected: an extra hop with no new capability).
- **Consistency test** (user request): a contract test checks every skill's context lines against the two regexes of `kernel-cli` (the wrapper and the new fallback form). Each line names its own skill, and the set of skills with context lines equals the manifest. Changing the prompt form later therefore means changing one spec block and seeing every place that fails. `.claude/rules/skills.md` names the enforcer.
- **Fragments become prompt keys**: `fragments/decision/lavish` and the new `fragments/decision/ask-user` (R-11, `features.lavish: false`). The default files stay in the plugin's `fragments/`, and a project can extend or replace them like `rules/*`. The fragment's condition lives in the manifest.
- **`bdk ctx startup`** renders `STARTUP_INSTRUCTIONS.md` with the agents table regenerated from the frontmatter (`name`, `model`, `description`) of every file in `agents/` (P11). A content test keeps the committed file byte-identical to the output.
- **Content hooks**: `bdk hooks session-start` prints STARTUP. In a BDK project it also runs the configuration check and v2 layout detection, one process instead of three, and reports problems as content. `bdk hooks skill-exists <name>` replaces `is-skill-exist/check.py` in `commit`'s frontmatter. `hooks.json` carries one SessionStart command in the `|| echo "BDK STOP..."` wrapper, no `python3` and no Stop hook (Q-6).
- **`ctx role` removed** (**BREAKING** on the contract; T02 decision Q-3): roles are skills, and `dispatch build` (T23) embeds the role body.
- **Deleted**: `scripts/inject.py`, `scripts/inject-rules.py`, `scripts/inject-language-rules.py`, `scripts/kernel_settings.py`, `hooks/is-skill-exist/`, `hooks/check-rules-drift/` and their pytest tests. They lose their last caller here, as `get_settings.py` did in T12.

Resolutions of the plan's "To resolve in the spec" (details and alternatives in design.md):

- **Fragments**: they become prompt keys with plugin default files in `fragments/` (not moved into a `prompts/` directory of the bundle), so they resolve and are overridden exactly like `rules/*`.
- **Adapter frontmatter for the table**: `name`, `model` and `description`, the fields every agent already has (`skill-check` `require-model`). No new field. One table replaces the two hand-written ones, and it still holds when T42 shrinks the 13 agents to five adapters.

Further decisions made here (design.md): a removed v2 key does not change `ctx skill` output (the acceptance signal; `config check` and `session-start` report it), while an unknown key or an invalid value is a STOP block. `hooks session-start` and `ctx startup` run outside a git work tree and print only STARTUP there, so a session in a non-repository directory never shows a STOP line.

Inputs carried by citation: design "Configuration (A-warstwy, R-format, D4, B7-B10)", "CLI contract" (inject mode, wrapper form), "Skill inventory", "Hooks (V1-1, V1-2)", "Constraints & NFRs" (SPOF row); decision register Q3, V1-5, P11, T6, R-11; T02 decisions Q-3, Q-6 (docs/V3-SKILL-INVENTORY.md); T04 (`v3-t04-drop-tool-tiers`); T03 / ADR-0001; HOST-FACTS `wrapper`, `wrapper-old-rule`, `allowed-control`; `docs/INJECTION-FLOWS.md`; `.claude/rules/fragment-system.md`; host survey of 2026-09-26 (Agent Skills specification, Claude Code skills docs on `disableSkillShellExecution`, Gemini CLI, OpenCode, Codex, Cursor, Copilot).

Out of scope:

- Rules by ID filtered by `applies` and `roles`, and rule content changes (T31). T13 reads rule sets by file.
- `bdk export --host` and rewriting the context line for other hosts (T23). T13 only fixes the one-line shape that makes the rewrite mechanical.
- `hooks session-end`, `prompt-expansion` and `pre-tool` (T24). `next` (T21).
- Rewriting skill content, the stage skills and the five adapters (T41, T42).
- Deleting `scripts/bdk_run_state.py`, `scripts/sentinel-echo.py` and `hooks/is-command-exists/`, which still have callers or belong to the Python cut (T32).
- Bumping `bdk-skill-kit` to v0.2.1 (separate change).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `kernel-cli`: Output modes: `ctx role` leaves the inject-mode list and the wrapper regex, and a new `content-fallback` regex defines the fallback sentence. Invocation: `ctx startup` and `hooks session-start` are standalone outside a git work tree. The error-code table drops `ctx role`.
- `kernel-cli/ctx`: `ctx skill` (manifest, parts, section format, removed-key rule) and `ctx startup` (generated agents table) rewritten, `ctx role` removed.
- `kernel-cli/hooks`: `hooks session-start` and `hooks skill-exists` are owned by T13, with their behaviour (STARTUP, config problems and layout as content, standalone outside a repository; search roots of `skill-exists`).
- `kernel-architecture`: the `ctx` slice without `role`, and the `hooks` slice with owners T13 and T24.
- `kernel-settings`: the prompt keys `fragments/decision/lavish` and `fragments/decision/ask-user`.
- `plugin-tooling`: context reaches skills only through `ctx skill`; the injection scripts and Python hooks are gone; SessionStart runs `hooks session-start`; STARTUP is rendered by `ctx startup`; the skill context lines have a consistency test.

## Impact

- New: `kernel/src/ctx/` handlers, use cases and manifest (`use-cases/manifest.ts`), `kernel/src/hooks/` (`session-start`, `skill-exists`), `fragments/decision/ask-user.md`, the skill context contract test, `.claude/rules/skill-context.md` (replacing `inject-fragments.md` and `fragment-system.md`).
- Changed: `kernel/src/registrations.ts`, `kernel/src/ctx/config.ts`, `schema/cli/commands.json`, `schema/cli/output/ctx.json`, `schema/cli/output/hooks-session-start.json`, `schema/cli/output/hooks-skill-exists.json`, `dist/bdk.mjs`, `hooks/hooks.json`, `STARTUP_INSTRUCTIONS.md`, the skills listed above, `fragments/decision-tier/lavish.md` (moved to `fragments/decision/lavish.md`), `skill-check.baseline.json` (pruned), `.claude/rules/skills.md`, `docs/INJECTION-FLOWS.md`, `docs/guide/` pages on hooks and injection, `README.md`.
- Deleted: the Python scripts and hooks named above and their tests under `tests/unit/`.
