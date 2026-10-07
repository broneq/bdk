# Proposal

## Why

A plugin author cannot unit test a rule in process. The kit exports no parser, so a test must either rebuild a `Document` by hand (frontmatter, key lines, body start, code fences, files) and duplicate the loader, or run the CLI in a child process, which adds no coverage to the plugin's own test project. BDK's plugin hits this today: its unit tests enforce coverage thresholds that the CLI-based contract tests cannot feed.

## What Changes

- A new entry point, `bdk-skill-kit/testing`, exports `checkRule(rule, input)`. It writes the given files into a temporary target directory, runs the one rule through the same discovery, document parsing, option merging and runner that the CLI uses, removes the directory and resolves to the rule's findings in report order.
- The entry ships as a committed bundle `dist/testing.mjs` with `dist/testing.d.ts`, exported as `./testing` in `package.json`. The main entry does not load it.
- The README gains a "Testing rules" section.
- The internal test helper module `src/testing.ts` moves to `src/test-helpers.ts`, so the public module can take the name.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `skill-kit`: the Distribution requirement lists the new bundle; a new "Rule tester" requirement specifies `checkRule`.

## Impact

- New: `src/testing.ts` (public), `src/testing.test.ts`, `dist/testing.mjs`, `dist/testing.d.ts`.
- Changed: `src/config.ts` and `src/runner.ts` expose what the tester composes, `build.mjs`, `package.json` `exports`, `knip.json` entries, `src/bundle.test.ts`, README.
- No change to the CLI, the config format or any rule.
