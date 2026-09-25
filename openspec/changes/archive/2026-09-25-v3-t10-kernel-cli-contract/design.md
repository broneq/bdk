# Design

## Context

See proposal.md, Why. The design already decided the shape at outline level: one invocation form (`node ${CLAUDE_PLUGIN_ROOT}/dist/bdk.mjs <args>`, no PATH shim), two output modes (inject from `!` blocks, command from Bash), exit codes 0 / 2 / 3 / 4 / 5, the four-field refusal (`refused`, `rule`, `why`, `instead[]`), `--json` on every command, the <= 100 lines list limit with `--for` and `--all`, the orchestrator-only versus subagent-allowed split enforced by `hooks pre-tool` (T3), and the rule that `source: user` exists only on the `hooks prompt-expansion` path (T1, P1). T01 confirmed the primary gate path (`upe-fires`), so no `stage enter` command is added, and showed the namespaced `command_name` (`upe-name`) the hook must parse.

Constraints on the artifact itself: T11 must be able to read it by machine (every command has a handler or an explicit stub); T15 / R-13 forbid skills from carrying usage documentation, so `bdk <group> --help` and this document must agree; T14 cross-checks the command split; the repository is English-only and em-dash-free; the repository has no Node toolchain yet (T11 adds pnpm, esbuild, Biome), only `node` 24 on the machine and pytest in CI.

## Goals / Non-Goals

**Goals:**
- One place that answers, for every kernel command, "what do I type, who may call it, what comes back, how does it fail" precisely enough for a contract test to be written from it without asking.
- The machine-readable index and the prose cannot drift from each other without a test failing.
- Every cross-cutting rule the skills and hooks rely on (wrapper form, STOP block, exit codes, error shape, split) is stated once, with the exact text a content test can match.

**Non-Goals:**
- Deciding the internals behind a command (store layout, graph semantics, budgets, heuristics); the contract names fields and behaviour at the boundary, the owner task fills the inside.
- Perfect final schemas. Later tasks may amend a command's schema in the same PR that implements it; the test suite and the schema-export diff guard make every amendment explicit.
- Writing kernel code, `--help` text or stubs.

## Decisions

### D-1 Prose in `docs/CLI-CONTRACT.md`, machine data in `schema/cli/`

The document holds the explanations, examples and rules; `schema/cli/commands.json` holds the command index and `schema/cli/output/<command-id>.json` plus `schema/cli/common/*.json` hold JSON Schemas (draft 2020-12). The document references schema files by path; the coverage test checks that every index entry has a document section with the same heading id and vice versa.

Alternatives:
- Everything in one Markdown file with fenced `json` blocks as schemas. Loses `$ref` reuse (the refusal and list shapes repeat in every command), cannot be validated by an IDE or by `openspec`-style tooling, and forces T12's zod export to emit Markdown. Lost.
- Schemas only from zod in T11, contract as prose only. Then nothing machine-readable exists before code, which is the T10 goal; the plan asks for "output schemas next to the prose". Lost.
- `schema/cli/` follows the design's decision that exported schemas are committed under `schema/` (R-format, "Configuration" section); T12's export becomes a reproduction check rather than a new location.

### D-2 Argument grammar: positional discriminators, flags for modifiers

`bdk <group> [<verb>] <positional...> [--flag [value]]`. A mandatory choice that changes the command's meaning is a positional literal (`attempt close A-0007 ok | fail | not-run`, `part done 02`, `ctx skill debug`, `config set --global`), as the design's sequence diagram already writes it. Optional inputs and switches are flags (`--json`, `--for <ref>`, `--all`, `--profile`, `--kind`, `--inferred`). `--skip-verify` is never a CLI flag: it arrives in the hook payload (P2). IDs are positional and never derived from the environment except the active Change, which every command resolves from the current branch. Flags never repeat a positional.

Alternative `attempt close A-0007 --outcome ok`: the outcome is mandatory, so a flag misrepresents it as optional, and `--help` for a required flag is longer to read than three literals. Lost. `attempt close-ok` style verbs: multiplies commands and breaks `attempt close --help`. Lost.

### D-3 One error object for every non-zero exit

Exit 2, 3, 4 and 5 all emit the same four fields: `refused: true`, `rule` (stable id `<class>/<name>`), `why` (one sentence with the concrete values), `instead[]` (>= 1 concrete commands or actions). The class prefix maps to the exit code: `policy/` and `guard/` -> 2, `input/` -> 3, `state/` -> 4 (`instead` always names `bdk rebuild`), `runtime/` -> 5, `kernel/not-implemented` -> 2 (the T11 stub rule). Exit 1 is reserved for an uncaught crash and is a kernel bug by definition; the contract says so and gives it no shape. In text mode the same four fields print as four labelled lines. Every command's index entry lists the command-specific `rule` ids it may emit; the rules every command shares (dispatcher and runtime checks) and the rules every Change-scoped command shares (no active Change, state checks) live once in the index's `base` object, with a `changeScoped` flag per record and `standalone: true` on `version`, the one command that runs without a project or runtime check. A command's `exits` is derived from the classes of that full set, and the contract test asserts the derivation and the catalogue.

Alternatives: a second shape for input errors (`error`, `usage`), as most CLIs do. Two shapes mean two parsers in every skill and in promptfoo rubrics; the design's "refusal shape everywhere" already chose one. Lost. An `ok: true|false` discriminator on every output: adds a fifth field to refusals (the acceptance signal counts four) and duplicates the exit code. Lost.

### D-4 Success output: command-specific object, shared page shape for lists

`--json` success output is a plain object validated by the command's schema; there is no envelope. Lists share `common/list-page.json`: `items[]`, `total`, `truncated`, `for` (the `--for` filter echoed), with the <= 100 lines rule realised as `items.length <= 100` unless `--all`. Text mode renders the same data and obeys the same 100 lines. `show <id>` is the only path to full bodies. Kernel-stamped fields (P1: `id`, `at`, `author`, `source`) appear in outputs and never as inputs; `log add --source user` is `input/forbidden-field`, exit 3, so the T20 acceptance case reads straight off the contract.

Alternative: a uniform envelope `{ok, command, kernel, data}`. It makes every consumer unwrap `data` and duplicates `bdk version`. Lost.

### D-5 Inject mode and the two wrapper forms as exact strings

Inject commands are exactly `ctx skill|role|startup` and `next` (Key boundaries). In inject mode the kernel exits 0 always, prints Markdown, and renders any error as a STOP block with a fixed shape: first line `BDK STOP: <why>`, second line `Instead: <instead joined by "; ">`, then nothing else. The contract publishes one regular expression for the allowed `!` line (content skills) and one for the guard hook line (`|| exit 2`), with the `2>&1` and the `|| echo "BDK STOP: kernel unavailable (exit $?). Install Node >= 22.13 and run /bdk:setup."` text verbatim, so T15's content test and this document match the same string. The minimum Node version in that string comes from HOST-FACTS `node-sqlite-min` (22.13.0); HOST-FACTS `allowed-compound` confirms the compound form is pre-approved by `Bash(node ${CLAUDE_PLUGIN_ROOT}/dist/bdk.mjs *)`.

Alternative: leave the wrapper as guidance and let T15 define the regex. Then two documents own one string. Lost (V1-5 wants one enforced form).

### D-6 Availability classes instead of a two-way split

Each command carries one class: `orchestrator` (main thread only; `hooks pre-tool` denies it to subagents: `commit`, `attempt`, `part`, `change`, `log ingest`, `spec merge`, `hooks`, and the writing `rules` verbs), `agent` (allowed from subagents: `log add`, `log show`, `dispatch show`, `evidence record`, `ctx`), `hook` (callable only through `hooks.json` and skill frontmatter: the `hooks` group; a Bash invocation is denied from every thread, T1 defence in depth), `read` (read-only queries with no guard: `next`, `explain`, `change status`, `change list`, `log list`, `query`, `rules show`, `config show`, `version`, `doctor`). Only the `orchestrator` and `hook` classes are guarded; `read` is unguarded because denying a subagent `bdk version` buys nothing and costs a Node start. This is the table T14 cross-checks against its write map: every command that writes into a Change is `orchestrator`, `agent` or `hook`, never `read`.

Alternative: the design's literal two lists (deny list and allow list) with everything else undefined. Undefined is what a contract must not leave. Lost.

### D-7 Contract version = kernel major

`bdk version --json` returns `{ "kernel": "3.0.0", "contract": 3, "node": "24.21.0" }`. Schema `$id`s are `https://raw.githubusercontent.com/broneq/bdk/<tag>/schema/cli/...` with the directory unversioned (the tag versions it, matching the settings schema modeline decision in "Configuration"). Additive changes (new command, new optional field, new `rule` id) stay within a major; removing or renaming a command, a field or an exit code needs a major bump. The dispatch package frontmatter keeps `kernel-version` as the full semver (P10), because attribution in promptfoo wants the patch level.

Alternatives: a separate contract integer bumped independently. A second version axis nobody else reads; semver majors already encode breaking changes. Lost. Per-command `since` fields: useful once a 3.1 exists, not now; noted as a permitted additive field.

### D-8 Cover the plan-added commands with an owner task per entry

Every command carries `owner: T11 | T20 | ... | T50`. T11 registers all of them; a command whose owner task has not landed is a stub returning `kernel/not-implemented` (exit 2, `instead` names the task). Commands the plan added after T02 (`measure`, `change checkpoint`, `export agents`, the `rules` funnel verbs, `dispatch run`) are in the contract because T11's "every command has a handler or stub" cannot hold for commands the contract does not know.

Alternative: contract only the design's outline and let each task extend the document. Then T11's stub rule is unverifiable and the document has no single moment of completeness. Lost.

### D-9 Headless wave runner is `dispatch run <part> --wave <n>`

The plan names it `bdk execute --wave N` (T23) and `bdk run` (T41). `execute` and `run` are both stage skill names (`/bdk:execute`, `/bdk:run`), and `run` under T02 decision R-9 means autonomy over gates, not process spawning. The runner consumes dispatch packages, so it belongs to the group that builds and shows them; the group becomes `dispatch build | show | run`. Availability `orchestrator`. The plan text in T23 and T41 is aligned in this Change (T10 Resolution paragraph).

Alternatives: a new top-level `wave` group: one more group for one verb. Lost. Keep `execute --wave`: a kernel command named like a user-only skill invites the model to call the wrong one. Lost.

### D-10 Hooks group documented against HOST-FACTS, not the design text

`hooks prompt-expansion` reads `command_name` in the namespaced form `bdk:<skill>` and `command_args` as a raw string (`upe-name`, `upe-fields`); `hooks pre-tool` reads `tool_input.file_path // notebook_path` (`input-notebookedit`) and has no `MultiEdit` case (`input-multiedit`); `hooks session-end` documents that `SessionEnd` also fires after headless runs and never after SIGKILL (`end-headless`, `end-kill`). `hooks stop` is absent (T02 Q-6). Where HOST-FACTS contradicts the design, the contract follows HOST-FACTS and cites the row; the design text is not edited (HOST-FACTS convention).

### D-11 Coverage test in `node:test`, zero dependencies

`tests/contract/cli-contract.test.mjs` uses only `node:test`, `node:fs` and `node:path` and runs with `node --test tests/contract/*.test.mjs`. It checks index <-> document heading parity, schema file existence and JSON validity, `$ref` resolution inside `schema/cli/`, four fields in every refusal example (fenced blocks tagged `json refusal`), availability class, owner and slice present on every entry, slice parity between the index and section 9 (D-13), and that every `bdk <words>` mention in the design's contract-bearing sections and the plan's task scopes resolves to a command id (with an explicit allowlist of prose forms such as `bdk <group> --help`). It does not validate examples against schemas (no validator without a dependency); T11 adds that with zod.

Alternatives: pytest, which CI already runs. Python is cut in T32 and T11 rewrites the test in `node --test`; writing it twice is waste. Lost. A manual checklist in the document: the acceptance signal is a cross-review that has to survive later edits. Lost.

### D-12 Document layout

`docs/CLI-CONTRACT.md` sections, in order: 1 Scope and status (contract version, owner tasks, how to amend); 2 Invocation (the only supported form, active Change resolution, `--json`, `--help`); 3 Output modes (inject vs command, STOP block, the two wrapper regexes); 4 Exit codes and the error object (rule catalogue by class); 5 Conventions (list pages, `--for`, `--all`, `show`, kernel-stamped fields, IDs and cross-Change references, time and hashes); 6 Availability classes and the guard; 7 Command reference, one `###` per group and one `####` per command with a fixed mini-template (Synopsis, Availability, Mode, Arguments, Output, Exit codes and rules, Example, Owner, Slice); 8 Hook payloads (stdin shapes per hook, from `tests/fixtures/host-payloads/`); 9 Kernel architecture (D-13); 10 Coverage table (design mention -> command id). Each `####` heading ends with the command id in braces, `{#attempt-close}`, which is the join key to `commands.json`.

The architecture lives inside the contract document rather than in a separate `docs/KERNEL-ARCHITECTURE.md` (user decision, 2026-09-25): the contract's command index is the architecture's module list, and one document keeps the two from drifting. If section 9 outgrows the rest of the document once the kernel exists, T50's documentation task may split it.

### D-13 Kernel as vertical slices

The kernel source is organised by capability, not by technical layer: one slice per command group of the contract (`change`, `graph`, `part`, `attempt`, `log`, `dispatch`, `evidence`, `spec`, `config`, `ctx`, `rules`, `query`, `commit`, `hooks`, `service`, `measure`, `export`). Every slice owns its full vertical: argument parsing (argv to a typed input), the use case, its own store queries and writes on the Change directory built on shared primitives, text and JSON rendering, the zod output schema that T12 exports to `schema/cli/output/`, and its tests next to the code. Every `commands.json` entry names its `slice`, and the coverage test checks that each slice named in the index appears in section 9 and vice versa.

`shared/` holds only what is an OS boundary or is used by three or more slices: `store` (the single access point of R-store: file IO, frontmatter, SQLite index, rebuild), `git` (child process wrapper), `config` (layered settings and the zod registry), `ids`, `clock`, `refusal` (the D-3 object and exit code mapping), `output` (text / JSON writer, list pages, the D-5 STOP renderer), `registry` (command registration, `--help`, inject versus command mode). A content test allows `node:fs` and `node:child_process` imports only inside `shared/store`, `shared/git` and `shared/config`.

Dependency rules: a slice imports another slice only through that slice's `index.ts`; the allowed edges are a matrix in section 9 (`hooks -> change, graph, log, ctx, config`; `change -> measure, graph, log, spec, rules`; `attempt -> part, log, evidence`; `commit -> part, log`; `dispatch -> rules, ctx`; `graph -> log, ctx`; `part -> graph, log`; `ctx -> rules`; `rules -> log`; `service -> every slice, read-only, for doctor and rebuild`; the rest import only `shared/`), and a `node:test` import scan fails on any edge outside the matrix or on a deep import. Reads of committed state (open tickets, task `Files:`, manifests, entry summaries) go through typed queries of `shared/store`, so a slice imports another only for a use case or domain logic it owns; that is what keeps the matrix acyclic (`evidence record` checks its ticket without importing `attempt`, `attempt close` imports `evidence` for freshness). The promise of approach A holds at slice level: a new artifact kind is a class inside `graph` plus a YAML node, and touches no other slice.

Alternatives:
- Horizontal layers (`cli/ -> services/ -> domain/ -> store/`): every new command touches four directories, and at roughly seventy commands each layer becomes a directory of unrelated files that only share a technical role; the owner-task model (D-8), where one task lands one group, maps to slices and cuts across layers. Lost.
- Hexagonal / ports-and-adapters: buys swappability of the store behind an interface, which R-store already asks for, at the price of a port interface per capability for a CLI that has exactly one adapter of each kind; what remains of it here is that `shared/store` and `shared/git` are the only places that touch the OS, without forcing every slice into port declarations. Lost as a whole.
- A single flat `commands/` directory with one file per command: fine at ten commands, no home for the per-group store queries and schemas at seventy; the slice is the flat layout with a group boundary added. Lost.

Section 9 contents: module map (Mermaid, `/bdk:mermaid-drawer` standard); anatomy of one slice (files and their responsibilities); `shared/` inventory with the admission rule; the dependency matrix; the flow of one command (`attempt close`) as a sequence diagram through registry, slice layers and `shared/store`; the `commands.json` to slice mapping; the recipe for a new command and for a new artifact kind; the test layout per slice and the two structural tests (import scan, `node:` boundary); the list T11 builds first (registry, refusal, output, store skeleton, `service` slice with `version` and `doctor`).

## Risks / Trade-offs

- [Schemas written before code turn out wrong] -> the owner task amends `schema/cli/` and the document in the implementing PR; T12's export diff check and the coverage test make the amendment visible; the contract states this amendment rule in section 1.
- [The document grows past what a reviewer reads] -> per-command entries follow the mini-template with one example each; long payloads live in schema `examples` and in `tests/fixtures/host-payloads/`.
- [Coverage test allowlist hides a missing command] -> the allowlist is a short explicit array in the test with a reason per entry; the acceptance task reviews it by hand once.
- [`dispatch run` naming conflicts with a later runner design in T23] -> T23 owns the semantics; only the name is fixed here, and D-9 records why the two plan names were rejected.
- [Availability class `read` unguarded lets a subagent call `query`] -> read-only by construction (T20 decides the table allowlist); accepted, matches the design's "careless, not adversarial" threat model.
- [Vertical slices duplicate small helpers across slices] -> the `shared/` admission rule (OS boundary or three or more consumers) plus the duplicate check in `/bdk:cr`; a helper used by two slices stays duplicated on purpose until a third appears.
- [T11 finds the slice layout does not fit esbuild bundling or `node --test` discovery] -> T11 amends section 9 in the same PR with the reason; the architecture is a design for T11 to build, not a constraint T11 cannot touch.
- [Architecture inside the contract document makes the contract long] -> section 9 is one diagram, one matrix and short tables; per-slice detail beyond that belongs in code comments once the code exists.

## Migration Plan

Not applicable: no runtime changes. The CI step is additive and passes on the merged tree.

## Open Questions

- Whether `query` gets a table allowlist and what `explain` prints exactly are decided by T20 and T21; the contract fixes only the argument and the output container (`rows[]` with `columns[]`; `chain[]` of node ids with states).
- Whether T11 generates `--help` from `commands.json` at build time or hand-writes it and tests parity is T11's call; the contract requires parity, not a mechanism.
