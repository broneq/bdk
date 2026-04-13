# Transcript Summary: create-plan skill execution

## Task
Implement a new document format detector that identifies document type from HTML structure and auto-selects the right parser. Register it in the existing parser selection mechanism.

## Phases Executed

### Phase 1: Parse & Setup
- Input validated (well-defined, > 10 words)
- Slug extracted: `document-format-detector`
- Plan file path set: `docs/plans/2026-03-27-document-format-detector.md`
- `docs/plans/` directory already existed
- No existing plan file found — proceeded without user confirmation
- No design docs found in `docs/designs/`

### Phase 2: Exploration
- Scope assessed as **Complex** (architectural change touching new subsystem: detectors + processors + container)
- **3 explorer agents dispatched** in parallel:
  - Agent 1 (Utilities & Existing Implementations): Found `FormatDetectorInterface`, `FroalaFormatDetector`, `FormatDetectorStrategy`, `TokenizerStrategy`, `SourceDocumentParser`, `DefaultContainer`. Checked `utility_classes` Serena memory. Discovered `DocumentFormatDetectionService` already exists but lacks SEA support. Found no `FormatParserResolver` or SEA detector anywhere.
  - Agent 2 (Architecture & Dependencies): Traced the full detection pipeline (`detectors/` → `services/detection/` → `use_cases/`), identified that `SourceDocumentParser` always requires explicit `parser_name` from callers. Confirmed `FormatDetectorStrategy.create_default()` only registers `FroalaFormatDetector`. Confirmed `TokenizerStrategy.create_default()` registers both `"froala"` and `"sea_contracts"`.
  - Agent 3 (Similar Features): Reviewed `FroalaFormatDetector` as the canonical example. Reviewed `DefaultContainer` lazy-init `_get_or_create` wiring pattern. Found `test_format_detector_strategy.py` as the test pattern to follow. Found `test_migrate_auto_detect.py` showing auto-detection in the API layer.

**Exploration summary:**
- Utilities: 6 found (FormatDetectorInterface, FroalaFormatDetector, FormatDetectorStrategy, TokenizerStrategy, SourceDocumentParser, DefaultContainer)
- Affected files: 8 found
- Similar features: 1 found (FroalaFormatDetector as exact reference)

### Phase 3: Design & Decisions
- 3 approaches designed:
  1. **SeaFormatDetector + FormatParserResolver** (selected) — LOW complexity, LOW risk, SRP/DIP compliant
  2. **Auto-detect inline in SourceDocumentParser** (rejected) — SRP violation, hard to test
  3. **FormatDetectorStrategy.resolve_parser_name()** (rejected) — cross-layer coupling violation
- Clear path identified: no user questions asked
- Selected approach: Approach 1

### Phase 4: Write Plan
- Template read from `references/plan-template.md`
- Plan written to `docs/plans/2026-03-27-document-format-detector.md`
- All tasks include: exact file paths, test cases with concrete inputs/outputs, test scaffolds, implementation code
- Verification section delegates to `test-runner` and `static-analyse` subagents with scoped paths

### Phase 5: Summary
Plan produced and ready for execution.

## Key Findings During Exploration

- `DocumentFormat` enum only has `FROALA_HTML` and `UNKNOWN` — `SEA_HTML` is missing and must be added
- `FormatDetectorStrategy.create_default()` only registers Froala — SEA detector missing
- `SourceDocumentParser` always requires explicit `parser_name` — no auto-detection path exists
- `FroalaFormatDetector` is the perfect reference: same base class, same `matches()` pattern, same module structure

## Approach Selected
**SeaFormatDetector + FormatParserResolver** — adds SEA format detection, a `FormatParserResolver` class mapping `DocumentFormat → parser_name`, and wires auto-detection into `SourceDocumentParser` when `parser_name="auto"`.

## Plan Statistics
- **Tasks created:** 6
- **Files to modify:** 6
- **Files to create:** 4 (SeaFormatDetector + __init__, FormatParserResolver, test files)
- **Test scaffolds included:** Yes — every task has a test scaffold with fixture type, variable names, and arrange/act/assert skeleton
- **TDD cycle enforced:** Yes — every task ends with `> Follow /test-driven-development skill for the red-green-clean cycle.`
