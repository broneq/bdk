# Explorer Agent Prompts

Use these prompts when dispatching Task agents in Phase 2. Replace `{feature description}` with the actual feature before dispatching.

---

## Agent 1: Utilities & Existing Implementations (ALWAYS launch)

```
Search the codebase for existing utilities and implementations related to:

Feature: {feature description}

Use Serena tools (find_symbol, search_for_pattern, get_symbols_overview) to:
1. Check if similar functionality already exists (check utility_classes memory first)
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

Read architecture_patterns and code_style_and_conventions memories if available. Use Serena tools to:
1. Identify which layer(s) this feature touches (CLI, Use Cases, Services, Processors, Repository)
2. Find which existing services or processors need changes
3. Trace dependencies using find_referencing_symbols
4. Check for related test files and test patterns

Return structured findings:
AFFECTED_LAYERS: {list layers}
AFFECTED_FILES: {list file paths}
DEPENDENCIES: {what this feature depends on}
TEST_PATTERNS: {describe testing approach from existing tests}
ARCHITECTURAL_CONSTRAINTS: {any SOLID principles or patterns to follow}
```

---

## Agent 3: Similar Features (Complex scope only)

```
Find similar features in the codebase as implementation examples:

Feature: {feature description}

Use Serena tools to:
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
