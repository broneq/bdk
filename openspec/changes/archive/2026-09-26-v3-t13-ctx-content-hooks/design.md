# Design

## Context

See proposal.md, Why. After T12 the kernel has `shared/config` (registry, two-pass validation, prompt values resolved across the layers from a plugin default file), the `config` and `service` slices, and a `ctx` slice with modules and prompt keys but no handler (`kernel/src/ctx/config.ts`). A record opts out of the git work tree through `standalone: true` in `schema/cli/commands.json` (`shared/registry/run.ts`); only `version` uses it. `node:fs` is allowed only in `shared/store`, `shared/config` and `shared/git` (import scan), so a slice reads files through the `Store` port or through `shared/config` (`pluginRoot` from `pluginRootOf(import.meta.url)`). v2 layout detection (`classifyLayout`, `V2_MARKERS`) lives in `service/domain/layout.ts`. `schema/cli/commands.json` still holds a `ctx-role` record, and `schema/cli/output/ctx.json` a parts `kind` enum from T10.

Skills carry four kinds of `!` blocks today: `inject.py --if` (fragments), `inject-rules.py`, `inject-language-rules.py`, `config show tools.<kind>` wrappers (T12, D-14) and `cat` of plugin files. `skill-check` (T15) enforces the wrapper form of kernel blocks from the `content-wrapper` regex in `kernel-cli` and holds 32 `block-form` and 10 `block-allowed-tools` baseline entries, all for the Python blocks.

User decisions taken while writing this Change (2026-09-26, Lavish review `.lavish/v3-t13-injection.html` and AskUserQuestion):

- Q1 = E: the model-run command is the portable base, the `!` line is the Claude Code accelerator.
- Q2: one context block per skill with headed sections; prose points to sections.
- Q3 = M1: a typed manifest in the kernel.
- A content test proves every skill calls its context the same way, and a `.claude/rules/` file names it.

## Goals / Non-Goals

**Goals:**

- One place (the manifest) decides what context a skill gets; one spec block decides how a skill asks for it.
- A skill loaded on any host either has its context or knows the one command that gives it.
- Session start never blocks and never shows a STOP line for a configuration problem.

**Non-Goals:**

- Changing the content of any rule, fragment or skill (T31, T41, T42).
- Host-specific rewriting of the context lines (T23 `export`).
- A generic condition language for fragments; T13 has one fragment and one condition.

## Decisions

### D-1 Delivery: model-run command as base, `!` line as accelerator (Q1 = E)

Each skill that needs context starts its body with two lines: the `!` line in the `content-wrapper` form calling `ctx skill <own-name>`, and a fixed fallback sentence matching the new `content-fallback` regex ("If no "BDK context: <name>" heading appears above, run `node "${CLAUDE_PLUGIN_ROOT}/dist/bdk.mjs" ctx skill <name>` first ..."). On Claude Code the `!` line pre-renders, the heading appears, and the model skips the sentence. Under `disableSkillShellExecution` the line becomes `[shell command execution disabled by policy]`, the heading is missing, and the model runs the command itself. On hosts that load `SKILL.md` verbatim (Codex, Cursor, Copilot) the same happens; T23's `export` drops the `!` line there, so the sentence stays.

Alternatives: A, `!` only (today's shape; Claude Code only, silent loss under the policy switch); B, command only (portable and the Agent Skills standard, but loses the determinism Claude Code gives for free); C, a `/bdk:inject` skill the model calls (an extra hop and a skill in the listing with no capability beyond B); D, a SessionStart or UserPromptSubmit hook that injects per skill (hooks do not know which skill is loading, and other hosts have no such hook). E keeps A's determinism where it exists and B's portability everywhere. Lost: A, B, C, D.

### D-2 One context block per skill with headed sections (Q2)

`ctx skill <name>` prints `## BDK context: <name>` and one `### <title>` section per part (`kernel-cli/ctx`, `bdk ctx skill`). Skill prose at a step says "apply the `Rules: security` section of the BDK context" instead of carrying its own `!` block. The heading doubles as the presence marker the fallback sentence tests.

Alternatives: one `ctx skill <name> --section <id>` call per step (keeps today's twelve blocks per skill and twelve places to change); named sections the prose fetches lazily (the model decides when to fetch, so context becomes non-deterministic). Lost.

### D-3 The manifest is typed code in the kernel (Q3 = M1)

`kernel/src/ctx/use-cases/manifest.ts` exports a `const` object keyed by skill name (a use case of the slice, so it may read the slice's `config.ts`; the slice anatomy has no other place for it). Each entry is an ordered list of parts, a discriminated union: `{ kind: "rules", category }`, `{ kind: "language-rules" }`, `{ kind: "fragment", id: "decision" }`, `{ kind: "tools", group }`, `{ kind: "file", path, title }`. The type makes an unknown part kind or tools group a compile error; the content test (D-10) checks what the type cannot: that every `rules/<category>` is a declared prompt key with a plugin default, every `file` exists, and the set of entries equals the set of skills with context lines. The bundle carries the manifest, so a skill never names what it needs and cannot drift from what it gets.

Alternatives: M2, frontmatter in each `SKILL.md` (`bdk-context: [rules/security, tools/test]`; the kernel would parse skill files at every call, and the host's frontmatter validators may reject unknown fields); M3, a YAML file in the plugin validated by zod (a second format and a runtime read for what the build can check). Lost.

### D-4 Fragments are prompt keys with defaults in `fragments/`

`fragments/decision/lavish` and `fragments/decision/ask-user` are declared with `definePromptKey` in `ctx/config.ts` like `rules/*`, with default files `fragments/decision/lavish.md` (moved from `fragments/decision-tier/`) and `fragments/decision/ask-user.md` (new; the `AskUserQuestion` guidance of R-11). A project extends or replaces them through `.bdk/prompts/fragments/decision/*.md` exactly like a rule set. The condition (which of the two) lives in the manifest's `fragment` part, implemented as one function in `ctx/use-cases/`: `features.lavish` true and an executable `lavish-axi` on `PATH` gives `lavish`, otherwise `ask-user`. The `PATH` probe goes through a new `Runtime.which(name)` bound in `main.ts` (the `node:fs` boundary keeps `stat` out of `ctx`), so tests inject it.

Alternatives: move the defaults into a `prompts/` directory of the bundle (one more tree for the same kind of file; the plan's open question, answered "stay files"); keep fragments outside the prompt system with an `if`/`prefer` syntax (a second override mechanism next to prompt values). Lost.

### D-5 `ctx startup` renders between markers; one generated table (P11, T6)

`STARTUP_INSTRUCTIONS.md` gets the markers `<!-- bdk:agents-table -->` and `<!-- /bdk:agents-table -->` in place of the two hand-written tables. `ctx startup` replaces the lines between them with one table built from `name`, `model` and `description` of every `agents/*.md`, sorted by `name`. The markers stay, so the output is again valid input and the committed file equals the output; a content test compares them byte for byte, and `pnpm build` does not rewrite the file (a regeneration is a deliberate `bdk ctx startup > STARTUP_INSTRUCTIONS.md`, which the test failure names). The same task corrects the "Quality Rules" paragraph, which still names `.bdk/settings.json`.

The acceptance signal says "lists the five adapters". T42 shrinks `agents/` to five adapters; until then the table lists the 13 current files. The scenario is "one row per file", which holds in both states.

Alternatives: keep two tables ("directly invokable" and "used by skills") through a new frontmatter field (the plan's open question: no new field, and the split disappears with T42); generate the whole file from a template (the file stops being readable in the repository). Lost.

### D-6 A removed v2 key does not change the context; unknown and invalid keys stop

`ctx skill` resolves configuration as `config show` does, except that pass one of the validation drops `removedKeys` entries silently instead of reporting them. An unknown key and an invalid value are STOP blocks (`policy/unknown-config-key`, `policy/config-invalid`). The acceptance signal needs `ctx skill design` byte-identical with and without `features.code-review-graph`, and a context built from a configuration the user did not mean (a typo in `tools.tests`) is worse than a visible stop. `config check` and `hooks session-start` keep reporting removed keys, so the user still learns about them once per session.

Implementation: `shared/config` gains an option on the resolve entry point (`removed: "ignore" | "report"`), default `report`. No new rule id.

Alternatives: report the removed key as a STOP block (breaks the acceptance signal and stops every skill for a harmless leftover); report it as a content line inside the context (the output differs, and the warning repeats in every skill). Lost.

### D-7 `session-start` and `ctx startup` are standalone; problems are content

Both records get `standalone: true`. `ctx startup` reads only plugin files. `session-start` prints the `ctx startup` text first, then, only when a work tree is found and it has `.bdk/`, runs `config check`'s validation (which refreshes the snapshot and the offline schema copy) and layout detection, each problem as one `[BDK] ...` line (`kernel-cli/hooks`). A STOP block at session start would make the model stop before the user asked anything; a line is visible and the user decides. Only an internal failure is a STOP block, and the shell wrapper covers a missing `node`.

Alternatives: keep three hook commands (three processes and three failure modes, the V1-1 problem); render configuration errors as STOP (see above). Lost.

### D-8 v2 layout detection moves into the `config` slice

`classifyLayout` and `V2_MARKERS` move from `service/domain/layout.ts` to `config/domain/layout.ts`, exported through `config/index.ts`; `service` (`doctor`) imports them from there. A `hooks` -> `service` edge would create a cycle, because `service` depends on every slice (`kernel-architecture`, Dependency matrix). The layout belongs next to configuration anyway: the markers are the v2 settings and state files that `bdk import` converts.

Alternatives: duplicate the marker list in `hooks` (two lists drift); move it into `shared/` (a domain rule in the shared kernel, which holds only infrastructure). Lost.

### D-9 `skill-exists` searches the directory layout only

Search roots: `~/.claude/skills/*/`, `<project>/.claude/skills/*/`, `~/.claude/plugins/marketplaces/*/skills/*/` and `~/.claude/plugins/cache/*/*/*/skills/*/`, matching `SKILL.md` frontmatter `name`. The cache root is new: v2 missed plugins whose marketplace repository holds the plugin in a subdirectory. Directory listing goes through the `Store` port (`list`, `exists`, `read`).

Alternatives: read `~/.claude/plugins/installed_plugins.json` (a host bookkeeping file with no documented schema; it changed shape before); ask the host (no API). Lost.

### D-10 The context lines have a content test; regexes come from the spec

A contract test (`kernel/tests/contract/skill-context.test.ts`) reads the `content-wrapper` and `content-fallback` regexes from `openspec/specs/kernel-cli/spec.md` (the same parser `skill-check` uses for the wrapper, via the fenced block's info string) and checks every `skills/*/SKILL.md` as `plugin-tooling`, Skill context lines, says. Until the archive the test reads the Change's delta, like T12's settings-table test. Negative controls seed a missing fallback, a wrong name and a manifest mismatch. `.claude/rules/skill-context.md` states the invariant in three lines and names the test and `skill-check` as enforcers (routing: the invariant fails silently on other hosts, so it is a rule; the enforcement is one line).

Alternatives: extend `skill-check` with the fallback rule (it lives in another repository, `bdk-skill-kit`, and does not know the manifest); a lint rule only (would not see the manifest). Lost.

### D-11 `cat` blocks become `file` parts

The three `cat` blocks (`cr`, `pr-review`, `bdk-implementer-return-contract`) become `file` parts with the title the manifest gives. The context lines rule allows no other `!` line, so one form covers every skill.

Alternatives: allow `cat` as a second permitted `!` form (a second form for the test and for T23 to rewrite); inline the files into the skills (duplicates text the `cr` references share). Lost.

### D-12 The Python injection path is deleted in T13

`scripts/inject.py`, `inject-rules.py`, `inject-language-rules.py`, `kernel_settings.py`, `hooks/is-skill-exist/`, `hooks/check-rules-drift/` and their pytest tests lose their last caller in this Change, so they go now, as `get_settings.py` did in T12 (T12 D-14). `bdk_run_state.py`, `sentinel-echo.py` and `hooks/is-command-exists/` still have callers and stay for T32. The rule-drift Stop hook is not ported (T02 Q-6).

Alternatives: keep them until T32 (dead code with tests that pass against nothing). Lost.

### D-13 Spec text outside the deltas

The Purpose paragraph of `openspec/specs/kernel-cli/ctx/spec.md` names `role`, and a delta cannot change a Purpose. The apply edits it directly, as T12 task 9.1 did for `kernel-architecture`.

## Risks / Trade-offs

- [The model ignores the fallback sentence on a host without `!`] -> the sentence is the first body line and names the exact command; T23's `export` can add a host-specific instruction; E2E covers Claude Code only, the rest is a manual check at T23.
- [A skill needs context it does not declare] -> content test: every skill with context lines has a manifest entry, and every entry resolves; a skill without lines has none, so review sees the addition in one file.
- [The committed STARTUP drifts from `ctx startup` after an agent edit] -> the byte-identical test fails in `pnpm test:contract` and names the regeneration command.
- [`PATH` probe for `lavish-axi` differs between the session and the `!` subprocess] -> both inherit the host's environment; a false negative gives the `ask-user` fragment, which is safe.
- [`session-start` becomes slower than a `cat`] -> one Node process replaces three; the E2E suite records its duration on the repository fixture, and task 9 checks it stays under one second.
- [Skills migrated with a changed meaning] -> content moves verbatim into prompt defaults and `file` parts; the diff of each skill is only the removed blocks, the two new lines and section references.

## Migration Plan

`staging/v3` may break v2 behaviour (T12 Q1). Order in the apply: contract and schemas, `ctx` slice, `hooks` slice with the layout move, fragments and STARTUP markers, then the skills and `hooks.json` in one step with the Python deletion, so no commit leaves a skill calling a deleted script. Rollback is the revert of the merge commit on `staging/v3`; the committed `dist/bdk.mjs` and `hooks.json` revert together.
