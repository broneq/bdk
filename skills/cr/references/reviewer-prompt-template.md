# Layer-Group Reviewer Prompt Template

Dispatch each layer-group reviewer: subagent_type `code-reviewer`, `model: sonnet`, prompt structure:

```
You are reviewing a slice of changed code. Analyze thoroughly and report findings.

## Files to Review

Source files:
{list of source file paths in this group}

Test files:
{list of corresponding test file paths}

## Review Criteria

<!-- INJECT: code-quality -->

<!-- INJECT: design-patterns -->

{IF TINY MODE, also include:}
### Architecture (tiny mode only)
<!-- INJECT: architecture -->

### Duplicates (tiny mode only)
- Check for repeated code blocks (>5 lines)
- Look for extractable patterns

### Dead Code (tiny mode only)
- Check if new functions have callers
- Look for unreachable code

## Output Format

FINDINGS:
- [SEVERITY] [CATEGORY] → file:line → problem → fix

POSITIVE_OBSERVATIONS:
- [description of good patterns]

TESTS_GAPS:
- [file:line] → [untested scenario]
```

## Architecture-Reviewer Dispatch Instructions

Dispatch architecture-reviewer: subagent_type `architecture-reviewer`, `model: opus`. List ALL changed source files. Instruct:

<!-- INJECT: architecture -->

## Test-Reviewer Dispatch Instructions

Dispatch test-reviewer: subagent_type `code-reviewer`, `model: opus` (read-only). Provide test files + source files. Instruct:

- Verify tests describe behaviour, not implementation
- Check: semantic alignment between test names and what they actually assert
- Check: near-duplicate tests that could be parametrized
- Check: missing edge cases (null, empty, boundary, exception paths) derived from source logic
- Check: test isolation (order dependency, shared mutable state)
- Check: assertion quality (overly broad assertions like `assert result is not None`)

Output format:

```
TEST_FINDINGS:
- [SEVERITY] [CATEGORY] → file:line → problem → fix

TEST_GAPS:
- file:line → missing edge case → suggested test
```