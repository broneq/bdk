---
name: setup
description: Initialize .bdk/settings.json for this project. Run once per project when BDK blocks session start with missing settings.
argument-hint: "[--force to re-run even if settings exist]"
disable-model-invocation: true
allowed-tools: Read Bash Write AskUserQuestion mcp__plugin_bdk_*
---

> Relies on BDK foundation (STARTUP_INSTRUCTIONS.md). Assumes environment discovery has already run (language, test runner, build tool are known).

# BDK Setup

Initializes `.bdk/settings.json` for this project. Probes project files to detect languages, test commands, lint commands, and build commands, then confirms with the user before writing.

## Workflow

### Phase 1: Check existing config

If `.bdk/settings.json` already exists and `--force` was not passed:
- Read the file and show current values
- Ask user: "Settings already exist. Overwrite?" — if no, stop

### Phase 2: Probe project files

Read the following files if they exist and extract command/tool hints:

**Command resolution priority** — always prefer running tools via the package manager over direct binary invocation:
- `package.json` scripts → `npm run <script>` / `yarn <script>` / `pnpm <script>` (detect manager by lockfile: `package-lock.json` → npm, `yarn.lock` → yarn, `pnpm-lock.yaml` → pnpm)
- Python with `pyproject.toml` → `poetry run <tool>` if `poetry.lock` exists, else direct
- Ruby → `bundle exec <tool>` always
- Direct binary only as last resort (no package manager detected)

**JavaScript/TypeScript** (`package.json`):
- Scan `scripts` for keys: `test`, `test:unit`, `test:e2e`, `test:integration`, `lint`, `lint:fix`, `build`, `typecheck`, `compile`
- Emit as `npm run <key>` (or yarn/pnpm equivalent per lockfile)
- Check `devDependencies`/`dependencies` for: `vitest`, `jest`, `@playwright/test`, `cypress`, `eslint`, `prettier`, `typescript` — only as fallback if no matching script key found
- Presence of `next.config.*` → add `next` to languages
- Presence of `react` in deps → add `react` to languages

**Python** (`pyproject.toml`, `setup.py`, `requirements*.txt`):
- Detect `pytest`, `ruff`, `mypy`, `black`, `flake8`
- If `poetry.lock` present → `poetry run pytest`, `poetry run ruff`, etc.
- Else direct: `pytest`, `ruff`, etc.
- Language: `python`

**Go** (`go.mod`):
- Test: `go test ./...`
- Check for `.golangci.yml` or `.golangci.toml` → lint: `golangci-lint run`
- Else lint: `go vet ./...`
- Language: `go`

**Rust** (`Cargo.toml`):
- Test: `cargo test`
- Lint: `cargo clippy`
- Build: `cargo build`
- Language: `rust`

**Java** (`pom.xml` or `build.gradle`):
- Maven: `mvn test`, `mvn package`
- Gradle: `./gradlew test`, `./gradlew build`
- Language: `java`

**PHP** (`composer.json`):
- Check `scripts` for test key; else detect `phpunit` or `artisan test`
- Check for `phpcs` or `pint` for lint
- Language: `php`

**Ruby** (`Gemfile`):
- Test: `bundle exec rspec` (if rspec in Gemfile) or `bundle exec rake test`
- Lint: `bundle exec rubocop`
- Language: `ruby`

**C#** (`*.csproj` or `*.sln`):
- Test: `dotnet test`
- Build: `dotnet build`
- Language: `csharp`

**Dart/Flutter** (`pubspec.yaml`):
- Test: `flutter test` (if flutter sdk) or `dart test`
- Language: `dart`

### Phase 3: Confirm settings via AskUserQuestion

Use the `AskUserQuestion` tool with up to 4 questions in a single call:

1. **Test commands** — multiSelect: true, options: each detected command as its own option + "None". User can add unlisted commands via "Other".
2. **Lint commands** — multiSelect: true, same pattern
3. **Features** — multiSelect: true, question: "Which features do you want to **disable**?", options: "Serena MCP", "CodeGraph MCP", "Caveman mode". Empty selection = all enabled.
4. **Build command** — only include if a build tool was detected or the language typically has one (e.g. TypeScript, Java, Rust); skip otherwise to stay under 4 questions

If more than 4 confirmation categories exist, prioritize: test → lint → features → build. Handle remaining categories with a follow-up `AskUserQuestion` call after writing.

"Other" is automatically appended by the UI — user can type any custom command there.

### Phase 4: Write .bdk/settings.json

Create directory and file:
```
.bdk/
├── settings.json
├── plans/
└── brainstorming/
```

Write `settings.json` with confirmed values using the schema:
```json
{
  "$schema": "https://raw.githubusercontent.com/broneq/bdk/main/hooks/check-bdk-config/settings.schema.json",
  "languages": ["..."],
  "test-tools": [{"type": "...", "command": "..."}],
  "lint-tools": [{"type": "...", "command": "..."}],
  "build-tools": [{"type": "...", "command": "..."}],
  "features": {
    "caveman": true,
    "serena": false,
    "code-review-graph": false
  }
}
```

Omit empty arrays (e.g. no `build-tools` key if none detected/provided).

### Phase 5: Initialize MCP tools

Run after writing `settings.json`.

**code-review-graph** — only if both conditions met:
1. `features.code-review-graph` is not `false` in written settings
2. `.mcp.json` (project or `~/.claude/mcp.json`) contains a `code-review-graph` server entry

Call `mcp__plugin_bdk_code-review-graph__build_or_update_graph_tool` (the MCP server itself is the source of truth — no need to check `.code-review-graph/graph.db` from the filesystem; the tool is incremental and skips work when the index is current).

- **Success** → print `[setup] code-review-graph: index built.`
- **Failure** (MCP not reachable / tool error) → print warning and continue — do not abort setup:
  ```
  [setup] code-review-graph: build failed. Call `mcp__plugin_bdk_code-review-graph__build_or_update_graph_tool` manually once MCP is reachable.
  ```

Prefer the MCP tool over shelling out to `uvx code-review-graph build` — same binary under the hood, but the MCP path uses the already-running server and works inside sandboxed/restricted environments where `uvx` may not be available.

**Serena** — no manual action needed at setup time. Serena's active-project state is in-memory only (resets every Claude Code session), so per-session activation is handled by the `hooks/activate-serena/activate.py` SessionStart hook. The hook emits an instruction telling Claude to call `mcp__plugin_bdk_serena__activate_project` whenever both `features.serena` is enabled and `.mcp.json` declares a `serena` server. No setup-time call required.

### Phase 6: Git guidance

Recommend:
- Commit `.bdk/settings.json` (shared with team — consistent commands for all contributors)
- Add to `.gitignore`: `.bdk/plans/` and `.bdk/brainstorming/` (personal artifacts)

Show the gitignore lines to add:
```
.bdk/plans/
.bdk/brainstorming/
```

Ask: "Add these to .gitignore now? [y/n]"

### Completion

Print:
```
[setup] .bdk/settings.json created.
[setup] Directories created: .bdk/plans/, .bdk/brainstorming/
[setup] Restart your Claude Code session — BDK will inject project settings on startup.
```
