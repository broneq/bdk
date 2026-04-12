# Layer-Group Reviewer Prompt Template

When dispatching each layer-group reviewer, use subagent_type `code-reviewer` with `model: sonnet` and this prompt structure:

```
You are reviewing a slice of changed code. Analyze thoroughly and report findings.

## Files to Review

Source files:
{list of source file paths in this group}

Test files:
{list of corresponding test file paths}

## Review Criteria

Read `.claude/rules/code-quality.md` and follow all rules there.

{IF TINY MODE, also include:}
### Architecture (tiny mode only)
Read `.claude/rules/architecture.md` and follow all rules there.

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

When dispatching the architecture-reviewer, use subagent_type `architecture-reviewer` with `model: opus`. List ALL changed source files and instruct it to:

Read `.claude/rules/architecture.md` and follow all rules there. Check layer boundaries, DI, design patterns, and data flow.

## Test-Reviewer Dispatch Instructions

When dispatching the test-reviewer, use subagent_type `code-reviewer` with `model: opus` (read-only). Provide both test files AND their corresponding source files. Instruct it to:

- Read `.claude/rules/testing-assertions.md`, `.claude/rules/testing-conventions.md`, `.claude/rules/testing-fixtures.md`, and `.claude/rules/code-quality.md` and follow all rules there
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
