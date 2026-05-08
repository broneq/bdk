# Dispatch Templates

Copy-paste prompt skeletons the coordinator uses when spawning subagents. Each template is self-contained — the subagent should not need to read additional files to start.

## Model parameter

Agent definitions declare a default model in their frontmatter (`implementer` and `fixer` default to `sonnet`). The Agent tool's `model` parameter **overrides** that default per dispatch.

- **Omit `model:`** when the default is correct (most tasks).
- **Pass `model: "haiku"`** when the matrix in `model-selection.md` says step down.
- **Pass `model: "opus"`** when the matrix says step up, or when re-dispatching after a reasoning-related `BLOCKED`.

Reviewers (`code-reviewer`, `architecture-reviewer`, `static-analyse`, `test-runner`) have their own opinionated defaults baked into their agent files — do not override unless you have a specific reason.

---

## Implementer dispatch

```text
Agent tool — subagent_type: "implementer"
  [optional] model: "haiku" | "opus"   # omit for default (sonnet)

  description: "Implement Task {N}: {short title}"

  prompt: |
    You are implementing Task {N} of the plan at {plan-path}.
    The coordinator has all plan context. You only need what is below.

    ## Task {N}: {title}

    {full task text from plan — verbatim, do not summarize}

    ## Test cases

    {paste the **Test cases:** block from the plan task verbatim}

    ## Files this task touches

    - {explicit path 1}
    - {explicit path 2}

    ## Architectural context

    {one paragraph: where this task sits, what it depends on, conventions to follow}

    ## Branch

    - Branch: {branch-name}
    - Base SHA: {sha-before-task-N}

    Commit your work to this branch. One commit per task.
```

---

## Fixer dispatch (lint findings)

```text
Agent tool — subagent_type: "fixer"
  # default model (sonnet) is correct for almost all fixer dispatches

  description: "Fix lint issues from Task {N}"

  prompt: |
    The static-analyse agent escalated these issues after Task {N}. Apply
    minimum-scope fixes. Do not refactor adjacent code.

    ## Findings

    {paste the "ESCALATE TO MAIN AGENT" block from static-analyse output verbatim}

    ## Files to touch

    - {paths from the findings}

    ## Branch

    - Branch: {branch-name}
    - Base SHA: {current HEAD before fixer}

    Verify by re-running the project's linter on the changed files. Commit
    with subject: fix(lint): {short summary}
```

---

## Fixer dispatch (test failures)

```text
Agent tool — subagent_type: "fixer"

  description: "Fix test failures from Task {N}"

  prompt: |
    The test-runner agent reported these failures after Task {N}.

    ## Failing tests

    {paste failure block — test names + error messages — verbatim}

    ## Likely scope

    The implementer modified: {paths}

    ## Branch

    - Branch: {branch-name}
    - Base SHA: {current HEAD}

    Diagnose the failure, apply minimum-scope fix, re-run the failing tests
    to verify GREEN. Commit with subject: fix(tests): {short summary}
```

---

## Fixer dispatch (code-review findings)

```text
Agent tool — subagent_type: "fixer"

  description: "Apply code-review findings (round {R})"

  prompt: |
    The code-reviewer agent reported these CRITICAL/HIGH findings on the
    full branch diff. Apply minimum-scope fixes. Group by file.

    ## Findings

    - [SEVERITY] [CATEGORY] → {file:line} → {problem} → {suggested fix}
    - ...

    ## Branch

    - Branch: {branch-name}
    - Base SHA: {merge-base with main}

    Verify each fix by re-reading the cited line. Commit with subject:
    fix(review): {short summary of dominant finding}
```

---

## Code-reviewer dispatch

```text
Agent tool — subagent_type: "code-reviewer", model: sonnet:

  description: "Final code review on branch {branch-name}"

  prompt: |
    Review the cumulative diff for branch {branch-name}.

    ## Scope

    - Branch: {branch-name}
    - Base SHA: {merge-base with main}
    - Head SHA: HEAD
    - Plan: {plan-path}

    ## Files changed

    {paste output of `git diff --name-only {base-sha}..HEAD`}

    Use `detect_changes` and `get_review_context` from the codegraph for
    risk-scored prioritization. Apply general best practices and any project
    rules from CLAUDE.md / .claude/rules/.

    Output the standard FINDINGS / POSITIVE_OBSERVATIONS / TEST_GAPS block
    defined in your agent prompt. Group findings by file in the output so
    the coordinator can batch them for the fixer.
```

---

## Architecture-reviewer dispatch (conditional)

```text
Agent tool — subagent_type: "architecture-reviewer", model: opus:

  description: "Architecture review on branch {branch-name}"

  prompt: |
    Review the cumulative diff for branch {branch-name} for architectural
    concerns only — layer boundaries, DI, design patterns, data flow,
    directory structure, import direction.

    ## Scope

    - Branch: {branch-name}
    - Base SHA: {merge-base with main}
    - Head SHA: HEAD
    - Plan: {plan-path}

    ## Reason for review

    {one sentence: why this branch needs architecture review — e.g.
    "introduces a new module under src/foo and a new public API"}

    Output the standard ARCHITECTURE_FINDINGS block defined in your
    agent prompt.
```

---

## Static-analyse dispatch (per task)

```text
Agent tool — subagent_type: "static-analyse", model: haiku:

  description: "Lint changed files from Task {N}"

  prompt: |
    Run the project's static analysis on these files only:

    - {path 1}
    - {path 2}

    Auto-fix what is auto-fixable. Escalate the rest.
```

---

## Test-runner dispatch (per task, smart cadence)

```text
Agent tool — subagent_type: "test-runner", model: haiku:

  description: "Run tests after Task {N}"

  prompt: |
    Run the project's test suite scoped to:

    - {test path 1}
    - {test path 2}

    Report pass/fail counts and failure messages. Do not investigate causes.
```

---

## Test-runner dispatch (final, full suite)

```text
Agent tool — subagent_type: "test-runner", model: haiku:

  description: "Final test suite for branch {branch-name}"

  prompt: |
    Run the full project test suite. Report pass/fail counts and failure
    messages. Do not investigate causes.
```
