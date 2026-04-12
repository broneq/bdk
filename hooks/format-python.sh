#!/bin/bash

# Auto-format Python files after editing
FILE_PATH="$1"

# Check if it's a Python file
if [[ "$FILE_PATH" == *.py ]]; then
    echo "🔧 Formatting Python file: $FILE_PATH"

    # Format with ruff
    ruff format "$FILE_PATH" 2>/dev/null

    # Auto-fix linting issues
    ruff check --fix "$FILE_PATH" 2>/dev/null

    echo "✅ Formatted: $FILE_PATH"
fi

exit 0
