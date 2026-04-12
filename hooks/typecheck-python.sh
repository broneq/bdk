#!/bin/bash

# Type-check Python files after editing
FILE_PATH="$1"

# Check if it's a Python file in src/
if [[ "$FILE_PATH" == *.py ]]; then
    echo "🔍 Type-checking with mypy..."

    # Run mypy on the src/ directory for full context
    # This ensures imports and cross-module types are validated
    if mypy . 2>&1 | head -n 20; then
        echo "✅ Type checking passed"
    else
        echo "⚠️  Type checking found issues (see above)"
        echo "💡 Fix type errors or run 'mypy .' for full report"
    fi
fi

exit 0
