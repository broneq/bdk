# kernel-cli/export Specification

## Purpose

Host exports (`export`). Generators for host-specific files. `agents` writes a host's agent files from the role skills; `rules export` (in the `rules` group) writes the rule projection.

Common rules, not repeated per requirement: every command may emit `input/unknown-command`, `input/unknown-flag`, `input/missing-argument`, `input/invalid-argument`, `runtime/node-version`, `runtime/not-a-repo`; every Change-scoped command additionally `policy/no-active-change`, `state/corrupted-index`, `state/ledger-invalid`, `state/change-dir-missing`. Their meaning and exit codes are in `kernel-cli`, Exit codes and the error object; a command's `exits` in the index is derived from the classes of its specific and common rules.

Representative refusal:

```json refusal
{
  "refused": true,
  "rule": "input/missing-argument",
  "why": "--host is required: claude, gemini, cursor or opencode",
  "instead": [
    "bdk export agents --host claude",
    "bdk export agents --help"
  ]
}
```

## Requirements

### Requirement: bdk export agents

Generate a host's agent files from the role skills and the per-host tool map. The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk export agents [--host claude|gemini|cursor|opencode] [--out <dir>] [--check]`
- **Availability:** `orchestrator`
- **Mode:** `command`
- **Arguments:**
  - `--host claude|gemini|cursor|opencode`. Required.
  - `--out <dir>`. Default the host's agents directory.
  - `--check`. Exit 2 when the committed files differ; write nothing.
- **Behaviour:** BDK's own `agents/` is the Claude Code output of this generator, checked by a content test (T23 acceptance: byte-identical). `setup` runs it for the detected host.
- **Writes:** `<host agents directory>`
- **Output:** `schema/cli/output/export-agents.json`
- **Exit codes and rules:** `0, 3, 5`. Specific rules: none; plus the common rules of every command (`kernel-cli`, Exit codes and the error object).
- **Example:**

  ```bash
  bdk export agents --host claude --check --json
  ```

  ```json
  {
    "host": "claude",
    "files": [
      {
        "adapter": "worker",
        "path": "agents/worker.md",
        "changed": false
      }
    ],
    "changed": false
  }
  ```

- **Owner:** T23
- **Slice:** `export`

#### Scenario: example run

- **WHEN** `bdk export agents --host claude --check --json` runs as in the example
- **THEN** the exit code is 0 and stdout validates against `schema/cli/output/export-agents.json`
