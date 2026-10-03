## Why

Scope: #109 (https://github.com/broneq/bdk/issues/109). Tracks #109. Depends on T41.

Both `execute` stage probes of T41 (2026-10-02) passed 3/3, but agents met kernel refusals in every case with agents and recovered only by retrying. Probe 2 (after D13) counted 21 refusals in nine kinds: `policy/missing-citation` (6), `policy/missing-evidence` (6), `input/invalid-envelope` (5), and one each of `policy/no-open-ticket`, `input/unknown-command`, `policy/ticket-open`, `policy/entries-missing`, `input/unknown-flag`. Each refused call costs a turn that an execute run should spend on the work. Reading the raw runs and the code shows the causes sit in four places: the role contracts and their envelope example, the package text `bdk dispatch build` writes, the lead contract's order of calls, and three reasonable forms the kernel refuses without a useful hint.

## What Changes

- **Role contracts** (`skills/roles/{lead,runner,implementer,simplifier}`; the envelope example is shared text in every role):
  - Runner: the contract states the citation grammar with a worked example, `--cite <file>:<line>=<text>`, instead of "the output line". Not a quoted console line.
  - Envelope example: `reason` is shown on its own line as an optional field, so agents stop writing `reason: ""` or `reason: null` on `done`; the example is a complete frontmatter with its `---` lines.
  - Lead: close a task ticket only after every step of its `steps` has a recorded manifest; pass the task ticket, not the `part-lead` ticket, to task commands; close the earlier ticket of a task before `attempt open task-redispatch` on it.
  - All roles: every `log add` carries `--ticket`; entry ids in the envelope are the ids `log add` printed; the summary limit (120 characters) and the entry types are named where the entry is written; the envelope is piped as the report, there is no frontmatter flag.
- **Package** (`bdk dispatch build`): the `Return` text names the summary limit and entry types, and shows the pipe form of `log ingest`.
- **Kernel**:
  - `bdk evidence record`: a citation that is not in the grammar but is text on a line of exactly one recorded file gets the refusal's `instead` filled with the exact `<file>:<line>=<text>` form. The kernel never accepts bare text as a citation (T23-D47 keeps the grammar).
  - `bdk log ingest`: `reason: ""` and `reason: null` on a status other than `blocked` and `needs-context` read as absent. They stay refused on `blocked` and `needs-context`.
  - New `bdk attempt show <ticket>`: one ticket's record (loop, target, state, steps, outcome), read-only. Agents expect it in both probes.
- **Contract tests**: one per fixed row, in the role-contracts tests and the kernel tests, so an edit that brings a refusal back fails in CI.
- **Probe**: `pnpm eval stages --skill execute --probe` after the fixes, refusal counts compared with the table of #109, recorded in `evals/results/stages/`.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `kernel-cli/evidence`: the citation hint of `evidence record`.
- `kernel-cli/log`: `log ingest` reads an empty `reason` as absent when the status does not need one.
- `kernel-cli/attempt`: new command `bdk attempt show`.
- `role-contracts`: the contract text rules for the rows above (citation form, envelope example, call order of the lead, ticket flags).
- `skill-evals`: the `execute` probe records refusal counts per kind, so the acceptance comparison is a number.

## Impact

- Changed: `skills/roles/*/SKILL.md`, `kernel/src/dispatch/domain/template.ts`, `kernel/src/evidence/domain/citation.ts` and `use-cases/record.ts`, `kernel/src/log/use-cases/ingest.ts`, `kernel/src/attempt/` (new `show` use case, command, schema), `schema/cli/commands.json` and `schema/cli/output/` (regenerated), `evals/suites/stages/` (refusal counting), `dist/bdk.mjs` (rebuilt), `STARTUP_INSTRUCTIONS.md` if regenerated, user docs of the command list.
- Out of scope: the `do-not-touch` deadlock (fixed in T41, D13); the plan size limit (T44, #106); the ledger entry model and `log add` types themselves; changing the citation grammar (T23-D47).

## Decisions

Resolved from the "To resolve in the spec" list of #109; rationale in design.md.

1. **Kernel absorbs** three rows: the empty `reason`, the citation hint, `attempt show`. **Contracts fix** the rest: `missing-evidence`, `no-open-ticket`, `ticket-open`, `entries-missing`, `unknown-flag`, `invalid-argument`.
2. **The runner's output file** is any text file the runner writes (its scratchpad); `evidence record` already copies text up to `max-committed-bytes` into the Change, so no new store and no new limit.
3. **`attempt show` is worth a command**, next to `attempt list --for`.

4. **Probe acceptance, 2026-10-03** (user decision): the second `execute` probe passed 3/3 with 6 refusals in total (T41 probe 2: 21) and none of `input/invalid-envelope`, `policy/no-open-ticket`, `input/unknown-command`, `input/unknown-flag`. One `policy/missing-citation` remained, a guessed line number that the hint corrected in one retry; the user accepted it. Rejected: the kernel taking `file:N=text` when the text is on another line (a citation then stops naming a place, T23-D47).
