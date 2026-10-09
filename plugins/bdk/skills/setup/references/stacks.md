# Stack detection

How to turn a project's files into `languages` and the `tools.test`, `tools.lint` and `tools.build` items.

## Run tools the way the project runs them

- `package.json` scripts through the package manager its lockfile names: `pnpm-lock.yaml` gives `pnpm <script>`, `yarn.lock` gives `yarn <script>`, `bun.lock` or `bun.lockb` gives `bun run <script>`, `package-lock.json` or no lockfile gives `npm run <script>` (`npm test` for `test`).
- Python: `uv run <tool>` with `uv.lock`, `poetry run <tool>` with `poetry.lock`, the tool directly otherwise.
- Ruby: `bundle exec <tool>`.
- A direct binary only when no script or package manager wraps it.

Read a script's body: the runner it starts decides the `id` and the form on changed files, not the script's name. Script names to look for: `test`, `test:unit`, `test:integration`, `test:e2e`, `lint`, `format:check`, `typecheck`, `build`.

## Items

- `id`: the runner or checker in kebab-case (`vitest`, `jest`, `playwright`, `pytest`, `eslint`, `prettier`, `tsc`, `ruff`), never the package manager; unique in its group. A typecheck goes into `lint`; a formatter's check mode (`prettier --check`) too, never its write mode.
- `command`: one command line, as the project runs it. Where the runner takes a list of files, add a second item whose `command` holds the literal `{files}` (`bdk check run` puts the changed files there) and whose `id` is the runner's with `-changed` (`vitest-changed`), or names the related-tests mode (`vitest-related` for `vitest related --run {files}`). When unsure the form works, leave the second item out: a wrong one runs the wrong thing.
- `when`: the check points the item runs at, by [the points table](#check-points). Write it on every item.
- `paths` on a `{files}` item: the files its tool reads, so a changed Markdown or YAML file never reaches it: `**/*.<ext>` for a linter or test runner on source files, the test files for a runner that takes only tests (`**/*.test.js` for `node --test`), the spec files for an E2E runner (`e2e/**/*.spec.ts`).
- A Playwright or Cypress suite is a `tools.test` item (its own `id`); it is not `tools.e2e`, which says how to start the product.

## By project file

| File | `languages` | Test | Lint | Build |
|---|---|---|---|---|
| `package.json` | `typescript` with `tsconfig.json`, else `javascript` | scripts; else a `vitest`, `jest`, `mocha` dependency; `node --test` files (`*.test.js`) | scripts; else `eslint`, `@biomejs/biome`, `prettier`; `tsc --noEmit` with `tsconfig.json` and no typecheck script | the `build` script |
| `pyproject.toml`, `setup.py`, `requirements*.txt` | `python` | `pytest` | `ruff check`, `mypy`, when configured or a dependency | none |
| `go.mod` | `go` | `go test ./...` | `golangci-lint run` with `.golangci.*`, else `go vet ./...` | `go build ./...` |
| `Cargo.toml` | `rust` | `cargo test` | `cargo clippy` | `cargo build` |
| `pom.xml` | `java` | `mvn test` | none | `mvn package` |
| `build.gradle*` | `java` or `kotlin` | `./gradlew test` | none | `./gradlew build` |
| `composer.json` | `php` | its `test` script, else `vendor/bin/phpunit` | `vendor/bin/phpcs` or `vendor/bin/pint --test` | none |
| `Gemfile` | `ruby` | `bundle exec rspec` with rspec, else `bundle exec rake test` | `bundle exec rubocop` | none |
| `*.csproj`, `*.sln` | `csharp` | `dotnet test` | none | `dotnet build` |
| `pubspec.yaml` | `dart` | `flutter test` with Flutter, else `dart test` | `dart analyze` | none |

A workspace with several packages lists every language it uses once.

## Check points

| Item | `when` |
|---|---|
| a linter, formatter check or test runner on the changed files (`{files}`) | `[part]` |
| a linter or formatter check of the whole project | `[review]` |
| a type check (`tsc --noEmit`, `mypy`, `go vet`) | `[wave, review]` |
| the project's main test script | `[wave, review]` |
| an integration, slow or heavy test script | `[review]` |
| an E2E runner (Playwright, Cypress) on the changed spec files | `[part]` |
| the whole E2E suite | `[review]` |
| build | `[review]` |

`part` runs after each plan part, on its changed files; `wave` after each wave of execute, on the Change branch; `review` in each review round. An item without `when` runs at every point.

## Forms on changed files

| Runner | `command` of the `{files}` item |
|---|---|
| vitest | `<pm> vitest related --run {files}` (id `vitest-related`) or `<pm> vitest run {files}` |
| jest | `<pm> jest --findRelatedTests {files}` (id `jest-related`) or `<pm> jest {files}` |
| node --test | `node --test {files}`, `paths` on the test files |
| playwright | `<pm> playwright test {files}`, `paths` on the spec files |
| pytest | `pytest {files}` (with its `uv run` or `poetry run` prefix), `paths` on the test files |
| eslint | `<pm> eslint {files}` |
| biome | `<pm> biome check {files}` |
| prettier | `<pm> prettier --check {files}` |
| ruff | `ruff check {files}` (with its prefix) |
| rspec | `bundle exec rspec {files}`, `paths` on `spec/**/*_spec.rb` |
| rubocop | `bundle exec rubocop {files}` |

`<pm>` is `pnpm`, `yarn`, `bunx` or `npx`, after the lockfile. `tsc`, `mypy` on a package, `go`, `cargo`, `mvn`, `gradle` and `dotnet` take no file list: no `{files}` item.

## Rewrite the removed `scoped`

An item holding `scoped` (an earlier v3 wrote it) becomes two items: the item keeps its `id` and `command` and gets `when: [wave, review]` (`[review]` for a lint or build item), and a new item `<id>-changed` gets the `scoped` command as its `command`, `paths` as in [Items](#items), and `when: [part]`. Edit only those lines, keeping comments and the order of the other keys. An item without `when` stays as it is: it runs at every point.

## Paths in a repository of several packages

`paths` (globs, `*` stays in one directory, `**` spans directories) tells `bdk check run` which changed files an item owns. Besides the `{files}` items of [Items](#items), write it on an item only when its command covers a part of the repository. Leave it out when the item covers the whole repository: a single-package repository, or one root command that runs every package (`pnpm -r test`). A root config change then still reaches the item.

| Layout | Test and build item | Lint item |
|---|---|---|
| Package in its own directory (`api/`, `web/`, `packages/ui/`) | `<dir>/**` | `<dir>/**/*.<ext>` for each extension its tool reads; `<dir>/**` for a tool that reads every file |
| Packages share the root (a Python app and a TypeScript app side by side) | `**/*.<ext>` of the item's language | `**/*.<ext>` |

Extensions: `pytest`, `ruff`, `mypy`: `py`; `vitest`, `jest`, `eslint`, `biome`, `tsc`: `ts`, `tsx`, `js`, `jsx` (only those the package uses); `go`: `go`; `cargo`: `rs`. A package that is a directory is the directory of its manifest (`api/pyproject.toml` gives `api`). Write the globs as a YAML list (`paths: ["api/**"]`). Every `command` runs from the project root, so give a package's commands its directory (`uv run --project api pytest`, `pnpm --dir web test`).

## v2 projects

BDK 2 kept `.bdk/settings.json`. Read it as hints and confirm each against the project files:

| v2 key | v3 key |
|---|---|
| `languages` | `languages` |
| `test-tools`, `lint-tools`, `build-tools` | `tools.test`, `tools.lint`, `tools.build`: `type` becomes `id`, `command` stays, and a v2 `scoped` becomes a second `{files}` item as in [Rewrite the removed `scoped`](#rewrite-the-removed-scoped); `tier`, `related`, `failed`, `incremental` have no v3 field |
| anything else | none: name it in the report as not carried over |

The v2 paths are `.bdk/settings.json`, `.bdk/plans/`, `.bdk/design/`, `.bdk/verify-plan/` and `.bdk/runs/`, whose v2 content v3 cannot read. Ask once whether to delete those that exist; delete only after a yes.
