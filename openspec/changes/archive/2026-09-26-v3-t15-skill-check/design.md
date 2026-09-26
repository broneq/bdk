# Design

## Context

See proposal.md, Why. Current state:

- 24 v2 skills in `skills/`. 14 of them carry `!` blocks that call `python3 ${CLAUDE_PLUGIN_ROOT}/scripts/inject*.py`, which is not the kernel wrapper. Several exceed S1 (`docs/V3-SKILL-INVENTORY.md` section 3.1) or name models in prose (SF-7). The v2 agents in `agents/` are full agents, not adapters.
- `.claude/skills/skill-lint` (22 checks) and `agent-lint` (17 checks) are model-judged and run only on request. T02 section 9 classified every check once as CI, dev-time or dropped. This design follows that table and does not reopen it.
- The kernel toolchain from T11 is already in place: TypeScript strict, esbuild bundle committed to `dist/`, Vitest projects `unit` / `e2e` / `contract`, ESLint, Prettier, knip, husky with lint-staged, commitlint and release-please. CI has a `skill-check` job that is a passing stub (`kernel-architecture`, CI pipeline).
- The marketplace (`.claude-plugin/marketplace.json`) already lists one external plugin by github source, `broneq/git-identity`. That repository is a TypeScript plugin with its own CI and release-please. The kit copies this pattern.
- Host facts, verified 2026-09-25 against code.claude.com:
  - **Skills reference:** the field list includes `when_to_use`, `arguments` and `background`. `description` plus `when_to_use` are truncated at 1,536 characters. Unknown fields are ignored without an error.
  - **Sub-agents reference:** the field list is known, and plugin agents ignore `hooks`, `mcpServers` and `permissionMode`.
  - **Plugins reference:** a plugin with a `bin/` directory is not installed on claude.ai or Cowork.
  - **Agent Skills specification:** six fields, `name` limited to 1-64 characters in `[a-z0-9-]` without edge or double hyphens, `description` limited to 1-1024 characters, and a recommendation of fewer than 500 lines.
  - `skill-lint` check 11 is outdated: it still calls `arguments` invalid and does not know `when_to_use`.

## Goals / Non-Goals

**Goals:**

- One deterministic pass tells an author, a pre-commit hook and CI the same thing, with a rule ID per finding.
- BDK does not restate a spec it checks against: the wrapper regex and its permission pair are read from `kernel-cli`.
- Rule logic and rule tests live in one place, the kit. BDK holds only data: targets, options, baseline.
- The authoring guidance an agent reads and the rules CI enforces are one catalogue. Every checkable guideline has a rule, and every rule is explained in the guidance.
- v2 content does not block v3 work, and it cannot grow new violations.

**Non-Goals:**

- Heuristic or model-judged checks (T02 dev-time rows). They are authoring guidance in the kit's `skill-authoring`, not rules.
- Autofix. The checker reports and never edits.
- Validating hooks, `plugin.json` or `marketplace.json`. `claude plugin validate` owns those.

## Decisions

### D-1 Distribution: a plugin repository with committed bundles, consumed by git tag

Repository `broneq/bdk-skill-kit` (user decision on the name and on marketplace distribution) is a Claude Code plugin laid out like `git-identity`. The TypeScript sources in `src/` are bundled by esbuild into two committed files:

- `dist/skill-check.mjs`: the CLI.
- `dist/index.mjs`: the library for configs and plugins, with `dist/index.d.ts`.

CI guards both files with `git diff --exit-code dist/`. `package.json` declares `bin: { "skill-check": "dist/skill-check.mjs" }`, `exports` for the library, and no `prepare` or `postinstall` script. BDK therefore installs it as `"bdk-skill-kit": "github:broneq/bdk-skill-kit#v0.1.0"` and runs `skill-check` with no build step. The BDK marketplace gets an entry with `source: { source: "github", repo: "broneq/bdk-skill-kit" }`, unpinned like `git-identity`. The skills of the plugin run the CLI as `node "${CLAUDE_PLUGIN_ROOT}/dist/skill-check.mjs"`.

Alternatives:

- **npm package `@broneq/skill-check`.** Normal distribution for non-Claude users, but it needs an npm account, a scope and a token secret. It also duplicates the channel the user chose. It can be added later without changing the contract. Lost for now.
- **`packages/skill-check` in the BDK repository.** Simplest wiring, but it contradicts R-15 (a separate project). It would also ship the checker inside the `bdk` plugin tree. Lost.
- **Plugin `bin/` directory with a bare `skill-check` command.** Nicer to type, but the plugins reference says claude.ai and Cowork refuse to install such a plugin. Lost.

### D-2 Spec home: the kit's own `openspec/specs/skill-kit`

The kit's contract is a living spec in an OpenSpec root inside the kit repository, `openspec/specs/skill-kit/spec.md`, next to the code it specifies (user decision during apply). Later kit changes run as OpenSpec Changes in the kit, so a new rule, its fixture, its guideline in `skill-authoring` and its catalogue row land in one PR of one repository. The kit is a public, standalone package whose README points at that spec. BDK keeps only what is BDK's: `skill-content-checks` (BDK's rule settings, config, baseline, CI and pre-commit), which cites the kit's spec at a release tag. The kit's spec entered as a baseline living spec when the kit repository was created, so this Change carries no `skill-kit` delta.

Alternative: the spec in BDK's `openspec/specs/skill-kit`, as first proposed. BDK is the planning home of the BDK family and one T15 Change could have archived everything. But every kit change would then need a PR in two repositories, the spec could drift from the code it lives apart from, and an outside contributor would have to open a Change in BDK. Lost.

### D-3 Kit toolchain mirrors BDK's

The kit uses the same tools and pinning policy as BDK T11 (D-2 of `v3-t11-kernel-skeleton`): exact versions, frozen `pnpm-lock.yaml`, TypeScript strict, Vitest with coverage thresholds 90 / 90 / 90 / 85, ESLint type-aware, Prettier, knip, commitlint, actionlint, husky with lint-staged, and release-please with `release-type: node`, which bumps `package.json` and `.claude-plugin/plugin.json`. The only bundled runtime dependency is `yaml` (with positions, for line numbers). `engines.node` is `>=22.18.0`, the first 22.x line where type stripping is on by default, so a `.ts` config or plugin loads with a plain dynamic `import()`. CI matrix: 22.18, 24, 26. The kit's CI also runs `skill-check --portable` over the kit's own `skills/` (dogfooding).

Alternative: `node --test` and Biome, as `git-identity` uses. One toolchain across the BDK family costs less to maintain than two. Lost.

### D-4 Core model: targets, documents, rules, plugins

- **Target.** A config entry `{ kind: "skills" | "agents", dirs: string[], profile: "claude-code" | "portable", options }`.
  - A `skills` target finds every `<dir>/<name>/` that holds a `SKILL.md`, and also every subdirectory with a `*.md` file but no `SKILL.md`, which becomes a `skill-file-name` finding.
  - An `agents` target reads every `<dir>/*.md` file.
  - `--portable` on the CLI forces the portable profile on every target.
  - Positional path arguments narrow the run to those skill directories or agent files, but project rules still see every target.
- **Document.** A parsed file:
  - frontmatter as a YAML map with a line for each key;
  - body lines with 1-based file line numbers;
  - a mask of fenced code blocks, for rules that check prose only;
  - for skills, the list of files in the skill directory.
- **Rule.** `{ id, kinds, defaultSeverity, check(doc, ctx) => Finding[] }`, or a project rule `checkProject(docs, ctx)` (used by `unique-names`). The IDs of generic rules are bare, like `name-format`. A plugin's rule IDs are `<plugin>/<rule>`, like `acme/house-style`.
- **Finding.** `{ rule, severity: "error" | "warning", file, line, message, fingerprint }`.
- **Plugin.** A module whose default export is `definePlugin({ name, rules })`.
- **Config.** `skill-check.config.{ts,mjs,js}` at the working directory, or `--config <path>`, whose default export is `defineConfig({ targets, plugins, rules, baseline })`. `rules` maps an ID to `"off" | "warning" | "error"` or `[severity, options]`. Any of these is a config error (exit 2): a config that names an unknown rule ID, a target dir that does not exist, or a plugin that fails to load.

Alternative: a JSON config with plugins named by package. JSON cannot hold a regex or a function, BDK's plugin is a local file, and a `.ts` config is type-checked by the project that owns it. Lost.

### D-5 Generic rule catalogue

The sources are T02 section 9 rows classed "CI", BMAD `validate_skills.py`, the Agent Skills specification and the host references. "S" means skills and "A" means agents.

| ID                         | Kind | Checks                                                                                                                                                                                                                                                                 | Default         | Source                                     |
| -------------------------- | ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- | ------------------------------------------ |
| `frontmatter`              | S, A | file opens with `---`, block closes, YAML parses to a map                                                                                                                                                                                                              | error           | skill-lint 1, agent-lint 1, BMAD SKILL-02  |
| `name-format`              | S, A | `name` present, 1-64 chars, `^[a-z0-9]+(-[a-z0-9]+)*$`; option `prefix` (a required prefix such as BMAD's `bmad-`)                                                                                                                                                     | error           | skill-lint 9, agent-lint 8, spec, SKILL-04 |
| `name-matches-dir`         | S    | `name` equals the directory name                                                                                                                                                                                                                                       | error           | spec, SKILL-05, skill-lint 17              |
| `skill-file-name`          | S    | a skill directory holds `SKILL.md` with that exact case                                                                                                                                                                                                                | error           | skill-lint 17, SKILL-01                    |
| `description`              | S, A | present, non-empty, length within `max`. The claude-code profile counts `description` + `when_to_use` against 1,536; the portable profile counts `description` against 1,024                                                                                           | error           | skill-lint 10, agent-lint 9, spec, host    |
| `description-front-loaded` | S    | first sentence does not open with filler (`This skill`, `A skill`, `Skill for`, `Helps`, `Used to`); description holds a trigger clause matching option `trigger` (default `\bUse (when\|for\|on\|if\|whenever)\b`, case-insensitive)                                  | warning         | plan scope, SKILL-06                       |
| `fields`                   | S, A | every frontmatter key is in the profile's list (D-6); agents: `hooks`, `mcpServers`, `permissionMode` are errors with the plugin-restriction message                                                                                                                   | error           | skill-lint 11, agent-lint 10, 10a, R-1     |
| `field-values`             | S, A | `effort` enum; `context` only `fork`; `shell` only `bash` / `powershell`; boolean fields boolean; `compatibility` <= 500; `metadata` a map of strings; agents: `tools` / `disallowedTools` a comma string or a list of tool patterns (`Name`, `Name(...)`, `mcp__...`) | error           | skill-lint 12, agent-lint 11, spec, host   |
| `invocation`               | S    | `disable-model-invocation: true` together with `user-invocable: false` (dead skill) is an error; `agent` without `context: fork` is a warning                                                                                                                          | error / warning | skill-lint 13, 14                          |
| `require-model`            | A    | `model` present                                                                                                                                                                                                                                                        | off             | agent-lint 2                               |
| `body`                     | S, A | non-empty body after frontmatter                                                                                                                                                                                                                                       | error           | SKILL-07                                   |
| `line-limit`               | S    | `SKILL.md` line count <= option `max` (default 500)                                                                                                                                                                                                                    | error           | spec, S1                                   |
| `absolute-paths`           | S, A | no `/Users/`, `/home/`, `/root/`, `/opt/`, `/var/`, `/tmp/`, `~/`, drive letters; `${VAR}/...` is fine                                                                                                                                                                 | error           | skill-lint 3, agent-lint 3                 |
| `model-names`              | S, A | no model family name or model ID in the body (option `names`, default the Claude, GPT and Gemini families); frontmatter `model` is exempt                                                                                                                              | error           | P11                                        |
| `arguments-typo`           | S, A | no `$ARGUMENT` without the `S`                                                                                                                                                                                                                                         | error           | skill-lint 15, agent-lint 12               |
| `references`               | S    | every relative link or backticked path from `SKILL.md` into the skill directory resolves; a referenced file that itself links deeper into a third file is a warning (spec: one level deep)                                                                             | error / warning | spec, user request                         |
| `unused-files`             | S    | every file in the skill directory is referenced from `SKILL.md` or from a file `SKILL.md` references                                                                                                                                                                   | error           | skill-lint 19                              |
| `layout`                   | S    | top-level entries of the skill directory are in option `allowed` (default: any)                                                                                                                                                                                        | error           | skill-lint 20                              |
| `unique-names`             | S    | skill names unique across all `skills` targets (project rule)                                                                                                                                                                                                          | error           | plan scope                                 |
| `cli-front`                | S    | D-8                                                                                                                                                                                                                                                                    | error           | R-13                                       |

`fields`, `field-values` and `invocation` replace skill-lint checks 11-14 with the current host lists. skill-lint 11's ban on `arguments` is gone, because the skills reference now defines `arguments`. skill-lint 2 (a skill `model` field as a warning) is not ported as a skill rule: a skill that omits `model` inherits the session model by design, and the portable profile forbids the field. T02 section 9 marks it CI "frontmatter only". This design keeps that intent through `require-model` for agents and records the deviation for skills here.

### D-6 Profiles hold the host field lists as data

- `portable`: `name`, `description`, `license`, `compatibility`, `metadata`, `allowed-tools` (Agent Skills specification). The profile applies to skills only. An `agents` target in the portable profile is a config error, because the standard defines no agents.
- `claude-code`, skills: the portable six plus `when_to_use`, `argument-hint`, `arguments`, `disable-model-invocation`, `user-invocable`, `disallowed-tools`, `model`, `effort`, `context`, `agent`, `background`, `hooks`, `paths`, `shell`.
- `claude-code`, agents: `name`, `description`, `tools`, `disallowedTools`, `model`, `maxTurns`, `skills`, `memory`, `background`, `omitClaudeMd`, `effort`, `isolation`, `color`, `initialPrompt`, `experimental`. `hooks`, `mcpServers` and `permissionMode` are known but plugin-ignored, so they are reported with that reason.

Each list lives in one source file with the date and the URL it was read from. A host adding a field is a one-line kit release.

Alternative: accept unknown fields with a warning, because the host ignores them. A typo such as `disable-model-invokation` then silently disables nothing, and that is exactly the class of silent failure A3 exists for. Lost.

### D-7 Baseline: fingerprinted, prune-only, stale entries fail

The baseline is a JSON file (config `baseline` or `--baseline`) with the entries `{ rule, file, fingerprint }`. A fingerprint is a hash of the rule ID, the file path and the normalised text that triggered the finding. It is not a line number, so edits above a finding do not invalidate it. A run:

1. suppresses findings that match an entry;
2. reports every entry that matches no finding as a `baseline-stale` error, so a fixed violation must also leave the baseline;
3. never suppresses a finding of a file that is not already in the baseline.

`--baseline-init` writes the file and refuses when it already exists. `--baseline-prune` removes stale entries and never adds any. As a result the baseline can only shrink without a hand edit, and a hand edit shows in review.

Alternatives:

- **Per-path `ignore` globs in the config.** A glob exempts the whole file from every rule, so a v2 skill could gain new violations unseen. Lost.
- **`--update-baseline` that also adds entries**, as ESLint suppressions do. One flag would then silence a new violation. Lost.

### D-8 The CLI-fronting rule (R-13)

A skill declares that it fronts a CLI with `metadata: { fronts-cli: "<command>" }`. `metadata` is a standard field, so the declaration is portable. `cli-front` requires:

- a model-invocable skill (no `disable-model-invocation: true`);
- `SKILL.md` of at most 30 lines;
- at least one mention of `<command> ... --help`;
- no usage documentation, which is detected in two ways:
  - more than 3 distinct `--flag` tokens other than `--help` and `--json`;
  - or a Markdown table or definition list whose rows start with a flag or a subcommand of `<command>`.

The thresholds are options of the rule. The authoring skill explains the pattern: when to reach for the tool, the one invocation form, `--help` as the source of truth.

Alternative: detect a CLI-fronting skill by prose, such as a skill whose body is mostly one command. That is heuristic, which A3 excludes, and it cannot tell a fronting skill from a workflow skill that runs a tool. Lost.

### D-9 Output and exit codes

- **Human format (default):** one line per finding, `file:line  severity  rule  message`, then a summary line. When `GITHUB_ACTIONS` is set, the human format also prints `::error file=...,line=...::` annotations (BMAD's behaviour).
- **`--json`:** `{ version, findings: Finding[], baseline: { suppressed, stale }, summary: { files, errors, warnings } }`.
- **Exit codes:**
  - 0 when there is no error-severity finding (warnings allowed);
  - 1 when there is at least one error, a stale baseline entry, or a warning under `--strict`;
  - 2 on a usage or config error, with the reason on stderr.

Alternative: BMAD's severity ladder CRITICAL / HIGH / MEDIUM / LOW with `--strict` at HIGH+. Two levels plus per-rule overrides express the same thing with less to explain. Lost.

### D-10 BDK conventions as options of generic kit rules

The BDK conventions of `skill-content-checks` are settings of generic kit rules (kit `v0.2.0`), not a BDK plugin. Each kit rule takes the BDK-specific part as an option:

| BDK convention                  | Kit rule shape                                                                  | Source                             |
| ------------------------------- | ------------------------------------------------------------------------------- | ---------------------------------- |
| Kernel wrapper form             | `!` blocks must match a `pattern` (in code fences too); no pattern forbids them | `kernel-cli` Invocation, V1-5      |
| Wrapper permission              | a skill with a `!` block lists every `require`d `allowed-tools` entry           | HOST-FACTS `allowed-control`       |
| No MCP tools, language commands | forbidden terms, anywhere or only in code, with per-term exempt names           | T03, skill-lint 6, agent-lint 6    |
| User-only and read-only gates   | named skills must set a field to a value or include listed entries              | T1, P9, skill-lint 22 fixed list   |
| Adapter shape                   | an agent body of at most N lines and N sentences, ending with a period          | plan scope (adapters)              |
| Portable craft skills           | the portable profile rejects `!` blocks and `${CLAUDE_*}` variables             | R-1 criterion                      |
| Namespaced references           | bare references to names of the checked targets must carry a `namespace`        | skill-lint 8, 16, agent-lint 7, 14 |

The final rule IDs and option shapes are the kit's (`openspec/specs/skill-kit` at `v0.2.0`). The kit tests every rule with unit tests and a seeded fixture, and rejects a malformed option with exit 2.

`skill-check.config.ts` reads the ` ```regex content-wrapper ` block and the `allowed-tools` pair from `openspec/specs/kernel-cli/spec.md` when it loads and passes them as options. A missing block fails the load, so the run exits 2 naming the spec.

Alternatives:

- **A BDK plugin in `tools/skill-check/` with its own unit tests, fixtures and a parity test** (first implementation). It re-tests in BDK what is the kit's job, and the kit exists to keep that separation. Lost (user decision).
- **The BDK plugin moved into the kit as it is.** The kit would then carry BDK's gate names, prefix and wrapper, and stop being generic. Lost.
- **A regex constant in the config plus a parity test against the spec.** Two copies and a test to keep them equal. Reading the spec removes the copy; a layout change in the spec fails loudly with exit 2 instead of drifting. The cost is a few milliseconds of Markdown parsing per run. Lost.

### D-11 BDK configuration

`skill-check.config.ts` at the repository root declares:

- target `skills` over `skills/` in the claude-code profile;
- target `agents` over `agents/`, with the adapter shape on;
- the rule settings of D-10, with the wrapper regex and pair read from `kernel-cli`;
- baseline `skill-check.baseline.json` at the repository root.

Overrides against the generic defaults:

- `line-limit` 200 (S1);
- `description` 250, BDK's listing budget (`.claude/rules/skills.md`), kept below the host cap of 1,536;
- `description-front-loaded` at error;
- `require-model` on for agents;
- `layout.allowed` = `references`, `examples`, `scripts`, `assets` (without v2 `fragments/`, which dies with `inject.py`; v2 skills that still use it sit in the baseline).

The `bdk-craft` target (portable profile) is added by T42 together with its directory. The kit's fixtures prove the portable profile.

Alternative: create an empty `craft/skills/` now so that the real config carries the target. That is a directory whose location T42 decides, created only to satisfy a config. Lost.

### D-12 Seeded violations live in the kit

BDK carries no fixtures and no rule tests. The kit's CI runs a seeded-violation fixture per rule, plus the coverage test that fixture names equal the rule catalogue, on every commit and tag. BDK pins only a tag with a green run.

This departs from the plan's acceptance wording, "BDK's CI … fails on a seeded violation of each rule" (user decision): the seeded run is the kit's CI at the pinned tag, and BDK's CI runs that tag over BDK's tree.

Alternative: one seeded-violation test in BDK. It re-tests the kit in BDK, which the separation exists to avoid. Lost.

### D-13 CI and pre-commit

- **CI.** The `skill-check` job replaces its stub. It sets up pnpm and Node from `.nvmrc`, runs `pnpm install --frozen-lockfile` and `pnpm skill-check` (`skill-check` with the root config).
- **Pre-commit.** lint-staged gets `"{skills,agents}/**": () => "pnpm skill-check"`. The function form runs one whole-tree check, because `unique-names`, `unused-files` and `references` need the whole tree and not only the staged files. The run takes well under a second.

Alternative for the pre-commit hook: pass only the staged files. Project rules would then see a partial tree. Lost.

### D-14 The two skills of the kit

- **`skill-check`.** Portable fields: `metadata.fronts-cli: skill-check`, `allowed-tools: Bash(node ${CLAUDE_PLUGIN_ROOT}/dist/skill-check.mjs *)`. At most 30 lines. Says when to run the checker (before committing a skill or agent, when a CI finding names a rule ID), gives the one invocation form and points at `--help`. It passes its own `cli-front` rule.
- **`skill-authoring`.** Portable fields and model-invocable (a description with triggers such as writing, splitting or reviewing a skill). At most 200 lines in `SKILL.md`, with worked detail in `references/`:
  - `frontmatter.md`: fields per profile;
  - `structure.md`: layout, references, progressive disclosure;
  - `process-vs-knowledge.md`: the T02 test and the R-6 admission rule;
  - `cli-fronting.md`: R-13.

  Each guideline that a rule checks ends with the rule ID in backticks. A kit test asserts that the set of generic rule IDs in the catalogue equals the set of IDs cited in `skill-authoring`, so a rule without guidance, or guidance that cites a missing rule, fails the kit's CI. BDK-specific conventions are in BDK's `.claude/rules/skills.md`, which points at `skill-authoring` for everything generic.

  From `v0.2.0` the skill also holds the generic Claude Code authoring knowledge BDK's rules used to carry: string substitutions, no tool guidance in prose, subagent dispatch, skill-scoped hooks, sharing files across skills, portability of reusable skills, and the read-only statement of agents.

Alternative: the authoring guidance in `bdk-craft` (T42). The guidance and the checker would then ship in different plugins, and the sync test would cross repositories. Lost (user decision to put it in T15 and in the kit).

### D-15 Dev-time lints removed, rules reduced to BDK

`.claude/skills/skill-lint` and `agent-lint` are deleted. Their judgment checks (project-specific references and phrasing, stated tool invariants, read-only agents) are generic authoring guidance and move to the kit's `skill-authoring`. `.claude/rules/skill-creation-rules.md` and `skill-structure.md` merge into `.claude/rules/skills.md`, which holds only BDK conventions and points at `/bdk-skill-kit:skill-authoring`. The `inject.py` details move to `.claude/rules/inject-fragments.md`. That leaves one owner per piece of guidance.

Alternative: keep the lints with only the judgment checks (first implementation). They restate what `skill-authoring` teaches. Lost (user decision).

## Risks / Trade-offs

- [The host adds or renames a frontmatter field and the kit reports a valid field as unknown] → The field lists are one dated file (D-6), and the error message names the profile and the URL to recheck. A fix is a patch release plus a tag bump in BDK.
- [Fingerprints collide or break when the triggering text is reworded] → A reworded violation shows up as new plus stale. That is the intended outcome: a touched v2 violation must be fixed or re-baselined visibly.
- [Git-tag dependencies cannot be updated by Dependabot as easily as npm ones] → The kit is BDK's own. A kit release PR is followed by a one-line tag bump in BDK, and the fixture test catches a behaviour change.
- [`.ts` config needs Node >= 22.18] → Only the `skill-check` job and the pre-commit hook load it; the job uses `.nvmrc`.
- [The config depends on the Markdown layout of the kernel-cli spec] → A missing block fails the load with exit 2 naming the spec, so a layout change cannot pass silently.
- [BDK's option values (gate names, command lists) have no test in BDK] → The kit validates option shapes (exit 2). A wrong value such as a misspelled gate name is caught only by review.
- [`description-front-loaded` filler list and trigger regex are English-only] → They are options. The authoring skill states the convention. Projects in other languages override the option.
- [The `!` detection in code fences flags documentation examples] → No BDK skill has a reason to show a `!` block example. A skill that must can write the example indented, without the leading `!` at column 0.
- [Creating a public repository is outward-facing] → The repository is created and `v0.1.0` is cut only after the user confirms during apply.

## Migration Plan

1. Build the kit in a fresh local repository `bdk-skill-kit`, with tests green and the bundles committed.
2. With the user's confirmation, create `broneq/bdk-skill-kit`, push, let CI pass and tag `v0.1.0` (release-please or a manual first tag).
3. In BDK:
   1. add the devDependency;
   2. add the config with the rule settings;
   3. generate the baseline over the v2 tree with `--baseline-init`;
   4. switch the CI step and add the pre-commit hook;
   5. add the marketplace entry;
   6. remove the lints and reduce the rules to BDK (D-15).

Rollback: revert the BDK commits. The CI step returns to the stub. The kit repository can stay; nothing in BDK's runtime depends on it.

## Open Questions

- Whether the kit's first release goes through release-please's initial PR or a manual `v0.1.0` tag. This affects only the order of steps 2 and 3.
