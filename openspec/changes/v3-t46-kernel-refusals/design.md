## Context

Source: #109 and the two T41 `execute` probes (`evals/results/stages/probe-execute-2026-10-02*.jsonl`). The raw runs show, per row: the runner saved test output to a file but cited the console summary text; `reason: null` came from an envelope example that shows `reason: <required ...>`; `attempt show` was typed by agents in both probes; the lead closed `A-...` before dispatching `steps`. Kernel refusals already name the next call in most rows, so the repair is mostly upstream of the kernel.

Rule of choice (decision 1 of the proposal): the kernel absorbs a form when it is reasonable and unambiguous; otherwise the contract changes the agent's call.

## Goals / Non-Goals

**Goals:** fewer wasted turns in `execute`; each fixed row guarded by a test.
**Non-Goals:** a new citation grammar (T23-D47), new entry types, the plan limits (T44), reopening the D13 `do-not-touch` fix.

## Decisions

### D1. Citation: hint, not leniency

A refused citation gets an exact `--cite <file>:<n>=<text>` in `instead` when one recorded file has the text on a line. The text is the bare value, or the part after `=` of a `<file>:<line>=<text>` or `<file>:<from>-<to>=<text>` value: the first probe showed agents guessing the line number and writing line ranges.

- Rejected: accept bare text as "some line contains it". It makes a citation mean different things by whether it parses, and breaks T23-D47's rule that a citation names a place. A passing verdict citing a phrase that occurs in an unrelated line would pass silently.
- Rejected: the runner contract alone. The agent already had "cite the output line"; it needs the grammar and a refusal that corrects it in one retry.

### D2. Runner output file

The runner writes its check output to any text file (already the contract) ending with `exit <code>`; `evidence record` copies it into the Change when it is text and within `max-committed-bytes`. No new store or limit. The contract example uses a path in the scratchpad.

- Rejected: `evidence record` capturing the command's output itself (`--run <cmd>`). It moves command execution into the kernel, which the runner role exists to avoid, and the issue lists it only as a candidate.

### D3. Empty `reason` on non-blocking status reads as absent

Applied in `checkEnvelope` before schema parse: drop `reason` when its value is `""` or `null` and `status` is `done` or `done-with-concerns`. The envelope example also stops showing a value for `reason`. Stored reports never hold the empty field. `blocked` and `needs-context` still refuse an empty `reason`, because that status needs the cause.

- Rejected: template change only. One probe-2 report had no frontmatter and fill-ins vary; the kernel form is harmless to accept and cheap.

### D4. `bdk attempt show <ticket>`

Read-only, same availability as `attempt list`, `input/not-found` for an unknown ticket. Output reuses the record schema fields. Agents reach for it in both probes (2 refusals per probe pair), and `attempt list --for` returns every ticket of a target, which is more than one asks for.

- Rejected: only a better `unknown-command` hint. The closest-command algorithm picked `attempt open` for `attempt show`; special-casing hints per command is a growing table, while a one-ticket read is a natural member of the group.

### D5. Rows fixed in contracts only

`missing-evidence`, `no-open-ticket`, `ticket-open`: the lead's call order (steps before close; task ticket for task commands; close before reopen). The kernel's first refusal already names the next `dispatch build` or call, so nothing to absorb. `entries-missing`: `--ticket` on every `log add`; envelope ids are the printed ones. `unknown-flag`: the package shows the pipe form. `invalid-argument`: limit and types stated at the point of writing (contract and package `Return`).

- Rejected: loosening `attempt close` to dispatch missing steps itself. That would move the lead's judgement into the kernel and defeat the ticket model.

### D6. Tests

Each fixed row has a test of the kind that fails if the fix is reverted: kernel unit tests for D1, D3, D4; role-contract tests that parse the contract text (citation example present, envelope example parses with `reason` unset, lead order, ticket flags); a template test for the package `Return` section. The stage probe is the end-to-end check, not a CI test.

## Risks / Trade-offs

- Contract text grows (each role budget is size-checked by `skill-check`): keep additions to a few lines, shared text where a fragment exists. Check `skill-check` after editing.
- The probe is nondeterministic and one run proves little; acceptance compares counts over its 3 cases and the fixed rules must be at 0. A single stray refusal of a fixed rule is analysed in the raw run, not hidden.
- `attempt show` widens the CLI surface; it needs `schema/cli/commands.json` and the contract tests that pair spec and schema.

## Open Questions

None blocking. Whether `tests-scoped` evidence for failing runs needs a similar hint is not seen in the probes and is left out.
