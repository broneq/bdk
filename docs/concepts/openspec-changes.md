# OpenSpec Changes - the unit of work and the living specs

BDK keeps every piece of work as an [OpenSpec](https://github.com/Fission-AI/OpenSpec) Change. A Change says why and what before any code exists, the stages build and review against it, and when it closes its spec deltas become part of the project's specs. The specs under `openspec/specs/` are therefore always the current description of what the product does: the living documentation BDK keeps for you.

## A Change on disk

```text
openspec/
  config.yaml                    schema: bdk
  schemas/bdk/                   the BDK schema, installed by /bdk:setup
  specs/<capability>/spec.md     what the product does today
  changes/<change>/              one directory per open Change
    proposal.md                  why and what, the capabilities it touches
    specs/<capability>/spec.md   spec deltas: ADDED, MODIFIED, REMOVED requirements
    design.md                    how, with the decisions and the options that lost
    plan/parts/NN.md             the work in parts, one agent each
  changes/archive/<date>-<change>/   closed Changes
```

The BDK schema (`schema: bdk`) defines these four artifacts and the order they are written in: proposal, then specs, then design, then plan parts. It has no task checklist: the progress of the build is run state under `.bdk/runs/<change>/`, not a file in the Change ([run state](./run-state.md)).

## Requirements and scenarios

A spec delta holds requirements, each with scenarios in WHEN / THEN form:

```markdown
### Requirement: Orders export as CSV
The order list SHALL offer a CSV download of the orders it shows.

#### Scenario: Export the filtered list
- **WHEN** a user filters the order list by "shipped" and chooses Export CSV
- **THEN** the browser downloads `orders.csv` holding only the shipped orders
```

Scenarios are the acceptance criteria of the whole run. Each plan part names the scenarios it makes true, and the implementer writes their tests first. The conformer checks the part against them. The [E2E check](./e2e.md) does not replay them: it derives its paths from the proposal and uses the running product as a user would. `/bdk:spec-conformance` checks the product against them in every review round and once more before the archive.

## Who writes what

| Artifact | Written by | Checked by |
|---|---|---|
| `proposal.md` | `/bdk:propose` (or `/bdk:diagnose-bug` for a bug) | you |
| spec deltas, `design.md` | `/bdk:design-draft` (a review fix part may add what a delta misses) | `/bdk:verify-design`, then you at the design gate; `/bdk:spec-conformance` in each review round |
| `plan/parts/NN.md` | `/bdk:plan-draft` | `/bdk:verify-plan`, `bdk plan check` |
| main specs | `openspec archive` in `/bdk:close` | `/bdk:spec-conformance` before it |

You can edit any of them by hand between stages. A stage reads the files as they are when it starts.

## Closing: from deltas to specs

`/bdk:close` first runs `/bdk:spec-conformance`: a verifier compares the spec deltas with the diff and the E2E verdict. Each review round ran the same check and fixed what it found, so close fails only on what changed after the last round. Only when it passes does `openspec archive` move the Change to `changes/archive/` and merge its deltas into `openspec/specs/`. The archive is committed with the work, so the pull request carries the code and the updated specs together.

## Without spec deltas

A Change that changes no behaviour (a refactoring, tooling, documentation) has no capability. Its `.openspec.yaml` sets `skip_specs: true`, and the stages skip what only scenarios feed, such as the acceptance tests; the E2E check is `SKIPPED` when the proposal changes nothing a user does.

## Sources

- `plugins/bdk/openspec/schemas/bdk/` (the BDK schema and its templates)
- `plugins/bdk/skills/propose/`, `design-draft/`, `plan-draft/`, `spec-conformance/`, `close/`
