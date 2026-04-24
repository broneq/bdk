# Explorer Agent Prompts

Use when dispatching agents in Phase 2. Replace `{feature description}` with actual feature.

Tool tier system (from STARTUP_INSTRUCTIONS):
- **Tier 1:** code-review-graph (`semantic_search_nodes`, `query_graph`, `get_impact_radius`, `get_affected_flows`) — use first
- **Tier 2:** Serena (`find_symbol`, `search_for_pattern`, `get_symbols_overview`, `find_referencing_symbols`) — if CodeGraph unavailable
- **Tier 3:** Grep/Glob/Read — always available fallback

---

## Agent 1: Utilities & Existing Implementations (ALWAYS launch)

```
Search the codebase for existing utilities and implementations related to:

Feature: {feature description}

Tool preference: use code-review-graph first (semantic_search_nodes, query_graph, get_review_context).
Fall back to Serena (find_symbol, search_for_pattern, get_symbols_overview), then Grep/Glob.

1. Check if similar functionality already exists
2. Find helper functions or base classes that could be reused
3. Identify relevant schemas, models, or data structures
4. Search for patterns or conventions this feature should follow

Return structured findings:
EXISTING_IMPLEMENTATIONS: {list file:symbol paths or NONE}
REUSABLE_UTILITIES: {list file:symbol paths or NONE}
RELEVANT_MODELS: {list file paths or NONE}
PATTERNS_FOUND: {describe 1-2 patterns this feature should follow}
```

---

## Agent 2: Architecture & Dependencies (Medium or Complex scope)

```
Analyze architecture and dependencies for implementing:

Feature: {feature description}

Tool preference: use code-review-graph first (query_graph with callers_of/callees_of, get_impact_radius, get_affected_flows).
Fall back to Serena (find_referencing_symbols, get_symbols_overview), then Grep/Glob.

1. Identify which modules/layers this feature touches
2. Find which existing components need changes
3. Trace dependencies
4. Check for related test files and test patterns

Return structured findings:
AFFECTED_LAYERS: {list layers}
AFFECTED_FILES: {list file paths}
DEPENDENCIES: {what this feature depends on}
TEST_PATTERNS: {describe testing approach from existing tests}
ARCHITECTURAL_CONSTRAINTS: {patterns to follow}
```

---

## Agent 3: Similar Features (Complex scope only)

```
Find similar features in the codebase as implementation examples:

Feature: {feature description}

Tool preference: use code-review-graph first (semantic_search_nodes, get_review_context).
Fall back to Serena (find_symbol, search_for_pattern), then Grep/Glob.

1. Search for features with similar purpose or structure
2. Find examples of similar data transformations or validations
3. Identify common error handling patterns
4. Look for similar integration tests

Return structured findings:
SIMILAR_FEATURES: {list file:symbol paths}
IMPLEMENTATION_EXAMPLES: {1-2 examples with brief description}
ERROR_HANDLING_PATTERNS: {how errors are handled in similar code}
TEST_EXAMPLES: {test file paths for similar features}
```
