# Design

## Context

See proposal.md - Why. The CLI path is `loadConfig` (imports the config file, builds the rule registry, validates settings and targets) followed by `runChecks` (discovers documents, parses them, merges options with `settingOf`, runs `check` and `checkProject`, sorts findings). The tester has no config file: the rule arrives as an object.

## Goals / Non-Goals

**Goals:**

- One parser, one loader, one option merge: the tester reaches the runner through the functions the CLI uses.
- Works from the bundle on Node versions without type stripping, since no TypeScript file is loaded at run time.

**Non-Goals:**

- Running the generic rules or other plugin rules alongside the rule under test.
- Baselines, path arguments and output formatting.
- Plugin name prefixes: the finding carries `rule.id` as given, because the tester receives a rule, not a plugin.

## Decisions

**Materialise files in a temp directory, not in memory.** `checkRule` writes `files` under `mkdtemp`, points one target with `dirs: ["."]` at it and removes it in `finally`, also when the rule throws. Alternative: an in-memory file system behind `discover`. It lost because it adds an abstraction to the loader that only the tester needs, and a rule that reads the disk through `ctx.root` would see nothing.

**Compose the loaded config from exported pieces, not from a synthetic `Config`.** The tester builds the rule map with only the rule under test, validates the target with the same `loadTarget` the config loader uses, and hands the runner a settings map `{ [rule.id]: [severity, options] }`, so `settingOf` merges `options` over `defaultOptions` exactly as for a config. Alternative: build a `Config` with a synthetic plugin and call the config loader. It lost because the registry always adds the generic rules, prefixes plugin rule IDs and skips rules whose default severity is `off`.

**Severity.** The rule runs at `error` when its default severity is `off`, else at its default severity. A report with `severity: "warning"` is still capped by the runner. Alternative: a `severity` input. Not needed yet; it can be added without breaking the signature.

**Paths outside the target are rejected.** A `files` key that is absolute or climbs out with `..` throws before anything is written, so a test cannot write outside the temp directory.

**Separate bundle and declaration file.** `dist/testing.mjs` is its own esbuild entry, so `dist/index.mjs` stays free of the runner. `dist/testing.d.ts` is emitted by `tsc` into a scratch directory and copied; it imports its types from `./index.js`, which resolves to `dist/index.d.ts`. Alternative: inline all types into one declaration file. It lost because the types would then be two distinct copies, and a `Rule` from `bdk-skill-kit` would not be the same type as the tester's.

## Risks / Trade-offs

- [The tester's target is always one directory named by the root] → A rule that depends on several targets must be tested through the CLI; the spec states the single-target scope.
- [Disk I/O per call] → Test trees are small; the cost is milliseconds.
