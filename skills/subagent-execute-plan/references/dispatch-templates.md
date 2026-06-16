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

    Return the YAML envelope per the preloaded `bdk-implementer-return-contract` meta-skill. Final message MUST be that YAML — no prose before or after.
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

---

## Workflow wave dispatch (when SKILL Step 3a-S chose `workflow`)

Used for a single group/wave of **file-disjoint, mechanical** tasks. The coordinator invokes the `Workflow` tool with the script below, passing the wave's per-task data as `args`. The script reuses `bdk:implementer` / `bdk:fixer` via `agentType` — the YAML return contract is transcribed to `RETURN_SCHEMA` so each agent emits structured output the script can branch on. The script **implements + optionally fixes only**: no tests, no lint, no commit (the coordinator owns those in SKILL 3d–3g).

`args` shape (coordinator builds this; tasks must be disjoint per the explorer):

```json
{
  "branch": "feature/xyz",
  "base_sha": "abc1234",
  "tasks": [
    {
      "id": "2.1",
      "title": "…",
      "text": "<full task text verbatim>",
      "test_cases": "<Test cases: block verbatim>",
      "files": ["src/a.py"],
      "context": "<one-paragraph architectural context>",
      "model": "haiku"
    }
  ]
}
```

Script skeleton:

```javascript
export const meta = {
  name: 'execute-wave',
  description: 'Implement one plan wave of disjoint tasks via the bdk fleet',
  phases: [{ title: 'Implement' }, { title: 'Fix' }],
}

const RETURN_SCHEMA = {
  type: 'object',
  required: ['status'],
  properties: {
    status: { type: 'string', enum: ['DONE', 'DONE_WITH_CONCERNS', 'NEEDS_CONTEXT', 'BLOCKED'] },
    files_changed: { type: 'array', items: { type: 'string' } },
    concerns: { type: 'array', items: { type: 'string' } },
    reason: { type: 'string' },
  },
}

const dispatch = (t) => `You are implementing Task ${t.id} of the plan.
The coordinator has all plan context. You only need what is below.

## Task ${t.id}: ${t.title}

${t.text}

## Test cases

${t.test_cases}

## Files this task touches

${t.files.map((f) => `- ${f}`).join('\n')}

## Architectural context

${t.context}

## Branch

- Branch: ${args.branch}
- Base SHA: ${args.base_sha}

Commit your work to this branch. One commit per task.

Return the YAML envelope per the preloaded \`bdk-implementer-return-contract\` meta-skill. Final message MUST be that YAML — no prose before or after.`

const results = await pipeline(
  args.tasks,
  (t) => agent(dispatch(t), {
    agentType: 'bdk:implementer',
    model: t.model,                 // omit-equivalent: pass 'sonnet' for default
    label: `impl:${t.id}`,
    phase: 'Implement',
    schema: RETURN_SCHEMA,
  }).then((r) => ({ task: t, r })),

  ({ task, r }) => {
    if (!r) return { task, r, fixed: null }
    const needsFix = r.status === 'BLOCKED' ||
      (r.status === 'DONE_WITH_CONCERNS' && (r.concerns || []).length > 0)
    if (!needsFix) return { task, r, fixed: null }
    // one fixer attempt — no looping inside the script
    return agent(
      `The implementer returned ${r.status} for Task ${task.id}.\n` +
      `Reason/concerns: ${r.reason || (r.concerns || []).join('; ')}\n` +
      `Files: ${task.files.join(', ')}\n` +
      `Branch: ${args.branch}, Base SHA: ${args.base_sha}\n` +
      `Apply minimum-scope fixes and commit. Return the YAML envelope per the preloaded contract.`,
      { agentType: 'bdk:fixer', label: `fix:${task.id}`, phase: 'Fix', schema: RETURN_SCHEMA },
    ).then((fixed) => ({ task, r, fixed }))
  },
)

const final = results.filter(Boolean).map(({ task, r, fixed }) => {
  const last = fixed || r
  return { id: task.id, status: last?.status || 'BLOCKED', files: last?.files_changed || [] }
})

return {
  files_changed: [...new Set(final.flatMap((x) => x.files))],
  blocked: final.filter((x) => x.status === 'BLOCKED').map((x) => x.id),
  needs_context: final.filter((x) => x.status === 'NEEDS_CONTEXT').map((x) => x.id),
}
```

The coordinator reads the returned object, feeds `files_changed` into SKILL 3d/3e/3g, and falls back to a single hand-orchestrated `bdk:implementer` (the "Implementer dispatch" template above) for each id in `blocked` / `needs_context`.
