# Design

## Context

`models` is a record `role -> model` in `plugins/bdk/src/config/domain/settings.ts` (spec `bdk-cli/config`, "Settings keys"). Its description lists eight roles. No code reads it: each skill reads the configuration from its `bdk config show` block and passes `model` on its `Agent` call (spec `bdk-cli/config`, "Configuration reaches skills and agents"; ADR-0003: logic lives in skills, the CLI only computes). So a role works exactly where a skill text says to pass it.

An audit of every `subagent_type` in `plugins/bdk/skills/*/SKILL.md`:

| Skill | Agent | `models.<role>` passed |
|---|---|---|
| `execute`, `auto-review`, `pr-review` | `bdk:lead` | yes |
| `execute-waves`, `implement-part`, `resolve-conflict` | `bdk:implementer` | yes (escalation first) |
| `execute-waves`, `conform-part` | `bdk:conformer` | yes |
| `review-round`, `pr-review-round` | reviewer, integration-reviewer, e2e-tester, judge | yes |
| `plan`, `verify-plan` | `bdk:verifier` | yes |
| `design`, `explore` | `bdk:explorer` | **no** |
| `design`, `verify-design` | `bdk:verifier` | **no** |
| `close`, `spec-conformance` | `bdk:verifier` | **no** |

The six missing calls are the whole defect. `debug`, `run`, `propose`, `setup` and the other skills start no agent themselves; they call stage skills.

## Goals / Non-Goals

**Goals:** every agent of the plugin has a role; every `Agent` call passes it; a test keeps agents, description and skill texts in step; the docs say the same as the schema.

**Non-Goals:** effort per role, roles for main-thread work such as a designer or planner (#278); a model check of the value (any alias or name stays accepted, as today).

## Decisions

### D1. `explorer` is a configurable role

The issue asks whether `explorer` becomes a role. It does: `models.explorer`.

- Alternative: keep the explorer fixed on haiku and document why. Lost: the explorer's map feeds the design, and a team on a large or unusual code base may want a stronger model; there is no reason to treat one agent differently from the other eight, and a fixed exception is one more thing for users to learn and for the docs to explain.
- The default stays the frontmatter `model: haiku`; nothing changes for a project that does not set it.

### D2. Roles are the agent file names, and the schema shape stays a free record

A role is the file name of an agent under `plugins/bdk/agents/`. The schema keeps `models: record<kebab, string>`; it does not become an enum of the nine roles.

- Alternative: a strict object with one optional key per agent, so a typo (`models.verfier`) is a validation problem. Lost for now: #278 adds roles that are not agents (designer, planner) and may change the value to model and effort; an enum here would conflict with that work in flight. Rejecting an unknown role is a fair follow-up once #278 settles the shape, and it belongs there. #278 announced its shape: `models` becomes a partial record over an exported `MODEL_ROLES` list with an object value `{ model, effort }`, read as `models.<role>.model`. The two converge: this Change adds `explorer` to the roles and writes the skill lines with `models.<role>`; whichever Change merges second adds `explorer` to `MODEL_ROLES` and rewrites the lines as `models.<role>.model` (and `.effort`). The parity test of D3 matches `models.<agent>` as a prefix, so it holds for both forms.

### D3. A workspace test enforces the parity, not a CLI helper

`plugins/bdk/tests/agent-models.test.ts` reads `plugins/bdk/agents/*.md`, the `models` description from `SettingsSchema`, and every `SKILL.md`. It fails when an agent is not named in the description, when the description names a role that is no agent, and when a paragraph (lines between blank lines) holding `subagent_type: "bdk:<agent>"` does not name `models.<agent>`.

- Alternative: a `bdk` command that resolves the model of a role for a skill (`bdk config model verifier`). Lost: the skills already read the merged configuration from `bdk config show`; a helper would add a call per agent start and fix no problem an eval showed (CLAUDE.md, "Building skills (v3)": a CLI helper only for a measured problem).
- Alternative: only fix the six calls. Lost: the defect came from nothing tying the skill texts to the roles; the next agent or skill would drift the same way.
- The paragraph is the unit because a call's fields sit in one list (`execute-waves` puts `model` on the next bullet of the same call). `pr-review-round` names its agents without `subagent_type` and passes `models.<role>` in one sentence for all workers; the test does not read it, and its text already passes the roles.
- The description of `models.<role>` holds the role list in backticks; the test reads the backticked names of the `models` description. The description stays the one place users read the roles (spec `bdk-cli/config`, "Every settings key has a description").

### D4. Docs follow the description

`docs/concepts/cli-config-hooks.md` gets `models.explorer` and `models.verifier` on the `/bdk:design` row, `models.verifier` on `/bdk:close`, and the key table lists `models.explorer`. `docs/concepts/agents.md` drops the known-limit sentence. `docs/guide/configuration.md` already points to the agents Reference; it names the role rule (the agent's name). The settings Reference is regenerated.

### D5. Evals record the acceptance signal

New cases grade the `Agent` call's input: a `tool_used` grader on `Agent` whose `input_match` requires both `"subagent_type":"bdk:<agent>"` and `"model":"sonnet"` (two lookaheads, so key order does not matter). Orchestrator cases: `design-models-per-role` (explorer and verifier), `plan-models-verifier`, `close-models-verifier`. Block cases, typed in the main thread: `explore-model-set`, `verify-design-model-set`, `spec-conformance-model-set`. Each reuses a shared fixture and adds `models` to `.bdk/settings.yaml` in its scaffold. They run with `--runs 1 --ablation none`: the question is whether the call carries the model, not whether the block changes the outcome (that is measured by the existing cases of each block).

## Risks / Trade-offs

- A model can omit `model` though the skill says to pass it. The eval cases measure this; the skill text names the field in the same sentence as `subagent_type`, which is the form that already works for `/bdk:plan`.
- The paragraph rule of the test is textual. A skill that splits a call over two paragraphs fails the test and must be written as one paragraph, which is also clearer to read.

## Eval results

Run on 2026-10-09 with Claude Code's pinned version, one arm, one run per case, with the grants and host settings of the eval README (`--case '*-model*'`, clean `HOME`, `macos-git-prefix.sh`, the offline `gh` stand-in first on `PATH`):

| Case | Score | Cost | The model grader |
|---|---|---|---|
| `design-models-per-role` | 1.00 | $0.87 | `bdk:explorer` and `bdk:verifier` started with `model: sonnet` |
| `plan-models-verifier` | 1.00 | $0.46 | `bdk:verifier` with `model: sonnet` |
| `close-models-verifier` | 1.00 | $0.55 | `bdk:verifier` with `model: sonnet` |
| `explore-model-set` | 1.00 | $0.32 | `bdk:explorer` with `model: sonnet` |
| `verify-design-model-set` | 1.00 | $0.29 | `bdk:verifier` with `model: sonnet` |
| `spec-conformance-model-set` | 1.00 | $0.28 | `bdk:verifier` with `model: sonnet` |

Baseline: `explore-model-set` on the skills of `staging/v3` before this Change scored 0.50: the map was written, and the model grader failed (`Agent called 0x`), so the grader tells the two apart.
