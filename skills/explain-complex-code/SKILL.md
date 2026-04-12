---
name: explain-complex-code
description: Generate comprehensive architecture documentation for complex code modules with Graphviz diagrams and examples. Use when user asks to "explain this code", "document the architecture", or wants to understand how a module/system works.
model: sonnet
user-invocable: true
arguments:
  - name: path
    description: Path to the code module/feature to explain
    required: true
---

# Explain Complex Code

> Relies on BDK foundation (STARTUP_INSTRUCTIONS.md) for project context and MCP tool preference.

Generate comprehensive architecture documentation for complex code with visual diagrams and clear examples.

## Workflow

### 1. Understand Scope

The `path` argument specifies what code to explain. Clarify with the user:
- **Focus areas**: Specific aspects (architecture, algorithms, data flow, testing strategy)
- **Audience level**: Team onboarding, external docs, debugging guide

### 2. Analyze Code Structure

**Step 2.1: Initial Discovery**
Use Tier 1/2/3 tools per BDK foundation to discover structure.

**Step 2.2: Map Dependencies**
For each key class/function: find its callers and what it calls.

**Step 2.3: Decide Partitioning Strategy**

| Files Count | Strategy | Subagent Count |
|-------------|----------|----------------|
| 1-2 files | One subagent for entire module | 1 subagent |
| 3-5 files | Group into 1-2 logical blocks | 1-2 subagents |
| 6-10 files | Group into 2-3 logical blocks | 2-3 subagents |
| 10+ files | Group by architectural layers | 3-4 subagents |

**Never more than 3-4 subagents total.**

### 3. Launch Subagents Strategically

Launch ALL subagents in a SINGLE message. For each subagent:

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

Using subagent findings, create structured documentation.

**Structure:**
1. **Overview**: 2-3 sentence summary
2. **Core Architecture**: File tree + component diagram
3. **Architecture Flow**: Process flow with Graphviz
4. **Critical Rules**: Non-obvious rules with examples
5. **Live Examples**: Prototype code (NOT actual implementation)
6. **Core Classes**: Key classes with usage patterns
7. **Testing Coverage**: Existing test structure and patterns

### 5. Create Graphviz Diagrams

Use diagrams for:
- **Data flow**: How data moves through system
- **Component architecture**: Layers and dependencies
- **Algorithm flow**: Decision points and steps

Keep diagrams under 15 nodes. Label edges clearly.

### 6. Write Prototype Examples

**CRITICAL RULE**: Use prototype code, NOT actual implementation.

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
- Use placeholder function names
- Show control flow clearly
- Include comments for key steps
- Keep under 20 lines per example
- Focus on ONE concept per example

### 7. Save Documentation

Save to `docs/architecture/[feature-name].md`.

## Quality Checklist

- [ ] Overview (2-3 sentences)
- [ ] File tree
- [ ] At least one Graphviz diagram
- [ ] Critical rules with examples
- [ ] Live examples with prototype code
- [ ] Core classes with usage
- [ ] Testing coverage

## Notes

- **Prototype code is mandatory**: Never copy actual implementation
- **Parallel subagents save time**: Launch all in one message
- **Focus on non-obvious details**: Skip explaining basic patterns
