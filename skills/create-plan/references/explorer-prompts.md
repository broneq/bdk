# Explorer Agent Prompts

Use when dispatching explorer agents in Phase 2. Replace `{feature}` with actual feature description.

Each explorer answers one **question dimension**. Pick the agents whose question is relevant to the feature — not all three are always needed (see SKILL.md Phase 2).

---

## Shared preamble (prepend to every agent prompt)

```
Feature: {feature}

You are an explorer subagent. Use BDK tool tiers (code-review-graph → Serena → Grep) — your skills frontmatter has loaded the tier guidance.

Start with `get_minimal_context(task="{feature}")` for a quick snapshot, then dive deeper with the tools relevant to your question.

Return STRICTLY this JSON (empty arrays allowed, never omit a key):

{
  "utilities":         [{"name": "...", "path": "...", "why_relevant": "..."}],
  "affected_files":    [{"path": "...", "reason": "..."}],
  "similar_features":  [{"name": "...", "path": "...", "pattern": "..."}],
  "notes":             "free-text caveats, gaps, surprising findings"
}

Only populate the keys your question dimension owns (see role below). Leave the others as empty arrays.
```

---

## Agent 1 — Existing Code (always launched)

**Owns:** `utilities`, `similar_features` (where overlap exists)

```
Question: what code already exists that this feature can reuse or build on?

1. Search for similar functionality already implemented
2. Find helper functions, base classes, schemas, models that could be reused
3. Identify conventions/patterns this feature should follow
```

---

## Agent 2 — Architecture & Dependencies

**Owns:** `affected_files`, populates `notes` with architectural constraints

**Launch when:** feature modifies existing components, crosses module boundaries, or changes shared infrastructure.

```
Question: what does this feature touch, and what depends on it?

1. Identify which modules/layers the feature touches
2. Find existing components needing changes (use query_graph callers_of/callees_of, get_impact_radius)
3. Trace dependencies and named execution flows (get_affected_flows)
4. Surface architectural constraints in `notes`
```

---

## Agent 3 — Similar Features

**Owns:** `similar_features`, populates `notes` with implementation patterns

**Launch when:** a feature with comparable shape likely exists in the codebase (e.g. "add new endpoint X" when other endpoints already exist).

```
Question: how have similar features been implemented before?

1. Search for features with similar purpose or structure
2. Use get_review_context(node=<symbol>) to read implementation token-efficiently
3. Identify error-handling, validation, and test patterns
4. Note 1-2 concrete reference implementations in `notes`
```
