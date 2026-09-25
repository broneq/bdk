# kernel-cli/ctx Specification

## Purpose

Prompt context (`ctx`). The three inject-mode composers that replace the v2 injection scripts: `skill` for a skill's `!` block, `role` for a role class, `startup` for the session foundation.

Common rules, not repeated per requirement: every command may emit `input/unknown-command`, `input/unknown-flag`, `input/missing-argument`, `input/invalid-argument`, `runtime/node-version`, `runtime/not-a-repo`; every Change-scoped command additionally `policy/no-active-change`, `state/corrupted-index`, `state/ledger-invalid`, `state/change-dir-missing`. Their meaning and exit codes are in `kernel-cli`, Exit codes and the error object; a command's `exits` in the index is derived from the classes of its specific and common rules.

Representative refusal:

```json refusal
{
  "refused": true,
  "rule": "input/not-found",
  "why": "no skill named debugg under skills/ or the configured fragment roots",
  "instead": [
    "bdk ctx skill debug",
    "check the skill name in the ! block"
  ]
}
```

## Requirements

### Requirement: bdk ctx skill

Compose the prompt context a skill's `!` block injects: tool tiers, fragments, rules, prompt values. The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk ctx skill <name>`
- **Availability:** `agent`
- **Mode:** `inject`
- **Arguments:**
  - `<name>` (required). Skill name, e.g. debug, plan.
- **Behaviour:** Replaces `inject.py`, `inject-rules.py` and `inject-language-rules.py` (Configuration section). Inject mode: exits 0 always; a configuration error becomes a STOP block. Resolution order: feature flags from the resolved configuration, then fragment chains, then rules by id filtered by `applies`, then Markdown prompt values with `mode: extends|replace`.
- **Writes:** nothing
- **Output:** `schema/cli/output/ctx.json` for `--json`; Markdown otherwise (`kernel-cli`, Output modes).
- **Exit codes and rules:** `0` always (inject mode). Rules rendered as a STOP block: `input/not-found`, `policy/unknown-config-key`; plus the common rules of every command (`kernel-cli`, Exit codes and the error object).
- **Example:**

  ```bash
  bdk ctx skill debug --json
  ```

  ```json
  {
    "content": "## Tool tiers\n...",
    "parts": [
      {
        "kind": "tier",
        "source": "fragments/tool-tiers/search.chain.json"
      },
      {
        "kind": "rules",
        "source": "rules/code-quality.md"
      }
    ]
  }
  ```

- **Owner:** T13
- **Slice:** `ctx`

#### Scenario: example run

- **WHEN** `bdk ctx skill debug --json` runs as in the example
- **THEN** the exit code is 0 and stdout is the composed Markdown, or under `--json` an object that validates against `schema/cli/output/ctx.json`

#### Scenario: input/not-found

- **WHEN** the referenced object does not exist in the active Change, the configuration or the bundle
- **THEN** the exit code is 0 and the output is a STOP block whose `why` and `instead` are those of `input/not-found`

#### Scenario: policy/unknown-config-key

- **WHEN** a key no module schema declares
- **THEN** the exit code is 0 and the output is a STOP block whose `why` and `instead` are those of `policy/unknown-config-key`

### Requirement: bdk ctx role

Compose the context for a role class (worker, reader, reviewer, verifier, runner). The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk ctx role <class>`
- **Availability:** `agent`
- **Mode:** `inject`
- **Arguments:**
  - `<class>` (required).
- **Behaviour:** Role skills under `skills/roles/` and the dispatch package builder (T23) use it; the role must be named because a skill cannot know which agent preloaded it. Same output shape and STOP behaviour as `ctx skill`.
- **Writes:** nothing
- **Output:** `schema/cli/output/ctx.json` for `--json`; Markdown otherwise (`kernel-cli`, Output modes).
- **Exit codes and rules:** `0` always (inject mode). Rules rendered as a STOP block: `input/not-found`, `policy/unknown-config-key`; plus the common rules of every command (`kernel-cli`, Exit codes and the error object).
- **Example:**

  ```bash
  bdk ctx role worker --json
  ```

  ```json
  {
    "content": "## Worker role\n...",
    "parts": [
      {
        "kind": "tier",
        "source": "fragments/tool-tiers/edit.chain.json"
      },
      {
        "kind": "rules",
        "source": ".bdk/rules/"
      }
    ]
  }
  ```

- **Owner:** T13
- **Slice:** `ctx`

#### Scenario: example run

- **WHEN** `bdk ctx role worker --json` runs as in the example
- **THEN** the exit code is 0 and stdout is the composed Markdown, or under `--json` an object that validates against `schema/cli/output/ctx.json`

#### Scenario: input/not-found

- **WHEN** the referenced object does not exist in the active Change, the configuration or the bundle
- **THEN** the exit code is 0 and the output is a STOP block whose `why` and `instead` are those of `input/not-found`

#### Scenario: policy/unknown-config-key

- **WHEN** a key no module schema declares
- **THEN** the exit code is 0 and the output is a STOP block whose `why` and `instead` are those of `policy/unknown-config-key`

### Requirement: bdk ctx startup

Render the STARTUP instructions, including the agents table generated from agent frontmatter (P11). The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk ctx startup`
- **Availability:** `agent`
- **Mode:** `inject`
- **Arguments:**
  - none beyond `--json` and `--help`.
- **Behaviour:** Called by `hooks session-start`. The agents table is byte-identical to what the content test compares against `STARTUP_INSTRUCTIONS.md` (P11, T6).
- **Writes:** nothing
- **Output:** `schema/cli/output/ctx.json` for `--json`; Markdown otherwise (`kernel-cli`, Output modes).
- **Exit codes and rules:** `0` always (inject mode). Rules rendered as a STOP block: `policy/unknown-config-key`; plus the common rules of every command (`kernel-cli`, Exit codes and the error object).
- **Example:**

  ```bash
  bdk ctx startup --json
  ```

  ```json
  {
    "content": "# BDK Shared Foundation\n...",
    "parts": [
      {
        "kind": "agents-table",
        "source": "agents/"
      },
      {
        "kind": "tier",
        "source": "fragments/tool-tiers/explore.chain.json"
      }
    ]
  }
  ```

- **Owner:** T13
- **Slice:** `ctx`

#### Scenario: example run

- **WHEN** `bdk ctx startup --json` runs as in the example
- **THEN** the exit code is 0 and stdout is the composed Markdown, or under `--json` an object that validates against `schema/cli/output/ctx.json`

#### Scenario: policy/unknown-config-key

- **WHEN** a key no module schema declares
- **THEN** the exit code is 0 and the output is a STOP block whose `why` and `instead` are those of `policy/unknown-config-key`
