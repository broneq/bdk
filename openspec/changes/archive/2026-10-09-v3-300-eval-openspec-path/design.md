# Design

## Context

See proposal.md - Why. Measured on 2026-10-09 with Claude Code 2.1.292, from a checkout under the home directory:

- With the caller's `HOME`, a run resolves `openspec` to `plugins/bdk/node_modules/.bin/openspec` (a probe case printed `command -v openspec`), and `openspec --version` fails with `Cannot find module '<checkout>/node_modules/.pnpm/@fission-ai+openspec@1.13.2_@types+node@22.20.5/node_modules/@fission-ai/openspec/bin/openspec.js'`. The sandbox denies reads under the home directory; it lets through the directories on `PATH`, so the shim runs, but not the package it points to.
- With the clean `HOME` of the "Host limits" Docker entry, the same shim works: the sandbox then denies the clean `HOME`, not the real one. This is why the failure shows only for contributors who do not need the Docker workaround.
- `claude plugin eval` has no option to widen what the sandbox reads, and a run loads no `.claude/` settings.

## Goals / Non-Goals

**Goals:**

- The README's commands work for cases that call `openspec`, with or without the clean `HOME`.
- A contributor without a usable `openspec` learns it before paying for runs.

**Non-Goals:**

- Making a run read the workspace `node_modules` (the sandbox decides that, and no eval option changes it).
- Changing any skill's way of calling OpenSpec.

## Decisions

### D1. The `eval` script strips every `node_modules/.bin` directory from `PATH`, and the README requires a global OpenSpec

Resolves the issue's "To resolve in the spec": both, since neither alone works. Stripping alone leaves no `openspec` for a contributor without a global one; documenting a global install alone does not help, because pnpm puts the workspace shim first on `PATH` and the run always picks it. A global OpenSpec 1.13.2 is already a requirement of this repository's SDLC (CLAUDE.md, the `openspec` CI job installs it the same way), so the README names it rather than adding a new tool.

Every `node_modules/.bin` directory goes, not only the one holding `openspec`: any pnpm shim there points into `node_modules/.pnpm/` and fails in a run the same way, so a future devDependency would bring the same bug back. Entries are removed by their last two path segments (`node_modules/.bin`), which matches the bin directories pnpm adds at every level of the workspace; every other entry keeps its order, including the relative `.git/bdk-eval/bin` the `propose-*` command puts first.

Alternatives:

- Copy or link the OpenSpec package to a directory outside the home directory before each run (as the `git` entry does for `macos-git-prefix.sh`). Lost: it adds files outside the repository that the script must keep in sync with the pinned version, for a tool every contributor already installs globally.
- Remove `@fission-ai/openspec` from the plugin's devDependencies. Lost: the tests run the pinned OpenSpec from it, and CI needs that version without a global install in the test job.
- Make the clean `HOME` mandatory for every run. Lost: it is a macOS-specific workaround with the keychain link, and an `openspec` installed under the real home (nvm) would still be unreadable without it.

### D2. A launcher `plugins/bdk/evals/run.ts`, not an inline shell `PATH` edit

The `PATH` filter, the look-up of the pinned `claude` and the warning are a few lines of Node that unit tests can call; a shell one-liner in `package.json` would be untestable and differ between shells. The launcher sits in `evals/`, next to the README that documents it, because `scripts/publish-plugin.ts` leaves `evals/` out of the release while a file at the plugin root (such as `build.ts`) ships; it runs with Node's type stripping like `build.ts` and is included in the plugin's `tsconfig.json`. Alternative: `plugins/bdk/eval.ts` next to `build.ts`. Lost: it would ship a development launcher in every release. It starts `<repo>/node_modules/.bin/claude` by its absolute path (the same binary the free loader check in `tests/evals.test.ts` uses), so removing the bin directories from `PATH` cannot change which Claude Code runs. It passes its exit code through, so `--threshold` keeps failing a script run.

### D3. Warn, do not stop, when no readable `openspec` is found

Most cases never call `openspec`, so a missing one must not block them. The check resolves `openspec` on the stripped `PATH` with its real path and warns when it is missing or lies under `os.homedir()`. Under the clean `HOME` the home directory is the clean one, so an `openspec` under the real home is correctly not warned about: the sandbox reads it then. The warning names the README entry to read.

Alternative: fail fast. Lost: it would block every case for a tool most of them do not need.

## Risks / Trade-offs

- [The sandbox's read rules change in a later Claude Code version] → The warning is advice only; the README entry records the measured version (2.1.292), as the other "Host limits" entries do.
- [An `openspec` other than 1.13.2 is found] → Not checked: the README names the version and the SDLC already pins it; a version check would run `openspec` on every eval start for little gain.
