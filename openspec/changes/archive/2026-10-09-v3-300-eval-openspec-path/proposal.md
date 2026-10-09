# Proposal

## Why

Tracks #300.

Under `pnpm --filter @bdk/bdk run eval`, a case that runs `openspec` cannot start it. `pnpm run` puts the workspace `node_modules/.bin` directories first on `PATH` and the run inherits them, so `openspec` resolves to the pnpm shim of the `@fission-ai/openspec` devDependency. The shim runs `node` on the package under `node_modules/.pnpm/`, and the run's sandbox denies reads under the caller's home directory (the shim's own directory is let through because it is on `PATH`), so the call fails with `Cannot find module .../node_modules/.pnpm/@fission-ai+openspec@1.13.2.../bin/openspec.js` and the model stops. Reproduced on 2026-10-09 with Claude Code 2.1.292: `propose-from-issue` run with the README's command scores 0.22 (`openspec list --specs` fails); the same case scores 1.00 when the run finds the Homebrew `openspec`.

## What Changes

- The `eval` script of `plugins/bdk/package.json` runs a new launcher `plugins/bdk/evals/run.ts` after the build. The launcher starts the Claude Code version pinned in the root `package.json` by its path, with every `node_modules/.bin` directory removed from the `PATH` the run inherits, and passes every argument through to `claude plugin eval . --scaffold`.
- Before it starts the run, the launcher looks up `openspec` on that `PATH` and prints a warning to stderr when there is none, or when it lives under the home directory, where a run cannot read it. It starts the run either way: most cases never call `openspec`.
- `plugins/bdk/evals/README.md` says that cases calling `openspec` need a global OpenSpec 1.13.2 outside the home directory, and a "Host limits" entry explains why the workspace one cannot serve.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `skill-evals`: the "Local run" requirement adds that the run inherits no workspace `node_modules/.bin` directory and that the launcher warns when no readable `openspec` is on `PATH`.

## Impact

- Code: `plugins/bdk/evals/run.ts` (new), `plugins/bdk/package.json` (`eval` script), `plugins/bdk/tsconfig.json` (include), `plugins/bdk/tests/evals.test.ts`.
- Docs: `plugins/bdk/evals/README.md` ("Run", "Host limits"). Nothing a BDK user sees changes: the eval suite is a contributor tool and is not released, so no `docs/guide/` or `docs/concepts/` page changes.
- Out of scope: the cases and skills of #293.
