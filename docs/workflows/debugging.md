# Debugging

```
/bdk:debug <error message, traceback, or steps to reproduce>
```

`/bdk:debug` is not a tier - it is what you run when you have a symptom rather than a
change. It ends by handing you back to one of the tiers, with a failing test already
written.

Core principle: understand first, test second, confirm with the user, fix third.

## The five phases

The phases run strictly in order, each announced as it is entered
(`[debug] Phase 2: Investigate`), and the next one does not start until the current one is
done.

### Phase 1 - Parse input

Validates the input (empty or vague means it asks for details and stops), extracts the
error type, failing component, steps to reproduce, and expected versus actual, then prints:

```
[debug] Issue: {one-line summary}
[debug] Signals: error={exception class or "none"}, component={file/class or "unknown"}
```

### Phase 2 - Investigate

Using the session's injected search and impact tiers, it finds the entry point, traces
callers up and callees down, identifies the impacted execution paths, flags cascading
risk at choke points, identifies the root cause, quantifies the blast radius, and scans
for the same class of problem in nearby code only:

```
[debug] Root cause: {one sentence}
[debug] Affected: {file path}:{line range}
[debug] Test gaps found: {N}
```

The gate is explicit: the root cause must be identified before Phase 3.

### Phase 3 - Write failing tests

Tests that precisely reproduce the bug, with specific input values and specific expected
outcomes, placed in the correct existing test file and following the project's test
conventions. They are confirmed RED by running the matching tier's `scoped` form on just
those files, directly via `Bash` - never a full tier, and never an e2e tier unless the
tests written *are* e2e specs.

```
[debug] Failing tests confirmed: {N} red
```

All new tests must be RED before Phase 4.

### Phase 4 - Propose and wait (HARD STOP)

This is the phase that makes the skill worth invoking. It describes the proposed solution
(what changes, why it fixes the root cause, risks), assesses complexity as LOW (isolated
change, one function or call site) or HIGH (many call sites, new abstractions, shared data
models), and asks you to choose:

1. **Fix now** - apply the inline fix and verify tests pass
2. **Create plan** - hand off to `/bdk:create-plan` with failing tests as acceptance criteria
3. **Something else** - redirect, reconsider, investigate more

!!! warning
    Phase 4 is a hard stop. After the question the turn ends: no text, no tools, no
    action. Only an actual user reply releases it - a background task completing, a hook
    firing, or the model's own reasoning does not, no matter how obvious the fix looks.

That stop is the whole point. A root cause found in one file very often has a second,
structural cause, and the cheapest moment to notice is before the first edit.

### Phase 5a - Fix inline

Applies the minimal fix, re-runs the same scoped command from Phase 3 to confirm those
tests are GREEN, delegates lint and incremental typecheck to `bdk:static-analyse` with the
changed files (not a project-wide sweep), then runs one regression dispatch to
`bdk:test-runner` for the fast tier's `related`/`scoped` form over the changed source.
An e2e tier is added only if the fix touched e2e specs or changed a public contract.

```
[debug] Done.
  Root cause:   {one sentence}
  Tests added:  {N}
  Fix applied:  {brief description}
  Status:       all tests GREEN
```

### Phase 5b - Hand off to a plan

```
[debug] Routing to /bdk:create-plan
```

The handoff is not just the sentence "fix this bug". `/bdk:create-plan` receives the root
cause as the feature description, the steps to reproduce verbatim, the failing test file
path and test names as acceptance criteria, and the architectural constraints discovered
during investigation. The plan starts from a reproduction, not from a guess.

From there you are in [the standard workflow](standard.md) - or the
[full pipeline](full-pipeline.md) if planning surfaces a design question.

## Choosing between 5a and 5b

| Choose | When |
|---|---|
| Fix now | The change is isolated to one function or call site, and the failing tests fully describe the contract. |
| Create plan | The fix touches many call sites, introduces a new abstraction, or changes a shared data model. |
| Something else | The root cause does not explain every symptom you have seen. Investigating again is cheaper than fixing the wrong thing. |

## What you get

| Artifact | Path |
|---|---|
| Failing tests reproducing the bug | your project's existing test files |
| Phase 5a: the fix | your working tree, tests GREEN |
| Phase 5b: a plan | `.bdk/plans/<ts>-<slug>.md`, with the failing tests as acceptance criteria |

`/bdk:debug` writes nothing under `.bdk/` itself. Its output is a reproduction and a
decision.

## Next step

After 5a, review it: [Code review](code-review.md). After 5b, execute it:
[Standard workflow](standard.md).
