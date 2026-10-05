## ADDED Requirements

### Requirement: Contracts leave BDK's own files to setup

The files under `.bdk/` are written by the kernel; a project tool that reports them is misconfigured, and only the user may change that configuration (T51). The role contracts SHALL say so in one line each:

- `reviewer` and `integration-reviewer`: a problem caused only by files under `.bdk/` is a `question` entry naming `/bdk:setup`, not a finding.
- `implementer` and `simplifier`: never change the project's tool configuration for `.bdk/` files, and never rewrite them with a formatter; log a `question` naming `/bdk:setup` instead.
- `runner`: paths under `.bdk/` get no finding but one `question` naming `/bdk:setup`, and a check that fails only on them is recorded `not-run` with that reason.

Every role body SHALL stay within the 4 096-byte budget of `Role contract content`.

#### Scenario: the line in each contract

- **WHEN** the content test reads the bodies of `implementer`, `simplifier`, `runner`, `reviewer` and `integration-reviewer`
- **THEN** each names `.bdk/`, `question` and `/bdk:setup`; `implementer` and `simplifier` also forbid changing the project's tool configuration and rewriting `.bdk/` files with a formatter; `runner` names `not-run`

#### Scenario: run-auto with the project's own lint

- **WHEN** the `run-auto` stage case runs on the eval fixture prepared as `/bdk:setup` leaves it, with `npm run lint` as its `tools.lint`
- **THEN** the Change is archived, and no commit after the preparation touches `.markdownlint-cli2.mjs`, `eslint.config.js`, `package.json` or `scripts/`
