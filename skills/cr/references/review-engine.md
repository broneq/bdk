# Review Engine

The single description of how a code review is scoped, dispatched, and merged. Two callers follow it:

| Caller | Mode | How it loads this file |
|---|---|---|
| `/bdk:cr` | `interactive` | Inlined at skill load - every invocation is a review, so there is nothing to defer |
| `/bdk:subagent-execute-plan` Step 4a | `autonomous` | Read lazily at Step 4a via `${CLAUDE_PLUGIN_ROOT}/skills/cr/references/review-engine.md` - it runs once at the end of a long run and is protecting a 50% context budget |

Reading this file is **not** invoking `/bdk:cr`. The executor's rule against skills-that-spawn-subagents inside subagents is about skill invocation from a subagent; the coordinator is not a subagent, and following a reference doc spawns nothing by itself.

---

## Request

The caller fills this block before doing anything else. Every field is required; `null` is a legitimate value where noted.

```
REVIEW_REQUEST
mode:        interactive | autonomous
run_id:      <run-id> | null      # null = no run for this branch
base_sha:    <sha>                # branch baseline, never HEAD
head_sha:    <sha>                # resolved, never the literal "HEAD"
range_mode:  delta | full
group:       <n> | null           # the group under review, when reviewing one
scaling:     tiny | small | large | massive
focus:       <free text> | null   # user's "review the auth changes" narrowing
```

`scaling` comes from the resolved range (see below), not from the whole branch: a delta review of 40 lines is `tiny` even on a branch of 4000.

## Result

The engine returns this. Note what it does **not** contain: rendered report sections. The seam is a merge, not a render - each caller formats the same findings differently, and pushing the rendering into the engine is what would force one caller's output shape onto the other.

```
REVIEW_RESULT
run_id:               <run-id> | null
base_sha:             <sha>
anchor_sha:           <sha>          # where the review actually started
head_sha:             <sha>
anchor_source:        <string>       # verbatim from resolve-range, e.g. "full (degraded)"
range_mode:           delta | full | empty
commits_in_range:     <n>
delta_files:          [<path>, ...]
cumulative_files:     [<path>, ...]
scaling:              tiny | small | large | massive
findings:             [ {severity, category, file, line, symbol, problem, fix}, ... ]
positive_observations: [<string>, ...]
test_gaps:            [<string>, ...]
counts:               {critical, high, medium, low}
suppressed:           <n>            # deferred findings withheld from reviewers
degraded:             [<string>, ...] # agents that failed or timed out
warnings:             [<string>, ...]
```

### Finding fields

| Field | Value |
|---|---|
| `severity` | `CRITICAL` \| `HIGH` \| `MEDIUM` \| `LOW` |
| `category` | one slug from the vocabulary below - never free text |
| `file` | repo-relative path, as `git diff --name-only` prints it |
| `line` | first line of the problem, for display |
| `symbol` | enclosing function/class/method name, or `null` when the finding is file-level (a missing module, an import block, a whole-file duplication) |
| `problem` / `fix` | prose, one sentence each |

### Category vocabulary

Ten slugs, one per reportable section. Every finding from every agent maps to exactly one; nothing else is a valid value.

| Slug | Report section | Fed by |
|---|---|---|
| `style` | 2. Style & Conventions | layer-group reviewer `FINDINGS` |
| `correctness` | 3. Functionality & Logic | layer-group reviewer `FINDINGS` |
| `performance` | 4. Performance | layer-group reviewer `FINDINGS` |
| `tests` | 5. Tests | reviewer `TEST_GAPS`, test-runner |
| `types` | 6. Type Hints & SOLID | layer-group reviewer `FINDINGS` |
| `oo-design` | 7. Object-Oriented Design | layer-group reviewer `FINDINGS` |
| `duplication` | 8. Duplicate Code | duplicate-detector `LITERAL_DUPLICATES` / `STRUCTURAL_PATTERNS` / `INTRA_FUNCTION` |
| `dead-code` | 9. Dead Code | dead-code-detector `UNUSED_SYMBOLS` / `UNREACHABLE_CODE` |
| `security` | 10. Security | layer-group reviewer `FINDINGS` |
| `architecture` | 11. Architecture | architecture-reviewer `LAYER_VIOLATIONS` / `DI_ISSUES` / `PATTERN_COMPLIANCE` / `DATA_FLOW` |

The four reviewer agents each emit their own block shape; normalizing them into this vocabulary is the merge's job, not theirs. Do not invent a slug for a finding that fits none of the ten - pick the closest and say why in `problem`. A free-text category defeats the dedup key below, because `dead_code`, `Dead Code`, and `unused-code` are three keys for one defect.

---

## Step 1 - Resolve the range

Never reason about the range from `git log` yourself. One command owns every case, so the two callers cannot disagree about what "delta" means:

```bash
python3 ${CLAUDE_PLUGIN_ROOT}/scripts/bdk_run_state.py resolve-range \
  --run {run_id} --head $(git rev-parse HEAD) [--full]
```

It returns `anchor_sha`, `anchor_source`, `range_mode`, `commits_in_range`, `delta_files`, `cumulative_files`, `suppressed_findings`, and `warnings`. Carry `anchor_source` into the report verbatim - it is the difference between "reviewed everything because you asked" and "reviewed everything because the watermark was lost", and a reader needs to know which.

Handle the outcomes:

| `range_mode` | What it means | Do |
|---|---|---|
| `delta` | Watermark healthy, or recovered from a `BDK-Group` trailer | Review `anchor_sha..head_sha` |
| `full` | First pass, `--full` requested, or the watermark was orphaned beyond recovery | Review `base_sha..head_sha`, and surface any `warnings` in the report |
| `empty` | No commits since the last review | Say "no new commits since <sha>" and **stop**. Touch no state, dispatch nothing, write no report |

**Pass `--full` when:** the user asked for it, or this is a pre-PR review. Delta review is the default for incremental passes, but it can miss a later group breaking an earlier one, so the last review before a PR is always full. The executor's end-of-plan review is therefore `--full`.

### No run for this branch

`cr` is also invoked standalone, on a branch that never went through the executor. There is no manifest and no watermark, so delta is not defined. Review the full diff, say so in the terminal line, and derive the baseline yourself:

```bash
git merge-base HEAD "$(git symbolic-ref --quiet --short refs/remotes/origin/HEAD || echo origin/main)"
```

Find out whether a run exists with `bdk_run_state.py list --branch $(git branch --show-current)`. With `run_id: null` the whole state-advancing half of this engine is skipped: no suppression list, no `review-done`. That is correct, not degraded - there is nothing durable to anchor to.

### Dirty worktree

In `interactive` mode the tree may be dirty. Review the resolved range **plus** `git diff HEAD`, warn about the uncommitted files by name, and **skip `review-done`** - there is no durable sha covering work that is not committed, and recording one would mark unreviewed commits as reviewed on the next pass. In `autonomous` mode the tree is guaranteed clean by the executor's Step 0, so this case does not arise; if it does, that is a bug worth reporting rather than working around.

## Step 2 - Classify size and plan the dispatch

Classify on the **resolved range's** total changed lines (`git diff --stat anchor_sha..head_sha`).

| Class | Lines | Layer reviewers | Also |
|---|---|---|---|
| tiny | < 50 | 1× `bdk:code-reviewer` (sonnet) covering everything, checking duplicates and dead code inline | test-reviewer (opus), static-analyse, test-runner |
| small | 50-1000 | 1× `bdk:code-reviewer` (sonnet) | architecture-reviewer (opus), test-reviewer (opus), 1× duplicate-detector, dead-code-detector, static-analyse, test-runner |
| large | 1000-3000 | N = ceil(lines / 1000), capped at 5 | as small, with N duplicate-detectors |
| massive | 3000+ | as large, N capped at 5 | as large |

At `tiny` the architecture, duplicate, and dead-code checks fold into the single layer reviewer rather than getting their own agents - at that size the dispatch overhead exceeds the work.

### Two cohorts (correctness constraint, not an optimization)

A delta review cannot scope every agent to the delta:

| Cohort | Agents | Scope | Why |
|---|---|---|---|
| Delta-scoped | layer reviewers, `bdk:static-analyse`, `bdk:test-runner` | `delta_files` | They only need what changed |
| Cumulative-scoped | `bdk:architecture-reviewer`, `bdk:dead-code-detector`, `bdk:duplicate-detector` | `cumulative_files` (always `base_sha..head_sha`) | A symbol is dead only relative to the whole branch, a layer violation is cumulative, and a duplicate needs both copies in view. Scoping these to a delta produces false negatives - the worst failure mode for a reviewer, since it reads as a clean pass |

Consequently the cumulative cohort runs **only on a full-range review**. On a delta pass, skip it and say so: `architecture_review: skipped:delta-pass`. Deferring it to the next full pass is honest; running it on a fragment is not.

Every dispatch prompt carries **both** file lists - the delta files to review and the cumulative files as context - or a reviewer re-flags a function an earlier commit of the same run introduced.

### Caller-specific skips

The executor skips `bdk:static-analyse` and `bdk:test-runner` entirely: it already ran them per group and runs the full suite once at Step 4d. Double-running them is pure waste and doubles the review's wall-clock for nothing.

## Step 3 - Dispatch

Launch every planned agent in a **single message with multiple `Agent` calls**. Use `references/reviewer-prompt-template.md` for the prompt structure; it carries the mandatory range-context block.

Subagents already run in the background - there is no `run_in_background` parameter on the `Agent` tool, and passing one is an input-validation error at runtime.

You will be notified as each agent completes. **Do not poll and do not schedule wake-ups** - no `ScheduleWakeup`, no `Monitor`, no `sleep`, no spawning an agent to check on another agent. Wait for the notifications.

When a reviewer's finding needs clarification, prefer `SendMessage(to: "<agentId>", ...)` over re-spawning - the reviewer keeps its scan context. See STARTUP "Continuing a Spawned Agent".

### Suppression list

With a `run_id`, fetch the findings the caller already triaged and declined, and paste the block into every reviewer prompt:

```bash
python3 ${CLAUDE_PLUGIN_ROOT}/scripts/bdk_run_state.py findings-list \
  --run {run_id} --format prompt
```

Without it, every delta pass re-reports the same debatable `MEDIUM`s that were deliberately deferred, and the caller's review-fix budget burns on noise. Record `suppressed` in the result so the report can say how many were withheld.

## Step 4 - Merge

1. **Collect** every agent's output. If some are still running, wait for their notifications - do not merge partial results, and do not poll.
2. **Normalize, then deduplicate** into one flat findings array. Two passes, in this order:

   **a. Normalize.** Map each agent's block into the finding fields above: repo-relative `file`, one `category` slug from the vocabulary, `symbol` filled in from the block when it names one (dead-code-detector always does; the graph tier gives it for the rest) or `null`.

   **b. Collapse.** Group by `(file, category)`, then merge findings that point at the same defect within that group:

   - Same `symbol` (both non-null) → same defect. Merge.
   - Either `symbol` is null and the lines are within **10 lines** of each other → same defect. Merge.
   - Otherwise → distinct. Keep both.

   Merging keeps the most detailed `problem`/`fix`, the **highest** severity of the merged set, and the **lowest** `line`. Record the collapse count in `warnings` as `deduped: {N} findings merged`.

   Keying on the symbol rather than the exact line is the point. Four agents look at one function from four angles and anchor at four different lines - the signature, the first statement, the middle of the body, an import above it. An exact-line key reports that as four findings, and since `counts` is derived from this array, the report's `{critical}C/{high}H/{medium}M/{low}L` header inflates with it. The executor then triages the same defect four times and can dispatch a fixer per copy, which is either three wasted passes or three conflicting edits to one function.
3. **Record what failed.** An agent that errored or timed out goes in `degraded[]` and is named in the report. A review missing a cohort must not read like a clean pass.
4. Derive `counts` from the flat array - never from your own recollection of what the agents said.

The array is the deliverable. Rendering is the caller's job: `cr` builds the 13-section report from it, the executor triages it by severity.

## Step 5 - Advance state

Only with a `run_id`, only on a committed range, and only after the merge:

```bash
python3 ${CLAUDE_PLUGIN_ROOT}/scripts/bdk_run_state.py review-done \
  --run {run_id} --reviewed-sha {head_sha} [--group {n}] \
  --counts {C},{H},{M},{L} [--report {path}]
```

`--reviewed-sha` must be the resolved sha from Step 1. The script refuses the literal `HEAD` (it is not durable) and refuses a sha that is not a descendant of the current watermark (the watermark only moves forward). Both refusals mean the caller got the range wrong - fix the call, do not work around it.

Defer each `MEDIUM` and `LOW` rather than dropping it:

```bash
python3 ${CLAUDE_PLUGIN_ROOT}/scripts/bdk_run_state.py findings-add \
  --run {run_id} --severity MEDIUM --category {cat} \
  --file {path} --line {n} [--symbol {name}] --problem {one line} [--fix {one line}]
```

`--category` takes a slug from the vocabulary above. The script normalizes case and separators (`Dead Code`, `dead_code` → `dead-code`) so a stored entry is keyed the same way whatever spelling reaches it, but it does not guess a slug from prose - pass one of the ten.

Idempotency: `(severity, category, file, symbol, problem)` when `--symbol` is given, `(severity, category, file, line, problem)` when it is not. Pass `--symbol` whenever the merge resolved one - a re-review of an edited file finds the same defect on a shifted line, and a line-keyed entry then stores a second copy of a finding already deferred.

## Mode differences

Everything above is shared. These are the only divergences:

| | `interactive` (`cr`) | `autonomous` (executor) |
|---|---|---|
| Range default | delta when a run exists, full otherwise | full (end-of-plan) |
| Dirty tree | allowed; review it, warn, skip `review-done` | cannot happen (clean-tree precondition) |
| static-analyse / test-runner | dispatched | skipped (already run per group) |
| Output | 13-section report file plus terminal summary | severity triage: CRITICAL/HIGH to fixers, MEDIUM/LOW to `findings-add` |
| `CRITICAL` remaining | reported to the user, who decides | blocks; up to 2 review-fix cycles, then stop with an error |
| State advance | `review-done` when a run exists and the tree is clean | always |

## Error handling

| Situation | Do |
|---|---|
| `range_mode: empty` | Say "no new commits since <sha>" and stop. No dispatch, no report, no state change |
| One agent fails or times out | Continue with the rest. Name it in `degraded[]` and in the report. Never let a partial review present as complete |
| Every agent fails | Stop with an error. There is no review to report |
| `resolve-range` refuses (unknown run) | The `run_id` is wrong, or the manifest is for another branch. Re-derive it with `list --branch`; do not fall back to guessing a baseline while claiming a run |
| `review-done` refuses | Report the message verbatim and leave the watermark alone. A wrong watermark silently un-reviews commits on the next pass, which is worse than not advancing it |
