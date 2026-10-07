## Why

Tracks #188.

After a break, a crash or a context compaction, `/bdk:run` must find the open stage of the current Change from files (design `docs/design/2026-10-07-v3-architecture.md`, "Run state, run artifacts and resume" and "Autopilot continuation"). The resume table has nine ordered rows over a dozen files in two trees (`openspec/changes/` and `.bdk/runs/`), plus the folded findings log of the last review round. Done by the model, that is many `Read` and `Bash` turns on the main thread, the most expensive agent of a run: draft 1's B1 run spent 1,037 main-thread turns and went through 3 compactions (`docs/v3-draft1/run-b1/2026-10-07-bdk-v3-findings.md`, "The main thread is the most expensive agent"), and every compaction is a resume. The derivation is deterministic, so it is the case ADR-0003 principle 6 admits for a CLI helper: it computes and saves model turns, and it decides nothing about what runs next beyond reporting what the table says. The design lists the command in its CLI table (`bdk run status`).

## What Changes

- New command group `run` in the `bdk` CLI with one verb: `bdk run status`. It reads `.bdk/runs/run.json`, each queued Change's `.bdk/runs/<change>/state.json` and run files, and its OpenSpec Change directory (active or archived), and prints the run, the part states of the current Change and, for every Change in the queue, the stage the resume table derives, with the row that matched and why. `--json` prints the same as one JSON document.
- Fixes the schemas of `run.json` and `state.json` (the issue's "To resolve in the spec"; the architecture leaves them open under "What We Did NOT Decide").
- Fixes the file conventions the table reads where the design leaves them open: the verdict line of a verify report, the close-stage files `close/spec-conformance.md` and `close/pr.md`, and how an archived Change is found.
- The `run` slice reads through the file system boundary `shared/fs`, validates with the runtime dependency `zod`, and folds the findings log through the `findings` slice (#187); it adds neither a second validator, a second file system module nor a second fold.

## Capabilities

### New Capabilities

- `bdk-cli/run`: the `bdk run status` command - the inputs it reads, the schemas of `run.json` and `state.json`, the resume table it applies and its text and JSON output.

### Modified Capabilities

None. The frame and architecture requirements of `bdk-cli` apply unchanged.

## Impact

- `plugins/bdk/src/run/` (new slice), its row in `src/slices.ts`, its entry in `src/main.ts`.
- Reads `.bdk/runs/` and `openspec/changes/` under the working directory; writes nothing.
- Out of scope: writing `run.json` (the `/bdk:run` skill), writing `state.json` (the execute lead), the findings commands and their log format (#187), configuration (#179), the BDK OpenSpec schema and part frontmatter (#180), `bdk run next` (deferred by the design until measured).
