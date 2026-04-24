# Conditional Tool Injection — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend `inject.py` with `--prefer` and `--chain` modes, build a `fragments/tool-tiers/` library, refactor `STARTUP_INSTRUCTIONS.md`, migrate general skills to chain calls, and enrich agents with Serena tool instructions.

**Architecture:** `inject.py` gains two orthogonal extensions (`--prefer` suppression flag, `--chain` JSON-driven dispatch) that compose with the existing `--if` logic. Fragment leaf files teach one tool tier each; chain JSON configs wire them into exclusive or additive sequences. Skills call `inject.py --chain` instead of hardcoded tool references; agents get additive Serena subsections.

**Tech Stack:** Python 3, pytest, Markdown, JSON

---

## File Map

**Create:**
- `fragments/tool-tiers/search-graph.md`
- `fragments/tool-tiers/search-serena.md`
- `fragments/tool-tiers/search-fallback.md`
- `fragments/tool-tiers/search.chain.json`
- `fragments/tool-tiers/edit-graph.md`
- `fragments/tool-tiers/edit-serena.md`
- `fragments/tool-tiers/edit.chain.json`
- `fragments/tool-tiers/impact-graph.md`
- `fragments/tool-tiers/impact-fallback.md`
- `fragments/tool-tiers/impact.chain.json`
- `fragments/tool-tiers/review-graph.md`
- `fragments/tool-tiers/review-fallback.md`
- `fragments/tool-tiers/review.chain.json`
- `fragments/tool-tiers/explore-graph.md`
- `fragments/tool-tiers/explore-serena.md`
- `fragments/tool-tiers/explore.chain.json`
- `.claude/rules/fragment-system.md`

**Modify:**
- `scripts/inject.py` — add `--prefer` flag, `--chain` mode, `inject_chain()` function
- `tests/unit/scripts/test_inject.py` — add tests for both new modes
- `STARTUP_INSTRUCTIONS.md` — replace hardcoded tier text with `--chain` calls
- `skills/debug/SKILL.md` — Phase 2 investigation steps
- `skills/create-plan/SKILL.md` — Phase 2 exploration steps
- `skills/cr/SKILL.md` — Step 1 scope steps
- `skills/refactor/SKILL.md` — workflow architecture survey
- `skills/test-driven-development/SKILL.md` — GATE 0 graph references
- `skills/explain-complex-code/SKILL.md` — Step 2 graph references
- `agents/explorer.md` — add Serena subsection
- `agents/code-reviewer.md` — add Serena subsection
- `agents/architecture-reviewer.md` — add Serena subsection
- `agents/dead-code-detector.md` — add Serena subsection
- `agents/duplicate-detector.md` — add Serena subsection
- `agents/step-simulator.md` — add Serena subsection
- `agents/log-analyzer.md` — add Serena subsection
- `CONTRIBUTING.md` — add "Writing Fragments" section

---

## Task 1: `inject.py` — `--prefer` flag (module API + CLI)

**Files:**
- Modify: `scripts/inject.py`
- Test: `tests/unit/scripts/test_inject.py`

- [ ] **Step 1: Write the failing tests for `--prefer` module API**

Add to `tests/unit/scripts/test_inject.py`:

```python
# ---------------------------------------------------------------------------
# inject with prefer_conditions
# ---------------------------------------------------------------------------

def test_inject_prefer_suppresses_when_preferred_true(tmp_path):
    """Block is suppressed when any prefer condition is true."""
    settings = {"features": {"code-review-graph": True, "serena": True}}
    content_file = tmp_path / "serena.md"
    content_file.write_text("# Serena search")
    result = inject(
        conditions=["features.serena"],
        prefer_conditions=["features.code-review-graph"],
        then_path=content_file,
        settings=settings,
    )
    assert result == ""


def test_inject_prefer_passes_when_preferred_false(tmp_path):
    """Block is injected when prefer condition is false."""
    settings = {"features": {"code-review-graph": False, "serena": True}}
    content_file = tmp_path / "serena.md"
    content_file.write_text("# Serena search")
    result = inject(
        conditions=["features.serena"],
        prefer_conditions=["features.code-review-graph"],
        then_path=content_file,
        settings=settings,
    )
    assert result == "# Serena search"


def test_inject_prefer_or_semantics_any_true_suppresses(tmp_path):
    """Multiple --prefer flags use OR — any one true suppresses."""
    settings = {"features": {"code-review-graph": False, "serena": True}}
    content_file = tmp_path / "fallback.md"
    content_file.write_text("# Fallback")
    result = inject(
        conditions=[],
        prefer_conditions=["features.code-review-graph", "features.serena"],
        then_path=content_file,
        settings=settings,
    )
    assert result == ""


def test_inject_prefer_empty_list_no_suppression(tmp_path):
    """Empty prefer_conditions list means no suppression."""
    settings = {"features": {"react": True}}
    content_file = tmp_path / "react.md"
    content_file.write_text("# React")
    result = inject(
        conditions=["features.react"],
        prefer_conditions=[],
        then_path=content_file,
        settings=settings,
    )
    assert result == "# React"


def test_inject_prefer_missing_settings_returns_empty(tmp_path):
    """Missing settings still returns empty regardless of prefer."""
    content_file = tmp_path / "file.md"
    content_file.write_text("content")
    result = inject(
        conditions=[],
        prefer_conditions=["features.code-review-graph"],
        then_path=content_file,
        settings=None,
    )
    assert result == ""
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pytest tests/unit/scripts/test_inject.py -k "prefer" -v
```

Expected: FAIL — `inject()` does not accept `prefer_conditions` parameter.

- [ ] **Step 3: Implement `--prefer` in `inject()` module API**

Add `prefer_conditions: list[str] = None` parameter to `inject()`. Logic: after all `--if` conditions pass, evaluate each prefer condition; if any is true, return `""`.

In `scripts/inject.py`, change the `inject` function signature and body:

```python
def inject(
    conditions: list[str],
    prefer_conditions: list[str] | None = None,
    then_path: str | Path | None = None,
    then_text: str | None = None,
    settings: dict | None = None,
) -> str:
    """Evaluate all conditions and return content string or empty string.

    prefer_conditions: list of conditions using OR logic — if any is true,
    suppress this block (used to defer to a higher-tier tool).
    Returns empty string when any condition is false, any prefer is true,
    or settings is None.
    """
    if settings is None:
        return ""

    for condition in conditions:
        if not evaluate_condition(condition, settings):
            return ""

    for prefer in (prefer_conditions or []):
        if evaluate_condition(prefer, settings):
            return ""

    if then_text is not None:
        return then_text

    if then_path is not None:
        path = Path(then_path)
        if not path.exists():
            raise FileNotFoundError(f"inject: file not found: {then_path}")
        return path.read_text(encoding="utf-8")

    return ""
```

- [ ] **Step 4: Add CLI `--prefer` argument to `main()`**

In `scripts/inject.py`, inside `main()`, add after the existing `--if` argument:

```python
parser.add_argument(
    "--prefer",
    dest="prefer_conditions",
    action="append",
    default=[],
    metavar="CONDITION",
    help="Suppress block if any of these conditions are true (repeatable, OR logic)",
)
```

And update the `inject()` call in `main()`:

```python
result = inject(
    conditions=args.conditions,
    prefer_conditions=args.prefer_conditions,
    then_path=args.then_path,
    then_text=args.then_text,
    settings=settings,
)
```

- [ ] **Step 5: Write failing CLI tests for `--prefer`**

Add to `tests/unit/scripts/test_inject.py`:

```python
def test_cli_prefer_suppresses_when_preferred_true(tmp_path):
    _write_settings(tmp_path, {"features": {"code-review-graph": True, "serena": True}})
    content_file = tmp_path / "serena.md"
    content_file.write_text("# Serena")
    result = _run_cli(
        ["--if", "features.serena", "--prefer", "features.code-review-graph",
         "--then", str(content_file)],
        cwd=tmp_path,
    )
    assert result.returncode == 0
    assert result.stdout == ""


def test_cli_prefer_injects_when_preferred_false(tmp_path):
    _write_settings(tmp_path, {"features": {"code-review-graph": False, "serena": True}})
    content_file = tmp_path / "serena.md"
    content_file.write_text("# Serena")
    result = _run_cli(
        ["--if", "features.serena", "--prefer", "features.code-review-graph",
         "--then", str(content_file)],
        cwd=tmp_path,
    )
    assert result.returncode == 0
    assert result.stdout == "# Serena"


def test_cli_prefer_multiple_or_semantics(tmp_path):
    _write_settings(tmp_path, {"features": {"code-review-graph": False, "serena": True}})
    content_file = tmp_path / "fallback.md"
    content_file.write_text("# Fallback")
    result = _run_cli(
        ["--prefer", "features.code-review-graph", "--prefer", "features.serena",
         "--then", str(content_file)],
        cwd=tmp_path,
    )
    assert result.returncode == 0
    assert result.stdout == ""
```

Note: `--if` is now optional when `--prefer` is used alone. The `required=True` on `--if` needs adjustment — change to `required=False, default=[]`.

- [ ] **Step 6: Fix `--if` required constraint**

In `main()`, change:
```python
parser.add_argument(
    "--if",
    dest="conditions",
    action="append",
    required=False,
    default=[],
    metavar="CONDITION",
    help="Condition to evaluate (repeatable, AND logic)",
)
```

Also update the `--then`/`--then-text` group: make it `required=False` and add validation after parsing:

```python
args = parser.parse_args()

if not args.conditions and not args.prefer_conditions and args.then_path is None and args.then_text is None:
    parser.error("At least one of --if, --prefer, --then, or --then-text required")

# Require output target
if args.then_path is None and args.then_text is None:
    parser.error("one of the arguments --then --then-text is required")
```

Remove `required=True` from the mutually exclusive group and handle manually.

- [ ] **Step 7: Run all inject tests**

```bash
pytest tests/unit/scripts/test_inject.py -v
```

Expected: ALL PASS

- [ ] **Step 8: Commit**

```bash
git add scripts/inject.py tests/unit/scripts/test_inject.py
git commit -m "feat(inject): add --prefer flag with OR suppression semantics"
```

---

## Task 2: `inject.py` — `--chain` mode

**Files:**
- Modify: `scripts/inject.py`
- Test: `tests/unit/scripts/test_inject.py`

- [ ] **Step 1: Write failing tests for `inject_chain()` module API**

Add to `tests/unit/scripts/test_inject.py`:

```python
import json

inject_chain = inject_mod.inject_chain


def _write_chain(path: Path, data: dict) -> Path:
    path.write_text(json.dumps(data))
    return path


# ---------------------------------------------------------------------------
# inject_chain — exclusive mode
# ---------------------------------------------------------------------------

def test_chain_exclusive_first_match_returned(tmp_path):
    """Exclusive mode returns content from first matching block only."""
    settings = {"features": {"code-review-graph": True, "serena": True}}

    graph_file = tmp_path / "search-graph.md"
    graph_file.write_text("# Graph search")
    serena_file = tmp_path / "search-serena.md"
    serena_file.write_text("# Serena search")

    chain_file = _write_chain(tmp_path / "search.chain.json", {
        "mode": "exclusive",
        "chain": [
            {"if": ["features.code-review-graph"], "then": str(graph_file)},
            {"if": ["features.serena"], "then": str(serena_file)},
        ]
    })
    result = inject_chain(chain_file, settings)
    assert result == "# Graph search"


def test_chain_exclusive_skips_to_second_when_first_fails(tmp_path):
    """Exclusive mode skips to next block when first condition fails."""
    settings = {"features": {"code-review-graph": False, "serena": True}}

    graph_file = tmp_path / "search-graph.md"
    graph_file.write_text("# Graph search")
    serena_file = tmp_path / "search-serena.md"
    serena_file.write_text("# Serena search")

    chain_file = _write_chain(tmp_path / "search.chain.json", {
        "mode": "exclusive",
        "chain": [
            {"if": ["features.code-review-graph"], "then": str(graph_file)},
            {"if": ["features.serena"], "then": str(serena_file)},
        ]
    })
    result = inject_chain(chain_file, settings)
    assert result == "# Serena search"


def test_chain_exclusive_unconditional_fallback(tmp_path):
    """Block with no 'if' is an unconditional fallback."""
    settings = {"features": {"code-review-graph": False, "serena": False}}

    fallback_file = tmp_path / "fallback.md"
    fallback_file.write_text("# Fallback")

    chain_file = _write_chain(tmp_path / "search.chain.json", {
        "mode": "exclusive",
        "chain": [
            {"if": ["features.code-review-graph"], "then": str(tmp_path / "graph.md")},
            {"then": str(fallback_file)},
        ]
    })
    result = inject_chain(chain_file, settings)
    assert result == "# Fallback"


def test_chain_exclusive_no_match_returns_empty(tmp_path):
    """Exclusive mode returns empty string when no block matches."""
    settings = {"features": {"code-review-graph": False}}
    graph_file = tmp_path / "graph.md"
    graph_file.write_text("content")

    chain_file = _write_chain(tmp_path / "search.chain.json", {
        "mode": "exclusive",
        "chain": [
            {"if": ["features.code-review-graph"], "then": str(graph_file)},
        ]
    })
    result = inject_chain(chain_file, settings)
    assert result == ""


# ---------------------------------------------------------------------------
# inject_chain — additive mode
# ---------------------------------------------------------------------------

def test_chain_additive_concatenates_all_matching(tmp_path):
    """Additive mode concatenates content from all matching blocks."""
    settings = {"features": {"code-review-graph": True, "serena": True}}

    graph_file = tmp_path / "edit-graph.md"
    graph_file.write_text("# Graph edit")
    serena_file = tmp_path / "edit-serena.md"
    serena_file.write_text("# Serena edit")

    chain_file = _write_chain(tmp_path / "edit.chain.json", {
        "mode": "additive",
        "chain": [
            {"if": ["features.code-review-graph"], "then": str(graph_file)},
            {"if": ["features.serena"], "then": str(serena_file)},
        ]
    })
    result = inject_chain(chain_file, settings)
    assert "# Graph edit" in result
    assert "# Serena edit" in result


def test_chain_additive_only_matching_blocks(tmp_path):
    """Additive mode skips blocks whose conditions are false."""
    settings = {"features": {"code-review-graph": True, "serena": False}}

    graph_file = tmp_path / "edit-graph.md"
    graph_file.write_text("# Graph edit")
    serena_file = tmp_path / "edit-serena.md"
    serena_file.write_text("# Serena edit")

    chain_file = _write_chain(tmp_path / "edit.chain.json", {
        "mode": "additive",
        "chain": [
            {"if": ["features.code-review-graph"], "then": str(graph_file)},
            {"if": ["features.serena"], "then": str(serena_file)},
        ]
    })
    result = inject_chain(chain_file, settings)
    assert "# Graph edit" in result
    assert "# Serena edit" not in result


# ---------------------------------------------------------------------------
# inject_chain — path resolution
# ---------------------------------------------------------------------------

def test_chain_resolves_paths_relative_to_chain_file(tmp_path):
    """Paths in chain files resolve relative to chain file directory."""
    settings = {"features": {"code-review-graph": True}}

    subdir = tmp_path / "tool-tiers"
    subdir.mkdir()
    graph_file = subdir / "search-graph.md"
    graph_file.write_text("# Graph content")

    chain_file = _write_chain(subdir / "search.chain.json", {
        "mode": "exclusive",
        "chain": [
            {"if": ["features.code-review-graph"], "then": "search-graph.md"},
        ]
    })
    result = inject_chain(chain_file, settings)
    assert result == "# Graph content"


# ---------------------------------------------------------------------------
# inject_chain — CLI
# ---------------------------------------------------------------------------

def test_cli_chain_exclusive_first_match(tmp_path):
    settings = {"features": {"code-review-graph": True}}
    _write_settings(tmp_path, settings["features"] if False else {"features": {"code-review-graph": True}})

    graph_file = tmp_path / "graph.md"
    graph_file.write_text("# Graph")
    chain_file = _write_chain(tmp_path / "search.chain.json", {
        "mode": "exclusive",
        "chain": [{"if": ["features.code-review-graph"], "then": str(graph_file)}],
    })

    result = _run_cli(["--chain", str(chain_file)], cwd=tmp_path)
    assert result.returncode == 0
    assert result.stdout == "# Graph"


def test_cli_chain_missing_file_exits_nonzero(tmp_path):
    result = _run_cli(["--chain", str(tmp_path / "nonexistent.json")], cwd=tmp_path)
    assert result.returncode == 1
    assert "[BDK inject]" in result.stderr
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pytest tests/unit/scripts/test_inject.py -k "chain" -v
```

Expected: FAIL — `inject_chain` not defined, `--chain` not recognised.

- [ ] **Step 3: Implement `inject_chain()` in `scripts/inject.py`**

Add after the existing `inject()` function:

```python
def inject_chain(
    chain_path: str | Path,
    settings: dict | None = None,
) -> str:
    """Resolve a chain config file and return assembled content.

    Chain file format:
        {"mode": "exclusive"|"additive", "chain": [...]}

    Each chain entry:
        {"if": ["condition", ...], "then": "relative/path.md"}
        {"then": "path.md"}  # unconditional fallback

    Paths in chain entries are resolved relative to chain_path's directory.
    Returns empty string when settings is None.
    Raises FileNotFoundError if chain_path does not exist.
    Raises ValueError for unrecognised mode or missing 'then'.
    """
    chain_path = Path(chain_path)
    if not chain_path.exists():
        raise FileNotFoundError(f"inject: chain file not found: {chain_path}")

    try:
        config = json.loads(chain_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        raise ValueError(f"inject: invalid JSON in chain file {chain_path}: {e}") from e

    mode = config.get("mode")
    if mode not in ("exclusive", "additive"):
        raise ValueError(f"inject: unknown chain mode {mode!r} in {chain_path}")

    chain = config.get("chain", [])
    base = chain_path.parent
    parts: list[str] = []

    for entry in chain:
        conditions = entry.get("if", [])
        then_rel = entry.get("then")
        if then_rel is None:
            raise ValueError(f"inject: chain entry missing 'then' key in {chain_path}")

        then_path = base / then_rel if not Path(then_rel).is_absolute() else Path(then_rel)
        content = inject(conditions=conditions, then_path=then_path, settings=settings)

        if content:
            if mode == "exclusive":
                return content
            parts.append(content)

    return "\n".join(parts) if parts else ""
```

- [ ] **Step 4: Add `--chain` CLI argument to `main()`**

In `main()`, add `--chain` as an alternative to `--if`/`--then`:

```python
parser.add_argument(
    "--chain",
    dest="chain_path",
    metavar="CHAIN_FILE",
    help="JSON chain config file for multi-tier injection",
)
```

Update the argument validation and dispatch in `main()`:

```python
args = parser.parse_args()

# Chain mode — mutually exclusive with --if/--then/--then-text
if args.chain_path:
    settings = (
        load_settings(args.settings_path) if args.settings_path else load_settings()
    )
    if settings is None:
        sys.exit(0)
    try:
        result = inject_chain(chain_path=args.chain_path, settings=settings)
    except (FileNotFoundError, ValueError) as e:
        print(f"[BDK inject] {e}", file=sys.stderr)
        sys.exit(1)
    if result:
        print(result, end="")
    sys.exit(0)

# Standard --if/--then mode
if not args.conditions and not args.prefer_conditions:
    parser.error("one of --if, --prefer, or --chain is required")
if args.then_path is None and args.then_text is None:
    parser.error("one of the arguments --then --then-text is required")

settings = (
    load_settings(args.settings_path) if args.settings_path else load_settings()
)
if settings is None:
    sys.exit(0)

try:
    result = inject(
        conditions=args.conditions,
        prefer_conditions=args.prefer_conditions,
        then_path=args.then_path,
        then_text=args.then_text,
        settings=settings,
    )
except (ValueError, FileNotFoundError) as e:
    print(f"[BDK inject] {e}", file=sys.stderr)
    sys.exit(1)

if result:
    print(result, end="")
sys.exit(0)
```

- [ ] **Step 5: Run all inject tests**

```bash
pytest tests/unit/scripts/test_inject.py -v
```

Expected: ALL PASS

- [ ] **Step 6: Commit**

```bash
git add scripts/inject.py tests/unit/scripts/test_inject.py
git commit -m "feat(inject): add --chain mode with exclusive and additive dispatch"
```

---

## Task 3: Fragment leaf files — `fragments/tool-tiers/`

**Files:**
- Create: all 10 leaf `.md` files listed below

- [ ] **Step 1: Create `fragments/tool-tiers/search-graph.md`**

```bash
mkdir -p fragments/tool-tiers
```

Content for `fragments/tool-tiers/search-graph.md`:

```markdown
**Search (code-review-graph — Tier 1):**
- `semantic_search_nodes(query=<symbol or keyword>)` — locate functions/classes by name or intent without file browsing
- `query_graph(pattern="callers_of", target=<symbol>)` — trace all callers up the call chain
- `query_graph(pattern="callees_of", target=<symbol>)` — trace all callees down to dependencies
- `query_graph(pattern="tests_for", target=<symbol>)` — find existing tests for a symbol

Prefer graph search over Grep/Read — cheaper and gives structural context.
```

- [ ] **Step 2: Create `fragments/tool-tiers/search-serena.md`**

Content for `fragments/tool-tiers/search-serena.md`:

```markdown
**Search (Serena — Tier 2):**
- `find_symbol(name_path=<Name/method>, relative_path=<file>)` — locate a named symbol by structural path; use `substring_matching=true` when name is approximate
- `search_for_pattern(pattern=<regex>, relative_path=<dir>)` — flexible regex/text search across files
- `find_referencing_symbols(name_path=<symbol>, relative_path=<file>)` — trace all usages of a symbol across the codebase
- `get_symbols_overview(relative_path=<file>)` — scan a file's full symbol map without reading bodies

Use when code-review-graph is unavailable or returns no results.
```

- [ ] **Step 3: Create `fragments/tool-tiers/search-fallback.md`**

Content for `fragments/tool-tiers/search-fallback.md`:

```markdown
**Search (Grep/Glob/Read — Tier 3):**
- `Grep(pattern=<regex>, path=<dir>)` — text search across files
- `Glob(pattern=<glob>)` — find files by name pattern
- `Read(file_path=<path>)` — read a specific file

Use only when both code-review-graph and Serena are unavailable.
```

- [ ] **Step 4: Create `fragments/tool-tiers/edit-graph.md`**

Content for `fragments/tool-tiers/edit-graph.md`:

```markdown
**Before editing (code-review-graph — Tier 1):**
- `get_impact_radius(node=<symbol or file>)` — understand what breaks if this symbol changes
- `get_affected_flows(target=<symbol>)` — identify execution paths impacted by the change
- `query_graph(pattern="callers_of", target=<symbol>)` — find all callers that must be updated

Run impact analysis BEFORE making edits to avoid missing call sites.
```

- [ ] **Step 5: Create `fragments/tool-tiers/edit-serena.md`**

Content for `fragments/tool-tiers/edit-serena.md`:

```markdown
**Structural editing (Serena — Tier 2):**
- `replace_symbol_body(name_path=<symbol>, relative_path=<file>, new_body=<code>)` — replace an entire function or class body atomically
- `insert_before_symbol(name_path=<symbol>, relative_path=<file>, new_content=<code>)` — inject code immediately before a symbol's definition
- `insert_after_symbol(name_path=<symbol>, relative_path=<file>, new_content=<code>)` — inject code immediately after a symbol's definition
- `rename_symbol(name_path=<symbol>, relative_path=<file>, new_name=<name>)` — safe rename with automatic reference updates across the codebase
- `safe_delete_symbol(name_path=<symbol>, relative_path=<file>)` — delete a symbol only if it has zero references

Prefer these structural tools over Edit/Write for function-level changes — safer and reference-aware.
```

- [ ] **Step 6: Create `fragments/tool-tiers/impact-graph.md`**

Content for `fragments/tool-tiers/impact-graph.md`:

```markdown
**Impact analysis (code-review-graph — Tier 1):**
- `get_impact_radius(node=<symbol or file>)` — full blast radius: what modules and symbols are affected
- `get_affected_flows(target=<symbol>)` — which named execution flows pass through the changed symbol
- `get_bridge_nodes_tool` — architectural choke points that amplify impact if changed

Use before any change with risk ≥ MEDIUM. Report impact to user before proceeding.
```

- [ ] **Step 7: Create `fragments/tool-tiers/impact-fallback.md`**

Content for `fragments/tool-tiers/impact-fallback.md`:

```markdown
**Impact analysis (Grep/Read — Tier 3):**
- `Grep(pattern=<symbol name>, path=<src dir>)` — find all source references manually
- Cross-check test files separately: `Grep(pattern=<symbol name>, path=<test dir>)`

Manual reference counting is error-prone. Verify thoroughly and flag any uncertainty to the user.
```

- [ ] **Step 8: Create `fragments/tool-tiers/review-graph.md`**

Content for `fragments/tool-tiers/review-graph.md`:

```markdown
**Code review scope (code-review-graph — Tier 1):**
1. `detect_changes(detail_level="minimal")` — risk-scored changed file list
2. `get_bridge_nodes_tool` — identify architectural choke points among changed files
3. `get_affected_flows` — execution paths impacted by the change set
4. `get_review_context(node=<symbol>)` — token-efficient source snippets for high-risk symbols

Start every review with `detect_changes`. Prioritise CRITICAL and HIGH risk symbols.
```

- [ ] **Step 9: Create `fragments/tool-tiers/review-fallback.md`**

Content for `fragments/tool-tiers/review-fallback.md`:

```markdown
**Code review scope (Grep/Read — Tier 3):**
- `git diff --name-only HEAD~1` — list changed files
- `git diff --stat HEAD~1` — change size per file
- Read changed files in full; manually trace callers via Grep

Without graph risk scoring, review all changed files with equal thoroughness.
```

- [ ] **Step 10: Create `fragments/tool-tiers/explore-graph.md`**

Content for `fragments/tool-tiers/explore-graph.md`:

```markdown
**Codebase exploration (code-review-graph — Tier 1):**
- `get_architecture_overview(detail_level="minimal")` — community map and cross-community coupling
- `list_communities` — module groupings and their members
- `semantic_search_nodes(query=<keyword>)` — find relevant symbols without manual browsing
- `get_hub_nodes_tool` — high-dependency symbols (understand these first)
- `get_surprising_connections_tool` — unexpected cross-module dependencies

Start exploration with `get_architecture_overview` to orient before reading any files.
```

- [ ] **Step 11: Create `fragments/tool-tiers/explore-serena.md`**

Content for `fragments/tool-tiers/explore-serena.md`:

```markdown
**Deep symbol exploration (Serena — Tier 2):**
- `get_symbols_overview(relative_path=<file>)` — full symbol map of a file without reading bodies
- `find_symbol(name_path=<symbol>, relative_path=<file>, include_body=true)` — read a specific symbol's body
- `find_symbol(name_path=<partial>, substring_matching=true)` — broad discovery when exact name unknown
- `find_referencing_symbols(name_path=<symbol>, relative_path=<file>)` — who uses this symbol

Use after graph overview to drill into specific files or symbols needing deeper analysis.
```

- [ ] **Step 12: Verify all fragment files exist and have content**

```bash
ls -la fragments/tool-tiers/
```

Expected: 10 `.md` files, each non-empty.

- [ ] **Step 13: Commit**

```bash
git add fragments/tool-tiers/*.md
git commit -m "feat(fragments): add tool-tier leaf content files for search, edit, impact, review, explore"
```

---

## Task 4: Chain config files — `fragments/tool-tiers/`

**Files:**
- Create: 5 `.chain.json` files in `fragments/tool-tiers/`

- [ ] **Step 1: Create `fragments/tool-tiers/search.chain.json`**

```json
{
  "mode": "exclusive",
  "chain": [
    { "if": ["features.code-review-graph"], "then": "search-graph.md" },
    { "if": ["features.serena"], "then": "search-serena.md" },
    { "then": "search-fallback.md" }
  ]
}
```

- [ ] **Step 2: Create `fragments/tool-tiers/edit.chain.json`**

```json
{
  "mode": "additive",
  "chain": [
    { "if": ["features.code-review-graph"], "then": "edit-graph.md" },
    { "if": ["features.serena"], "then": "edit-serena.md" }
  ]
}
```

- [ ] **Step 3: Create `fragments/tool-tiers/impact.chain.json`**

```json
{
  "mode": "exclusive",
  "chain": [
    { "if": ["features.code-review-graph"], "then": "impact-graph.md" },
    { "then": "impact-fallback.md" }
  ]
}
```

- [ ] **Step 4: Create `fragments/tool-tiers/review.chain.json`**

```json
{
  "mode": "exclusive",
  "chain": [
    { "if": ["features.code-review-graph"], "then": "review-graph.md" },
    { "then": "review-fallback.md" }
  ]
}
```

- [ ] **Step 5: Create `fragments/tool-tiers/explore.chain.json`**

```json
{
  "mode": "additive",
  "chain": [
    { "if": ["features.code-review-graph"], "then": "explore-graph.md" },
    { "if": ["features.serena"], "then": "explore-serena.md" }
  ]
}
```

- [ ] **Step 6: Run chain integration test (manual)**

Create a temp settings file and verify chain resolves correctly:

```bash
mkdir -p /tmp/bdk-chain-test/.bdk
echo '{"features":{"code-review-graph":true,"serena":true}}' > /tmp/bdk-chain-test/.bdk/settings.json
python3 scripts/inject.py --chain fragments/tool-tiers/search.chain.json --settings /tmp/bdk-chain-test/.bdk/settings.json
```

Expected: prints content of `search-graph.md` (exclusive — codegraph wins).

```bash
echo '{"features":{"code-review-graph":false,"serena":true}}' > /tmp/bdk-chain-test/.bdk/settings.json
python3 scripts/inject.py --chain fragments/tool-tiers/edit.chain.json --settings /tmp/bdk-chain-test/.bdk/settings.json
```

Expected: prints content of `edit-serena.md` only (additive — only serena matched).

- [ ] **Step 7: Commit**

```bash
git add fragments/tool-tiers/*.chain.json
git commit -m "feat(fragments): add chain config files for search, edit, impact, review, explore"
```

---

## Task 5: `STARTUP_INSTRUCTIONS.md` refactor

**Files:**
- Modify: `STARTUP_INSTRUCTIONS.md`

- [ ] **Step 1: Read current file**

Read `STARTUP_INSTRUCTIONS.md` fully before editing — the current content:

```markdown
# BDK Shared Foundation
...
## MCP Tool Preference (Tier System)

- **Tier 1:** code-review-graph — structural graph, impact analysis, code review context
- **Tier 2:** Serena — AST-level analysis, referencing symbols, structural analysis
- **Tier 3:** Grep/Glob/Read — always available, used when MCP tools are unavailable

If a Tier 1 or Tier 2 tool is not available, fall back to the next tier silently.

## When to Use code-review-graph (Tier 1)

Use `mcp__code-review-graph__*` tools BEFORE Grep/Glob/Read for:
...
Fall back to Serena or Grep only when graph returns no results or tool unavailable.
```

- [ ] **Step 2: Replace the static tier section with chain inject calls**

Replace the entire "MCP Tool Preference" and "When to Use" sections with:

```markdown
## Tool Tier System

When exploring, searching, editing, or reviewing code, use the best available tool tier. The instructions below are injected based on your project's enabled features.

**Exploration & Architecture:**

!`python3 ${CLAUDE_PLUGIN_ROOT}/scripts/inject.py --chain ${CLAUDE_PLUGIN_ROOT}/fragments/tool-tiers/explore.chain.json`

**Symbol Search & Tracing:**

!`python3 ${CLAUDE_PLUGIN_ROOT}/scripts/inject.py --chain ${CLAUDE_PLUGIN_ROOT}/fragments/tool-tiers/search.chain.json`

**Impact Analysis:**

!`python3 ${CLAUDE_PLUGIN_ROOT}/scripts/inject.py --chain ${CLAUDE_PLUGIN_ROOT}/fragments/tool-tiers/impact.chain.json`
```

Keep all other sections in `STARTUP_INSTRUCTIONS.md` unchanged.

- [ ] **Step 3: Verify the file renders correctly (sanity check)**

```bash
python3 scripts/inject.py --chain fragments/tool-tiers/explore.chain.json --settings /tmp/bdk-chain-test/.bdk/settings.json
```

Expected: non-empty output if settings has `code-review-graph: true`.

- [ ] **Step 4: Commit**

```bash
git add STARTUP_INSTRUCTIONS.md
git commit -m "refactor(startup): replace hardcoded tier text with chain inject calls"
```

---

## Task 6: Migrate general skills to `--chain` calls

**Files:**
- Modify: `skills/debug/SKILL.md`, `skills/create-plan/SKILL.md`, `skills/cr/SKILL.md`, `skills/refactor/SKILL.md`, `skills/test-driven-development/SKILL.md`, `skills/explain-complex-code/SKILL.md`

- [ ] **Step 1: Migrate `skills/debug/SKILL.md` Phase 2**

Find Phase 2 lines (currently lines 82–89 — the numbered list of graph tool calls):

```markdown
1. **Find entry point**: `semantic_search_nodes(query=<error component or symbol>)` — locate without manual file browsing
2. **Trace callers**: `query_graph(pattern="callers_of", node=<entry_point>)` — trace up the call chain
3. **Trace callees**: `query_graph(pattern="callees_of", node=<entry_point>)` — trace down to dependencies
4. **Identify impacted paths**: `get_affected_flows` — named execution paths through the suspected area
5. **Flag cascading risk**: `get_bridge_nodes_tool` on the affected module — highest-risk choke points
```

Replace lines 1–3 with a chain inject call, keeping lines 4–9 (affected_flows, bridge_nodes, root cause, blast radius, test gaps, summary) intact:

```markdown
Inject available search tools:

!`python3 ${CLAUDE_PLUGIN_ROOT}/scripts/inject.py --chain ${CLAUDE_PLUGIN_ROOT}/fragments/tool-tiers/search.chain.json`

Using the search tools above:
1. **Find entry point** — locate the error component or symbol
2. **Trace callers** — trace up the call chain
3. **Trace callees** — trace down to dependencies
4. **Identify impacted paths**: `get_affected_flows` — named execution paths through the suspected area
5. **Flag cascading risk**: `get_bridge_nodes_tool` on the affected module — highest-risk choke points
6. **Identify root cause**
7. **Quantify blast radius**:

!`python3 ${CLAUDE_PLUGIN_ROOT}/scripts/inject.py --chain ${CLAUDE_PLUGIN_ROOT}/fragments/tool-tiers/impact.chain.json`

8. **Scan for related test gaps** — same class of problem in nearby code only
9. **Print investigation summary**:
```

Also remove the graph-specific tool references from `allowed-tools` frontmatter — the chain fragments define contextually what tools are available:

```yaml
allowed-tools: AskUserQuestion TaskCreate TaskUpdate TaskList Bash(python3 ${CLAUDE_PLUGIN_ROOT}/scripts/*)
```

- [ ] **Step 2: Migrate `skills/create-plan/SKILL.md` Phase 2**

Current Phase 2 exploration code (lines 50–53):

```markdown
1. `get_architecture_overview(detail_level="minimal")` — understand which layers are affected
2. `list_flows_tool` — identify named execution flows the feature may touch
3. `get_surprising_connections_tool` — detect cross-module dependencies the plan must account for
```

Replace with:

```markdown
Run graph-first architecture snapshot:

!`python3 ${CLAUDE_PLUGIN_ROOT}/scripts/inject.py --chain ${CLAUDE_PLUGIN_ROOT}/fragments/tool-tiers/explore.chain.json`

Using the exploration tools above:
1. Understand which layers are affected
2. Identify named execution flows the feature may touch
3. Detect cross-module dependencies the plan must account for
```

Remove graph tool entries from `allowed-tools` frontmatter:

```yaml
allowed-tools: Bash(python3 ${CLAUDE_PLUGIN_ROOT}/scripts/)
```

- [ ] **Step 3: Migrate `skills/cr/SKILL.md` Step 1**

Current Step 1 uses `detect_changes` hardcoded. The skill already has an existing fragment inject at step 1. Replace the graph-hardcoded scope steps block with:

```markdown
!`python3 ${CLAUDE_PLUGIN_ROOT}/scripts/inject.py --chain ${CLAUDE_PLUGIN_ROOT}/fragments/tool-tiers/review.chain.json`
```

Keep the existing `fragments/code-review-graph/step1-scope.md` inject call if it adds non-overlapping content; otherwise remove and consolidate into `review-graph.md`.

Check: `review-graph.md` already covers `detect_changes` + `get_bridge_nodes_tool` + `get_affected_flows`. The existing `step1-scope.md` is redundant — remove the old inject call and use the chain instead.

Remove graph entries from `allowed-tools`:

```yaml
allowed-tools: Bash(git *)
```

- [ ] **Step 4: Migrate `skills/refactor/SKILL.md`**

Current workflow steps 1 (graph survey):

```markdown
1. Graph-first architecture survey:
   - `get_architecture_overview(detail_level="minimal")` — current community structure and layer boundaries
   - `list_communities` — identify tightly-coupled communities the refactor should clean up
   - `get_surprising_connections_tool` — cross-cutting concerns that violate layering
   - `refactor_tool(mode="dead_code")` — identify dead code to remove during refactor
```

Replace with:

```markdown
1. Architecture survey:

!`python3 ${CLAUDE_PLUGIN_ROOT}/scripts/inject.py --chain ${CLAUDE_PLUGIN_ROOT}/fragments/tool-tiers/explore.chain.json`

   Using the exploration tools above: understand current community structure, identify tightly-coupled communities, detect cross-cutting concerns, and identify dead code with `refactor_tool(mode="dead_code")` if graph is available.
```

Remove graph entries from `allowed-tools`.

- [ ] **Step 5: Migrate `skills/test-driven-development/SKILL.md` GATE 0**

Current GATE 0 (lines 74–78):

```markdown
Graph-assisted discovery (if graph available):
- `get_flow_tool(flow=<feature>)` — understand the execution path before writing tests
- `query_graph(pattern="tests_for", node=<target_symbol>)` — find existing tests to avoid duplication
- `get_impact_radius(node=<implementation_file>)` — understand blast radius to prioritize edge cases
```

Replace with:

```markdown
Tool-assisted discovery:

!`python3 ${CLAUDE_PLUGIN_ROOT}/scripts/inject.py --chain ${CLAUDE_PLUGIN_ROOT}/fragments/tool-tiers/search.chain.json`

Using the search tools above: find existing tests to avoid duplication, understand blast radius to prioritize edge cases.
```

Remove graph entries from `allowed-tools`.

- [ ] **Step 6: Migrate `skills/explain-complex-code/SKILL.md` Step 2.1**

Current Step 2.1:

```markdown
- `semantic_search_nodes(query=<path or module name>)` — find all symbols without file browsing
- `get_hub_nodes_tool` on the target directory — identify high-dependency symbols that need prominent documentation
- `list_communities` — use community grouping to determine subagent partitioning (prefer community boundaries over line-count rules)
- Fall back to Tier 1/2/3 tools per BDK foundation if graph unavailable
```

Replace with:

```markdown
!`python3 ${CLAUDE_PLUGIN_ROOT}/scripts/inject.py --chain ${CLAUDE_PLUGIN_ROOT}/fragments/tool-tiers/explore.chain.json`

Using the exploration tools above: find all symbols, identify high-dependency symbols, use community grouping to determine subagent partitioning where available.
```

Remove graph entries from `allowed-tools`.

- [ ] **Step 7: Commit all skill migrations**

```bash
git add skills/debug/SKILL.md skills/create-plan/SKILL.md skills/cr/SKILL.md \
        skills/refactor/SKILL.md skills/test-driven-development/SKILL.md \
        skills/explain-complex-code/SKILL.md
git commit -m "refactor(skills): migrate tool references to --chain inject calls"
```

---

## Task 7: Enrich agents with Serena tool instructions

**Files:**
- Modify: all 7 agent files listed in the spec

The pattern for each agent: add a `## Serena Tool Usage` subsection under the existing tool hierarchy section. This is additive — no existing lines removed.

- [ ] **Step 1: Enrich `agents/explorer.md`**

After the existing "Tier 2: Serena MCP Tools (FALLBACK)" bullet list, add:

```markdown
### Serena Tool Patterns

**Symbol discovery:**
- `get_symbols_overview(relative_path=<file>)` — scan a file's complete symbol map; use before reading bodies to decide what's relevant
- `find_symbol(name_path=<ClassName/method_name>, relative_path=<file>, include_body=true)` — read one specific symbol without loading the whole file
- `find_symbol(name_path=<partial_name>, substring_matching=true)` — broad discovery when exact name unknown

**Reference tracing:**
- `find_referencing_symbols(name_path=<symbol>, relative_path=<file>)` — find every location in the codebase that references this symbol; use to assess usage breadth before reporting a finding

**Pattern search:**
- `search_for_pattern(pattern=<regex>, relative_path=<dir>)` — flexible regex search; use when symbol name is unknown or when looking for code patterns (e.g. all `raise ValueError` calls)
```

- [ ] **Step 2: Enrich `agents/code-reviewer.md`**

After the existing "## Process" section, add:

```markdown
## Serena Tool Patterns

**Reviewing and suggesting structural fixes:**
- `get_symbols_overview(relative_path=<file>)` — map all symbols in a changed file before reading bodies; prioritise review by symbol count and nesting
- `find_referencing_symbols(name_path=<symbol>, relative_path=<file>)` — check how widely a symbol is used before suggesting renaming or splitting it
- `replace_symbol_body(name_path=<symbol>, relative_path=<file>, new_body=<code>)` — when writing a concrete fix suggestion, show the replacement body using this tool's signature so the developer can apply it directly
- `rename_symbol(name_path=<symbol>, relative_path=<file>, new_name=<name>)` — use reference count from `find_referencing_symbols` to assess rename blast radius before recommending it
```

- [ ] **Step 3: Enrich `agents/architecture-reviewer.md`**

After step 6 in "## Process", add:

```markdown
### Serena Structural Analysis

- `find_referencing_symbols(name_path=<symbol>, relative_path=<file>)` — verify import direction: if a lower-layer symbol is referenced from an upper layer, flag it as a layer violation
- `rename_symbol(name_path=<symbol>, relative_path=<file>, new_name=<name>)` — use to assess rename cost when suggesting clarifying renames for misnamed modules or classes
- `get_symbols_overview(relative_path=<file>)` — map symbols before reading bodies; detect god classes by symbol count before investing read tokens
```

- [ ] **Step 4: Enrich `agents/dead-code-detector.md`**

After step 3 in "## Detection Process", add:

```markdown
### Serena Fallback Detection

When `refactor_tool` or `query_graph` are unavailable:
- `get_symbols_overview(relative_path=<file>)` — list all symbols in a file for manual dead-code scan
- `find_referencing_symbols(name_path=<symbol>, relative_path=<file>)` — confirm zero references for a candidate symbol
- `find_symbol(name_path=<symbol>, relative_path=<file>, include_body=false)` — get line range for deletion plan without reading body
- `safe_delete_symbol(name_path=<symbol>, relative_path=<file>)` — **do NOT use** (this agent is read-only); include in DELETION_PLAN instructions for the developer instead
```

- [ ] **Step 5: Enrich `agents/duplicate-detector.md`**

After step 6 in "## Process", add:

```markdown
### Serena Symbol Patterns

- `find_referencing_symbols(name_path=<symbol>, relative_path=<file>)` — before proposing extraction, check how many call sites exist; extraction adds value only when callers are spread across modules
- `get_symbols_overview(relative_path=<file>)` — find methods with similar names or signatures across a file without reading all bodies
```

- [ ] **Step 6: Enrich `agents/step-simulator.md`**

After "## Process" header, before "For EACH task", add:

```markdown
## Serena Tool Usage

Use Serena tools to verify code claims in the plan before trusting them:
- `find_symbol(name_path=<symbol>, relative_path=<file>, include_body=true)` — read the actual function body; never trust plan code snippets without verification
- `get_symbols_overview(relative_path=<file>)` — check that types, classes, and methods named in the plan actually exist in the file
- `search_for_pattern(pattern=<function_name>, relative_path=<src>)` — locate a symbol when its exact file is unknown
```

- [ ] **Step 7: Enrich `agents/log-analyzer.md`**

After "## Analysis Rules", add:

```markdown
## Serena Tool Usage

When a stack trace references a specific symbol:
- `find_symbol(name_path=<ClassName/method>, relative_path=<file>, include_body=true)` — read the throwing code to understand the error context
- `search_for_pattern(pattern=<error_string>, relative_path=<src>)` — locate where the error message is raised when the file is unclear
- `get_symbols_overview(relative_path=<file>)` — scan a file's structure to orient before reading specific symbols
```

- [ ] **Step 8: Run unit tests to confirm no regressions**

```bash
pytest tests/unit/ -v
```

Expected: ALL PASS

- [ ] **Step 9: Commit**

```bash
git add agents/
git commit -m "feat(agents): enrich all agents with Serena powerful tool instructions"
```

---

## Task 8: Write `.claude/rules/fragment-system.md`

**Files:**
- Create: `.claude/rules/fragment-system.md`

- [ ] **Step 1: Write the rule doc**

Create `.claude/rules/fragment-system.md`:

```markdown
# Fragment System

BDK's conditional injection system: how fragments are structured, how chains work, and when to use each mode.

## What Are Fragments

Fragments are Markdown files injected at skill load time based on `.bdk/settings.json` feature flags. Unlike `references/` (always loaded), fragments are **only included** when their condition matches.

## Directory Layout

```
fragments/
  tool-tiers/          ← shared, multi-skill
    search.chain.json
    search-graph.md
    search-serena.md
    search-fallback.md
    edit.chain.json
    edit-graph.md
    edit-serena.md
    impact.chain.json
    impact-graph.md
    impact-fallback.md
    review.chain.json
    review-graph.md
    review-fallback.md
    explore.chain.json
    explore-graph.md
    explore-serena.md
  <capability>/        ← other shared fragment groups
    step1-*.md

skills/<skill-name>/
  fragments/           ← skill-local conditional fragments
    react.md
    typescript-strict.md
```

## Chain File Format

```json
{
  "mode": "exclusive",
  "chain": [
    { "if": ["features.code-review-graph"], "then": "search-graph.md" },
    { "if": ["features.serena"], "then": "search-serena.md" },
    { "then": "search-fallback.md" }
  ]
}
```

- `mode`: `"exclusive"` or `"additive"`
- `chain`: array of entries, each with optional `"if"` (AND conditions) and required `"then"` (path relative to chain file)
- Entry without `"if"` is an unconditional fallback

## Modes

| Mode | Behaviour | Use when |
|------|-----------|----------|
| `exclusive` | Inject first matching entry only | Fallback tiers (codegraph → serena → grep) |
| `additive` | Inject all matching entries | Complementary tools (both useful together) |

## Tool-Tier Chains

| Chain | Mode | Reason |
|-------|------|--------|
| `search.chain.json` | exclusive | Redundant to use both codegraph and grep |
| `edit.chain.json` | additive | Impact analysis + structural editing are complementary |
| `impact.chain.json` | exclusive | Codegraph wins; Serena has no impact analysis |
| `review.chain.json` | exclusive | Codegraph first; grep fallback |
| `explore.chain.json` | additive | Architecture overview + symbol detail = complementary |

## When to Use `--chain` vs `--if`/`--prefer`

| Situation | Use |
|-----------|-----|
| Fallback tier system | `--chain` with `exclusive` |
| Complementary tools | `--chain` with `additive` |
| Simple one-off conditional | `--if` / `--prefer` inline |
| Suppress block when better tool available | `--prefer` |

## Graph-Only Skills

Skills `graph-explore`, `graph-debug`, `graph-review`, `graph-refactor` require code-review-graph by design. They make no sense without it. **Do not apply chain migration to these skills.** They stay hardcoded.

## Agents vs Skills

Agent `.md` files are static markdown — shell commands do not execute at load time. `inject.py --chain` cannot be used in agents. Agent tool preferences come from `STARTUP_INSTRUCTIONS.md` (assembled via chains) and from explicit Serena tool subsections in the agent body.
```

- [ ] **Step 2: Commit**

```bash
git add .claude/rules/fragment-system.md
git commit -m "docs(rules): add fragment-system rule covering chain files and tool tiers"
```

---

## Task 9: Update `CONTRIBUTING.md` with fragment authoring section

**Files:**
- Modify: `CONTRIBUTING.md`

- [ ] **Step 1: Check if CONTRIBUTING.md exists**

```bash
ls CONTRIBUTING.md 2>/dev/null || echo "missing"
```

If missing, create a minimal file first:

```markdown
# Contributing to BDK
```

- [ ] **Step 2: Add "Writing Fragments" section**

Append to `CONTRIBUTING.md`:

```markdown
## Writing Fragments

Fragments are conditional Markdown files injected into skills at load time.

### Creating a Leaf Fragment

1. Decide scope: shared (`fragments/<capability>/`) or skill-local (`skills/<name>/fragments/`)
2. Name the file after the tool tier or feature it teaches (e.g. `search-serena.md`)
3. Write content that teaches Claude WHEN and HOW to use the tools — not just a tool list
4. Keep content under 10 lines; longer content should be split into multiple fragments

### Creating a Chain File

1. Create `<purpose>.chain.json` in the same directory as the leaf files
2. Choose mode:
   - `exclusive` — fallback tiers (first match wins)
   - `additive` — complementary tools (all matches combined)
3. Paths are relative to the chain file's own directory
4. The last entry in an exclusive chain may have no `"if"` — unconditional fallback

```json
{
  "mode": "exclusive",
  "chain": [
    { "if": ["features.code-review-graph"], "then": "search-graph.md" },
    { "if": ["features.serena"], "then": "search-serena.md" },
    { "then": "search-fallback.md" }
  ]
}
```

### Referencing a Chain from a Skill

```markdown
!`python3 ${CLAUDE_PLUGIN_ROOT}/scripts/inject.py --chain ${CLAUDE_PLUGIN_ROOT}/fragments/tool-tiers/search.chain.json`
```

### Naming Conventions

- Chain files: `<purpose>.chain.json`
- Leaf files: `<purpose>-<tier>.md` (e.g. `search-graph.md`, `search-serena.md`, `search-fallback.md`)
- Tier names: `graph`, `serena`, `fallback`

### When NOT to Use Chains

- **Graph-only skills** (`graph-explore`, `graph-debug`, `graph-review`, `graph-refactor`): these require code-review-graph by design; no chain migration applies
- **Agents**: static markdown, no shell execution at load time; use body text subsections instead
```

- [ ] **Step 3: Commit**

```bash
git add CONTRIBUTING.md
git commit -m "docs(contributing): add fragment authoring guide with chain file format"
```

---

## Self-Review Against Spec

**Spec section coverage:**

| Spec Section | Covered by Task |
|---|---|
| 1. inject.py `--prefer` flag | Task 1 |
| 2. inject.py `--chain` mode | Task 2 |
| 3. Fragment library — leaf files | Task 3 |
| 3. Fragment library — chain configs | Task 4 |
| 4. STARTUP_INSTRUCTIONS refactor | Task 5 |
| 5. General skills migration | Task 6 |
| 6. Agent body enrichment (all 7 agents) | Task 7 |
| 7. `.claude/rules/fragment-system.md` | Task 8 |
| 7. `CONTRIBUTING.md` fragment section | Task 9 |

**Spec implementation order compliance:** 1→2→3→4→5→6→7→8→9 ✓

**Out-of-scope verified not included:**
- No changes to `.bdk/settings.json` schema ✓
- No new MCP tools or Serena configuration ✓
- No changes to graph-only skills ✓
- No agent-to-skill conversion ✓

**Placeholder scan:** No TBD, no "add appropriate error handling", no "similar to Task N" — each step contains complete code or exact commands. ✓

**Type consistency check:** `inject()` signature uses `prefer_conditions: list[str] | None = None` consistently across Task 1 module API, CLI, and Task 2 `inject_chain()` call. `inject_chain()` signature is `(chain_path, settings)` used consistently in Task 2 tests and Task 4 manual verification. ✓
