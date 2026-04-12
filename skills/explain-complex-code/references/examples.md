# Explain Complex Code - Detailed Examples

This document provides detailed, realistic examples of using the explain-complex-code skill with different codebase sizes and structures.

## Example 1: Migration Pipeline (10+ files)

**Command**: `/explain-complex-code src/services/migration/`

**Step 2.1 - Initial Discovery**:
```python
# Discover 12 files across 3 subdirectories
mcp__serena__list_dir(relative_path="src/services/migration/", recursive=True)
# Files found: document_migration_service.py, + parsers/ (3 files) + transformers/ (4 files) + storage/ (4 files)
```

**Step 2.2 - Map Dependencies**:
```python
# Find key classes
mcp__serena__find_symbol(name_path_pattern="DocumentMigrationService")
mcp__serena__find_referencing_symbols(name_path="DocumentMigrationService", relative_path="...")
# Discovers: Service orchestrates Parser → Transformer → Storage flow
```

**Step 2.3 - Decision**: 12 files → Group by architectural layers (4 groups)

**Step 3 - Subagent Launch** (parallel, all in ONE message):
```python
Task("Explore Service Layer (document_migration_service.py): ...", "Explore")
Task("Explore Parser Block (parsers/html_parser.py, tokenizer.py, token_classifier.py): ...", "Explore")
Task("Explore Transformation Block (transformers/line_transformer.py, position_mapper.py, context_resolver.py, change_detector.py): ...", "Explore")
Task("Explore Storage Block (storage/repository.py, json_writer.py, xml_formatter.py, template_loader.py): ...", "Explore")
```

**Output**: `docs/architecture/migration-pipeline.md` with:
- Component diagram (4 layers with 12 files)
- Data flow diagram (HTML → Tokens → Transformed → XML)
- Critical rules (position accuracy, change detection)
- Live example (sample migration)
- Core classes (Service, Parser, Transformer, Storage)

---

## Example 2: Token Alignment Algorithm (2 files)

**Command**: `/explain-complex-code src/services/position_mapping/token_alignment.py`

**Step 2.1 - Initial Discovery**:
```python
mcp__serena__get_symbols_overview(relative_path="src/services/position_mapping/token_alignment.py")
# Files found: token_alignment.py (450 lines), test file (300 lines)
```

**Step 2.3 - Decision**: 2 files → 1 subagent to protect main context

**Step 3 - Subagent Launch**:
```python
Task(prompt="Explore Token Alignment module (token_alignment.py + tests): Report core algorithm, key classes, dependencies, critical rules, test scenarios...", subagent_type="Explore")
```

**Output**: `docs/architecture/token-alignment-algorithm.md` with:
- Algorithm flow diagram (decision tree)
- Critical rules (boundary handling, whitespace)
- Live examples (3 scenarios: exact match, partial, boundary)
- Common pitfalls (off-by-one errors)

---

## Example 3: Change Detection Module (7 files)

**Command**: `/explain-complex-code src/services/change_detection/`

**Step 2.1 - Initial Discovery**:
```python
mcp__serena__list_dir(relative_path="src/services/change_detection/", recursive=True)
# Files found: 7 files (unmarked_change_detector.py, froala_marker.py, + detectors/ (3 files) + rules/ (2 files))
```

**Step 2.2 - Map Dependencies**:
```python
mcp__serena__find_symbol(name_path_pattern="UnmarkedChangeDetector")
mcp__serena__find_referencing_symbols(name_path="UnmarkedChangeDetector", relative_path="...")
# Discovers: Main detector orchestrates Rules → Detectors → Marker flow
```

**Step 2.3 - Decision**: 7 files → Group into 2 logical blocks (not 3, keep it simple)

**Step 3 - Subagent Launch** (parallel, all in ONE message):
```python
Task("Explore Core Detection Block (unmarked_change_detector.py, rules/addition_rule.py, rules/deletion_rule.py): Report orchestration logic, rule evaluation, dependencies...", "Explore")
Task("Explore Detection Utilities Block (detectors/text_differ.py, html_comparer.py, change_classifier.py, froala_marker.py): Report comparison algorithms, classification logic, Froala integration...", "Explore")
```

**Output**: `docs/architecture/change-detection-system.md` with:
- Component diagram (2 blocks with dependency arrows)
- Algorithm flow (Rule evaluation → Detection → Classification → Marking)
- Critical rules (unmarked text detection, Froala compatibility)
- Live examples (detection scenarios)

---

## Example 4: Single Utility File (1 file)

**Command**: `/explain-complex-code src/utils/position_calculator.py`

**Step 2.1 - Initial Discovery**:
```python
mcp__serena__get_symbols_overview(relative_path="src/utils/position_calculator.py")
# File: 180 lines, 3 classes, 8 helper functions
```

**Step 2.3 - Decision**: 1 file → 1 subagent to protect context

**Step 3 - Subagent Launch**:
```python
Task(prompt="Explore position_calculator.py: Report all classes/functions, their purposes, key algorithms, edge cases, and how they relate to each other...", subagent_type="Explore")
```

**Output**: `docs/architecture/position-calculator.md` with:
- Class relationship diagram
- Algorithm descriptions
- Usage examples
- Edge case handling

---

## Example 5: Complex Service Layer (15+ files)

**Command**: `/explain-complex-code src/services/`

**Step 2.1 - Initial Discovery**:
```python
mcp__serena__list_dir(relative_path="src/services/", recursive=True)
# Files found: 18 files across migration/, transformation/, change_detection/, position_mapping/
```

**Step 2.2 - Map Dependencies**:
```python
# Analyze top-level services
mcp__serena__find_symbol(name_path_pattern="*Service", relative_path="src/services/")
mcp__serena__find_referencing_symbols(...)
# Discovers: 4 main service categories with clear boundaries
```

**Step 2.3 - Decision**: 18 files → Group by service categories (4 layers)

**Step 3 - Subagent Launch** (parallel, all in ONE message):
```python
Task(prompt="Explore Migration Services (all files in migration/): For EACH file report: purpose, key classes, dependencies. Then synthesize: service orchestration, shared patterns, core workflows...", subagent_type="Explore")
Task(prompt="Explore Transformation Services (all files in transformation/): For EACH file report: purpose, key classes, dependencies. Then synthesize: transformation pipeline, shared patterns, algorithms...", subagent_type="Explore")
Task(prompt="Explore Change Detection Services (all files in change_detection/): For EACH file report: purpose, key classes, dependencies. Then synthesize: detection strategy, shared patterns, rule system...", subagent_type="Explore")
Task(prompt="Explore Position Mapping Services (all files in position_mapping/): For EACH file report: purpose, key classes, dependencies. Then synthesize: mapping algorithms, shared patterns, edge cases...", subagent_type="Explore")
```

**Output**: `docs/architecture/service-layer.md` with:
- Service layer architecture diagram
- Data flow between services
- Dependency injection patterns
- Core algorithms per service
- Integration patterns

---

## Pattern: Multi-Module Feature

For features spanning multiple files:
1. Create one subagent per logical block (not per file!)
2. Create overview diagram showing module relationships
3. Create detailed flow for main process
4. Document each core class separately

## Pattern: Algorithm Documentation

For complex algorithms:
1. Create high-level flow diagram
2. Document critical rules with violation examples
3. Show 2-3 live examples (simple → complex)
4. Include edge cases and pitfalls

## Pattern: Service Layer Documentation

For service-oriented code:
1. Show layer architecture (CLI → Use Cases → Services → Data)
2. Document dependency injection pattern
3. Show data flow through layers
4. Include test strategy per layer
