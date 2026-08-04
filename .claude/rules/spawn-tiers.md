# Spawn Tiers - How BDK Skills Delegate Work

BDK has two spawn transports for delegated work. Skills must not hardcode either one.

| Tier | Mechanism | Gate |
|---|---|---|
| Herdr pane agents (preferred) | `herdr pane split` + `herdr agent start` + `herdr agent prompt` | `env.HERDR_ENV=1` AND `cmd.herdr` |
| Agent tool (baseline) | `Agent` with `subagent_type: bdk:<role>` | always available |

The tier is resolved once, in the foundation. `STARTUP_INSTRUCTIONS.md` carries the `Agents` table as prose (baseline) followed by `<!-- CHAIN: spawn/spawn.chain.json -->`, which appends the Herdr override block when the gate passes. No gate, no block, and the prose baseline stands unchanged. That is the whole "optional if herdr exists" mechanism.

## Runtime conditions

`inject.py` supports two settings-independent condition types, added for this tier:

| Condition | True when |
|---|---|
| `env.VAR` | `VAR` is set and non-empty |
| `env.VAR=value` | `VAR` equals `value` exactly |
| `cmd.name` | `name` resolves on `PATH` |

A block whose conditions are **all** runtime conditions resolves even when `.bdk/settings.json` is absent, because it describes the session rather than the project. Mixing a runtime condition with a `features.*` condition still requires settings.json. An unconditional chain entry still requires settings.json, which is what keeps the existing tool-tier fallbacks from firing in non-BDK projects.

Use `env.*`/`cmd.*` for facts about the running session (a multiplexer, an installed binary). Use `features.*` for project opt-ins. Do not add a `features.herdr` flag: a stale flag would claim a transport that is not actually running.

## Authoring a spawn site

Any skill step that dispatches an agent gets a **pointer**, not a copy of the tier block:

```md
!`python3 ${CLAUDE_PLUGIN_ROOT}/scripts/inject.py --if env.HERDR_ENV=1 --if cmd.herdr --then-text '> **Herdr spawn tier active.** <what changes for THIS step>. Full procedure and fallback triggers: "Spawn Tier: Herdr Pane Agents" in the BDK foundation.'`
```

Rules for the pointer text:

- State only what changes **for that step** (transport, envelope location, continuation form, pane cap consequences). The procedure lives in the fragment.
- No backticks inside `--then-text` - the whole inject call is already backtick-delimited. Use bold or quotes instead.
- Single-quote the argument. Keep it to one paragraph.
- Never restate the fallback triggers. Cite them.

Current spawn sites: `subagent-execute-plan` (3a-S, 3b), `cr` (Step 3), `verify-plan` (Step 2), `design` (Phase 3 Step 1). `tests/unit/skills/test_spawn_pointers.py` executes every pointer with the gate on and off and enforces the rules above, including the backtick trap: a backtick inside `--then-text` truncates the enclosing block silently at skill load time.

## Invariants a transport must not break

A spawn tier changes **how** an agent is reached, never what it owes back:

- The role's return envelope schema is unchanged. Only the transport moves (inline message vs. a file under `.bdk/herdr/`).
- Verification cadence, commit boundaries, and cycle caps stay with the orchestrator.
- A skill that reports a summary block must surface which transport ran, so a pane run is distinguishable from an `Agent` run.
- Envelopes go to the shared `.bdk/herdr/` buffer, never to a per-skill directory. See `.claude/rules/artifacts.md`.

## Role bootstrap drift

A pane agent is a plain CLI session, so it does not inherit an agent definition's `skills:` preload. `fragments/spawn/spawn-herdr.md` carries a role-to-meta-skill table that reconstructs it. Editing `skills:` in any `agents/*.md` means editing that table too. `tests/unit/fragments/test_spawn_herdr_roles.py` fails on drift.

## Adding a third tier

Add a fragment under `fragments/spawn/`, add an entry **above** the herdr entry in `spawn.chain.json` (the chain is `exclusive`, first match wins), and gate it on runtime conditions. Skills need no edits: their pointers are gated on the herdr tier specifically, so a new top tier must either carry its own pointers or subsume the herdr guidance.
