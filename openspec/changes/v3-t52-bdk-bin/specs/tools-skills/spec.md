## MODIFIED Requirements

### Requirement: bdk-cli points to the kernel help

`/bdk:bdk-cli` SHALL be a skill that fronts a CLI: `metadata.fronts-cli` set to `bdk`, at most 30 lines, and model-invocable. It SHALL say:

- when to reach for the kernel: Change state, the ledger, rules, evidence and configuration questions;
- the invocation form `bdk <group> <verb>`, the command the plugin puts on the Bash tool's `PATH`, with `--json` for output a caller acts on;
- that `bdk --help` and `bdk <group> --help` are the only usage reference.

It SHALL copy no flag table, subcommand list or exit code, and SHALL name no path to the bundle. Its `allowed-tools` SHALL be `Bash(bdk *)`.

#### Scenario: thin front

- **WHEN** `pnpm skill-check` checks `skills/tools/bdk-cli/SKILL.md`
- **THEN** the `cli-front` rule passes, the file has at most 30 lines, and it names `--help`

#### Scenario: invocation without a path

- **WHEN** the content test reads `skills/tools/bdk-cli/SKILL.md`
- **THEN** it names `bdk <group> <verb>`, its `allowed-tools` is `Bash(bdk *)`, and no line names `bdk.mjs` or `CLAUDE_PLUGIN_ROOT`
