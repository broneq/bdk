# Design

## Context

The `bdk` plugin has the CLI frame and the slice architecture of `v3-178-bdk-plugin-skeleton` (spec `bdk-cli`, rule `.claude/rules/bdk-cli.md`) and no command group yet. The findings log is specified in design `2026-10-07-v3-architecture.md`, "Findings and triage": an append-only event log with `finding`, `level` and `decision` lines and a `bdk findings` command that folds it. "What We Did NOT Decide" left the exact event schema open; #187 asks the spec to fix it and the dedupe key. Several Changes add slices in parallel (#179 config, #186 git, #188 run status); the shared spots (`shared/fs`, `zod`, `main.ts` wiring) were agreed with them (D6).

## Goals / Non-Goals

**Goals:**

- Parallel writers append without losing or corrupting lines.
- A stateless fold: the same log gives the same list, whatever ran before (spec `bdk-cli`, "Commands help, they never govern").
- A schema small enough that a reviewer prompt can name the command in one line.

**Non-Goals:**

- Locking, compaction or rewriting the log; a status field per finding stored anywhere but in events.
- Deciding what happens with the findings: rounds, policy and triage stay in skill text.
- `bdk check run` writing red checks (its slice uses `addFinding` from `findings/index.ts` through a matrix edge when it is built).

## Decisions

### D1. Append-only JSON Lines with three event types

As specified in `bdk-cli/findings`, "Event log". One compact JSON object per line, discriminated by `type`. Fields follow the architecture design (`id`, `source`, `file`, `line`, `rule`, `summary`, `evidence`; level and decision values), plus an optional `reason` on level and decision events (the judge's and triage's one-line rationale, which the triage page and the PR need) and `issue` on `defer` ("defer with an issue").

- No timestamp and no schema version field: the fold relies on file order only, a timestamp would need a clock boundary and make the output depend on time, and new optional fields stay readable by the current schema. A breaking format change would use a new `type`.
- `JSON.stringify` escapes newlines inside strings, so an event is always exactly one line.

Alternatives: one file per finding (draft 1 ledger, Q-4) - lost: many tiny files per round for no gain, since one writer process owns each line anyway, and `level`/`decision` would need either mutation or more files. A mutable JSON document with a lock - lost: a lock is what loses updates when a writer crashes, and the architecture design chose the event log to avoid rewrites.

### D2. The CLI stamps the id from the dedupe key

`id = "f-" + sha256(key).hex[0..12]`, key = `file`, `line`, rule part joined by U+001F (spec "Finding id and dedupe key"). Deterministic ids give dedupe for free: duplicates share the id, so a `level` or `decision` on either applies to the folded finding, and parallel writers need no coordination to agree on ids.

- **Rule first, summary as fallback.** Two reviewers flagging the same rule on the same line report the same problem in different words, so with a rule the summary is left out of the key. Without a rule (E2E, integration), only the same normalised summary is a duplicate; that catches retried agents writing the same finding again, the common case of duplicates, and never merges two different problems.
- **Normalisation** follows draft 1's fingerprint (NFKC, lowercase, runs of non-alphanumerics to one space, trim), without its "digit runs to `#`", which there served cross-round recurrence and here would merge "line 3" and "line 4" style summaries.
- **12 hex characters (48 bits):** a round holds tens of findings; the chance of a false merge is below 1e-11, and the id stays short for the model to copy.

Alternatives: caller-supplied ids - lost: parallel writers would need a scheme to avoid collisions, and models invent inconsistent ids (draft 1 P1: ids are stamped, never input). Random ids (ULID) with dedupe only at fold time - lost: a decision on one duplicate would not cover the other, and the fold would need a second key. Dedupe on `file` and `line` alone - lost: two different problems on one line would merge.

### D3. Writers append one line with one write; the fold is a pure function

`appendText` opens the log with `O_APPEND` and writes the whole line in one `write` call (`appendFileSync`). On local file systems the kernel positions every `O_APPEND` write at the end atomically, so parallel processes neither overwrite nor interleave lines. The acceptance test runs 50 real `bdk` processes at once against one log.

`level` and `decide` read the log first and refuse an unknown id (`usage/unknown-finding`): a typo in an id would otherwise go unnoticed until triage. That read is input validation of the command's own argument, not a check that another command ran (spec `bdk-cli`, "Commands help, they never govern"); a finding is never removed, so the check cannot race into a false refusal.

The fold (`domain/fold.ts`) takes the log text and returns the view: findings in first-seen order, last `level` and last `decision` per id in file order, sources and report counts, counts, skipped lines. It is pure and unit-tested on strings. Events naming an id without a `finding` line (only possible by hand editing) are skipped with a reason rather than failing the fold, as are lines that do not parse: one damaged line must not hide the rest of a round (spec "Fold the log", "Damaged line").

Alternatives: a lock file around writes - lost: unnecessary with `O_APPEND`, and a crashed writer leaves a stale lock. Failing `list` on a damaged line - lost: the reader is a skill in the middle of a round; it needs the findings and a note of the bad line, not exit 3.

### D4. Command shapes

- **`list` is a verb.** The architecture design writes the fold as bare `bdk findings`, but the frame (`shared/cli`) allows a verbless command only as the single command of a group, and bare `bdk <group>` prints the group help. Changing the frame for one group would make `bdk findings` ambiguous between help and the fold; `bdk findings list` is explicit. Deviation recorded here; the architecture table is updated to match.
- **The log path is the first argument** of every command. The skill knows the run directory and round; the CLI does not find a project root or a current round, which would be state (D3-0 keeps run state in skills and files). `--change`/`--round` flags were considered and lost: they need a root-discovery rule that #179 owns and add nothing a path does not say.
- **Required flags** (`--source`, `--summary` of `add`) are checked in the command, since the frame's flags are optional: missing ones are `usage/missing-argument`, like a missing positional.
- **`list` filters** `--level <level|unleveled>` and `--decision <decision|undecided>`; counts always cover the whole log, so a filtered list still says how much is left. `--decision fix` is "what to fix"; `--level blocker --decision undecided` is the autopilot's "blockers without a decision" (architecture design, resume row 7).
- **Missing files:** `add`, `level` and `decide` create the log and its directories (`add`) or treat a missing log as empty (`level`/`decide`, then `usage/unknown-finding`). `list` folds a missing log in an existing directory to zero findings - a round whose reviewers found nothing has no file - but a missing directory is `env/log-dir-missing`, exit 3, so a mistyped path does not read as a clean round.
- **Exit codes:** `list` always exits 0. "Findings remain" is not a "no" answer of the command; the skill reads the counts and decides.
- **Text output** is for a model reading a Bash result: `add` prints the id, `level`/`decide` print one confirmation line, `list` prints a counts line, one line per finding (`id level decision file:line [rule] summary (sources)`), and skipped lines last.

### D5. Slice layout

`src/findings/` with `commands/{add,level,decide,list}.ts`, `use-cases/` of the same names, `domain/` (event types and the zod event schemas, `id.ts` for key and hash, `fold.ts`), `store/log.ts` (read and append through the injected `Files`), `render/list.ts` and the others, `schema/` (zod schemas of each `--json` result) and `tests/`. `index.ts` exports `findingsGroup(deps)` for `main.ts` and the use cases `addFinding` and `listFindings` for slices that get a matrix edge later (`check`, `run` #188). The slice imports no other slice; its matrix row is empty. Three small files are shared inside a layer rather than owned by one command: `use-cases/known.ts` (the unknown-id check of `level` and `decide`), `commands/flags.ts` (reading string flags and the `<log>` argument declaration) and `domain/problem.ts` (the first zod issue worded as a usage error); `tests/memory-files.ts` is the in-memory `Files` of the tests.

SHA-256 comes from `node:crypto`, which is not an OS module in the `bdk-cli` "OS boundary" list: hashing is a pure computation, so `domain/id.ts` may use it.

### D6. Shared ground agreed with the parallel Changes

- **`shared/fs`** is an OS boundary module with the API agreed with #179 (owner) and #188: `readText(path)` (undefined on a missing file), `list(dir)`, `writeText(path, text)` and `appendText(path, text)`, all synchronous, behind a `Files` interface that `main.ts` injects into slice factories (`findingsGroup({ files })`). This Change carries the same module so it can merge first; whichever Change merges second keeps the merged copy and drops its own.
- **`zod` 4.6.5** (exact pin, the version #179 and #188 use) is a runtime dependency of `plugins/bdk`, bundled into `dist/bdk.mjs`, as design D7 of `v3-178-bdk-plugin-skeleton` planned for the first slice with a schema. The event schemas reuse it to validate log lines in the fold.
- #188 (`bdk run status`) gets the event schema from this spec and may add a matrix edge `run -> findings` to call `listFindings`.

## Risks / Trade-offs

- [Network file systems (NFS) do not guarantee atomic `O_APPEND`] -> run directories live in `.bdk/runs/` of a local checkout; the fold skips and reports a damaged line instead of failing, so the worst case is a visible, single lost finding.
- [A rule-keyed dedupe merges two different problems that a reviewer files under the same rule on the same line] -> the folded entry keeps every source and the report count, so triage sees that more than one writer reported it; the first summary and evidence are shown.
- [A hash collision merges two findings] -> 48 bits for tens of findings per round makes it negligible.
- [Parallel Changes edit `main.ts`, `slices.ts`, `package.json` and the lockfile] -> each adds one entry; the later rebase keeps both and regenerates the lockfile with `pnpm install`.
