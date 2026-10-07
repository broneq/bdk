# Design

## Context

`staging/v3` holds the workspace, PR CI and the release flow (#172), but no plugin. ADR-0002 and its design fix the plugin layout, the launcher contract (`bin/<cli>` resolves its own real path and runs `node <dir>/../dist/<cli>.mjs`, design section "CLI invocation") and the release check (`bin/<cli> --version` equals the tag, spec `plugin-release`). ADR-0003 fixes what the CLI may be: principle 6, "The CLI computes, it does not govern".

The draft 1 kernel (`draft/v3-1:kernel/src`) is the input for the source architecture: 19 slices of `commands/ use-cases/ domain/ store/ render/ schema/ tests/`, a `shared/` of 9 modules, an import matrix read from the spec `kernel-architecture` and checked by `kernel/tests/structure.test.ts`. The architecture itself held up; what failed around it (findings, section 5) was what the kernel was asked to do: hold the process order, keep a ledger, guard agents, and carry 73 command records of which 25 never ran.

Tooling facts on this branch: the root `vitest.config.ts` already collects `plugins/*/src/**/*.test.ts` and `plugins/*/tests/**/*.test.ts`; `pnpm check` runs lint, format, typecheck, test, then build, so no test may depend on a `dist/` built by an earlier step; `typescript` is a root dev dependency; `esbuild` is in the lockfile only as a transitive dependency of vitest.

## Goals / Non-Goals

**Goals:**

- The frame a command needs (routing, help, flags, output, errors, exit codes) exists and is tested, so #179 and later tasks only add a slice.
- The slice architecture is enforced by ESLint from the first commit, while there is almost no code to move.
- Every rule of the architecture that a test cannot check is written where an agent changing the CLI reads it.

**Non-Goals:**

- No product command. `bdk config` (#179) is the first slice (see D9).
- No runtime dependency. The first slice that needs one adds it (D7).
- No coverage threshold, no Node version matrix in CI, no generated JSON Schema files: none has a consumer yet (#172 design, Non-Goals).

## Decisions

### D1. Plugin package layout

```
plugins/bdk/
  .claude-plugin/plugin.json   name, version, description, author, repository, license
  bin/bdk                      POSIX sh launcher (D2)
  build.ts                     esbuild build (D3)
  eslint.architecture.ts       architecture lint block generated from src/slices.ts (D5)
  package.json                 "private": true, "type": "module", no version; scripts build, typecheck
  tsconfig.json                extends ../../tsconfig.json; includes src/, tests/, build.ts, eslint.architecture.ts
  src/
    main.ts                    composition root (D4)
    slices.ts                  slice matrix and shared/ inventory (D5); empty slice list
    shared/cli/                the CLI frame (D8)
  tests/
    architecture-lint.test.ts  proof that the architecture lint rejects each violation (D5)
    shared-admission.test.ts   three-slices admission count (D5)
    cli.test.ts                end-to-end test of the built launcher (D10)
```

`plugin.json` is written as `JSON.stringify(manifest, null, 2)` plus a newline and holds no `version.txt` next to it: the release-please json updater rewrites the manifest in that layout, prettier skips it, and `tests/release-components.test.ts` enforces both (#173 D3, D4).

No `skills/`, `agents/` or `hooks/` directories: they arrive with their tasks, and empty directories do not survive git. `package.json` stays in the release snapshot (#172 D3), which is harmless because `dist/bdk.mjs` is self-contained.

Alternative: CLI in its own workspace package next to the plugin (`packages/bdk-cli`). Lost: ADR-0002 keeps CLI and skills of one plugin in one directory so that one change is one PR and one release.

### D2. Launcher: POSIX sh, symlinks resolved, exit 3 on a missing piece

`bin/bdk` is the draft 1 launcher with two changes: it resolves symbolic links of `$0` in a loop of `readlink` before taking the directory (the design asks for "the realpath of `$0`", and `readlink -f` is missing on older macOS), and it exits 3, the `env/*` code of `bdk-cli`, instead of the draft's 5. It checks that `node` is on `PATH` and that `dist/bdk.mjs` exists, then `exec node "$bundle" "$@"`. The Node version check stays in `main.ts`, where it can be unit-tested and reported as `env/node-version`.

Alternative: a Node launcher (`#!/usr/bin/env node` importing `../dist/bdk.mjs`). Lost: without a `.mjs` extension its module type depends on the nearest `package.json`, and it cannot print a repair line when `node` itself is missing. A symlink `bin/bdk -> ../dist/bdk.mjs`: lost, it dangles in every checkout before a build and its survival through the plugin cache copy is unverified.

### D3. Build: esbuild from a TypeScript build script

`plugins/bdk/build.ts`, run as `node build.ts` (Node >= 22.18 strips types), calls esbuild with `entryPoints: ["src/main.ts"]`, `bundle: true`, `platform: "node"`, `format: "esm"`, `target: "node22.18"`, `outfile: "dist/bdk.mjs"`, and `define: { __BDK_VERSION__: JSON.stringify(version) }` with `version` read from `.claude-plugin/plugin.json` (design section "CLI invocation"). It exports a `build({ outfile })` function so the end-to-end test (D10) can build into a temporary directory. `esbuild` becomes an exact-pinned dev dependency of `plugins/bdk`.

Alternatives: `tsc` emit - lost, it writes one file per module and leaves runtime dependencies in `node_modules`, which an installed plugin does not have (ADR-0002). Running `src/*.ts` directly through type stripping - lost, ADR-0002 decides a built single file, and a later runtime dependency would need `node_modules` in the cache. A shared build helper at the root - lost for now (#172 design, Non-Goals): `bdk-skill-kit` (#175) has its own build; a helper waits for a measured duplication.

### D4. Vertical slices, taken over from draft 1 D-13

Taken over unchanged, as specified in `bdk-cli` ("Vertical slices", "Slice anatomy", "Import matrix", "shared/ admission", "OS boundary"):

- one slice per command group under `src/<group>/`, reached only through its `index.ts`;
- the layers `commands/ use-cases/ domain/ store/ render/ schema/ tests/`, one file per command in each, pointing one way;
- an acyclic import matrix between slices; reads of shared data through `shared/`, not through a slice edge;
- `shared/` only for OS boundaries or code three or more slices use; a helper used by two slices is duplicated on purpose;
- OS access only in `main.ts` and the OS boundary modules of `shared/`, so every use case is unit-tested against injected boundaries (draft 1 `Runtime` and `Streams`);
- `main.ts` as the composition root, the only file importing every slice.

Changed, because draft 1 needed it for a kernel that governs, or because it was built before any use:

| Draft 1                                                                                                                                       | v3                                                                                                         | Why                                                                                                                                                                                        |
| --------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `schema/cli/commands.json`: one record per command, written ahead of the code; help, contract and E2E cases generated from it                 | Each command is declared in its own slice (`index.ts`); help comes from that declaration                  | Findings 5, "Size without use": 73 records, 25 commands never ran. A central index is a second place to edit per command and invites commands designed before a measured need. |
| Matrix as a Markdown table in the spec, parsed by the test                                                                                    | Matrix as data in `src/slices.ts` (D5)                                                                     | A new slice would fail the test until `/opsx:sync`; the code file changes in the same commit as the import it allows.                                                                      |
| Refusal classes `policy/`, `guard/`, `state/`, `kernel/` with a catalogue of 82 rules and exit codes 2-5                                     | Three error classes `usage/`, `env/`, `internal/`; exit 1 means "the answer is no" (D6)                   | `policy/` and `guard/` refusals are the CLI deciding the process (findings 5, "Process was moved into the kernel"). A check that fails is an answer, not a refusal.                     |
| Inject mode and the `BDK STOP` block that tell the model what to do                                                                           | None                                                                                                       | Instructions to the model live in skill text (ADR-0003, principle 1).                                                                                                                       |
| Registry resolves the active Change and writes a run journal line per command                                                                 | None                                                                                                       | Hidden state between commands; bookkeeping (findings 1: 1,349 of 1,808 Bash calls were `bdk`). Spec `bdk-cli`, "Commands help, they never govern".                                      |
| Body read from stdin with a 3 s wait                                                                                                          | stdin only for an explicit `-` argument                                                                    | Findings 1, "Commands hang on stdin": 14 timeouts.                                                                                                                                         |
| Per-slice `config.ts` registering config modules                                                                                              | Not decided here                                                                                           | #179 owns configuration and decides whether a slice declares its settings.                                                                                                                 |
| Coverage thresholds 90/85, Node matrix of three lines, E2E cases enumerated from the index                                                   | Unit tests per slice; one E2E test of the built launcher (D10); every command's tests validate its JSON   | No index to enumerate from; thresholds and the matrix measure nothing yet (#172 design).                                                                                                   |

Alternatives considered again for v3: horizontal layers (`cli/ services/ domain/`) and hexagonal ports. Both lost for the reasons of D-13 (a command touches four directories; one adapter per port), which still hold. A flat `commands/` directory, one file per command, fits the eight commands of the design section "CLI" today; it lost because the user requires the slice architecture, and because the slice is the flat layout plus a group boundary, which costs nothing at eight commands and keeps groups like `findings` (event log, folding, triage) from leaking into each other.

### D5. ESLint enforces the architecture; the slice matrix is data in code

`src/slices.ts` exports plain data and imports nothing:

```ts
export const SLICES: Record<string, { imports: readonly string[]; why: string }> = {};
export const SHARED: Record<string, { admitted: "os-boundary" | "frame" | "three-slices"; why: string }> = {
  cli: { admitted: "frame", why: "routing, help, flags, output, errors and exit codes of every command" },
};
```

`plugins/bdk/eslint.architecture.ts` imports `src/slices.ts` (Node >= 22.18 loads it with type stripping) and exports a flat-config block for `plugins/bdk/src/**/*.ts`; the root `eslint.config.mjs` spreads it in. The block is generated from the matrix, so a new slice is one row in `slices.ts` and nothing in the ESLint config changes. It enforces, at the import line where the violation is written:

| Check                                                                         | Rule                                                                                                                                                                                                                                                       |
| ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Slice imports another slice only along its matrix row and only `index.ts`     | `boundaries/dependencies` (`eslint-plugin-boundaries`): folder elements `shared` (`src/shared/*`), `layer` (`src/*/*`, capturing slice and layer), `slice` (`src/*`) and `root` (`src`); a file's place inside its folder is its `fileInternalPath`, so "only `index.ts`" is `{ type: "slice", fileInternalPath: "index.ts" }`; default `disallow`, one `allow` per matrix edge from the `use-cases` layer to the target's `index.ts` |
| Layer direction inside a slice ("Slice anatomy")                              | the same rule: `allow` from layer to layer with `slice: "${from.slice}"`, per the table of "Slice anatomy"                                                                                                                                                 |
| `shared/` never imports a slice                                               | the same rule: `shared` is allowed only `shared`                                                                                                                                                                                                           |
| Every file under `src/` sits where the anatomy puts it                        | checked when `eslint.architecture.ts` loads: only `main.ts` and `slices.ts` in `src/`, only `index.ts` and layer directories in a slice, only directories in `shared/`. `boundaries/no-unknown-files` cannot do it: plugin v7 classifies folders, so a stray file in a known folder is never unknown |
| OS modules and `process` only in `main.ts` and `os-boundary` modules           | built-in `no-restricted-imports` (each module of "OS boundary", with and without the `node:` prefix) and `no-restricted-globals` (`process`), switched off for `src/main.ts` and the `SHARED` entries admitted as `os-boundary`                              |
| Slice directories equal the `SLICES` keys, `shared/` directories equal the `SHARED` keys, the matrix names only known slices and is acyclic | checked when `eslint.architecture.ts` loads; it throws with the offending name or cycle, so `pnpm lint` fails before linting any file                                                                                                                       |

One check is not per import and stays a test: `tests/shared-admission.test.ts` fails when a `SHARED` entry admitted as `three-slices` is imported by fewer than three slices (it lists imports with `ts.preProcessFile` from the root `typescript` dependency).

`tests/architecture-lint.test.ts` proves the rules: each case writes a small source tree to a temporary directory, runs the ESLint Node API over it with the blocks `architecture()` generates for that tree's own matrix, and asserts the rule and line reported, or the load-time error. Fixture trees in the repository were rejected: the root lint and the editor would lint them too, and a tree that must fail would fail `pnpm lint`. With no slice yet, the real tree passes trivially and the generated trees carry the proof.

New root dev dependency: `eslint-plugin-boundaries` 7.2.0 (supports ESLint 10 and flat config), exact-pinned like the rest of the toolchain. Its default resolver follows relative imports with a `.ts` extension, type-only imports included, so no TypeScript resolver is needed.

Why ESLint (user decision, review of this design): a violation shows where it is written - in the editor, in `pnpm lint` and in every scoped lint run an agent does on the files it changed - with the rule name at the import line, instead of in a test run after the fact. It uses the toolchain every contributor already runs, and needs no own import parser.

Alternatives: a vitest structural test over `ts.preProcessFile` for all checks (draft 1 `kernel/tests/structure.test.ts`, this design's first version) - lost: the violation surfaces only when tests run, away from the import, and the test is a hand-written import parser to maintain. `dependency-cruiser` - lost: a second tool and config format next to ESLint, run as its own CI step, with the same after-the-fact feedback as a test. The built-in `no-restricted-imports` alone for the matrix - lost: its patterns match the import string, not the resolved file, so `../../config/index.ts` and a deep import look alike at different depths. The matrix as a table in `openspec/specs/bdk-cli/spec.md`, parsed at config load (draft 1) - lost, see D4. Self-declared imports in each slice's `index.ts` - lost: no single view to review for cycles and for edges that should go through `shared/`.

### D6. Output conventions and exit codes

As specified in `bdk-cli` ("Output streams", "JSON output", "Errors", "Exit codes", "No waiting on input"). The choices behind it:

- **JSON is compact**, one line, `JSON.stringify(value)` plus a newline. The reader is a model or a program; indentation costs tokens and adds nothing for either. Alternative: two-space indentation (draft 1) - lost for that reason.
- **Text mode is the default**, written for a model reading it in a Bash result: short lines, no tables wider than the content needs, no colour. `--json` is for skills and tests that parse the result.
- **Under `--json` an error goes to stdout**, so a caller parses one stream and one document. In text mode it goes to stderr, so stdout is always a result.
- **Exit 1 is a "no" answer with a normal result** (a check that found problems, a validation that failed), the way `grep`, `diff` and linters use it. The skill reads the result and decides; the CLI never refuses to let it go on.
- **No `policy/` or `guard/` class.** An exit code that means "you may not do this now" is how draft 1 moved the process into the kernel. Hook guards (`hooks.subagent-git`, design section "Hooks") speak the host's hook protocol, not the CLI's exit codes; the `hooks` slice specifies that protocol when it is built.
- **Codes are stable strings.** `usage/unknown-command`, `usage/unknown-flag`, `usage/missing-argument`, `usage/invalid-argument`, `env/node-version`, `internal/unexpected` exist in this Change; a slice adds its own `env/*` and `usage/*` names, never a new class.

### D7. Output schemas are zod schemas, added with the first slice

`schema/<command>.ts` exports a zod (v4) schema of the command's `--json` result; the result type is `z.infer` of it, `render/` formats the same object, and the command's tests parse every JSON output with it. zod is the draft 1 choice, bundles into `dist/bdk.mjs`, and gives JSON Schema through `z.toJSONSchema` when a consumer for a schema file appears. The dependency is added by the first slice that has a schema (#179), not here: the frame's only JSON shape, the error object, is a TypeScript type checked by its own test. #179 still decides the settings schema and its library ("To resolve in the spec" of #179); using zod there as well is the recommendation, so the bundle carries one validation library.

Alternatives: hand-written JSON Schema files with a validator (ajv) - lost: two definitions of each shape (type and schema) that can drift. TypeScript types only - lost: nothing checks at test time that the printed JSON matches.

### D8. The frame: `shared/cli`

`shared/cli` is admitted as the frame (D5). It holds:

- **Command declaration** - the `Group` a slice's `index.ts` exports: name, one-line summary and its commands, each with an optional verb (absent only for the single command of a group), one-line summary, positional arguments, flags (`boolean` or `string`, passed to `node:util` `parseArgs`), the exit codes it returns besides 0, 2, 3 and 4 (only 1), and a `run(input)` that returns a result (`data` for `--json`, `text` otherwise, optional exit 1) or throws a `CliError`. The usage line is generated from the arguments. What a command needs from the OS comes from `main.ts` through the slice's own wiring when the first slice needs it (#179), not through a frame-wide context object.
- **Router** - matches argv against the declarations, handles `--help`/`-h`, `--version` and `--json` itself, parses flags with `parseArgs({ strict: true, allowPositionals: true })` so an unknown flag is `usage/unknown-flag`, suggests close names by edit distance, renders help from the declarations, and maps a result or error to stdout, stderr and the exit code. It takes `argv`, `version`, `nodeVersion`, the command list and the output streams as parameters, so the unit tests drive it with a fake slice and strings.
- **Error type** - `CliError { code, message, hint? }` and the exit code of each class.

`main.ts` reads `__BDK_VERSION__`, `process.argv`, `process.versions.node` and the streams, imports the (for now empty) list of slice declarations, calls the router, and sets `process.exitCode`; an exception that escapes is printed as `internal/unexpected` with exit 4.

Alternative: a CLI library (commander, yargs, citty). Lost: a runtime dependency whose help, error output and exit codes we would have to override to meet `bdk-cli`, for parsing that `node:util` `parseArgs` already does.

### D9. No product slice in this Change

The frame is tested through a fake slice declared in the unit tests, and the architecture lint through source trees generated by its test. `bdk config` (#179) is the first real slice and the example later tasks copy.

Alternative: a `version` or `service` slice (draft 1 `service`: `version`, `doctor`) to show the anatomy in real code. Lost: `bdk --version` already answers the release check, a `bdk version` command would have no caller, and the development rule in `CLAUDE.md` adds a CLI helper only for a measured problem.

### D10. Tests

- Unit tests next to the code: `src/shared/cli/tests/*.test.ts` for routing, help, flag errors, suggestions, JSON and text output of results and errors, every exit code, the Node version check.
- `tests/architecture-lint.test.ts` and `tests/shared-admission.test.ts` (D5).
- `tests/cli.test.ts`: calls `build()` from `build.ts` into a temporary plugin directory (copies of `.claude-plugin/` and `bin/`), then runs `bin/bdk` as a child process from another working directory and through a symlink: `--version` equals `plugin.json`, `--help` exits 0, an unknown command exits 2 with the text error, the same with `--json`, and a missing bundle exits 3. It builds by itself because `pnpm check` runs the tests before `pnpm build`, and it never touches `plugins/bdk/dist/`.

The acceptance signal "`bdk --version` works from `bin/` in a test project" is also checked by hand in the last task group: `pnpm build`, then `claude --plugin-dir <repo>/plugins/bdk` in a separate test project and `bdk --version` through the Bash tool (HOST-FACTS row `plugin-bin-bash`).

### D11. Release wiring, version and marketplace entry

- `release-please-config.json` gains `"plugins/bdk": { "component": "bdk" }`, `.release-please-manifest.json` gains `"plugins/bdk": "2.7.0"`, and `plugin.json` starts at `"version": "2.7.0"`, the last released version of the `bdk` plugin. The breaking commits of v3 then make the first `bdk--v*` release 3.0.0 when `staging/v3` reaches `main`. Alternative: start at `3.0.0` - lost, release-please would treat 3.0.0 as already released and the first v3 release would be 4.0.0 or 3.1.0; a `release-as` override would be a one-off setting someone must remember to remove. Until that release, `bdk --version` in development prints 2.7.0 (see Risks).
- The `bdk` entry of `.claude-plugin/marketplace.json` becomes `{"source": "git-subdir", "url": "broneq/bdk", "path": "plugins/bdk", "ref": "release"}` (plugins-reference, marketplace "git-subdir plugin source"; ADR-0002). Alternative: a relative path `./plugins/bdk` - lost, it resolves at the marketplace's ref (`main`), which holds no `dist/`.
- `CLAUDE.md` "Current state": the sentence "Until `plugins/bdk/` exists, the `bdk` marketplace entry pins the `v2.7.0` tag" is replaced by "The `bdk` marketplace entry installs `plugins/bdk` from the `release` branch; until the first `bdk--v*` release is published from `main` (#213), installing it fails, and `v2.7.0` stays installable by its tag."

### D12. Making the architecture durable

Three places, each holding what only it can hold:

| Place                                  | Holds                                                                                                     | Why there                                                                                                                                                                                                                                                                |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Spec `bdk-cli` (`openspec/specs/`)     | The normative requirements and scenarios: frame behaviour and the architecture                            | The living spec of the repository (`openspec/config.yaml`); a Change that alters the architecture must write a delta against it, so the change is reviewed as a decision, not slipped into code.                                                                       |
| `.claude/rules/bdk-cli.md`, path-scoped | What an agent must keep in mind while editing CLI code, mostly the rules no test can check                 | Loads only when an agent reads a matching file, so it costs nothing in skill or docs work and is present exactly when a slice is written. "Cross-cutting invariant whose violation fails silently" is the case for a rule file; the test-enforced parts get one line naming the enforcer. |
| `CLAUDE.md`, one line                  | A pointer for the agent that designs a command before it opens any CLI file                               | Proposals and designs are written before a path-scoped rule loads; one line in every session is cheaper than a design that misses the architecture.                                                                                                                   |

Scope is `plugins/bdk/` only, not `plugins/*/src`: `bdk-skill-kit` arrives with its own CLI (#175) that does not follow this layout, and a rule that is false for existing code teaches agents to ignore rules. Another plugin opts in by widening `paths:` and adding its own architecture lint block.

Rejected: the rule only in `CLAUDE.md` (loaded in every session, also by the parallel agents working on skills and docs, and grows with each convention); only in the spec (an agent editing code does not read `openspec/specs/` unless told to); a `CLAUDE.md` inside `plugins/bdk/` (not loaded as plugin context and `claude plugin validate` warns about it, plugins-reference "Standard layout"; it would also ship to users).

Exact text of `.claude/rules/bdk-cli.md`:

```markdown
---
paths:
  - "plugins/bdk/src/**"
  - "plugins/bdk/tests/**"
  - "openspec/specs/bdk-cli/**"
---

# bdk CLI

The `bdk` CLI helps skills; it never runs the process. Spec: `openspec/specs/bdk-cli/spec.md`.

- A command computes a result from its arguments and the files it reads, or writes what it was asked to write, and returns. It never decides what runs next, records which step of a skill ran, refuses work because another command did not run, prompts, or waits. The order of the work lives in skill text.
- A new command needs a recorded problem that an eval or a measurement showed (`CLAUDE.md`, "Building skills"). Name it in the Change.
- One slice per command group: `src/<group>/`. A new verb goes into its group's slice; a new group is a new slice, its row in `src/slices.ts`, and its spec `bdk-cli/<group>`.
- A slice owns its whole vertical: `commands/` (argv, help), `use-cases/` (logic; no argv, no stdout), `domain/` (types, pure rules), `store/` (its files), `render/` (text), `schema/` (zod schema of the `--json` result), `tests/`. One file per command in each layer.
- Reach another slice only through its `index.ts`, and add a matrix edge only for a use case that slice owns. Data several slices read goes through `shared/`.
- `shared/` takes only an OS boundary, the CLI frame, or code three or more slices import. Two slices needing the same helper keep two copies.
- File system, child processes, environment and `process` only in `src/main.ts` and `shared/` OS boundary modules; use cases get them injected and are unit-tested without them.
- Output: the result on stdout; `--json` prints one compact JSON document; errors are `<usage|env|internal>/<name>`; exit 0 ok, 1 "the answer is no" with a normal result, 2 usage, 3 environment, 4 internal. Read stdin only for an explicit `-`.

ESLint (`plugins/bdk/eslint.architecture.ts`, run by `pnpm lint`) enforces the matrix, the layer direction and the OS boundary; `plugins/bdk/tests/shared-admission.test.ts` the `shared/` admission. When they fail, fix the import; change `src/slices.ts` only with a reason in its `why` field. Never silence a `boundaries/*` rule with an `eslint-disable` comment.
```

Exact line added to `CLAUDE.md`, as the last bullet of "Building skills (v3)":

```markdown
- The `bdk` CLI is built as vertical slices, one per command group: spec `openspec/specs/bdk-cli/`, rule `.claude/rules/bdk-cli.md`, enforced by ESLint (`plugins/bdk/eslint.architecture.ts`).
```

## Risks / Trade-offs

- [The slice anatomy is heavy for groups of one or two commands] -> a slice omits `domain/` and `store/` when it has none; the rest is one small file per layer. The anatomy is what makes every slice readable the same way, and the draft measured no cost from it.
- [The architecture lint is only proven on generated trees until #179 adds a slice] -> the test trees break each check on purpose; #179's review checks that the real slice passes for the right reason.
- [An agent silences a `boundaries/*` report with an `eslint-disable` comment] -> the lint block sets `linterOptions.noInlineConfig: true` for `plugins/bdk/src/**`, so inline disables have no effect there; the cost is that no other rule can be switched off inline in the CLI source either, which is the intended strictness.
- [`eslint-plugin-boundaries` lags an ESLint major or changes its rule names (`element-types` became `dependencies`)] -> exact pin; the architecture-lint test fails on a silent no-op after an upgrade, because it asserts each violation is reported.
- [`bdk --version` prints 2.7.0 while the code is v3, as draft 1 did (findings 5, "v3 was never released")] -> accepted until the first release; the version is a release fact, and the release flow (#173, #213) is where it changes. If it misleads a run report, `bdk --version` is the wrong source for "which BDK ran", not the version.
- [release-please has no `bdk--v*` tag to start from and may build the first changelog from the whole history] -> #173 showed that `bootstrap-sha` bounds the commits release-please reads; setting it for the first v3 release is #213's call, because the right commit is the merge of `staging/v3` into `main`. This Change only registers the component.
- [Between the merge of `staging/v3` into `main` and the first publish, `/plugin install bdk@bdk` fails because `release` holds no `plugins/bdk/`] -> #213 publishes and checks the first release right after the merge; `v2.7.0` stays installable by tag.
- [Parallel PRs (#175) edit the same root files and `pnpm-lock.yaml`] -> different entries in each file; the second PR to merge rebases, keeps both entries and runs `pnpm install` to regenerate the lockfile.
- [Plugins with `bin/` are not installed by claude.ai and Cowork (plugins-reference, "Standard layout")] -> already accepted by ADR-0002 (`bin/` is how skills call `bdk`); recorded here because it is now real for the `bdk` plugin.

## Migration Plan

No user-visible change before `staging/v3` merges into `main`. Rollback before the first v3 release: restore the `v2.7.0` source in the `bdk` marketplace entry.

## Open Questions

None that change the specs or the task breakdown. The decisions most worth the reviewer's attention are D9 (no product slice), D11 (start version 2.7.0) and D12 (where the rule lives).
