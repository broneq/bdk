---
status: accepted
date: 2026-10-29
decision-makers: broneq
enforced-by:
  - plugins/bdk-skill-kit/src/package.test.ts
  - plugins/bdk-skill-kit/src/bundle.test.ts
  - scripts/publish-plugin.test.ts
  - tests/release-components.test.ts
---

# ADR-0027: `bdk-skill-kit` is also a library, installed as a git dependency from the `release` branch

## Context and Problem Statement

`bdk-skill-kit` is a Claude Code plugin whose skill runs `skill-check`. Projects also want `skill-check` in CI and pre-commit hooks, and plugin authors import `defineConfig`, `definePlugin`, `defineRule` and `checkRule` to write their own rules. Those consumers need the built CLI and library as a dependency, at a released version. Before it moved into this repository (#175) the kit installed from its own repository's tags. How does a project install the kit as a dependency, now that it is one plugin directory among several?

## Decision Drivers

- **One release:** the plugin and the library are the same code and the same version (`plugin.json`, ADR-0002).
- **Nothing to publish or maintain besides the `release` branch** the release job already writes.
- **Runs without a build:** a consumer installs and runs `skill-check` with no install script.
- **Version pinning** for consumers.

## Considered Options

1. **Git dependency on a `release` commit**, with the path `plugins/bdk-skill-kit`.
2. **npm package**, published by the release job.
3. **Plugin only:** no library promise; consumers vendor or copy the CLI.

## Decision Outcome

**Chosen option: 1.** The kit's plugin directory is also an npm package: `package.json` declares `bin` `skill-check` and `exports` `.` and `./testing`, carries no `version` and no script that runs on install, and ships in the release snapshot. The bundles (`dist/skill-check.mjs`, `dist/index.mjs`, `dist/testing.mjs`) import only `node:` modules, so the package has no runtime dependencies to install. A consumer installs a release as

```sh
pnpm add -D "github:broneq/bdk#<release-commit>&path:/plugins/bdk-skill-kit"
```

The plugin has no `bin/`; its skill runs `node ${CLAUDE_PLUGIN_ROOT}/dist/skill-check.mjs`. The kit is not on npm.

It is the only option that keeps one release and one version for plugin and library and needs no registry.

### Consequences

- ✅ Plugin and library are always the same release; nothing else is published.
- ✅ A consumer pins an exact, immutable commit.
- ❌ No semver ranges and no `npm update`: a consumer moves the pin by hand.
- ❌ One directory is both a Claude Code plugin and an npm package; the release snapshot keeps `package.json` for it.
- 🟡 Consumers pin `release` commits by the path `plugins/bdk-skill-kit`: renaming the directory, moving the package or switching to npm breaks every pin.

## Pros and Cons of the Options

### 1 - Git dependency on a `release` commit

- Good: one release; no registry, token or second publish step.
- Bad: no version ranges; a long git URL per consumer.

### 2 - npm package

- Good: version ranges, the usual install.
- Bad: a second release per change and a registry dependency, which ADR-0002 rejected for the `bdk` CLI (option B); `package.json` would need a version next to `plugin.json`.

### 3 - Plugin only

- Good: nothing to keep stable beyond the plugin.
- Bad: CI and pre-commit use and third-party rules lose a supported install.
