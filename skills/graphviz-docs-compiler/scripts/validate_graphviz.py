#!/usr/bin/env python3
"""Validate Graphviz syntax in markdown code blocks.

Usage:
    python validate_graphviz.py <markdown-file>

Exit codes:
    0 - All diagrams valid
    1 - Syntax errors found
"""

import subprocess
import sys
from pathlib import Path


def extract_graphviz_blocks(content: str) -> list[tuple[int, str]]:
    """Extract Graphviz code blocks from markdown.

    Returns:
        List of (line_number, graphviz_code) tuples
    """
    blocks = []
    lines = content.split("\n")
    in_block = False
    current_block = []
    block_start = 0

    for i, line in enumerate(lines, start=1):
        if line.strip().startswith("```dot") or line.strip().startswith("```graphviz"):
            in_block = True
            block_start = i
            current_block = []
        elif line.strip() == "```" and in_block:
            in_block = False
            if current_block:
                blocks.append((block_start, "\n".join(current_block)))
        elif in_block:
            current_block.append(line)

    return blocks


def validate_graphviz(code: str) -> tuple[bool, str]:
    """Validate Graphviz syntax using dot command.

    Returns:
        (is_valid, error_message)
    """
    try:
        # Try to compile the graph
        result = subprocess.run(
            ["dot", "-Tsvg", "-o", "/dev/null"],
            input=code.encode("utf-8"),
            capture_output=True,
            timeout=5,
        )

        if result.returncode == 0:
            return True, ""
        else:
            return False, result.stderr.decode("utf-8")

    except FileNotFoundError:
        # dot command not found, skip validation
        print("Warning: 'dot' command not found. Skipping Graphviz validation.")
        print("Install graphviz to enable validation: brew install graphviz")
        return True, ""

    except subprocess.TimeoutExpired:
        return False, "Validation timeout (complex diagram or infinite loop)"

    except Exception as e:
        return False, f"Validation error: {str(e)}"


def main():
    if len(sys.argv) != 2:
        print("Usage: python validate_graphviz.py <markdown-file>")
        sys.exit(1)

    file_path = Path(sys.argv[1])

    if not file_path.exists():
        print(f"Error: File not found: {file_path}")
        sys.exit(1)

    content = file_path.read_text()
    blocks = extract_graphviz_blocks(content)

    if not blocks:
        print("No Graphviz blocks found.")
        sys.exit(0)

    print(f"Found {len(blocks)} Graphviz block(s)")

    all_valid = True
    for line_num, code in blocks:
        is_valid, error = validate_graphviz(code)

        if is_valid:
            print(f"✓ Block at line {line_num}: Valid")
        else:
            print(f"✗ Block at line {line_num}: INVALID")
            print(f"  Error: {error}")
            all_valid = False

    if all_valid:
        print("\n✓ All Graphviz blocks are valid!")
        sys.exit(0)
    else:
        print("\n✗ Some Graphviz blocks have errors.")
        sys.exit(1)


if __name__ == "__main__":
    main()
