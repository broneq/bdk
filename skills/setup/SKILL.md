---
name: setup
description: Initialize .bdk/settings.yaml for this project. Run once per project, or when a skill reports that no tools.test or tools.lint entry is configured.
argument-hint: "[--force to re-run even if settings exist]"
disable-model-invocation: true
allowed-tools: Read Bash Write AskUserQuestion
---

> Relies on BDK foundation (STARTUP_INSTRUCTIONS.md). Assumes environment discovery has already run (language, test runner, build tool are known).

# BDK Setup

Initializes `.bdk/settings.yaml` for this project. Probes project files to detect languages, test commands, lint commands, and build commands, then confirms with the user before writing.

## Workflow

### Phase 1: Check existing config

If `.bdk/settings.yaml` already exists and `--force` was not passed:

- Read the file and show current values
- Ask user: "Settings already exist. Overwrite?" — if no, stop

If only the v2 file `.bdk/settings.json` exists, say that this setup writes `.bdk/settings.yaml` instead and that the kernel ignores `settings.json`; carry its commands over as the detected defaults of Phase 3.

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

### Phase 2b: Fill in tier and scoping forms

The full command is the least useful thing about a tool entry. BDK runs scoped checks throughout a plan and the full suite exactly once, at the end — so every entry needs a `tier` and, wherever the tool supports it, the narrower forms. Getting these right here is what stops every later agent from guessing at `npm run test:unit -- <path>` versus `vitest related`.

Set `tier` on every `tools.test` entry (`fast` | `e2e`) and every `tools.lint` entry (`lint` | `format` | `typecheck`). It is required: `bdk config check` refuses an entry without it, because a wrong guess (`fast` on an e2e runner) means a slow suite runs at every group boundary.

`{files}` is a literal placeholder in these templates — callers substitute a path list. Derive per runner:

| Runner     | `scoped`                         | `related`                             | `failed`                            | `incremental`              |
| ---------- | -------------------------------- | ------------------------------------- | ----------------------------------- | -------------------------- |
| vitest     | `npx vitest run {files}`         | `npx vitest related --run {files}`    | `npx vitest run --changed`          | —                          |
| jest       | `npx jest {files}`               | `npx jest --findRelatedTests {files}` | `npx jest --onlyFailures`           | —                          |
| playwright | `npx playwright test {files}`    | —                                     | `npx playwright test --last-failed` | —                          |
| cypress    | `npx cypress run --spec {files}` | —                                     | —                                   | —                          |
| pytest     | `pytest {files}`                 | —                                     | `pytest --lf`                       | —                          |
| go test    | `go test {files}`                | —                                     | —                                   | —                          |
| cargo test | `cargo test {files}`             | —                                     | —                                   | —                          |
| rspec      | `bundle exec rspec {files}`      | —                                     | `bundle exec rspec --only-failures` | —                          |
| eslint     | `npx eslint {files}`             | —                                     | —                                   | —                          |
| prettier   | `npx prettier --check {files}`   | —                                     | —                                   | —                          |
| ruff       | `ruff check {files}`             | —                                     | —                                   | —                          |
| tsc        | —                                | —                                     | —                                   | `npx tsc -b --incremental` |
| mypy       | `mypy {files}`                   | —                                     | —                                   | `mypy --incremental .`     |

Rules for anything not in the table:

- Package-manager script wrapping a runner that takes paths → `<script> -- {files}` (`npm run test:unit -- {files}`). The `--` is required or the paths reach npm, not the runner.
- A tool that takes no path list (most typecheckers, some build-mode linters) → omit `scoped`; give an `incremental` form if the tool has a cache flag.
- Not sure a form exists → omit it. A wrong template is worse than a missing one: BDK falls back cleanly from a missing form, and silently runs the wrong thing with a broken one.
- `scoped` and `related` **must** contain `{files}`; `bdk config check` refuses settings where they do not, because such a command ignores the file list and quietly runs everything.

### Phase 3: Confirm settings via AskUserQuestion

Use the `AskUserQuestion` tool with up to 3 questions in a single call:

1. **Test commands** — multiSelect: true, options: each detected command as its own option + "None". User can add unlisted commands via "Other".
2. **Lint commands** — multiSelect: true, same pattern
3. **Build command**: only include if a build tool was detected or the language typically has one (e.g. TypeScript, Java, Rust)

Confirm the **full** commands only. Tiers and scoped forms are derived from Phase 2b for whatever the user confirms — they are mechanical consequences of the runner, not preferences worth a question. Show them in the completion summary instead so a wrong derivation is visible.

"Other" is automatically appended by the UI — user can type any custom command there.

### Phase 4: Write .bdk/settings.yaml

Create directory and file:

```
.bdk/
├── settings.yaml
├── plans/
└── design/
```

Get the schema URL for the first line of the file:

```bash
node "${CLAUDE_PLUGIN_ROOT}/dist/bdk.mjs" config schema --url --json
```

Write `settings.yaml` with the modeline built from its `url`, then the confirmed values plus the tier/scoping forms from Phase 2b:

```yaml
# yaml-language-server: $schema=<url>
languages: [typescript, react]
tools:
  test:
    - id: vitest
      tier: fast
      command: npm run test:unit
      scoped: npx vitest run {files}
      related: npx vitest related --run {files}
      failed: npx vitest run --changed
    - id: playwright
      tier: e2e
      command: npm run test:e2e
      scoped: npx playwright test {files}
      failed: npx playwright test --last-failed
  lint:
    - id: eslint
      tier: lint
      command: npm run lint
      scoped: npx eslint {files}
    - id: tsc
      tier: typecheck
      command: npm run typecheck
      incremental: npx tsc -b --incremental
  build:
    - id: tsc
      command: npm run build
```

`id` names the runner or framework (`vitest`, `playwright`, `pytest`, `eslint`, `tsc`), not the package manager, in kebab-case and unique within its list; a personal `.bdk/settings.local.yaml` overrides an entry by its `id`. Omit empty lists (e.g. no `build` key if none detected/provided), and omit any per-entry form the tool does not support. `build` entries need no `tier`. An entry may carry `when`, a sentence that tells the model when that command is the right one (`when: Only for changes under e2e/.`); add it only when two entries of the same tier compete.

Then run:

```bash
node "${CLAUDE_PLUGIN_ROOT}/dist/bdk.mjs" config check
```

It must exit 0. On a refusal, fix the key or value it names and run it again.

### Phase 5: Git guidance

Recommend:

- Commit `.bdk/settings.yaml` (shared with team — consistent commands for all contributors)
- Add to `.gitignore`: `.bdk/plans/` and `.bdk/design/` (personal artifacts), `.bdk/.machine/` (files the kernel writes) and `.bdk/settings.local.yaml` (personal overrides)

Show the gitignore lines to add:

```
.bdk/plans/
.bdk/design/
.bdk/.machine/
.bdk/settings.local.yaml
```

Ask: "Add these to .gitignore now? [y/n]"

### Completion

Print:

```
[setup] .bdk/settings.yaml created; bdk config check passed.
[setup] Test tiers: {tier}={command} (scoped: {scoped|none}) …
[setup] Lint tiers: {tier}={command} (scoped: {scoped|none}) …
[setup] Directories created: .bdk/plans/, .bdk/design/
[setup] Skills read the settings when they load; no restart needed.
```

The tier lines exist so a wrong derivation is caught now, by the one person who knows the project, rather than showing up later as a slow suite running at every group boundary.
