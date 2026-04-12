#!/usr/bin/env python3
"""
Compile Graphviz diagrams to SVG and update markdown documentation.

This script supports three modes:
1. Forward mode (default): .dot files → SVG → update markdown
2. Reverse mode: markdown code blocks → .dot files → SVG → update markdown
3. Both mode: reverse + forward (extract from markdown, then compile all)

Usage:
    python compile_diagrams.py docs/                    # Forward mode
    python compile_diagrams.py docs/ --mode reverse     # Reverse mode
    python compile_diagrams.py docs/ --mode both        # Both modes
"""

import argparse
import re
import subprocess
import sys
from pathlib import Path


def find_dot_files(docs_root: Path) -> list[Path]:
    """Find all .dot files in diagrams/ subdirectories."""
    return list(docs_root.rglob("diagrams/*.dot"))


def find_markdown_files(docs_root: Path) -> list[Path]:
    """Find all markdown files in documentation root."""
    return list(docs_root.rglob("*.md"))


def extract_graphviz_blocks(md_file: Path) -> list[tuple[int, str, str]]:
    """
    Extract Graphviz code blocks from markdown file.

    Returns:
        List of (line_number, header_text, graphviz_code) tuples
    """
    content = md_file.read_text()
    lines = content.split("\n")
    blocks = []
    in_block = False
    current_block = []
    block_start = 0
    last_header = "diagram"

    for i, line in enumerate(lines, start=1):
        # Track headers before code blocks
        if line.startswith("#"):
            # Extract header text, removing markdown formatting
            last_header = re.sub(r"^#+\s*", "", line).strip()
        elif line.strip().startswith("```dot") or line.strip().startswith("```graphviz"):
            in_block = True
            block_start = i
            current_block = []
        elif line.strip() == "```" and in_block:
            in_block = False
            if current_block:
                blocks.append((block_start, last_header, "\n".join(current_block)))
        elif in_block:
            current_block.append(line)

    return blocks


def slugify(text: str) -> str:
    """
    Convert header text to filename-safe slug.

    Example: "Component Diagram" -> "component-diagram"
    """
    # Convert to lowercase
    text = text.lower()
    # Replace spaces and special chars with hyphens
    text = re.sub(r"[^\w\s-]", "", text)
    text = re.sub(r"[-\s]+", "-", text)
    # Remove leading/trailing hyphens
    return text.strip("-")


def extract_diagrams_from_markdown(
    md_file: Path, docs_root: Path, dry_run: bool = False
) -> list[Path]:
    """
    Extract Graphviz code blocks from markdown to .dot files.

    Returns:
        List of created .dot file paths
    """
    blocks = extract_graphviz_blocks(md_file)
    if not blocks:
        return []

    # Determine diagrams directory
    # For docs/architecture/file.md -> docs/architecture/file/diagrams/
    md_stem = md_file.stem
    diagrams_dir = md_file.parent / md_stem / "diagrams"

    created_files = []

    for _, (line_num, header, code) in enumerate(blocks, start=1):
        # Generate filename from header
        filename = f"{slugify(header)}.dot"

        # Handle duplicate names by appending number
        dot_file = diagrams_dir / filename
        counter = 2
        while dot_file in created_files:
            base_name = slugify(header)
            filename = f"{base_name}-{counter}.dot"
            dot_file = diagrams_dir / filename
            counter += 1

        created_files.append(dot_file)

        if dry_run:
            print(f"  Would extract: {md_file}:{line_num} -> {dot_file}")
            continue

        # Create directory and write file
        diagrams_dir.mkdir(parents=True, exist_ok=True)
        dot_file.write_text(code)

    return created_files


def compile_dot_to_svg(dot_file: Path, output_file: Path) -> bool:
    """
    Compile a .dot file to SVG using Graphviz.

    Returns:
        True if compilation succeeded, False otherwise
    """
    try:
        output_file.parent.mkdir(parents=True, exist_ok=True)
        subprocess.run(
            ["dot", "-Tsvg", str(dot_file), "-o", str(output_file)],
            capture_output=True,
            text=True,
            check=True,
        )
        return True
    except subprocess.CalledProcessError as e:
        print(f"Error compiling {dot_file}: {e.stderr}", file=sys.stderr)
        return False
    except FileNotFoundError:
        print(
            "Error: Graphviz 'dot' command not found. Install with: brew install graphviz",
            file=sys.stderr,
        )
        sys.exit(1)


def get_image_path(dot_file: Path, docs_root: Path) -> Path:
    """
    Get the corresponding image path for a .dot file.

    Converts: docs/xml_template_loader/diagrams/architektura.dot
    To:       docs/xml_template_loader/images/architektura.svg
    """
    relative = dot_file.relative_to(docs_root)
    parts = list(relative.parts)

    # Replace 'diagrams' with 'images'
    if "diagrams" in parts:
        idx = parts.index("diagrams")
        parts[idx] = "images"

    # Change extension to .svg
    parts[-1] = Path(parts[-1]).stem + ".svg"

    return docs_root / Path(*parts)


def find_markdown_file(dot_file: Path) -> Path | None:
    """
    Find the markdown file that should contain this diagram.

    For: docs/xml_template_loader/diagrams/architektura.dot
    Returns: docs/xml_template_loader.md
    """
    # Get the parent directory name (e.g., xml_template_loader)
    module_dir = dot_file.parent.parent
    md_file = module_dir.parent / f"{module_dir.name}.md"

    return md_file if md_file.exists() else None


def update_markdown(md_file: Path, dot_file: Path, svg_file: Path) -> bool:
    """
    Update markdown file to replace Graphviz code block with image + source link.

    Replaces:
        ```dot
        digraph { ... }
        ```

    With:
        ![Diagram Name](module/images/diagram.svg)

        Source: [`diagrams/diagram.dot`](module/diagrams/diagram.dot)
    """
    if not md_file.exists():
        return False

    content = md_file.read_text()

    # Read the dot file to find the exact code block
    dot_content = dot_file.read_text().strip()

    # Pattern to match the code block
    # Matches: ```dot\n<content>\n``` or ```graphviz\n<content>\n```
    pattern = rf"```(?:dot|graphviz)\s*\n{re.escape(dot_content)}\s*\n```"

    # Calculate relative paths from markdown file
    md_dir = md_file.parent
    svg_relative = svg_file.relative_to(md_dir)
    dot_relative = dot_file.relative_to(md_dir)

    # Create replacement text
    diagram_name = dot_file.stem.replace("_", " ").title()
    replacement = (
        f"![{diagram_name}]({svg_relative})\n\nSource: [`diagrams/{dot_file.name}`]({dot_relative})"
    )

    # Replace the code block
    new_content, count = re.subn(pattern, replacement, content, flags=re.MULTILINE | re.DOTALL)

    if count > 0:
        md_file.write_text(new_content)
        return True

    return False


def process_diagram(dot_file: Path, docs_root: Path, dry_run: bool = False) -> tuple[bool, str]:
    """
    Process a single diagram: compile and update markdown.

    Returns:
        (success, message) tuple
    """
    svg_file = get_image_path(dot_file, docs_root)
    md_file = find_markdown_file(dot_file)

    if dry_run:
        msg = f"Would compile: {dot_file} -> {svg_file}"
        if md_file:
            msg += f"\n  Update: {md_file}"
        return True, msg

    # Compile diagram
    if not compile_dot_to_svg(dot_file, svg_file):
        return False, f"Failed to compile {dot_file}"

    # Update markdown if file exists
    if md_file:
        if update_markdown(md_file, dot_file, svg_file):
            return True, f"Compiled {dot_file} -> {svg_file}\n  Updated {md_file}"
        else:
            return (
                True,
                f"Compiled {dot_file} -> {svg_file}\n  Warning: Could not find code block in {md_file}",
            )

    return True, f"Compiled {dot_file} -> {svg_file}"


def run_reverse_mode(
    docs_root: Path, dry_run: bool = False, verbose: bool = False
) -> tuple[int, int]:
    """
    Extract Graphviz code blocks from markdown files to .dot files.

    Returns:
        (extracted_count, failed_count) tuple
    """
    md_files = find_markdown_files(docs_root)
    if not md_files:
        print(f"No markdown files found in {docs_root}")
        return 0, 0

    print(f"Scanning {len(md_files)} markdown file(s) for Graphviz diagrams...\n")

    extracted_count = 0
    failed_count = 0

    for md_file in md_files:
        try:
            created_files = extract_diagrams_from_markdown(md_file, docs_root, dry_run)
            if created_files:
                extracted_count += len(created_files)
                if verbose or dry_run:
                    for dot_file in created_files:
                        print(f"✓ Extracted: {dot_file}")
        except Exception as e:
            failed_count += 1
            print(f"✗ Failed to extract from {md_file}: {e}", file=sys.stderr)

    return extracted_count, failed_count


def run_forward_mode(
    docs_root: Path, dry_run: bool = False, verbose: bool = False
) -> tuple[int, int]:
    """
    Compile .dot files to SVG and update markdown.

    Returns:
        (success_count, failure_count) tuple
    """
    dot_files = find_dot_files(docs_root)
    if not dot_files:
        print(f"No .dot files found in {docs_root}/**/diagrams/")
        return 0, 0

    print(f"Found {len(dot_files)} diagram(s) to compile\n")

    success_count = 0
    failure_count = 0

    for dot_file in dot_files:
        success, message = process_diagram(dot_file, docs_root, dry_run)

        if success:
            success_count += 1
            if verbose:
                print(f"✓ {message}")
        else:
            failure_count += 1
            print(f"✗ {message}", file=sys.stderr)

    return success_count, failure_count


def main():
    parser = argparse.ArgumentParser(
        description="Compile Graphviz diagrams and update markdown documentation"
    )
    parser.add_argument(
        "docs_root",
        type=Path,
        nargs="?",
        default=Path("docs"),
        help="Root directory for documentation (default: docs/)",
    )
    parser.add_argument(
        "--mode",
        choices=["forward", "reverse", "both"],
        default="forward",
        help="Operation mode: forward (.dot → SVG), reverse (markdown → .dot), both (reverse + forward)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be done without making changes",
    )
    parser.add_argument(
        "--verbose",
        "-v",
        action="store_true",
        help="Show detailed output",
    )

    args = parser.parse_args()

    if not args.docs_root.exists():
        print(f"Error: Documentation root '{args.docs_root}' does not exist", file=sys.stderr)
        sys.exit(1)

    total_failures = 0

    # Run based on mode
    if args.mode == "reverse":
        print("=== Reverse Mode: Extracting diagrams from markdown ===\n")
        extracted, failed = run_reverse_mode(args.docs_root, args.dry_run, args.verbose)
        print(f"\nExtraction Summary: {extracted} extracted, {failed} failed")
        total_failures = failed

    elif args.mode == "forward":
        print("=== Forward Mode: Compiling diagrams ===\n")
        success, failed = run_forward_mode(args.docs_root, args.dry_run, args.verbose)
        print(f"\nCompilation Summary: {success} succeeded, {failed} failed")
        total_failures = failed

    elif args.mode == "both":
        print("=== Both Mode: Extract + Compile ===\n")

        # Step 1: Reverse (extract)
        print("Step 1: Extracting diagrams from markdown...\n")
        extracted, extract_failed = run_reverse_mode(args.docs_root, args.dry_run, args.verbose)
        print(f"\nExtraction: {extracted} extracted, {extract_failed} failed\n")

        # Step 2: Forward (compile)
        print("Step 2: Compiling all diagrams...\n")
        success, compile_failed = run_forward_mode(args.docs_root, args.dry_run, args.verbose)
        print(f"\nCompilation: {success} succeeded, {compile_failed} failed\n")

        # Combined summary
        print("=" * 50)
        print(f"Total extracted: {extracted}")
        print(f"Total compiled: {success}")
        print(f"Total failures: {extract_failed + compile_failed}")
        total_failures = extract_failed + compile_failed

    if total_failures > 0:
        sys.exit(1)


if __name__ == "__main__":
    main()
