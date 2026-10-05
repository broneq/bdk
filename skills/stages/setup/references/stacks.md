# Stack Detection

How to turn a project's files into `tools.test`, `tools.lint`, `tools.build` entries and `languages`. Read only when the project has no settings for a group yet.

## Prefer the project's own scripts

Run a tool the way the project runs it:

- `package.json` scripts through the package manager its lockfile names: `pnpm-lock.yaml` -> `pnpm <script>`, `yarn.lock` -> `yarn <script>`, `package-lock.json` -> `npm run <script>`. Script keys to look for: `test`, `test:unit`, `test:e2e`, `test:integration`, `lint`, `format`, `format:check`, `typecheck`, `build`.
- Python with `poetry.lock` -> `poetry run <tool>`, with `uv.lock` -> `uv run <tool>`; otherwise the tool directly.
- Ruby -> `bundle exec <tool>`.
- A direct binary only when no package manager wraps it.

A script wraps a runner: read the script's body to know which runner it starts, because the tier and the scoped forms follow from the runner, not from the script name.

## Detection by project file

| File                                              | Language                                                                                | Test                                                                       | Lint                                                          | Build             |
| ------------------------------------------------- | --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------- | ----------------- |
| `package.json`                                    | `typescript` with `tsconfig.json`, else `javascript`; `react` with a `react` dependency | scripts; else `vitest`, `jest`, `@playwright/test`, `cypress` dependencies | scripts; else `eslint`, `prettier`, `typescript` dependencies | `build` script    |
| `pyproject.toml`, `setup.py`, `requirements*.txt` | `python`                                                                                | `pytest`                                                                   | `ruff`, `mypy`, `black`, `flake8` when configured             | none              |
| `go.mod`                                          | `go`                                                                                    | `go test ./...`                                                            | `golangci-lint run` with `.golangci.*`, else `go vet ./...`   | `go build ./...`  |
| `Cargo.toml`                                      | `rust`                                                                                  | `cargo test`                                                               | `cargo clippy`                                                | `cargo build`     |
| `pom.xml`                                         | `java`                                                                                  | `mvn test`                                                                 | none                                                          | `mvn package`     |
| `build.gradle*`                                   | `java` or `kotlin`                                                                      | `./gradlew test`                                                           | none                                                          | `./gradlew build` |
| `composer.json`                                   | `php`                                                                                   | its `test` script, else `phpunit` or `php artisan test`                    | `phpcs` or `pint`                                             | none              |
| `Gemfile`                                         | `ruby`                                                                                  | `bundle exec rspec` with rspec, else `bundle exec rake test`               | `bundle exec rubocop`                                         | none              |
| `*.csproj`, `*.sln`                               | `csharp`                                                                                | `dotnet test`                                                              | none                                                          | `dotnet build`    |
| `pubspec.yaml`                                    | `dart`                                                                                  | `flutter test` with the Flutter SDK, else `dart test`                      | `dart analyze`                                                | none              |

## Entry fields

- `id`: the runner or checker in kebab-case (`vitest`, `playwright`, `pytest`, `eslint`, `tsc`), never the package manager; unique within its group. A personal `.bdk/settings.local.yaml` overrides an entry by this `id`.
- `tier`: required on `tools.test` (`fast` or `e2e`) and `tools.lint` (`lint`, `format` or `typecheck`); `build` entries have none. A wrong `fast` on an end-to-end runner makes a slow suite run at every task boundary.
- `command`: the full run, as the user confirmed it.
- `scoped`, `related`, `failed`, `incremental`: the narrower forms from the table below, only where the runner has them. `scoped` and `related` must contain the literal `{files}`; the kernel refuses one without it.
- `when`: one sentence telling the model when this entry is the right one, only when two entries of the same tier compete (`when: Only for changes under e2e/.`).

## Scoped forms by runner

| Runner     | `tier`      | `scoped`                         | `related`                             | `failed`                            | `incremental`              |
| ---------- | ----------- | -------------------------------- | ------------------------------------- | ----------------------------------- | -------------------------- |
| vitest     | `fast`      | `npx vitest run {files}`         | `npx vitest related --run {files}`    | `npx vitest run --changed`          |                            |
| jest       | `fast`      | `npx jest {files}`               | `npx jest --findRelatedTests {files}` | `npx jest --onlyFailures`           |                            |
| playwright | `e2e`       | `npx playwright test {files}`    |                                       | `npx playwright test --last-failed` |                            |
| cypress    | `e2e`       | `npx cypress run --spec {files}` |                                       |                                     |                            |
| pytest     | `fast`      | `pytest {files}`                 |                                       | `pytest --lf`                       |                            |
| go test    | `fast`      | `go test {files}`                |                                       |                                     |                            |
| cargo test | `fast`      | `cargo test {files}`             |                                       |                                     |                            |
| rspec      | `fast`      | `bundle exec rspec {files}`      |                                       | `bundle exec rspec --only-failures` |                            |
| eslint     | `lint`      | `npx eslint {files}`             |                                       |                                     |                            |
| prettier   | `format`    | `npx prettier --check {files}`   |                                       |                                     |                            |
| ruff       | `lint`      | `ruff check {files}`             |                                       |                                     |                            |
| tsc        | `typecheck` |                                  |                                       |                                     | `npx tsc -b --incremental` |
| mypy       | `typecheck` | `mypy {files}`                   |                                       |                                     | `mypy --incremental .`     |

Use the project's wrapper in these forms where it has one (`pnpm vitest run {files}`, `poetry run pytest {files}`). For anything not in the table:

- A package-manager script wrapping a runner that takes paths: `<script> -- {files}` (`npm run test:unit -- {files}`); without the `--` the paths reach the package manager, not the runner.
- A tool that takes no path list: no `scoped`; an `incremental` form when the tool has a cache flag.
- Unsure a form exists: leave it out. The kernel falls back cleanly from a missing form and silently runs the wrong thing with a broken one.

## Writing an entry

One `bdk config set` per entry, the value an inline YAML mapping:

```bash
bdk config set tools.test.vitest '{tier: fast, command: pnpm test, scoped: "pnpm vitest run {files}", related: "pnpm vitest related --run {files}"}'
bdk config set tools.lint.tsc '{tier: typecheck, command: pnpm typecheck, incremental: "pnpm tsc -b --incremental"}'
bdk config set tools.build.tsc '{command: pnpm build}'
bdk config set languages '[typescript, react]'
```

Quote any value holding `{files}`, `:` or `#`.

## Ignore lists

Where each tool reads the paths it skips, and the entry that keeps it off `.bdk/`. A tool belongs here when it reads Markdown, YAML or JSON, the file types BDK commits. Its `.gitignore` support never covers `.bdk/`: the files are committed, so `.gitignore` does not list them.

| Tool                              | Where its ignore list lives                                                                                                        | Entry                                         |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| markdownlint-cli2                 | `ignores` in `.markdownlint-cli2.{jsonc,yaml,cjs,mjs}`; a `globs` list there or on the command line still reads `.bdk/` without it | `".bdk/**"`                                   |
| markdownlint-cli                  | `.markdownlintignore`, or `--ignore` in the script                                                                                 | `.bdk/`                                       |
| prettier                          | `.prettierignore` (created when missing); prettier reads it only at the project root                                               | `.bdk/`                                       |
| eslint (flat config)              | `ignores` of a config object that has no other key, in `eslint.config.{js,mjs,cjs,ts}`; only when it lints Markdown, JSON or YAML  | `".bdk/**"`                                   |
| eslint (legacy)                   | `.eslintignore` or `ignorePatterns` in `.eslintrc.*`, under the same condition                                                     | `.bdk/`                                       |
| biome                             | `files.includes` in `biome.json(c)` (v2, a negated pattern) or `files.ignore` (v1)                                                 | `"!.bdk"` (v2), `".bdk/**"` (v1)              |
| dprint                            | `excludes` in `dprint.json`                                                                                                        | `".bdk/**"`                                   |
| remark-cli                        | `.remarkignore`                                                                                                                    | `.bdk/`                                       |
| yamllint                          | `ignore` in `.yamllint(.yaml)`                                                                                                     | `.bdk/`                                       |
| cspell                            | `ignorePaths` in `cspell.json` or `.cspell.json`                                                                                   | `".bdk/**"`                                   |
| vale                              | the `--glob` of the script that runs it                                                                                            | `--glob='!.bdk/**'`                           |
| ruff                              | `extend-exclude` in `[tool.ruff]` of `pyproject.toml` or in `ruff.toml`; only when it reads Markdown code blocks                   | `".bdk"`                                      |
| a project script that lists files | its own file list: `git ls-files` takes a pathspec, a glob an ignore option                                                        | `':(exclude).bdk'`, or an ignore of `.bdk/**` |

A wrapper such as lint-staged runs the tool with the tool's own ignore list, so the entry above covers it too.
