## Why

Plan: docs/V3-IMPLEMENTATION-PLAN.md, T41 (Delivery item 3). Tracks #61.

A Change opened with `/bdk:change` now stops at `/bdk:design`, and that command still runs the v2 skill: it writes `.bdk/design/<ts>-<slug>-design.md`, a path the v3 kernel does not read, never calls `bdk done design`, and hands off to `/bdk:create-plan` and `/bdk:create-adr`. Nothing in v3 verifies a design either. The kernel already has the pieces (a `design-verifier` role over the `reader` adapter, `attempt open verifier`, a dispatch package with the closed P8 categories), but the graph has no node that needs a verdict: a probe on 2026-10-01 showed `gate:design` ready as soon as `bdk done design` ran. A user who passes that gate, or `run` with an automatic design gate, moves to planning on a design nobody checked. This Change delivers the v3 `design` and `verify-design` stage skills and the node that makes verification part of the graph.

## What Changes

- **New stage skill `design`** (replaces the v2 `skills/design`, T02 disposition "redesign"): a thin skill driven by `bdk next`.
  - Grounds itself in the code before any question, then explores at least two approaches per real branching decision, each with a Mermaid diagram and a self-critique (bottleneck, single point of failure, hidden cost, unconfirmed assumption), and the user picks.
  - Writes the files the kernel names: `design.md` for `small`; for a split design (three or more subsystems, or over 12 KB) `design/parts/<nn>-<slug>.md`, after which `bdk done design` raises the profile to `large` itself (T21); `architecture.md` unless the frontmatter declares `architecture: false`. The skill writes no frontmatter field or path the kernel's instruction does not name.
  - Every decision taken with the user and every open question becomes a ledger entry (`bdk log add decision|question`) with refs, not prose in the file. This absorbs the decision capture of `create-adr` (T02 OD-1).
  - Keeps the v2 schema-change gate: a design that changes a data model shows the current shape, offers the proposals and records the approved one as a `decision` before verification.
  - Finishes each artifact with `bdk done <id>`, runs `/bdk:verify-design`, shows the written design with the verdict in one review (decision 5), and ends with the gate status of `bdk change status`, naming `/bdk:plan` and the pending review entries.
- **New stage skill `verify-design`**: verifies the current design on a fresh context, invoked by `design` and runnable on its own. It opens a `verifier` ticket on the new `design-verify` node, builds the `design-verifier` package, starts the role through the `bdk:reader` adapter with the package path as its prompt, closes the ticket from the role's report and, on a passing report with no live blocker, marks `design-verify` done. On blockers it reports them and what the attempt budget allows next (retry, escalate, park).
- **New kernel kind and node `design-verify`** (decision 1): a verdict kind like `plan-verify`, hashed over `design.md`, `architecture.md` and every design part, so any change to the design makes the verdict stale. `gate:design` requires it. The kernel registers sixteen kinds instead of fifteen. Every verdict kind also refuses a report older than the artifact it verifies (decision 4).
- **A working `report` entry** (decision 8): no command could write the `report` entry a verdict kind reads, because `log add report` had no way to fill its required `report` field and `log ingest` writes no entries; every verdict node was unreachable outside test fixtures. `log add report --ticket <ticket>` now names the report `log ingest` stored under that ticket and the ticket's target, and the `verifier` and `design-verifier` contracts record it after `log ingest`.
- **Asking the user in two tiers** (decision 2): the `decision` fragment of `bdk ctx skill` keeps simple bounded questions in `AskUserQuestion` even when Lavish is on, and sends only decisions that need a page (approach comparisons with diagrams, a schema delta, the review of a draft design) through the current `lavish-axi` review loop. The fragment's procedure is rewritten for that loop; the fallback states what the terminal loses.
- **Removed**: the v2 `skills/design/` (in the same Change, so `/bdk:design` resolves to one skill). `skills/create-adr/` stays until T42's `adr` tools skill replaces it (decision 3).
- **`ctx skill` manifest**: `design` keeps its parts; `verify-design` gets an empty entry for its `BDK STOP` line.
- **Evals**: case files `design.yaml` and `verify-design.yaml` in the `stages` suite; this Change runs only `--probe`.
- **User documentation**: `reference/skills.md`, `reference/artifacts.md`, the workflow pages that name `/bdk:design`, and README's skill table.

## Capabilities

### New Capabilities

None. `stage-skills` exists since `v3-t41-setup-change` and gains the two skills.

### Modified Capabilities

- `stage-skills`: requirements for `design` and `verify-design`; the shape requirement names which stage skills a model may start; a requirement for the two tiers of asking the user, which every stage skill follows through the `Asking the user` section of its context.
- `kernel-pipeline`: the `design-verify` kind (sixteen kinds), its node in the graph variants, `gate:design` requiring it, and the `fresh` check of every verdict kind.
- `skill-evals`: the `stages` suite covers every stage skill, not only the user-only ones.
- `kernel-cli/log`: `log add report` fills the entry's `report` field from the ticket's package and refuses before the report is stored.
- `role-contracts`: the `verifier` and `design-verifier` contracts record their stored report with `log add report`.

`kernel-cli/ctx` needs no delta: it chooses between the two fragment files and does not specify their text. `skill-content-checks` already leaves `design` and `verify-design` out of its user-only gate list.

## Impact

- New: `skills/stages/design/` (SKILL.md, references for the approach loop and the self-critique), `skills/stages/verify-design/SKILL.md`, `pipeline/design-verify.md`, the kind class next to `PlanVerifyKind`, `evals/suites/stages/cases/design.yaml` and `verify-design.yaml`.
- Removed: `skills/design/` (v2).
- Changed: `pipeline/pipeline.yaml`, `kernel/src/graph/config.ts` and the kind registry, `schema/` outputs that enumerate kinds, `fragments/decision/lavish.md` and `ask-user.md`, `kernel/src/ctx/use-cases/manifest.ts`, `evals/suites/stages/suite.ts`, `dist/bdk.mjs` (rebuilt), README, `docs/guide/`.
- Kernel tests that count kinds or list the design-stage nodes change with the new node; fixtures that record a verdict report before the `done` of the verified node change with the `fresh` check.
- Out of scope: `plan`, `verify-plan` (`v3-t41-plan`); `execute` (`v3-t41-execute`); `close`, `run` and how `run` drives the design gate (`v3-t41-close-run`); the `adr` tools skill and the MADR template (T42).

## Decisions taken with the user (2026-10-01)

1. **`design-verify` node.** A verdict node mirroring `plan-verify`, so the graph enforces design verification for `small` and `large` feature Changes. Rejected: advisory verification through `review: true` ledger entries, which `run` with an automatic gate would pass by.
2. **Lavish only for rich decisions.** No Lavish page for a question such as "new branch or the current one". A decision whose options a label and one sentence describe goes to `AskUserQuestion`; a decision that needs a diagram, a side-by-side comparison, a schema delta or an annotated draft goes to Lavish when it is on, otherwise the comparison is printed before `AskUserQuestion`. The rule lives in the shared `Asking the user` fragment.
3. **ADR export in T42.** `design` writes decisions to the ledger only and carries no MADR template; rendering a ledger decision, or a decision made outside a Change, as `docs/adr/NNNN-*.md` belongs to the thin `adr` tools skill of T42 (OD-1 (b)). One decision store; `design` stays under 200 lines; `skills/create-adr/` stays until `adr` replaces it.
4. **Fresh verdicts.** Every verdict kind (`design-verify`, `plan-verify`, `review`) gains a check `fresh`: its latest report must not be older than the latest `done` of a node it requires. Without it, `bdk done design-verify` after a design change passes again on the old report.
5. **Verify, then review.** `design` writes the chosen approaches, runs `/bdk:verify-design`, and shows the written design with the verdict in one review. A requested change is written and verified again before the next review; the gate is rendered only after the user accepts. Rejected: a draft review before verification, which costs a round and hides the verifier's points from the review.
6. **Coordinator acts on the verdict.** `false-code-claim` blockers are corrected without a question (a correction that changes a recorded decision is asked); other blockers go to the user in one question with proposed fixes; for a `done-with-concerns` verdict the coordinator decides per finding whether to fix it before planning and shows each decision with its reason in the review.
7. **Invocation.** `design` and `verify-design` stay model-invocable (T02 section 13.1 gives user-only gating to `change`, `plan`, `execute`, `close` and `run`): `design` starts `verify-design`, and the stage-command gate still checks a user-typed `/bdk:design`.
8. **The role records its report.** `log add report --ticket` fills the entry from the ticket's package, and the verifier roles call it after `log ingest`. Rejected: `attempt close` writing the entry (a second writer of role entries), and a `--report <path>` flag (a path the kernel already knows).
