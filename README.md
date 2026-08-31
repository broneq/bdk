# BDK — Broneq Dev Kit

A personal Claude Code plugin packaging reusable dev workflows, skills, agents, and hooks into a single installable unit.

**Core design principle**: Language-agnostic by default. Skills contain workflow logic only; environment discovery is delegated to `STARTUP_INSTRUCTIONS.md` and the local project's `CLAUDE.md`.

---

## Installation

**From GitHub directly (recommended until marketplace listing is live):**

1. Add the BDK marketplace source:
   ```
   /plugin marketplace add broneq/bdk
   ```
2. Install:
   ```
   /plugin install bdk@bdk
   ```

---

## Skills

Invoke with `/bdk:<skill-name>`:

| Skill | Description                                                                                         |
|-------|-----------------------------------------------------------------------------------------------------|
| `/bdk:setup` | Initialize `.bdk/settings.json` — run once per project before using other skills                    |
| `/bdk:cr` | Dynamic code review (3-13 parallel agents based on change size). Reviews the delta since the last review by default; `--full` reviews the whole branch; `--inline` runs every cohort in-session with no subagents; `--base <ref>` reviews against an explicit base (stacked branches) |
| `/bdk:pr-review` | Review GitHub PRs from URLs: one subagent per PR running `/bdk:cr --inline`, templated inline comments + summary on GitHub, approve / request-changes verdict; stack-aware (diff vs stack parent); `--verify` checks whether previous review comments were implemented and resolves addressed threads |
| `/bdk:commit` | Generate conventional commit message from git changes                                               |
| `/bdk:create-plan` | Create TDD-driven implementation plans                                                              |
| `/bdk:subagent-execute-plan` | Execute a plan task-by-task with a fresh implementer subagent per task and a single end-of-branch review |
| `/bdk:verify-plan` | Verify a plan against real code before execution                                                    |
| `/bdk:debug` | Structured debugging: investigate → failing tests → fix or plan                                     |
| `/bdk:test-driven-development` | Rigid TDD cycle: red → green                                                                        |
| `/bdk:design` | Design partner: classifies product vs architecture vs combined, 2+ approaches with Mermaid, self-critique, validation loop with warm-explorer reuse |
| `/bdk:create-adr` | Generate Architecture Decision Records (MADR format)                                                |
| `/bdk:explain-complex-code` | Generate architecture docs with Graphviz diagrams                                                   |
| `/bdk:update-docs` | Refresh existing architecture docs after code changes                                               |
| `/bdk:refine-rules` | Compact and verify `.claude/rules/*.md` against real code - four-part admission test, six verdicts, budgets, relocation to doc comments, uniform format |
| `/bdk:add-rule` | Capture one lesson as a properly-homed rule - routes to a narrow-glob rule file, a wide one, a skill, a doc comment, a test signpost, or nothing; dedupes, respects budgets |
| `/bdk:graphviz-docs-compiler` | Compile `.dot` files to SVG and update markdown references                                          |

### Removed skills

Claude Code removed the `TaskCreate` / `TaskUpdate` / `TaskList` tools, which several skills used as their only state mechanism. Those skills are gone rather than patched:

| Removed | Use instead |
|---|---|
| `/bdk:execute-plan` | `/bdk:subagent-execute-plan` |
| `/bdk:save-progress`, `/bdk:restore-progress` | Nothing to invoke. `/bdk:subagent-execute-plan` checkpoints itself to a run manifest plus git commit trailers and resumes automatically; `--force` takes a run over from a dead session |
| `/bdk:create-tasks`, `/bdk:refactor` | `/bdk:create-plan` |
| `/bdk:audit-prompt` | Nothing |

---

## The plan pipeline

The four plan skills form one chain, each stage consuming the previous stage's output:

```
/bdk:design  →  /bdk:create-plan  →  /bdk:verify-plan  →  /bdk:subagent-execute-plan  →  /bdk:cr
```

The seams are files, not conversation state, so any stage can run in a fresh session:

| Seam | Carrier |
|---|---|
| design → plan | the design doc at `.bdk/design/` |
| plan → verify | the plan file |
| verify → execute | `.bdk/verify-plan/<slug>-verification.md`, carrying the plan's sha256 |
| execute → review | git commit trailers (`BDK-Run:`, `BDK-Group:`) plus `.bdk/runs/<run-id>.json` |

**The plan file is immutable once verified.** Its sha256 is the run's identity, so edit before verifying, never after: the executor re-hashes the file and reports a post-verification edit as a stale stamp. To change course mid-run, stop, edit, re-verify, and start a new run - the already-committed groups stay committed and the new run picks up from the trailers.

Progress is recorded per group, in two places: commit trailers are the durable ground truth (they survive a crash, a new session, a deleted `.bdk/`, and a rebase), and the run manifest is a cache that makes resume cheap. On any disagreement git wins and the manifest is corrected. Everything under `.bdk/runs/` is machine-owned and gitignored - read it with `python3 scripts/bdk_run_state.py print --run <id>`, never by hand.

### Running plans in parallel worktrees

Two plans that touch the same files cannot run in the same checkout - the executor's clean-tree precondition and its per-group commits would interleave. Give each run its own worktree:

```bash
git worktree add ../myproject-featA -b feat/a
git worktree add ../myproject-featB -b feat/b
```

Then open a Claude Code session in each and run `/bdk:subagent-execute-plan` there. This works with no extra machinery because the run id is `<plan-slug>--<branch-slug>`: different branches mean different run ids, different manifests, and trailers that never match each other's `git log`. Nothing coordinates the two runs, which is the point - merge them the way you merge any two branches.

One session per worktree. Two sessions in one worktree contend for the same run, and the second is refused by the session guard.

---

## Agents

Used by skills internally (invoke via `subagent_type`):

| Agent | Model | Purpose |
|-------|-------|---------|
| `code-reviewer` | sonnet | Layer-group deep code review |
| `implementer` | sonnet | End-to-end task implementation (TDD, lint, commit) — used by `/bdk:subagent-execute-plan` |
| `fixer` | sonnet | Apply specific findings (review, lint, test failures) — used by `/bdk:subagent-execute-plan` |
| `explorer` | haiku | Fast codebase exploration (CodeGraph → Serena → Grep) |
| `test-runner` | haiku | Run tests, parse and report results |
| `dead-code-detector` | haiku | Find unreachable/unused code |
| `duplicate-detector` | haiku | Find code duplication |
| `architecture-reviewer` | opus | Audit against architectural rules |
| `static-analyse` | haiku | Detect and run project lint/format/type-check |
| `plan-verifier` | opus | One-pass plan verification — six-section structured checklist, resumable via `SendMessage` for delta iteration. Used by `/bdk:verify-plan` |
| `design-verifier` | opus | One-pass design verification — five-section checklist with gap-type routing (codebase / requirement / shape / honesty), resumable via `SendMessage`. Used by `/bdk:design` Phase 3 |
| `log-analyzer` | haiku | Parse and summarize error logs |
| `web-researcher` | haiku | Search web for solutions and docs |

---

## Test & Lint Tiers

BDK runs checks **scoped to what changed** for the whole length of a plan, and the full suite exactly once, at the end. That only works if it knows which of your commands is the cheap one and how to narrow it — so each `test-tools` / `lint-tools` entry in `.bdk/settings.json` carries a tier and the narrower forms of the same command. `/bdk:setup` fills these in; this is what it writes:

```json
{
  "test-tools": [
    {
      "type": "vitest",
      "tier": "fast",
      "command": "npm run test:unit",
      "scoped": "npx vitest run {files}",
      "related": "npx vitest related --run {files}",
      "failed": "npx vitest run --changed"
    },
    {
      "type": "playwright",
      "tier": "e2e",
      "command": "npm run test:e2e",
      "scoped": "npx playwright test {files}",
      "failed": "npx playwright test --last-failed"
    }
  ],
  "lint-tools": [
    {"type": "eslint", "tier": "lint", "command": "npm run lint", "scoped": "npx eslint {files}"},
    {"type": "tsc", "tier": "typecheck", "command": "npm run typecheck", "incremental": "npx tsc -b --incremental"}
  ]
}
```

| Field | Meaning |
|---|---|
| `type` | The runner or framework (`vitest`, `pytest`, `eslint`, `tsc`) — not the package manager. BDK reads it to infer a missing `tier`. |
| `tier` | `fast` / `e2e` for tests; `lint` / `format` / `typecheck` for lint. Decides **when** the command may run. |
| `command` | The full, unscoped form. The slowest one: reserved for the end-of-plan gate. |
| `scoped` | Scoped to a path list. Must contain `{files}`. |
| `related` | The tests *covering* given source files, for runners that compute that themselves. Must contain `{files}`. Replaces asking an agent which tests cover a change. |
| `failed` | Re-runs only what failed. Used by fix cycles, so a fix attempt does not pay for a suite. |
| `incremental` | Cache-reusing form of a check that cannot take a path list — typecheckers above all. |

Omit any form your tool does not support; BDK falls back cleanly from a missing form. `tier` is optional but should always be set: BDK infers it from the tool name, and an inferred `fast` on an e2e runner means a slow suite runs at every group boundary.

**What this buys.** Per task, only the task's own test file runs. Per group, only the tests covering the group's changed files — the fast tier alone, unless the group actually touched e2e specs. Fix cycles re-run failures, not suites. Lint runs on the changed files; typecheck reuses its cache between groups. The unscoped everything, e2e included, runs once per plan.

---

## Quality Rules

BDK ships language-agnostic rule sets (`code-quality`, `architecture`, `design-patterns`, `security`, `engineering-judgment`, `test-quality`) injected into `/bdk:cr`, `/bdk:create-plan`, and `/bdk:design` outputs.

### Four usage patterns

**1. Zero config (recommended for most projects).** No settings entry. BDK defaults are used as-is.

**2. Extend defaults.** Point `.bdk/settings.json` at a file with project-specific additions:

```json
{
  "quality": {
    "code-quality": "docs/standards/coding.md"
  }
}
```

The BDK default content is emitted first, then your file's content appended.

**3. Replace defaults.** When your project has its own complete rule set:

```json
{
  "quality": {
    "code-quality": {
      "path": "docs/standards/coding.md",
      "mode": "replace"
    }
  }
}
```

**4. Point at existing project doc.** Same as pattern 2, but the path can be any existing standards doc — no copy needed.

### Behaviour on misconfiguration

If `.bdk/settings.json` references a file that doesn't exist (or is unreadable), `inject-rules.py` exits 1 with a clear error. `/bdk:cr` and `/bdk:create-plan` will surface the error and stop, rather than silently dropping the rule context.

### Adding a new rule category

See `.claude/rules/quality-rules.md` (BDK-dev convention).

---

## Language Rules

Companion to Quality Rules, but keyed by the project's `languages` array rather than a flat rule name. BDK ships per-language principle sheets in `rules/languages/<lang>.md` (React, TypeScript, and JavaScript today; Vue, Python, Go, … follow the same pattern). Each agent that writes or reviews code (`code-reviewer`, `implementer`, `fixer`, `plan-verifier`) preloads them via the `bdk-rules-languages` meta-skill; plan and execution templates pull them through a `<!-- INJECT-LANGUAGES -->` marker.

Declare the project's stack in `.bdk/settings.json`:

```json
{
  "languages": ["react", "typescript"]
}
```

Override or extend a default rule sheet per language (same `extends` | `replace` semantics as quality rules):

```json
{
  "languages": ["react"],
  "language-rules": {
    "react": "docs/team-react-conventions.md"
  }
}
```

A language listed without a matching `rules/languages/<lang>.md` (and no override) is silently skipped — no error.

Authoring a new language sheet: see `.claude/rules/language-rules.md`.

---

## What Does NOT Go Into BDK

These stay in the project-level `.claude/` of each repo:

- **Rules** — project-specific domain rules (architecture layers, domain logic, etc.)
- **Plans** — generated per-project
- **Project-specific hooks** — drift detection, worktree setup, directory creation
- **Domain skills** — feature-specific workflows
- **Language-specific hooks** — Python formatters, Go linters tied to one stack

---

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, authoring conventions, and how to add skills/agents.
