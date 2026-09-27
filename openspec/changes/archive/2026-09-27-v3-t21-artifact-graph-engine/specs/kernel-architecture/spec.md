## MODIFIED Requirements

### Requirement: Change recipes

A new command, a new artifact kind and a new host hook SHALL each touch the files the recipes name and nothing outside them.

**A new command** touches one slice and the contract: add the record to `schema/cli/commands.json` and its requirement to the group's spec under `kernel-cli/<group>/` (the contract test enforces the pair), add `<slice>/commands/<command>.ts`, `<slice>/use-cases/<command>.ts`, `<slice>/schema/<command>.ts`, `<slice>/render/<command>.ts`, `<slice>/tests/<command>.test.ts` with one unit test per rule the record declares, and one E2E case per exit code, plus one line in `kernel/scripts/export-schemas.ts` naming the output schema file, so `pnpm build` generates it (design decision D-10 of `v3-t12-layered-config`). Nothing else outside the slice changes; the registry reads the index.

**A new artifact kind** touches `graph` and the plugin's `pipeline/` directory only: a node in `pipeline/pipeline.yaml` with its `requires` and node fields (`kernel-pipeline`, Pipeline file), a kind class in `graph/domain/kinds/` added to the kind registry with its files, hash inputs, applicability, instances and validator, and its instruction template `pipeline/<kind>.md`, whose prompt key `pipeline/<kind>` the kind registry declares. `next`, `explain`, `validate` and `done` need no change, and no other slice learns about the kind (the promise of approach A, kept at slice level).

**A new host hook** touches `hooks` only: a payload parser in `hooks/domain/`, a use case with the decision, and a fixture under `tests/fixtures/host-payloads/<version>/` recorded with the T01 probe.

#### Scenario: new command

- **WHEN** a Change adds a command
- **THEN** it adds the index record, the group spec requirement, one file per layer in the slice, one unit test per declared rule, one E2E case per exit code and its line in the schema generator, and no other file outside the slice and the contract changes

#### Scenario: new artifact kind

- **WHEN** a Change adds an artifact kind
- **THEN** it changes files under `kernel/src/graph/domain/kinds/`, `pipeline/` and the kind's tests only, and the code of `next`, `explain`, `validate`, `done` and every skill is unchanged
