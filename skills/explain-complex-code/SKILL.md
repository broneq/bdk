---
name: explain-complex-code
description: Generate comprehensive architecture documentation for complex code modules with Graphviz diagrams and examples. Use when user asks to "explain this code", "document the architecture", or wants to understand how a module/system works.
model: sonnet
user-invocable: true
argument-hint: "[path]"
hooks:
  Stop:
    - hooks:
        - type: prompt
          prompt: "Verify documentation completeness: $ARGUMENTS\n\nRequired checks:\n1. File saved to .bdk/explain-complex-code/ directory\n2. Contains Overview section (2-3 sentences)\n3. Contains Core Architecture with file tree\n4. Contains at least ONE Graphviz diagram compiled to SVG (no raw ```dot or ```graphviz blocks remain — all replaced with ![...](*.svg) image references)\n5. Contains Critical Rules section with examples\n6. Contains Live Examples with PROTOTYPE code (not actual implementation)\n7. Contains Core Classes section\n8. Contains Testing Coverage section describing existing tests\n\nReview the conversation and tool outputs. If ANY required section is missing or incomplete, respond: {\"ok\": false, \"reason\": \"Missing: [list specific items]\"}\n\nIf all sections present and complete, respond: {\"ok\": true}"
          timeout: 30
---

# Explain Complex Code

> Relies on BDK foundation (STARTUP_INSTRUCTIONS.md) for project context and MCP tool preference.

Generate architecture docs for complex code with visual diagrams and examples.

## Workflow

### 1. Understand Scope

`path` arg specifies code to explain. Clarify:
- **Focus areas**: Architecture, algorithms, data flow, testing strategy
- **Audience level**: Team onboarding, external docs, debugging guide

### 2. Analyze Code Structure

**Step 2.1: Initial Discovery**
Use Tier 1/2/3 tools per BDK foundation to discover structure.

**Step 2.2: Map Dependencies**
For each key class/function: find callers and callees.

**Step 2.3: Decide Partitioning Strategy**

| Files Count | Strategy | Subagent Count |
|-------------|----------|----------------|
| 1-2 files | One subagent for entire module | 1 subagent |
| 3-5 files | Group into 1-2 logical blocks | 1-2 subagents |
| 6-10 files | Group into 2-3 logical blocks | 2-3 subagents |
| 10+ files | Group by architectural layers | 3-4 subagents |

**Never more than 3-4 subagents.**

### 3. Launch Subagents Strategically

Launch ALL subagents in ONE message. Per subagent:

```
Explore the following files as a logical block: [FILE_LIST]

For EACH file, report:
1. Core responsibilities and purpose
2. Key classes/functions and their roles
3. Important dependencies
4. Critical algorithms or rules
5. Data structures
6. Edge cases or special handling

Then synthesize:
7. How these files work together
8. Data flow between them
9. Shared dependencies or patterns
```

### 4. Synthesize Documentation

From subagent findings, create structured docs.

**Structure:**
1. **Overview**: 2-3 sentence summary
2. **Core Architecture**: File tree + component diagram
3. **Architecture Flow**: Process flow with Graphviz
4. **Critical Rules**: Non-obvious rules with examples
5. **Live Examples**: Prototype code (NOT actual implementation)
6. **Core Classes**: Key classes with usage patterns
7. **Testing Coverage**: Existing test structure and patterns

### 5. Create Graphviz Diagrams

Use for:
- **Data flow**: How data moves through system
- **Component architecture**: Layers and dependencies
- **Algorithm flow**: Decision points and steps

Under 15 nodes. Label edges clearly.

### 6. Write Prototype Examples

**CRITICAL RULE**: Prototype code only — NOT actual implementation.

**Good Prototype:**
```
# Parse and validate
parsed = parse(input_data)
if not parsed.is_valid:
    return error_response()

# Transform based on type
result = transform(parsed)
return format_output(result)
```

**Prototype Rules:**
- Placeholder function names
- Clear control flow
- Comments for key steps
- Under 20 lines per example
- One concept per example

### 7. Save Documentation

Save to `.bdk/explain-complex-code/[feature-name].md`.

### 8. Compile Diagrams

After saving, invoke `/bdk:graphviz-docs-compiler` to extract `.dot` files and compile to SVG.

## Quality Checklist

- [ ] Overview (2-3 sentences)
- [ ] File tree
- [ ] At least one Graphviz diagram
- [ ] Dot code blocks replaced with SVG image references
- [ ] Critical rules with examples
- [ ] Live examples with prototype code
- [ ] Core classes with usage
- [ ] Testing coverage

## Notes

- **Prototype code mandatory**: Never copy actual implementation
- **Parallel subagents save time**: Launch all in one message
- **Focus non-obvious details**: Skip basic patterns