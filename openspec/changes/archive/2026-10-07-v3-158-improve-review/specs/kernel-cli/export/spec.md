# Spec Delta

## MODIFIED Requirements

### Requirement: bdk export agents

Generate a host's adapter files from the kernel's adapter definitions and the per-host tool map. The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk export agents --host claude [--out <dir>] [--check]`
- **Availability:** `orchestrator`
- **Mode:** `command`
- **Arguments:**
  - `--host claude`. Required. Claude Code is the only host in 3.0; any other value is `input/invalid-argument`.
  - `--out <dir>`. Default the `agents/` directory of the plugin root, the directory that holds the running bundle's `dist/`.
  - `--check`. Compare instead of writing; exit 2 when a generated file differs or is missing; write nothing.
- **Behaviour:** Writes exactly one file per adapter (`lead`, `worker`, `reader`, `integrator`, `judge`, `reviewer`, `runner`, `scout`, `role-contracts`, Adapters) at `<out>/<adapter>.md`: frontmatter with `name`, `description`, the host's `tools:` for the adapter's tool classes, the adapter's model tier and a generated marker, then a body of one sentence. The output is a pure function of the kernel version and the host: LF line endings, no timestamp, fixed key order. Other files in `<out>` are never read, written or compared, so the v2 agents that live next to the adapters until T42 are untouched. BDK's own generated adapters are the Claude Code output of this generator: `pnpm build` writes them into `agents/`, where git ignores them (`kernel-architecture`, Generated outputs), and the release ref carries them. `--check` stays for a person or a script that verifies a directory; CI does not run it, because the build step has just written the files.
- **Writes:** `<out>/{lead,worker,reader,integrator,judge,reviewer,runner,scout}.md`
- **Output:** `schema/cli/output/export-agents.json`
- **Exit codes and rules:** `0, 2, 3, 5`. Specific rules: `policy/generated-drift`; plus the common rules of every command (`kernel-cli`, Exit codes and the error object).
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

#### Scenario: committed adapters reproduced byte for byte

- **WHEN** `bdk export agents --host claude --out <tmp>` runs in the BDK repository and `<tmp>` is compared with the `agents/` that `pnpm build` wrote
- **THEN** each of the eight adapter files is byte-identical to its built copy, and `files` lists exactly the eight adapters, `integrator` and `judge` among them

#### Scenario: policy/generated-drift

- **WHEN** `agents/reader.md` was edited by hand and `bdk export agents --host claude --check` runs
- **THEN** the exit code is 2, the error object carries `rule: policy/generated-drift`, `why` names `agents/reader.md`, and no file is written

#### Scenario: missing adapter file

- **WHEN** `agents/scout.md` does not exist and `bdk export agents --host claude --check` runs
- **THEN** the exit code is 2 with `rule: policy/generated-drift` naming `agents/scout.md`

#### Scenario: v2 agents left alone

- **WHEN** `<out>` also holds `implementer.md` and `bdk export agents --host claude --out <out>` runs
- **THEN** `implementer.md` keeps its bytes and is absent from `files`

#### Scenario: host without a tool map

- **WHEN** `bdk export agents --host gemini` runs
- **THEN** the exit code is 3 with `rule: input/invalid-argument`, and `why` names `claude` as the only supported host
