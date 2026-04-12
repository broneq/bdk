#!/bin/bash
# Validates and compiles Graphviz diagrams when documentation is written

set -e

# Read JSON input from stdin
INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

# Only process docs/architecture/*.md files
if [[ "$FILE_PATH" != docs/architecture/*.md ]]; then
  exit 0
fi

# Check if file contains Graphviz diagrams
if ! grep -q '```dot\|```graphviz' "$FILE_PATH" 2>/dev/null; then
  exit 0
fi

# Get project root (4 levels up from .claude/commands/explain-complex-code/scripts/)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"

cd "$PROJECT_ROOT"

# Step 1: Validate syntax
echo "Validating Graphviz syntax..." >&2
if ! python3 "$SCRIPT_DIR/validate_graphviz.py" "$FILE_PATH"; then
  echo "❌ Graphviz validation failed. Fix syntax errors before proceeding." >&2
  exit 2
fi

# Step 2: Check if Graphviz is installed
if ! command -v dot &> /dev/null; then
  echo "{\"systemMessage\": \"⚠️  Graphviz diagrams validated but not compiled. Run: brew install graphviz\"}"
  exit 0
fi

# Step 3: Extract and compile diagrams
echo "Extracting and compiling diagrams..." >&2
if uv run python .claude/commands/graphviz-docs-compiler/scripts/compile_diagrams.py docs/ --mode both 2>&1 | tee /dev/stderr; then
  # Success - show summary
  DIAGRAM_COUNT=$(find docs/architecture -name "*.svg" 2>/dev/null | wc -l | tr -d ' ')
  echo "{\"systemMessage\": \"✓ Graphviz diagrams validated and compiled successfully ($DIAGRAM_COUNT SVG files generated)\"}"
  exit 0
else
  echo "❌ Diagram compilation failed. See errors above." >&2
  exit 2
fi
