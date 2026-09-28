# kernel-cli delta

## MODIFIED Requirements

### Requirement: Conventions

Success output, list pages, identifiers, timestamps, idempotence and the refusal-versus-finding split SHALL follow these conventions in every command.

- **Success output is a plain object.** No envelope: the `--json` output of a command is the object its schema under `schema/cli/output/` describes. Optional fields are absent when unknown, never `null`. Enumerations are lowercase words. Text mode renders the same data; only JSON is the contract.
- **List pages.** Every `list` verb and every command that returns a collection uses `schema/cli/common/list-page.json`: `items[]`, `total` (the count before truncation), `truncated` (boolean), and `for` (the `--for` filter as given, absent when none). The default page is the first 100 items, which is the design's "<= 100 lines" rule; `--all` lifts it. A list verb's text mode prints at most 100 lines for the same reason, ending in a line that names `--all`; every other command prints its whole text, so a `show` body is never cut. `--for <ref>` narrows a list to what references a task (`02-3`), a part (`02`) or a file path; the list verbs that accept it say so in their entry.
- **Full bodies only via `show`.** `list` returns summaries (id, type, summary, status, refs). `show <id>` returns the whole entry, package or attempt record. Dumping the whole state needs `query` with `--all`.
- **Kernel-stamped fields.** `id`, `at`, `author` and `source` on ledger entries, tickets, attempts and manifests are stamped by the kernel from its clock, git config and the ticket's role (P1), and so is every other field `kernel-state` marks as stamped (for example a `learning` entry's `fingerprint`). They appear in outputs and never in inputs; passing one is `input/forbidden-field`. `source: user` exists only on the stage-transition path (`hooks prompt-expansion`); `source: policy` only when `policy.gates.<gate>: auto` passes a gate (T02 decision R-9); `source: inferred` only from `change new --inferred`.
- **Identifiers.** Change ids, ledger ids (`L-`), ticket ids (`A-`), evidence ids (`E-`) and rule ids (`[PREFIX-n]`) are opaque strings to callers. Their format is fixed by `kernel-state` (Identifiers): the prefix followed by eight random characters of `[0-9a-z]`, non-sequential, with no allocator or lock; Change ids are `<yyyy-mm-dd>-<slug>`. Within the active Change an id is bare (`L-m2x9v7qa`); across Changes it is qualified (`<changeId>/L-m2x9v7qa`). Task ids are `<part>-<n>` (`02-3`), part ids two digits (`02`), artifact ids the node names of `pipeline.yaml` (`design`, `plan-verify`, `gate:design`). Ids in the examples of these specs are illustrative.
- **Time, hashes, sizes, paths.** `at` and every other timestamp the kernel writes is ISO 8601 UTC with milliseconds at a fixed width, `2026-09-25T09:41:07.123Z`, so string order is time order; an input timestamp may leave out the milliseconds. Hashes are `sha256:<64 hex>`. Sizes are bytes. Paths in outputs are relative to the project root with `/` separators; inputs accept absolute paths inside the project.
- **Idempotence and deduplication.** A command that would create an object identical by its dedupe key returns the existing object with `deduplicated: true` and exits 0 (`log add`, `evidence record`, `change checkpoint` when nothing changed). Commands that transition state refuse a repeated transition with `policy/invalid-transition` rather than silently succeeding, except where an entry says otherwise (`hooks prompt-expansion` on an already passed gate passes without writing, S5).
- **Refusal versus finding.** The kernel refuses (exit 2) when proceeding would break an invariant: a forbidden path, a missing ticket, a stale manifest. It records a `finding` entry and exits 0 when the deviation is information for the human: a file outside a task's `Files:`, an uncategorised verifier blocker (downgraded to `observation` with `review: true`, P8). Each entry names which of the two it does.
- **Clock and budgets are not arguments.** No command takes a timestamp, an author, a budget or a model name as input; budgets and the escalation model come from policy (T22), time from the kernel.

#### Scenario: list page cap

- **WHEN** a `list` verb runs without `--all` over more than 100 matching items
- **THEN** `items` holds the first 100, `total` the full count and `truncated` is `true`

#### Scenario: show body past 100 lines

- **WHEN** `dispatch show` prints a package of more than 100 lines in text mode
- **THEN** stdout is the whole file, byte for byte, with no truncation line

#### Scenario: kernel-stamped field in input

- **WHEN** `log add` or `log ingest` receives `id`, `at`, `author` or `source` as input
- **THEN** the exit code is 3 with `rule: input/forbidden-field`

#### Scenario: duplicate by dedupe key

- **WHEN** `log add`, `evidence record` or `change checkpoint` would create an object identical by its dedupe key
- **THEN** the existing object is returned with `deduplicated: true` and the exit code is 0

#### Scenario: timestamp with milliseconds

- **WHEN** `bdk log add finding "a" --ref src/a.ts --json` runs
- **THEN** the output's `at` matches `^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$`
