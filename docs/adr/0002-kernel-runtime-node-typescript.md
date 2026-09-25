---
status: accepted
date: 2026-09-25
decision-makers: {TBD}
consulted: {TBD}
informed: {TBD}
---

# ADR-0002: Kernel runtime is Node with TypeScript source and a committed ESM bundle

## Context and Problem Statement

BDK v3 moves the Change process out of skill prose into a kernel CLI: a state machine over committed files, a ledger with history, schema validators and refusals the model cannot argue with (design `docs/v3/2026-09-23-0703-bdk-v3-change-centric-design.md`, sections "Selected Approach" and "Constraints & NFRs", row Runtime). v2 is 12 Python files (2 712 lines of scripts and hooks, 5 442 lines of tests, stdlib only, Python >= 3.12). v3 rewrites the state model whatever the language, and the kernel needs libraries neither standard library has: a YAML parser, a schema validator, a Markdown block parser. The question is which runtime the kernel is written in and how it reaches the user's machine. Register entry: D5 (`docs/v3/2026-09-23-0703-bdk-v3-decisions.md`).

## Decision Drivers

- **The rewrite is the one free moment to change language.** The kernel is written from scratch in either option; only the ports of `inject*.py`, `get_settings.py` and the hooks are extra, and the configuration rework changes those anyway.
- **One language across the plugin ecosystem.** `broneq/git-identity` ADR 0001 chose Node because npm is the only built-in channel for sharing code between plugins; that ADR names "the helpers are to be consumed by bdk" as the condition under which bdk dictates the ecosystem's language.
- **Types where they pay most.** A state machine, a ledger and schema validation are where static types and zod (as in OpenSpec) return the most.
- **Nothing to install on the user's machine but the runtime.** Hooks and `!` blocks run the kernel directly; no `npx`, no package install, no network (git-identity ADR 0001 rules 1, 3 and 7); TypeScript is the source because a bundling step exists (rule 8).
- **A missing runtime fails loudly.** The kernel is code by definition, so git-identity's rule 9 ("the core functionality has no runtime") cannot hold; the failure must be a visible STOP line with an install instruction, never a silent success (decision Q3).
- **Tooling around BDK is already Node:** promptfoo for evals, lavish-axi, gh-axi, chrome-devtools-axi.

## Considered Options

1. **Node, TypeScript source, one committed ESM bundle** - esbuild bundles the kernel and its pinned dependencies into `dist/bdk.mjs`; CI rebuilds it and fails on `git diff --exit-code dist/`.
2. **Python 3.12, dependencies packed with zipapp** - one `.pyz` with pure-Python dependencies, run offline like the bundle.
3. **Node with dependencies installed on the user's machine** - a `package.json` the host installs, or `npx` at call time.

## Decision Outcome

**Chosen option: 1, Node with TypeScript source and a committed ESM bundle**, because the rewrite makes the language change free, it puts the whole plugin ecosystem on one language with shared bundled helpers, and it gives the kernel static types and zod for exactly the parts that need them, while the committed bundle keeps the user's side to "Node and nothing else".

### Consequences

- ✅ The user needs Node >= 22.13.0 and nothing else: the bundle carries `zod` and `yaml`, and the host skips `pnpm-lock.yaml`, so no install runs on the user's machine. The minimum is the first 22.x with `node:sqlite` unflagged (HOST-FACTS `node-sqlite-min`); the SQLite index needs no native module.
- ✅ With the bundled MCP servers removed (ADR-0001), `uv` is no longer needed at all, so the "two runtimes" cost the design session accepted for this option is gone.
- ✅ The bundle is reviewed like source: CI rebuilds it and fails on any difference, the runtime dependencies are limited to an allowlist (`zod`, `yaml`) with exact versions, and `pnpm audit --prod` gates every CI run (V1-8).
- ❌ A hard cut from v2 to v3: v3 does not read v2 artifacts; `bdk doctor` detects the v2 layout and names `bdk import` (T32) as the repair.
- ❌ The v2 unit tests are ported or rewritten, most of them because the model they test changes.
- 🟡 git-identity ADR 0001 needs an amendment: its consequence "bdk stays in Python" no longer holds, and its rule 9 does not fit a plugin whose core is a kernel (T11 opens that PR in `broneq/git-identity`).
- 🟡 Development toolchain, as amended in T11 (design D-2 of the Change `v3-t11-kernel-skeleton`): D5 named `node --test` and Biome; the kernel uses Vitest (unit, E2E and contract projects, coverage thresholds), ESLint with type-checked `typescript-eslint` rules, Prettier over the repository, husky with lint-staged and commitlint, and knip. This is a user decision in favour of the mainstream stack and its type-aware lint rules; the runtime half of D5 is unchanged. pnpm is the development package manager, pinned through `packageManager`.

### Implementation Requirements

- [x] `package.json` with `engines.node >=22.13.0`, exact dependency versions, `packageManager` pinned (T11).
- [x] esbuild build to `dist/bdk.mjs`, target `node22.13`, committed, checked by `git diff --exit-code dist/` on CI (T11).
- [x] Tests: the bundle loads only Node built-ins; runtime dependencies stay within the allowlist; no version ranges (T11).
- [ ] git-identity ADR 0001 amendment merged in `broneq/git-identity`.

## Pros and Cons of the Options

### Node, TypeScript source, one committed ESM bundle

The path git-identity ADR 0001 already walks (esbuild, bundle committed); the reference projects with a comparable core (OpenSpec, Task Master, claude-flow) are TypeScript.

- ✅ One language for every plugin of the ecosystem and for the tooling around BDK.
- ✅ Static types and zod for the state machine, the ledger and the schema validators.
- ✅ Nothing installed at run time; one file to review and ship.
- ❌ "Python is everywhere" never helped v2 (macOS ships 3.9.6 with Xcode, BDK needs 3.12), and Node is not more available either: the user installs a runtime in both options.
- ❌ The bundle is a generated file in the repository and must be rebuilt with every source change.

### Python 3.12, dependencies packed with zipapp

- ✅ Continuity with v2: no language change, the existing tests keep their language.
- ✅ zipapp runs offline like a bundle.
- ❌ A second language in the plugin ecosystem, with no built-in channel to share helpers between plugins.
- ❌ zipapp is a less common path, limited to pure-Python dependencies.
- ❌ The saving is small: the state model and most of its tests are rewritten anyway.

### Node with dependencies installed on the user's machine

- ✅ No generated file in the repository.
- ❌ An install step, a network dependency and a lockfile resolution on every user machine; hooks would depend on it (git-identity ADR 0001 rules 3 and 7 forbid this).
- ❌ `npx` at call time adds seconds to every kernel call against a 30-50 ms budget.

## More Information

- Register entry D5 and the D5 discussion on design page 01 (`docs/v3/bdk-v3-design-01-produkt.html`); design "Constraints & NFRs" (rows Runtime, Security, Availability).
- Implemented by T11, Change `v3-t11-kernel-skeleton` (design D-1 to D-3, D-10, D-11); specs `kernel-architecture` (Bundle, Runtime dependencies, CI pipeline) and `kernel-cli` (Invocation).
- ADR-0005 depends on this runtime for `node:sqlite`.
