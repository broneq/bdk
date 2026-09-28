# Design

## Context

See proposal.md, Why. This is part B of T23. The decisions T23-D0 to D24 and the spike facts live in the part A design (`openspec/changes/archive/2026-09-28-v3-t23a-roles-adapters/design.md`); this design cites them and adds T23-D25 onwards. Four of the new decisions were taken by the user in a Lavish review on 2026-09-28 (`.lavish/v3-t23b-questions.html`), with worked examples of each option.

State today:

- `dispatch build` and `dispatch show` are index records answering `kernel/not-implemented`; the package and report schemas exist (`kernel/src/shared/store/state/{dispatch,report}.ts`), and `shared/store` already resolves a ticket to its package (`ticketDispatch`).
- `log ingest` (T22) ingests a `bdk-entries` block, is `orchestrator`-only and reads `--file` or stdin; `log add` has no `--category`; the observation cap is specified but not enforced.
- `rules show` is a T31 stub; there is no `rules` slice. The rule prompt values (`rules/<category>`, `rules/languages/*`) and `languages` are declared and consumed by `ctx`.
- The role skills of part A already name `dispatch show`, `rules show --ticket`, `log add --category` and `log ingest --ticket`.

## Goals / Non-Goals

**Goals:**

- A package an agent can work from with nothing else: task, binding decisions, role, rules command, return contract, within 12 KB.
- One report channel with a check at write time, so a malformed envelope is fixed by the agent that wrote it, not discovered at `attempt close`.
- P8 enforced by the kernel where entries are written, not by the orchestrator.

**Non-Goals:**

- Evidence primitives, post-task nodes, the swarm skill (including the orchestrator's single resume), `log list --since-ticket-start`, prune (part C).
- Rule ids, `rules show <id>`, selection by `applies` (T31). Guard hooks (T24). v2 skill rewiring (T42).

## Decisions

- **T23-D25 Every role stores its report through `log ingest` (user choice).** The `implementer` loses the direct Write path to its report: the kernel stamps `schema`, `ticket` and `role`, validates the envelope and checks `entries` before anything is stored, so a wrong envelope is refused while the agent is still running. The role contract tells every agent to check the exit code and resubmit (user note). Alternative: the implementer writes the file itself - rejected, it must hand-write `schema: 1` and the stamped fields, and the only check is at `attempt close`, after the agent is gone.
- **T23-D26 `log ingest` stores reports and writes no entries.** Stdin only (`--file` dropped: an agent never has a report file to point at), `schema` / `ticket` / `role` in the input are `input/forbidden-field` (P1), a bad field is the new `input/invalid-envelope` (replaces `input/invalid-block`), `entries` and `evidence` ids are checked with `policy/entries-missing`. A later call under the same open ticket replaces the report (`replaced: true`), which is what makes resubmission cheap. `attempt close --envelope` keeps its own `entries` check (T22) for a report that reached `reports/` another way.
- **T23-D27 Rule selection by role, languages from settings (user choice).** A role-to-category map in the kernel (`rules` domain): `implementer`, `reviewer`, `pr-reviewer` get `code-quality`, `architecture`, `design-patterns`, `security`, `test-quality` plus the language rules; `verifier` gets `architecture`, `test-quality`, `engineering-judgment`; `design-verifier` gets `architecture`, `engineering-judgment`, `security`; `runner` and `scout` none. Language rules are every name in `languages` with a prompt value, until T31 selects by `applies` and rule id. The target's files do not take part yet. Alternative: filter languages by file extension - rejected, it needs a new settings map that T31's `applies` makes redundant.
- **T23-D28 `rules-read` in the attempt record (user choice).** The first `rules show --ticket` stamps the record through a `shared/store` primitive; `attempt close` of an `implementer` ticket without it writes one kernel `finding` with `review: true` and returns `rulesFinding`, and the close goes on (R2 is a signal for the human, not a gate). Only the implementer is checked because it is the role that writes code; reviewers and verifiers without rules produce weaker findings, which their own loops expose. Alternative: a kernel `observation` per call - rejected, one meaningless entry per dispatch in every `log list`.
- **T23-D29 Role bodies are not overridable in 3.0 (user choice; corrects T23-D11).** A forked role loads the plugin's `SKILL.md` before it runs; if the package embedded a project override, a forked agent would see two different contracts. The package embeds the plugin body, and projects adapt behaviour through rule prompt values and `policy.verifier`. No `roles/<role>` prompt key exists, so a file at `.bdk/prompts/roles/verifier.md` is `policy/unknown-config-key`.
- **T23-D30 `rules` owns the rule text.** The dependency matrix already has `ctx -> rules` and `dispatch -> rules`, and a reverse edge is forbidden, so `rules show --ticket` cannot read rule text through `ctx`. The `rules/<category>` and `rules/languages/*` prompt keys and `languages` move to `kernel/src/rules/config.ts` (consumer `rules`), `rules` exposes the resolved sections through its `index.ts`, and `ctx` reads them from there for the skills' rule parts. `bdk ctx skill` output is unchanged; a contract test compares it before and after. Alternative: `rules -> ctx` and drop `ctx -> rules` - rejected, T31 designs `ctx` reading rules by id from `rules`, so the edge would flip back.
- **T23-D31 `dispatch build <target>` and target-specific bodies.** The first argument is the ticket's target (task, part, Change or artifact id, as `kernel-state` Attempt record), not a task: verifier tickets target a part or an artifact. Only a task target embeds its text (it is bounded and is what the worker executes); any other target names the artifact paths, because a whole plan part or design can exceed 12 KB on its own. The output's `task` becomes `target`, `entries.summaries` becomes `entries.counted` (per-type counts, T23-D13) and `rules` (rule ids) is dropped until T31.
- **T23-D32 Entry selection for a package.** Full text for `decision` with `status: accepted` and `blocker` not `resolved` whose refs name the target, the target's part, or one of the task's `Files:`; for every other type a count and `bdk log list --for <target>`. Matching by `Files:` catches a decision recorded against a file before the task existed.
- **T23-D33 `template-hash` covers what the agent is told.** sha256 over the template skeleton (placeholders, not values), the role body and the texts `rules show --ticket` prints for the ticket, each LF-normalised, trailing whitespace stripped, frontmatter removed (T23-D10). A project changing its rules changes the hash, which is what T40 needs to attribute behaviour.
- **T23-D34 P8 in `log add`, consumer `log`.** `policy.verifier` moves from consumer `dispatch` to `log`, the slice that downgrades; `dispatch` reads both lists through `log`'s `index.ts` (edge `dispatch -> log` added). The downgrade applies only under `verifier` and `design-verifier` tickets, names the given category in a fixed sentence that prefixes the body (an `observation` has no `category` field in `kernel-state`, found during apply) and reports `downgraded` in the output. `not-a-fail` is a second `{id, description}` list with the six items of the design's Verifier contracts, so projects extend it the same way. The default items always stay beneath the layers (`withDefaultItems`, found during apply), so a project adds or rewords a category but cannot remove a default one in 3.0 (user choice; the old sentence about replacing the array had no mechanism behind it).
- **T23-D35 Single resume is a contract of the orchestrator (user note).** `role-contracts` Dispatch prompt states it; the swarm skill (part C) implements it. B only guarantees that a missing or refused report is detectable: no file at the `report` path, or `log ingest` exit 2/3 in the agent's transcript. The test of the `one resume for a missing report` scenario therefore lands with part C, next to the swarm skill.
- **T23-D36 Scenario names of MODIFIED requirements are kept.** OpenSpec refuses a MODIFIED block that drops a scenario name, so the `policy/observation-cap`, `input/invalid-block`, `wrong type names the line` and `counter checked at close` scenarios keep their names and now describe the new behaviour (no cap, `input/invalid-envelope`, the envelope line, the early `entries` check).
- **T23-D37 `dispatch -> graph` for artifact targets (user choice, found during apply).** A verifier ticket targets an artifact such as `plan-verify`, whose files only the graph knows: the node's writes and inputs and those of the nodes it requires (`plan-verify` requires the plan parts). `graph` exposes them through its `index.ts`; the edge is acyclic because `graph` imports only `log` and `ctx`. Alternatives: a path table in `dispatch` - rejected, it duplicates the kinds and drifts when a kind is added; only `bdk explain <target>` in the package - rejected, the spec asks for the paths and the agent would pay one more call.
- **T23-D38 Only list verbs cap their text (user choice, found by the live check of task 7.2).** The registry cut every command's text at 100 lines and named `--all`, which only the list verbs accept, so a forked verifier saw half of a 117-line package and a flag the kernel then refused. List verbs keep their cap in their handlers behind their own `--all`; every other command prints its whole text, as `Full bodies only via show` already required. Alternatives: cap everywhere except `show`, naming `--json` - rejected, `config show` and `config schema` would still print a cut YAML or JSON document; a separate issue - rejected, the package is unusable in text mode today.

## Risks / Trade-offs

- [A task with many accepted decisions exceeds 12 KB] → `policy/package-too-large` names the largest section; the instead lines are `part split` and resolving or superseding decisions. The E2E fixture records the size of a typical task package so a template change that grows it shows up in review.
- [An implementer's rules are about 29 KB with two languages] → Read on demand through Bash, not in the package; T31 narrows by rule id and `applies`; T40 measures the effect.
- [`rules` slice refactor touches `ctx`] → The `ctx skill` output for every manifest entry is compared byte for byte in the existing contract test before and after the move.
- [Envelope refusals loop an agent] → Each refusal names one field and its line; the orchestrator resumes at most once (T23-D35).
- [`log ingest` availability change widens what a subagent can do] → It writes only `reports/` at its own ticket's path and no entries; T24's guard still denies every `orchestrator` verb.
- [Roles and the ledger disagree until part C] → `evidence` ids in an envelope can only be empty until `evidence record` lands; `log ingest` accepts an empty list.

## Migration Plan

`dispatch build` / `show` and `rules show --ticket` had no implementation. `log ingest`'s T22 implementation is replaced; no release shipped it and no project calls it, so no migration. `policy.log.max-observations` was never registered. Rollback is a revert of the PR.

## Open Questions

None. The four questions of the review are decided (T23-D25, D27, D28, D29).
