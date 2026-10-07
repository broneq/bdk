# Design

## Context

See proposal.md - Why. The `bdk` plugin has the CLI frame and the architecture lint from #178 (archived Change `2026-10-07-v3-178-bdk-plugin-skeleton`, D4-D8), and no slice yet. Spec `bdk-cli` and `.claude/rules/bdk-cli.md` fix the slice anatomy, the OS boundary and the output conventions this Change follows.

Several issues add slices to `plugins/bdk` at the same time (#179, #186, #187). Agreements reached with them over the coordination channel, which this design relies on:

- #179, #186 and #187 share one `src/shared/fs/` (an `os-boundary` module, first claimed by #179, merged first by #187) with a synchronous `Files` interface: `readText(path): string | undefined` (undefined on ENOENT/ENOTDIR), `list(dir): readonly Entry[] | undefined` (`Entry { name, dir }`, sorted by name, undefined when absent), `writeText`, `appendText`; and the runtime dependency `zod` pinned to `4.6.5`. `main.ts` passes the OS dependencies to a slice factory per group: `GROUPS = [findingsGroup({ files }), ...]`.
- #187 owns `findings.jsonl` (spec `bdk-cli/findings`): one JSON object per line with `type` `finding` | `level` | `decision` and `id`; `level` values `blocker`, `should-fix`, `nice-to-have`, `not-a-problem`; `decision` values `fix`, `accept`, `defer`; fold in file order, latest level and latest decision per id win, lines with an unknown id or invalid JSON skipped and reported.
- #180 owns the Change layout: parts at `openspec/changes/<change>/plan/parts/NN.md`, `NN` two digits equal to the frontmatter `id`.

Coordination rule from the orchestrator: no agent waits for another. This Change builds what it needs now and reconciles at rebase.

## Goals / Non-Goals

**Goals:**

- One deterministic read of the run files gives the open stage of every queued Change, per the nine rows of "Autopilot continuation", in text for the context and in JSON for a skill.
- The schemas of `run.json` and `state.json` are fixed and validated, so the one writer of each file (`/bdk:run`, the execute lead) has a contract.

**Non-Goals:**

- No writer of `run.json` or `state.json`: the design gives each file one writer, and it is a skill (principle 5). No `bdk run init` or `bdk run set`.
- No `bdk run next`: the design defers it until measured. `status` reports the stage; the skill decides what to run.
- No `openspec status` call, no git, no `gh`: the derivation reads files only, so it stays fast, offline and testable without child processes.
- No skill text: `/bdk:run` and the stage skills are their own issues; they call this command.

## Decisions

### D1. One slice `run`, one verb `status`

`src/run/` with `index.ts`, `commands/status.ts`, `use-cases/status.ts`, `domain/status.ts`, `store/status.ts`, `render/status.ts`, `schema/status.ts` and `tests/`, following spec `bdk-cli` "Slice anatomy". The slice row in `src/slices.ts` imports no other slice.

- `store/status.ts` reads the files through an injected `Files` and turns them into a plain snapshot: the parsed `run.json`, and per Change the parsed `state.json`, the file and directory names the table looks at, the verdict of each last report, and the folded findings counts of the last round. It owns the zod schemas of the two state files, because they are files of this slice.
- `domain/status.ts` holds the types and the pure rules: the verdict line, the findings fold, and the resume table as one function from a Change snapshot to a stage. Every row is unit-tested on a hand-built snapshot, and again end to end through the store on a temporary tree.
- `use-cases/status.ts` composes store and domain into the result; `render/status.ts` prints it; `schema/status.ts` is the zod schema of the `--json` result.

Alternative: put the derivation in the use case and skip `domain/`. Lost: the table is the part most worth testing in isolation, and the anatomy puts pure rules in `domain/`.

### D2. The command reads relative to the working directory, no flags

`/bdk:run` and the stage skills run at the project root, and the design keeps run state in `.bdk/runs/` of that root. A `--root` flag would have no caller today (development rule: no helper before a need). The working directory comes from `main.ts` through the slice factory.

### D3. Schemas of `run.json` and `state.json` (issue: "To resolve in the spec")

As in spec `bdk-cli/run`. The choices behind them:

- **`version: 1` in both files.** The writers are skills, whose text changes between releases; a version lets a later reader say "this run was written by an older BDK" instead of misreading it. Alternative: no version - lost, a field added later cannot be told from a typo.
- **A queue entry is `{change, issue?}` and the name is fixed when the Change is queued.** `/bdk:run` names each Change (`<prefix>-<N>-<slug>`) when it builds the queue, and `propose` creates the OpenSpec Change under that name, so every row of the table can be checked by name before `proposal.md` exists. Alternative: entries without a name until `propose` ran - lost, row 1 would need a second key to find the Change.
- **`mode` is `interactive` or `non-interactive`.** The architecture lists "mode" in `run.json` without values; the run behaves differently in exactly these two cases (a background lead and questions to the user, or a foreground lead and decide-and-record, design "Layers" and `execution.lead`). Gate policy stays configuration (`policy.gates.*`, #179), not run state.
- **Change names match `^[a-z0-9][a-z0-9-]*$`.** OpenSpec rejects capitals, and a name is joined into paths; the pattern rules out `..` and separators before any path is built.
- **Unknown keys are ignored** (zod `object`, which strips them), so a writer can add a key in a minor release without breaking older readers; a missing or wrong known key is an error.
- **A part state is `{status, attempts, reason?}`** with status `pending | done | blocked` (design table "Run state"). `reason` lets the lead say why a part is blocked, which the context needs when the run resumes.
- **Errors are `env/invalid-run-state` and `env/no-run`, exit 3.** The spec `bdk-cli` defines exit 3 for a file the command needs that is missing or unusable; a "no" answer (exit 1) would ask the skill to parse a result that does not exist.

### D4. File conventions the design leaves open

- **Verdict line.** A verify report passes when a line reads `Verdict: PASS`, case and Markdown marks ignored (`**Verdict:** PASS`, `## Verdict: PASS`). The verifier skills are not written yet; this gives them one line to write. Alternative: a JSON sidecar per report - lost, a second file per report for one word.
- **Close files.** The design's run artifact table has no close-stage file, but row 9 needs to know whether spec conformance passed and whether a PR exists. `close/spec-conformance.md` (the `spec-conformance` verifier's report, with a verdict line) and `close/pr.md` (written by `/bdk:close` with the PR URL) follow principle 4, "every step writes a file". Archiving is read from OpenSpec itself: the active directory is gone and an archived one exists. The commit step has no file of its own; it is part of the `pr` step. Alternative: ask `gh` for a PR - lost, a network call in a status read, and the run's PR is known to the step that opened it.
- **Last report and round** are by number, not by modification time: numbers are written by the skills, times change with a checkout.

### D5. Findings fold through the `findings` slice

Rows 7 and 8 need the latest level and decision per finding of the last round. #187 owns the log and its fold, and exports `listFindings(files, {log})` from `src/findings/index.ts`. The `run` slice imports it along the matrix edge `run -> findings` (spec `bdk-cli` "Import matrix": an edge for a use case the other slice owns): `use-cases/status.ts` calls it for the last round of each Change, counts findings whose level is `blocker` with no decision and findings whose decision is `fix`, and turns every skipped line into a warning. The store only names the log path; the domain receives the two counts.

History: when this Change was first built, #187 was not merged and the orchestrator forbade waiting, so `domain/status.ts` held a minimal fold of the agreed format. #187 merged before this Change, and the rebase replaced the copy with the edge, as planned; no second fold ships.

Alternative: read only `report.md` and parse a blocker count from it - lost, the decisions are in the log, not in the report. Keeping the local copy - lost, the `findings` slice validates event lines (id format, level and decision values) and a copy would drift from it.

### D6. `shared/fs` and `zod` as agreed with the parallel slices

This Change needs `readText` and `list` only. It was built with its own `src/shared/fs/index.ts` of exactly the agreed signatures and `zod@4.6.5`; #187 merged the agreed module and the same zod pin first, so the rebase dropped this Change's copy and kept the merged module and dependency. The `run` slice codes against the `Files` interface and never writes; its in-memory test `Files` throws on `writeText` and `appendText`. `node:path` is not an OS module in spec `bdk-cli` "OS boundary", so the store joins paths itself.

The slice factory takes `{ files, cwd }`; `main.ts` passes `files` from `shared/fs` and `cwd` from `process.cwd()`, the same factory pattern as `findingsGroup({ files })`.

### D7. Output

Text is for the context of a model: a header line, one line per Change with stage, step, row and reason, the parts of the current Change, warnings. JSON carries the same fields with `null` for absent values, so a skill reads one shape whatever the stage. Both list Changes in queue order and parts in id order (spec `bdk-cli` "Output streams": stable order).

Status of every queued Change, not only the current one: the table is cheap, and after a crash the main thread sees at once which Changes are done and which have not started, without a second call.

## Risks / Trade-offs

- [The conventions of D4 bind skills that are not written yet] -> they are in the spec `bdk-cli/run`; the skill issues read the spec, and a change to a file name is a delta there.
- [The local fold drifts from the `findings` slice] -> D5: replaced by the edge at rebase if #187 is merged; otherwise one small function with tests against the agreed format; the agreed format is cited in this design.
- [A hand edit makes `state.json` invalid and the run cannot resume] -> the error names the file and the key, so the model or the user fixes the line; the CLI never repairs state (one writer).
- [Parallel slices edit `slices.ts`, `main.ts`, `package.json` and the lockfile] -> different rows; the second to merge rebases, keeps both entries and runs `pnpm install`.

## Migration Plan

None: a new command; nothing reads or writes these files yet.
