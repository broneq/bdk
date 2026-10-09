## MODIFIED Requirements

### Requirement: No paid evals in CI, free checks of the suite

No CI workflow SHALL start a paid eval run. PR CI SHALL find every `plugins/<name>/evals/` that holds a case and, for each, load every case with the pinned Claude Code loader at a cost ceiling of zero and with the tools that plugin's eval README grants, and fail on a case that does not load or a grader that cannot pass with those tools. It SHALL run every case scaffold of every such suite and every shared fixture of `plugins/bdk/evals/fixtures/` as the harness runs them, and fail on a missing script or a non-zero exit. A suite whose plugin has no grants listed for the check SHALL fail it. The check SHALL prove that it detects a broken case, so a change in the loader's output cannot turn it into a silent pass.

#### Scenario: Broken case fails CI

- **WHEN** a case under `plugins/bdk/evals/` has an unknown frontmatter key and `pnpm test` runs
- **THEN** the eval suite test fails and names the case

#### Scenario: Broken case of another plugin fails CI

- **WHEN** the `case.yaml` of `plugins/bdk-skill-kit/evals/skill-check-internal-error` is not valid YAML, or names a `scaffold_script` that does not exist, and `pnpm check` runs
- **THEN** it fails and names the plugin and the case

#### Scenario: Every plugin's cases load

- **WHEN** `pnpm test` runs on a tree where `plugins/bdk/evals/`, `plugins/bdk-craft/evals/` and `plugins/bdk-skill-kit/evals/` hold cases
- **THEN** the loader check runs once for each of the three suites and every case loads

#### Scenario: New suite without grants

- **WHEN** a plugin gains its first eval case and the check lists no grants for that plugin
- **THEN** the eval suite test fails and names the plugin

#### Scenario: Broken fixture fails CI

- **WHEN** a shared fixture or a case scaffold exits non-zero and `pnpm test` runs
- **THEN** the eval suite test fails and names the script

#### Scenario: No credentials needed

- **WHEN** the check runs with an empty `HOME` and no model credentials
- **THEN** it completes without a model call and without cost
