# Layer-Group Reviewer Prompt Template

Dispatch each layer-group reviewer: subagent_type `bdk:code-reviewer`, `model: sonnet`, prompt structure:

```
You are reviewing a slice of changed code. Analyze thoroughly and report findings.

## Range

Reviewing: {anchor_sha}..{head_sha}  ({delta|full})
Branch baseline: {base_sha}

## Files to Review

Source files:
{delta source file paths in this group}

Test files:
{corresponding test file paths}

## Context — do NOT report findings in these

These files changed earlier on the same branch. They are here so you understand
the code you are reviewing, not for review. A finding whose location is in this
list belongs to an earlier commit and was already reviewed:

{cumulative file paths not in the delta}

## Already triaged — do NOT report these again

{paste the block from `bdk_run_state.py findings-list --format prompt`, or omit
this whole heading when there is no run}

## Review Criteria

Quality rules (code-quality, design-patterns, architecture) are preloaded into your context via meta-skills — apply them when reviewing.


### Duplicates (tiny mode only)
- Check for repeated code blocks (>5 lines)
- Look for extractable patterns

### Dead Code (tiny mode only)
- Check if new functions have callers
- Look for unreachable code

## Output Format

Use the output format from your agent definition, unchanged.
```

The reviewer's output envelope is defined once, in `agents/code-reviewer.md` ("Output Format"). Do not restate it here — a second copy is what produced the `TESTS_GAPS` / `TEST_GAPS` split.

**The three blocks above are mandatory on every dispatch.** Omitting the context list makes a reviewer re-flag code an earlier commit of the same run introduced; omitting the triage list makes it re-report findings the caller deliberately declined, which burns the review-fix budget on settled arguments. On a full-range review the context list is empty (delta == cumulative) — keep the heading and say `(none — full-range review)` so a reviewer never has to guess whether it was dropped or genuinely empty.

## Architecture-Reviewer Dispatch Instructions

Dispatch architecture-reviewer: subagent_type `bdk:architecture-reviewer`, `model: opus`. Architecture and design-pattern rules are preloaded via meta-skills — apply them.

This agent is **cumulative-scoped**: pass the full `base_sha..head_sha` file list, not the delta. A layer violation is a property of the whole branch, so a delta-scoped architecture review reports clean while the violation stands. It therefore runs only on a full-range review — on a delta pass, skip it and record `architecture_review: skipped:delta-pass` rather than running it on a fragment. Same for `bdk:dead-code-detector` and `bdk:duplicate-detector`.

## Test-Reviewer Dispatch Instructions

Dispatch test-reviewer: subagent_type `bdk:code-reviewer`, `model: opus` (read-only). Provide test files + source files. Instruct:

- Verify tests describe behaviour, not implementation
- Check: semantic alignment between test names and what they actually assert
- Check: near-duplicate tests that could be parametrized
- Check: missing edge cases (null, empty, boundary, exception paths) derived from source logic
- Check: test isolation (order dependency, shared mutable state)
- Check: assertion quality (overly broad assertions like `assert result is not None`)

Output format: the same `bdk:code-reviewer` envelope as any other reviewer, with `[CATEGORY] = TESTS` on its findings. There is no separate test-reviewer envelope — one shape to parse, not three.