**Resolving merge conflicts**

Resolve each conflicted path by what kind of file it is:

- **Package manager lockfile** (`pnpm-lock.yaml`, `package-lock.json`, `yarn.lock`, `bun.lock`, `Cargo.lock`, `poetry.lock`, `uv.lock`, `Pipfile.lock`, `go.sum`, `Gemfile.lock`, `composer.lock`, `mix.lock`, `pubspec.lock`, `Package.resolved`, `packages.lock.json`, and the like): a hand-merged lockfile can parse and still pin versions that no manifest asked for, so take either side whole, merge the manifests (`package.json`, `Cargo.toml`, `pyproject.toml`, `go.mod`, ...), then regenerate the lockfile with the project's package manager, for example `pnpm install --lockfile-only`, `npm install --package-lock-only`, `cargo generate-lockfile`, `uv lock`, `go mod tidy`.
- **Other generated file** (codegen output, snapshots, compiled assets): take either side, then run the command that produces it.
- **Migration** that collides with another on a number or a timestamp: keep both and renumber the later one, together with every reference to it.
- **Source code and documentation**: keep the intent of both sides. When the two sides change the same behaviour in incompatible ways, report the conflict instead of choosing one.

A conflicted file is resolved when it holds no `<<<<<<<`, `=======` or `>>>>>>>` line and the project's checks pass on it.
