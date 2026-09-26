# Spec Delta

## MODIFIED Requirements

### Requirement: Conventions

Success output, list pages, identifiers, timestamps, idempotence and the refusal-versus-finding split SHALL follow these conventions in every command.

- **Success output is a plain object.** No envelope: the `--json` output of a command is the object its schema under `schema/cli/output/` describes. Optional fields are absent when unknown, never `null`. Enumerations are lowercase words. Text mode renders the same data; only JSON is the contract.
- **List pages.** Every `list` verb and every command that returns a collection uses `schema/cli/common/list-page.json`: `items[]`, `total` (the count before truncation), `truncated` (boolean), and `for` (the `--for` filter as given, absent when none). The default page is the first 100 items, which is the design's "<= 100 lines" rule; `--all` lifts it. Text mode prints at most 100 lines for the same reason. `--for <ref>` narrows a list to what references a task (`02-3`), a part (`02`) or a file path; the list verbs that accept it say so in their entry.
- **Full bodies only via `show`.** `list` returns summaries (id, type, summary, status, refs). `show <id>` returns the whole entry, package or attempt record. Dumping the whole state needs `query` with `--all`.
- **Kernel-stamped fields.** `id`, `at`, `author` and `source` on ledger entries, tickets, attempts and manifests are stamped by the kernel from its clock, git config and the ticket's role (P1), and so is every other field `kernel-state` marks as stamped (for example a `learning` entry's `fingerprint`). They appear in outputs and never in inputs; passing one is `input/forbidden-field`. `source: user` exists only on the stage-transition path (`hooks prompt-expansion`); `source: policy` only when `policy.gates.<gate>: auto` passes a gate (T02 decision R-9); `source: inferred` only from `change new --inferred`.
- **Identifiers.** Change ids, ledger ids (`L-`), ticket ids (`A-`), evidence ids (`E-`) and rule ids (`[PREFIX-n]`) are opaque strings to callers. Their format is fixed by `kernel-state` (Identifiers): the prefix followed by eight random characters of `[0-9a-z]`, non-sequential, with no allocator or lock; Change ids are `<yyyy-mm-dd>-<slug>`. Within the active Change an id is bare (`L-m2x9v7qa`); across Changes it is qualified (`<changeId>/L-m2x9v7qa`). Task ids are `<part>-<n>` (`02-3`), part ids two digits (`02`), artifact ids the node names of `pipeline.yaml` (`design`, `plan-verify`, `gate:design`). Ids in the examples of these specs are illustrative.
- **Time, hashes, sizes, paths.** `at` and every other timestamp is ISO 8601 UTC with seconds, `2026-09-25T09:41:07Z`. Hashes are `sha256:<64 hex>`. Sizes are bytes. Paths in outputs are relative to the project root with `/` separators; inputs accept absolute paths inside the project.
- **Idempotence and deduplication.** A command that would create an object identical by its dedupe key returns the existing object with `deduplicated: true` and exits 0 (`log add`, `evidence record`, `change checkpoint` when nothing changed). Commands that transition state refuse a repeated transition with `policy/invalid-transition` rather than silently succeeding, except where an entry says otherwise (`hooks prompt-expansion` on an already passed gate passes without writing, S5).
- **Refusal versus finding.** The kernel refuses (exit 2) when proceeding would break an invariant: a forbidden path, a missing ticket, a stale manifest. It records a `finding` entry and exits 0 when the deviation is information for the human: a file outside a task's `Files:`, an uncategorised verifier blocker (downgraded to `observation` with `review: true`, P8). Each entry names which of the two it does.
- **Clock and budgets are not arguments.** No command takes a timestamp, an author, a budget or a model name as input; budgets and the escalation model come from policy (T22), time from the kernel.

#### Scenario: list page cap

- **WHEN** a `list` verb runs without `--all` over more than 100 matching items
- **THEN** `items` holds the first 100, `total` the full count and `truncated` is `true`

#### Scenario: kernel-stamped field in input

- **WHEN** `log add` or `log ingest` receives `id`, `at`, `author` or `source` as input
- **THEN** the exit code is 3 with `rule: input/forbidden-field`

#### Scenario: duplicate by dedupe key

- **WHEN** `log add`, `evidence record` or `change checkpoint` would create an object identical by its dedupe key
- **THEN** the existing object is returned with `deduplicated: true` and the exit code is 0

### Requirement: Availability classes

Each command SHALL carry exactly one availability class in the index, and the `hooks pre-tool` guard SHALL enforce the classes by exact verb.

Each command carries exactly one class in the index (`availability`). The `hooks pre-tool` guard (T24) reads the same index: it denies a subagent (hook input carries `agent_id`) every command whose verb is `orchestrator` or `hook`, and denies every thread a Bash invocation of a `hook` command. The match is by exact verb from the index, not by group prefix, so a read-only verb inside a guarded group (`change status`, `attempt list`, `part list`) stays callable from a subagent; the design's group-level deny list ("`bdk.mjs commit|attempt|part|change|log ingest|spec merge|hooks`") is the same set at verb granularity. The deny reason names the verb and tells the agent to return `blocked` with the cause instead of working around it.

| Class          | Who may call                                              | Guarded                                                                 | Verbs                                                                                                                                                                                                                                                                                                                                                              |
| -------------- | --------------------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `orchestrator` | The main thread (the orchestrating skill) and tests.      | Yes: denied to subagents by `hooks pre-tool`.                           | Every command that writes into the Change, the working tree or the configuration: `change new\|resume\|park\|takeover\|checkpoint\|close`, `done`, `part start\|done\|split`, `attempt open\|close`, `log ingest\|resolve\|route`, `dispatch build\|run`, `spec merge`, `config set`, `commit`, `rules add\|import\|export`, `export agents`, `rebuild`, `import`. |
| `agent`        | Subagents and the main thread.                            | No.                                                                     | The five operations a worker or runner needs (T2, T3): `log add`, `log show`, `dispatch show`, `evidence record`, `ctx skill\|role\|startup`.                                                                                                                                                                                                                      |
| `hook`         | The host only, through `hooks.json` or skill frontmatter. | Yes: a Bash invocation is denied in every thread (T1 defence in depth). | `hooks session-start\|session-end\|prompt-expansion\|pre-tool\|skill-exists`.                                                                                                                                                                                                                                                                                      |
| `read`         | Anyone.                                                   | No.                                                                     | Read-only queries with no side effect beyond the lazy index rebuild: `next`, `explain`, `validate`, `measure`, `change status\|list`, `part list`, `attempt list`, `log list`, `evidence check`, `spec delta check\|diff`, `config show\|check\|schema`, `query`, `rules check\|show\|explain\|prune\|stats`, `doctor`, `version`.                                 |

`hooks prompt-expansion` is the only writer of `source: user` transition entries; there is no `approve`, no `gate pass`, and `log add` cannot produce `source: user` (T1, P1, S8). A model that wants a gate passed has exactly one option: render the gate status and stop, so that the user types the next stage command.

**Cross-check with the state contract (T14).** Every command that writes lists the Change directory paths it may touch in `writes[]` (index field); `read` commands have an empty list. `kernel-state`'s write map names a writer for every file in the Change directory and checks that each kernel writer is an `orchestrator`, `agent` or `hook` command here, never a `read` one, whose `writes[]` covers the path. The other writers are stage skills and roles that write artifact files (design and plan artifacts, `spec-delta/`, worker reports) through the host's file tools; the kernel validates those files at `done` and at `attempt close`.

#### Scenario: subagent calls an orchestrator verb

- **WHEN** a `PreToolUse` payload with `agent_id` carries a Bash command invoking an `orchestrator` verb such as `bdk.mjs commit`
- **THEN** `hooks pre-tool` denies with `guard/subagent-kernel-command` and the reason names the verb

#### Scenario: subagent calls a read verb of a guarded group

- **WHEN** a subagent invokes `bdk.mjs attempt list`
- **THEN** `hooks pre-tool` passes, because the match is by verb, not by group

#### Scenario: hook verb from Bash

- **WHEN** any thread invokes `bdk.mjs hooks ...` through Bash
- **THEN** `hooks pre-tool` denies with `guard/hooks-from-bash`
