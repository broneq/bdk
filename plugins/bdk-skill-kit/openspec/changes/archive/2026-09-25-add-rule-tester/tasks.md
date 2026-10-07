# Tasks

## 1. Make room for the public module

- [x] 1.1 Move the internal test helpers from `src/testing.ts` to `src/test-helpers.ts`, update every import, and verify `pnpm typecheck` and `pnpm test` pass

## 2. Rule tester

- [x] 2.1 Write `src/testing.test.ts` covering a per-document rule, a project rule, options merging, the profile, a rule off by default, the warning cap, a rejected portable agents target, a path outside the target, and temp dir removal on return and on throw; verify it fails for the missing module
- [x] 2.2 Export `loadTarget` from `src/config.ts`, let `runChecks` take only the loaded-config fields it reads, implement `checkRule` in `src/testing.ts`, and verify the tests from 2.1 pass

## 3. Bundle and publish the entry

- [x] 3.1 Extend `src/bundle.test.ts`: `dist/testing.mjs` imports only `node:` modules, `dist/testing.d.ts` declares `checkRule` and imports only `./index.js`, and `dist/index.mjs` does not contain the tester; verify it fails before the build change
- [x] 3.2 Add the `dist/testing.mjs` esbuild entry and the `dist/testing.d.ts` emit to `build.mjs`, the `./testing` export to `package.json` and the entry to `knip.json`; run `pnpm build` and verify 3.1 passes
- [x] 3.3 Verify `dist/testing.mjs` runs a rule from a plain `.mjs` script on Node 22.13
- [x] 3.4 Add the "Testing rules" section to the README and verify its example matches the exported signature

## 4. Integration

- [x] 4.1 Run the full local CI (build, bundle diff, lint, format check, typecheck, knip, test, self-check) and `openspec validate add-rule-tester --strict`
