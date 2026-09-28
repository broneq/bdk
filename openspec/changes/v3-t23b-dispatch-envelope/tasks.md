# Tasks

## 1. Contract and plan

- [x] 1.1 Update `schema/cli/commands.json` for the deltas: `dispatch build <target>`, `rules show` (`--ticket`, `agent`, writes `attempts/`, owner T23), `log ingest` (`agent`, no `--file`, owner T23, new rules), `log add --category`, `policy/observation-cap` removed, `input/invalid-envelope` replacing `input/invalid-block` in `kernel/src/shared/refusal/index.ts`; update the hand-written output schemas `dispatch-build`, `dispatch-show` and `rules-show` (the zod-generated `log-add` `downgraded`, `log-ingest` and `attempt-close` `rulesFinding` change with their implementation in 3.2, 3.3 and 5.1) and the planned-keys list (`policy.verifier.not-a-fail`, `policy.log.max-observations` removed); verify `pnpm test:contract` fails only on the missing implementations, then passes the index and schema checks
- [x] 1.2 Sync the main specs from the deltas (`kernel-cli`, `kernel-cli/{dispatch,rules,log,attempt}`, `kernel-state`, `kernel-settings`, `role-contracts`, `kernel-architecture`) and edit the `kernel-cli/log` Purpose (ingest stores reports); verify `openspec validate --specs --strict` and `pnpm test:contract` spec checks pass
- [x] 1.3 Record T23-D25 to D36 in the T23 entry of `docs/V3-IMPLEMENTATION-PLAN.md` (Scope B wording: `<target>`, report through ingest for every role, rules by role map, `rules-read`, roles not overridable); verify by reading the section against design.md

## 2. `rules` slice and rule text ownership

- [x] 2.1 Write a contract test that captures `bdk ctx skill <name>` output for every manifest entry with a fixture `languages` and project override; verify it passes on the current `ctx` before any move
- [x] 2.2 Create `kernel/src/rules/` (config, domain role-to-category map, use case resolving sections, `index.ts`), move the `rules/*` prompt keys and `languages` from `ctx/config.ts` to `rules/config.ts`, make `ctx` read rule sections through `rules`; verify 2.1 stays byte-identical, `pnpm test:unit`, the S6 structural test and the import scan pass
- [x] 2.3 Add the `shared/store` primitive that stamps `rules-read` once in an attempt record and the `rules-read` field in `kernel/src/shared/store/state/attempt.ts`; verify unit tests for first stamp, repeated call and rebuild
- [x] 2.4 Write failing unit and E2E tests for `rules show --ticket` (example run, `input/not-found`, `policy/no-open-ticket`, selection by role, project override, first read stamped, `<id>` form `kernel/not-implemented`); implement the command and register the slice; verify `pnpm build && pnpm test:e2e` passes them

## 3. `log`: P8 and report storage

- [x] 3.1 Register `policy.verifier` (`blocking-categories`, `not-a-fail`, consumer `log`) and drop the observation cap code paths; verify `bdk config show policy.verifier --json` matches the `not-a-fail defaults` scenario and the settings contract test passes
- [x] 3.2 Write failing tests for `log add --category` and the P8 downgrade (verifier without category, verifier in category, implementer never downgraded, design-verifier with a project category); implement; verify unit and E2E pass
- [x] 3.3 Write failing tests for the reworked `log ingest` (every scenario of the delta: example, invalid envelope with line, forbidden field, no open ticket, no cap, entries missing, evidence missing, implementer stores and replaces); replace the T22 implementation; verify unit and E2E pass and no code path reads a `bdk-entries` block

## 4. `dispatch` slice

- [x] 4.1 Write failing unit tests for the package template: section order, task-target embedding, non-task targets naming paths, entry selection by target / part / `Files:` (T23-D32), verifier categories and `not-a-fail`, role body without frontmatter, `template-hash` normalisation and stability (T23-D33); verify they fail for the missing module
- [x] 4.2 Implement `dispatch build` (role-to-adapter map from `export`, lists from `log`, rule texts from `rules`, placeholder check from `shared/store`, 12 288-byte limit naming the largest section) and `dispatch show` (ticket or path under `dispatch/`); register the slice; verify 4.1 passes and the import scan accepts `dispatch -> rules|log|export|graph` only (T23-D37)
- [x] 4.3 Write E2E tests for every scenario of the `kernel-cli/dispatch` delta including acceptance B (13 KB package refused, `TODO` in `Files:` refused, no ticket refused, package embeds the role body, the `rules show --ticket` command and only accepted decisions and open blockers in full), and record the fixture package size; verify `pnpm test:e2e` passes (tiny fixture, task `01-1`, implementer: 3 771 bytes, of which the role body is about 2 700)

## 5. `attempt close` and role contracts

- [x] 5.1 Write failing tests for the missing-rules finding (implementer without `rules-read` gets one `finding` with `review: true` and `rulesFinding`; with `rules-read` none; a verifier ticket never); implement in `attempt close`; verify unit and E2E pass
- [x] 5.2 Update the seven role skills: every role pipes its report to `bdk log ingest --ticket`, checks the exit code and resubmits a refused report; the implementer no longer writes the report file; extend `kernel/tests/contract/role-contracts.test.ts` with the `every role stores its report through ingest` scenario and a check that no `roles/` prompt key is registered; verify the content test, `pnpm skill-check` and the 4 096-byte budget pass

## 6. Documentation

- [x] 6.1 Update `docs/guide/` pages for `dispatch`, `log` (`add --category`, `ingest`), `rules show --ticket` and `policy.verifier`, and any page that names `bdk-entries` or the observation cap; verify `pnpm docs:build` and the drift guards in `pnpm test:contract` pass (no `docs/guide/` page names a kernel command, `bdk-entries` or the cap: the site still describes v2 under its banner until T50, so the commands and `policy.verifier` went into `README.md`, where the v3 kernel is documented)

## 7. Acceptance

- [x] 7.1 Run the part B acceptance end to end on the E2E fixture Change: `attempt open`, `dispatch build`, `dispatch show`, `rules show --ticket`, `log add` (with a downgraded verifier blocker), `log ingest`, `attempt close --envelope`; verify every step's exit code and output against the specs (kept as `kernel/src/dispatch/tests/acceptance.e2e.ts`: an implementer and a verifier ticket, every output schema-validated)
- [ ] 7.2 Live check on Claude Code: fork `bdk:verifier` on a real package from the fixture and confirm it calls `dispatch show`, `rules show --ticket` and `log ingest --ticket` and returns the envelope; record the result in the PR description
- [ ] 7.3 Run `pnpm lint && pnpm format:check && pnpm typecheck && pnpm knip`, `pnpm skill-check`, `pnpm test:unit`, `pnpm test:e2e`, `pnpm test:contract`, `pytest tests/unit/`, `pnpm docs:build` and `openspec validate v3-t23b-dispatch-envelope --strict`; verify all pass
