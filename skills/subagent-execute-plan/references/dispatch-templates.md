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
Agent tool — subagent_type: "bdk:implementer"
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

    Leave your changes uncommitted in the working tree. The coordinator
    commits once per group after its own verification.

    Return the YAML envelope per the preloaded `bdk-implementer-return-contract` meta-skill. Final message MUST be that YAML — no prose before or after.
```

---

## Fixer dispatch (lint findings)

```text
Agent tool — subagent_type: "bdk:fixer"
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

    Verify by re-running the project's linter on the changed files. Leave
    the fixes uncommitted — the coordinator commits.
```

---

## Fixer dispatch (test failures)

```text
Agent tool — subagent_type: "bdk:fixer"

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
    to verify GREEN. Leave the fix uncommitted — the coordinator commits.
```

---

## Fixer dispatch (code-review findings)

```text
Agent tool — subagent_type: "bdk:fixer"

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

    Verify each fix by re-reading the cited line. Leave the fixes
    uncommitted — the coordinator commits.
```

---

## Reviewer dispatch — see the review engine

There is no reviewer template here. Step 4a runs the shared review engine, which owns range resolution, the size-based scaling table, the delta/cumulative cohort split, and the mandatory range-context and suppression blocks:

- `${CLAUDE_PLUGIN_ROOT}/skills/cr/references/review-engine.md` — the process
- `${CLAUDE_PLUGIN_ROOT}/skills/cr/references/reviewer-prompt-template.md` — the prompt structure for `bdk:code-reviewer` and `bdk:architecture-reviewer`

A second copy of those prompts here is exactly how the two review call sites drifted apart in the first place. The fixer templates below stay, because routing findings back into code is the executor's own job and `cr` never does it.

---

## Verifier dispatches

Every verifier dispatch passes **paths and intent**, never a resolved command. Both agents preload the project's tier/scoping policy (`bdk-lint-tools`, `bdk-test-tools`) and pick the command form themselves — which is what keeps the scoping correct when `.bdk/settings.json` changes, and what stops a stale command string in this file from being run for a year.

### Static-analyse (per group)

```text
Agent tool — subagent_type: "bdk:static-analyse", model: haiku:

  description: "Lint changed files from group {N}"

  prompt: |
    Static analysis, scoped to these files only:

    - {path 1}
    - {path 2}

    Use the scoped form for lint/format and the incremental form for
    typecheck. Auto-fix what is auto-fixable. Escalate the rest.
```

### Test-runner (per group — changed source files)

```text
Agent tool — subagent_type: "bdk:test-runner", model: haiku:

  description: "Run tests for group {N}"

  prompt: |
    Changed source files — run the fast tier's tests covering them:

    - {path 1}
    - {path 2}

    Use the `related` form if configured, otherwise `scoped` on the
    matching test files. Fast tier only: no e2e/integration tier.

    Report the exact command you ran, pass/fail counts, and failure
    messages. Do not investigate causes.
```

Add, **only** when the group added or modified e2e specs (or 3d's public-contract widening applies):

```text
    Also run these e2e specs, scoped to exactly these paths:
    - {spec path 1}
```

### Test-runner (fix cycle — failed-first)

```text
Agent tool — subagent_type: "bdk:test-runner", model: haiku:

  description: "Re-run failures after fix (cycle {N})"

  prompt: |
    Re-run the failures only — use each tier's `failed` form. These are
    the failures being chased:

    {failure list from the previous run}

    Do not run the full suite; a confirming full run comes later.
    Report the exact command you ran and pass/fail counts.
```

Prefer `SendMessage` to the verifier already holding this group's context over a fresh spawn (see SKILL 3f).

### Test-runner (final gate — full suite)

The one full-suite dispatch per run. Sent at SKILL step 4-0, in the background, before the review fan-out.

```text
Agent tool — subagent_type: "bdk:test-runner", model: haiku:

  description: "Final gate: full suite for branch {branch-name}"

  prompt: |
    Final gate: run the FULL, unscoped suite of every tier configured in
    test-tools, e2e/integration included.

    Report the exact commands you ran, pass/fail counts per tier, and
    failure messages. Do not investigate causes.
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

Leave your changes uncommitted in the working tree. The coordinator commits once per group.

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
      `Apply minimum-scope fixes and leave them uncommitted. Return the YAML envelope per the preloaded contract.`,
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
