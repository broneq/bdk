# Documentation Template

## Standard Structure

Every code explanation document should follow this structure:

```markdown
# [Feature/Module Name] - Architecture Documentation

## Overview

Brief 2-3 sentence description of what this code does and its purpose in the system.

## Core Architecture

### File Tree

\`\`\`
module_name/
├── core/
│   ├── parser.py          # Parses input format X
│   ├── processor.py       # Core transformation logic
│   └── validator.py       # Schema validation
├── services/
│   └── orchestrator.py    # Coordinates processing pipeline
└── utils/
    └── helpers.py         # Utility functions
\`\`\`

### Component Diagram

\`\`\`dot
digraph architecture {
    // Your Graphviz diagram here
}
\`\`\`

## Architecture Flow

### High-Level Process

\`\`\`dot
digraph flow {
    // Sequential flow diagram
}
\`\`\`

### Detailed Steps

1. **Step Name**: Brief description
   - Key operation performed
   - Important side effects

2. **Step Name**: Brief description
   - Key operation performed

## Critical Rules

### Rule Category 1

**Rule**: [State the rule clearly]

**Why**: [Explain the rationale]

**Example violation**:
\`\`\`python
# Bad: violates rule
if some_condition:
    incorrect_approach()
\`\`\`

**Correct approach**:
\`\`\`python
# Good: follows rule
if some_condition:
    correct_approach()
\`\`\`

### Rule Category 2

[Repeat structure above]

## Live Examples

### Example 1: [Common Use Case]

**Scenario**: Describe the scenario

**Input**:
\`\`\`python
input_data = {
    "field": "value"
}
\`\`\`

**Processing** (prototype code):
\`\`\`python
# Parse input
parsed = parse(input_data)

# Transform
if parsed.needs_special_handling:
    result = special_transform(parsed)
else:
    result = standard_transform(parsed)

# Output
return format_output(result)
\`\`\`

**Output**:
\`\`\`python
{
    "transformed_field": "transformed_value"
}
\`\`\`

**Key Points**:
- Important aspect 1
- Important aspect 2

### Example 2: [Edge Case]

[Repeat structure above]

## Real-World Examples (Optional)

_Include this section when the module performs data transformations, algorithmic processing,
or multi-step pipelines where concrete input/output pairs make the behavior tangible.
Skip for simple CRUD, configuration, or thin wrapper modules._

### Example 1: [Descriptive Scenario Name]

**Input:**
\`\`\`
[Concrete input data in the module's actual format — HTML, XML, JSON, text, etc.]
\`\`\`

**Processing:**

| Step | Action | Result |
|------|--------|--------|
| 1 | [What happens] | [Intermediate state] |
| 2 | [What happens] | [Intermediate state] |
| 3 | [What happens] | [Final state] |

**Result:**
\`\`\`
[Concrete output in the module's actual format]
\`\`\`

### Example 2: [Edge Case or Alternative Path]

[Same structure as above — show a different scenario that reveals
non-obvious behavior, boundary conditions, or fallback logic]

### Example 3: [Complex Scenario] (if needed)

[Only include a third example when the module has genuinely distinct
processing paths worth demonstrating]

## Core Classes

### Class: ClassName

**Purpose**: What this class does

**Key Responsibilities**:
- Responsibility 1
- Responsibility 2

**Structure**:
\`\`\`dot
digraph class_detail {
    node [shape=record];

    ClassName [label="{ClassName|
        - field1\l
        - field2\l
        |+ method1()\l
        + method2()\l
    }"];

    Dependency [label="{Dependency}"];
    ClassName -> Dependency [label="uses"];
}
\`\`\`

**Usage Pattern** (prototype):
\`\`\`python
# Initialize
instance = ClassName(config_params)

# Use
result = instance.method1(input_data)

# Handle output
if result.is_valid():
    process(result)
\`\`\`

**Important Notes**:
- Note about thread safety, immutability, etc.
- Note about performance considerations

### Class: AnotherClass

[Repeat structure above]

## Testing Coverage

### Unit Tests

Located in `tests/unit/[module_path]/`:
- `test_class_name.py` - Tests for ClassName
- `test_another_class.py` - Tests for AnotherClass

**Key test patterns**:
- Parametrized tests for edge cases
- Mock dependencies for isolation
- Fixture factories in `tests/helpers/factories.py`

### Integration Tests

Located in `tests/integration/`:
- `test_feature_integration.py` - End-to-end feature tests
- Uses real fixtures from `tests/fixtures/`

**Test data**:
- Multiple template types (nype46, nype93, gencon1994)
- Real-world document scenarios

## References

- Link to related documentation
- Link to API specs
- Link to design decisions
\`\`\`

## Section Guidelines

### Overview
- Keep to 2-3 sentences
- State the "what" and "why"
- Mention key dependencies if relevant

### Core Architecture
- File tree should show 2-3 levels max
- Component diagram shows major components only
- Use consistent naming with actual code

### Architecture Flow
- Show the happy path first
- Add error paths as dashed lines
- Keep diagrams under 15 nodes

### Critical Rules
- Focus on non-obvious rules
- Explain the "why" not just the "what"
- Provide both good and bad examples

### Live Examples
- Use realistic but simple data
- Prototype code should be 10-20 lines max
- Focus on one thing per example
- Show input → processing → output

### Real-World Examples (Optional)
- **Include when**: Module has data transformations, algorithms, or multi-step pipelines
- **Skip when**: Simple CRUD, configuration wrappers, or thin delegation layers
- Use concrete data in the module's actual format (HTML, XML, JSON, etc.)
- Show step-by-step processing with intermediate states (tables work well)
- 2-3 examples: start with the happy path, then show edge cases or fallback logic
- Keep each example focused on one scenario — don't combine multiple concerns
- Input/output should be realistic but minimal (enough to show the behavior, no more)
- Processing steps should reveal the "why" — what decisions the algorithm makes and why

### Core Classes
- One class per subsection
- Show only public API in diagrams
- Prototype usage should be 5-15 lines
- Explain design decisions

### Testing Coverage
- Describe existing test structure (unit vs integration)
- Location of test files relative to source code
- Key test patterns used (parametrized, fixtures, mocks)
- Test data sources (fixtures directory, factories)

## Prototype Code Rules

**DO:**
- Use placeholder names: `process()`, `transform()`, `calculate()`
- Show control flow clearly
- Include comments for key steps
- Use realistic data structures
- Keep under 20 lines

**DON'T:**
- Copy actual implementation line-by-line
- Include all error handling details
- Show complete parameter lists
- Include logging/debugging code
- Replicate complex algorithms in full

**Example - Good Prototype:**
```python
# Parse and validate
parsed_data = parse(raw_input)
if not parsed_data.is_valid:
    return error_response()

# Transform based on type
if parsed_data.type == 'special':
    result = special_transform(parsed_data)
else:
    result = standard_transform(parsed_data)

return format_output(result)
```

**Example - Bad (too detailed):**
```python
# DON'T copy actual implementation
try:
    parser = HTMLParser(config={'strict': True, 'encoding': 'utf-8'})
    tokens = parser.tokenize(raw_input)
    validator = SchemaValidator(schema_path='/path/to/schema.json')
    if not validator.validate(tokens):
        logger.error(f"Validation failed: {validator.errors}")
        raise ValidationError(validator.errors)
    # ... 50 more lines of actual code
```
