---
status: accepted
date: 2026-10-29
decision-makers: broneq
enforced-by:
  - plugins/bdk/evals/judge-levels
  - plugins/bdk/evals/plan-fresh
  - tests/eval-suites.test.ts
---

# ADR-0024: Agents run each command alone under narrow grants - a denied command is never a verdict

## Context and Problem Statement

BDK skills call the `bdk` CLI and `lavish-axi` through Bash. `/bdk:setup` grants them narrowly, as `Bash(${CLAUDE_PLUGIN_ROOT}/bin/bdk *)` and the like, and each skill's `allowed-tools` does the same. The host matches a grant against the command as written: a compound command (`cd`, `;`, `&&`, a pipe, `echo`) or one whose argument holds a shell variable or substitution is denied as a whole, or asks the user. In the measured runs, plan verifiers chained `cd`, `ls` and `bdk plan check` and got denied (#342), a judge that wrote `B=...; L=<log>; "$B" ... $L` lost its report (#371), and one verifier reported the denial under `Must address`, so a sound plan failed. Do we fit the grants to how agents like to write commands, or the commands to the grants, and what does a block do with a denial?

## Decision Drivers

- **Least privilege:** a user's permission rules stay narrow and auditable; an unattended run must not need `Bash(*)`.
- **Correctness of the verdict:** a verifier's `FAIL` must mean the artifact is wrong, never that the host refused a call.
- **Same behaviour in evals and real sessions:** a grant widened only in evals hides the problem.
- **No machinery for a wording problem** (CLAUDE.md, "Building skills (v3)").

## Considered Options

1. **Each command is the whole Bash command with literal arguments**; BDK never widens grants to fit a command; a denied command stops the block with no report.
2. **Widen the grants** (`Bash(*)`, or `Bash(cd *)`, `Bash(ls *)` beside `bdk`).
3. **A `PreToolUse` hook that splits compound commands.**

## Decision Outcome

**Chosen option: 1.** Every `bdk` and `lavish-axi` call a skill or agent makes is the whole Bash command: the quoted plugin path (`"${CLAUDE_PLUGIN_ROOT}/bin/bdk"`) and every argument written out, nothing before or after it, no `cd`, `;`, `&&`, `|`, `echo` or shell variable; free text passed as an argument (`--summary`, `--evidence`, `--reason`) holds no backtick, `$` or backslash. Files are read and listed with Read, Grep and Glob, not `cat`, `ls` or `grep` through Bash. The rule is written into each block's own skill text, and into `bdk:verifier`, which serves three skills, because a block runs alone and a shared file it must first read is a step it can skip. The text names no placeholder command: an example template made the judge send stray denied calls in 3 of 15 runs; without it, 0 of 15.

A verifier whose needed command is denied, although it ran it on its own, writes no report and returns the command and the denial instead of a verdict; its caller (`/bdk:plan`, a review round) sees an environment problem and stops or starts it once more. The one exception is `cd <worktree> && bdk ...` under `--workdir` (`/bdk:pr-review` in its own worktree), where both pieces are granted.

It is the only option that keeps a project's permissions as narrow as `/bdk:setup` writes them, in evals and real sessions alike.

### Consequences

- ✅ An unattended run needs only the grants `/bdk:setup` wrote; nothing asks the user mid-run.
- ✅ A denial can no longer turn into a `FAIL` that sends a sound plan back to its author.
- ✅ The grader `no-denied-call` on every review, triage and plan case makes a denial visible directly (`plugins/bdk/evals/README.md`).
- ❌ Every skill carries the same wording discipline, and a new skill that forgets it fails only in a run or an eval.
- ❌ Agents take more Bash calls (one per command) than a chained form would.
- 🟡 The rule follows how the host matches grants today (Claude Code 2.1.292); a host that matched compound commands per piece would make it looser than needed.

## Pros and Cons of the Options

### 1 - Commands alone, narrow grants

- Good: least privilege; the same in evals and sessions; no new machinery.
- Bad: wording discipline in every skill; stray-call risk measured and closed (3/15 to 0/15).

### 2 - Widen the grants

- Good: agents write commands as they like.
- Bad: a user's rules must allow arbitrary shell; widened only in evals, the problem stays in real sessions.

### 3 - A splitting hook

- Good: no change to skill text.
- Bad: machinery for a wording problem; a hook that rewrites commands steers the model's work, which the CLI and hooks never do ([ADR-0003](./0003-v3-architecture-skills-first.md)).

## More Information

Archived Changes `v3-342-plan-evals-permission-denials` (design D1, D2, D4), `v3-376-review-evals-compound-bdk-calls` (design D1-D6) and `v3-293-dogfood-setup-propose-design` (Lavish commands alone).
