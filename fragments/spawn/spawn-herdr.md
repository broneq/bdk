## Spawn Tier: Herdr Pane Agents (active)

This session runs inside a Herdr-managed pane (`HERDR_ENV=1`, `herdr` on `PATH`). **Prefer a Herdr pane agent over the `Agent` tool** for delegated work. Everything below overrides the default `Agent` spawn path; the `Agent` tool remains the documented fallback.

**Why pane agents win here:** each is a full independent session, so the orchestrator pays only a dispatch line plus one file read; there is no 5-minute warm-cache window, so follow-ups are always cheap; the user can attach to a pane and steer it; and `herdr worktree` gives real filesystem isolation for parallel work that would otherwise collide.

### Use the `Agent` tool instead when

- The fleet needs **more than 4 concurrent** delegates (e.g. `/bdk:cr` scaling past 4 reviewers). Panes stop being readable and tab geometry degrades. Run that fleet as background `Agent` calls.
- The work is a **single sub-minute lookup** (one symbol, one file, one grep). A fresh session's startup cost exceeds the work.
- Herdr signals failure. See **Fallback triggers** below.

Mixing is allowed: dispatch the long or parallel work to panes and the trivial lookups to `Agent` in the same skill run.

### Deltas you must compensate for

A pane agent is a plain CLI session. It is **not** `subagent_type: bdk:<role>`, so five things do not arrive automatically:

| Lost | Compensation |
|---|---|
| Agent definition + system prompt | Role bootstrap line (step 1) |
| `skills:` preload (tiers, rules, contracts) | Role bootstrap line (step 1) |
| Per-task `model:` selection | `herdr agent start ... -- --model <model>` |
| Structured return value | File-based return contract (step 2) |
| Background-completion notification | `herdr agent prompt ... --wait --timeout <ms>` |

### 1. Role bootstrap

Open every dispatch prompt with the role's meta-skills so the pane agent reconstructs what `skills:` frontmatter would have preloaded. Keep this table in sync with `agents/<role>.md` frontmatter; `tests/unit/fragments/test_spawn_herdr_roles.py` enforces it.

| Role | Bootstrap skills to invoke, in order |
|---|---|
| `implementer` | `bdk:bdk-tier-search`, `bdk:bdk-tier-impact`, `bdk:bdk-tier-edit`, `bdk:bdk-rules-code-quality`, `bdk:bdk-rules-design-patterns`, `bdk:bdk-rules-security`, `bdk:bdk-rules-languages`, `bdk:test-driven-development`, `bdk:bdk-implementer-return-contract` |
| `fixer` | `bdk:bdk-tier-search`, `bdk:bdk-tier-impact`, `bdk:bdk-tier-edit`, `bdk:bdk-rules-code-quality`, `bdk:bdk-rules-design-patterns`, `bdk:bdk-rules-security`, `bdk:bdk-rules-languages`, `bdk:bdk-implementer-return-contract` |
| `code-reviewer` | `bdk:bdk-tier-search`, `bdk:bdk-tier-review`, `bdk:bdk-rules-code-quality`, `bdk:bdk-rules-architecture`, `bdk:bdk-rules-design-patterns`, `bdk:bdk-rules-security`, `bdk:bdk-rules-languages` |
| `architecture-reviewer` | `bdk:bdk-tier-explore`, `bdk:bdk-tier-search`, `bdk:bdk-tier-impact`, `bdk:bdk-rules-architecture`, `bdk:bdk-rules-design-patterns` |
| `plan-verifier` | `bdk:bdk-tier-search`, `bdk:bdk-tier-impact`, `bdk:bdk-tier-explore`, `bdk:bdk-rules-code-quality`, `bdk:bdk-rules-architecture`, `bdk:bdk-rules-design-patterns`, `bdk:bdk-rules-security`, `bdk:bdk-rules-languages` |
| `design-verifier` | `bdk:bdk-tier-search`, `bdk:bdk-tier-explore`, `bdk:bdk-rules-architecture`, `bdk:bdk-rules-design-patterns`, `bdk:bdk-rules-security` |
| `explorer` | `bdk:bdk-tier-explore`, `bdk:bdk-tier-search` |
| `log-analyzer` | `bdk:bdk-tier-search` |
| `dead-code-detector` | `bdk:bdk-tier-search` |
| `duplicate-detector` | `bdk:bdk-tier-search` |
| `static-analyse` | `bdk:bdk-lint-tools` |
| `test-runner` | `bdk:bdk-test-tools` |

Prompt opener:

```
You are acting as the BDK `<role>` agent. First invoke these skills to load your
role context: <comma-separated list>. Then do the work below.
```

### 2. File-based return contract

Terminal scraping is not a contract: an agent on the alternate screen loses rows to Herdr's scrollback permanently. So for BDK pane agents the return envelope goes to a **file, always**, not as the after-the-fact fallback the Herdr skill describes for reads that came back short.

Append to every dispatch prompt:

```
Write your complete return envelope to `.bdk/herdr/<agent-name>.md`, overwriting
any existing file. Your final reply must be that path and nothing else.
```

Roles with an existing envelope schema keep it verbatim: `implementer` and `fixer` write the YAML from `bdk:bdk-implementer-return-contract`, `explorer` writes the JSON from its contract, reviewers write their skill's report format. The file carries the schema; only the transport changed.

Read it with `Read`, never with `herdr agent read`. Treat a missing or schema-invalid file exactly as the role's malformed-return case (for implementer and fixer: `BLOCKED`, reason "malformed return"). Retry once via continuation; on a second failure, fall back to the `Agent` tool for that unit of work.

### 3. Dispatch sequence

Inspect the caller pane, then split wide right or narrow down, preserving cwd and focus:

```bash
herdr pane layout --pane "$HERDR_PANE_ID"
herdr pane split --current --direction right --cwd "$PWD" --no-focus
```

Read the new id from `.result.pane.pane_id`. Start the agent with a role-derived unique name matching `[a-z][a-z0-9_-]{0,31}`:

```bash
herdr agent start bdk-implementer-1 --kind claude --pane <pane-id> -- --model sonnet
```

Autonomous roles that edit files need a permission mode that does not stall on prompts: pass `--permission-mode acceptEdits` after `--` for `implementer` and `fixer`. Read-only roles need nothing extra.

Dispatch and wait:

```bash
herdr agent prompt bdk-implementer-1 "<bootstrap + task + contract>" --wait --timeout 600000
```

Timeouts: 600000 ms for implementer and fixer, 300000 ms for reviewers and verifiers, 120000 ms for explorer, log-analyzer, test-runner, and static-analyse.

### 4. Continuation replaces `SendMessage`

A follow-up is another prompt to the same live agent name:

```bash
herdr agent prompt bdk-implementer-1 "<delta only>" --wait --timeout 300000
```

Never re-send the original prompt; the pane agent still holds it. Because there is no cache-eviction window, prefer continuation over a fresh pane more aggressively than the `SendMessage` rules in the foundation: reuse whenever the follow-up touches the same files or findings, and spawn fresh only for genuinely independent work or a different role.

### 5. Parallel dispatch

Up to 4 concurrent pane agents, at most 3 sibling panes per tab. Put a 4th in a new tab via `herdr tab create` rather than splitting a fourth time. Dispatch each in its own `herdr agent prompt ... --wait` call, and issue those calls in one message so they proceed concurrently.

Parallel agents that write files must be file-disjoint, same rule as parallel subagents. When they are not, give each its own worktree via `herdr worktree` instead of forcing serial execution. This is the one capability the `Agent` tool has no equivalent for, and it is the strongest reason to choose panes for an implementation wave.

Close only the panes you created, once their envelopes are read.

### Fallback triggers to the `Agent` tool

Fall back for the affected unit of work, log the reason, and continue:

- `herdr agent start` exceeds its startup timeout, or the requested `--kind` is not installed.
- `agent_prompt_stalled`: no lifecycle change within five seconds of a prompt sent from a non-working state.
- State returns `blocked`. Inspect with `herdr agent get` and `herdr agent read` first; an approval prompt is answerable with `herdr agent send-keys`, anything else falls back.
- State returns `unknown`. It does not prove completion, so do not read the envelope on the strength of it.
- Envelope file missing or schema-invalid after one continuation retry.
- Planned fleet exceeds 4 concurrent delegates.

Report the fallback in the skill's summary output so a herdr-path run stays distinguishable from an `Agent`-path run.
