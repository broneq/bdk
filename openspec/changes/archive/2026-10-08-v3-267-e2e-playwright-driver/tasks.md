# Tasks

## 1. Probe and fixtures

- [x] 1.1 Probe the eval sandbox (design D9): a throw-away eval case outside the suite, run with the pinned Claude Code 2.1.292 and with the newest version at least two weeks old, that runs `node -e "require('http').createServer().listen(5181)"` and a headless `chromium.launch()` of Playwright 1.63.0; record both outcomes (bind, launch) under "Measurements" in design.md and delete the probe case. Done when the outcome decides between eval cases and manual checks in 1.3 and 3.1.
- [x] 1.2 Write `plugins/bdk/evals/fixtures/web-hard-defects.sh` (design D9): dependency-free Node server on its own port, the Change with the scenarios "Save on a narrow screen", "Save shows Saved", "Place order once" and one working scenario, each defect seeded as in spec `bdk-e2e-check` "Playwright driver"; verify by running it in a temp dir, opening the page with a short Playwright script and seeing each defect by hand, and that `pnpm exec vitest run plugins/bdk/tests/evals.test.ts` still passes.
- [x] 1.3 Per the probe: either add the block cases `e2e-check-web-broken` (on `click-counter.sh`) and `e2e-check-web-hard-defects` with graders (`Result: fail` regex per broken scenario, `Result: pass` for the working one, `file_exists` on `add-one.webm` and a `.png`, one finding per defect, `tool_used: Skill`), or update "Manual browser check of `e2e-check`" in `plugins/bdk/evals/README.md` with both fixtures and their expected files (video included); verify with the free eval check (`pnpm exec vitest run plugins/bdk/tests/evals.test.ts`).

## 2. Config enum (breaking)

- [x] 2.1 Change the test first: `plugins/bdk/src/config/tests/domain.test.ts` accepts `playwright` and `chrome-devtools-mcp`, rejects `chrome-devtools-axi` with a message naming both allowed values, and accepts an absent field; verify it fails (`pnpm exec vitest run plugins/bdk/src/config`).
- [x] 2.2 Change the enum and its comment in `plugins/bdk/src/config/domain/settings.ts` (absent means `playwright`); verify 2.1 passes and `pnpm lint` and `pnpm typecheck` pass.

## 3. e2e-check Playwright driver (with /skill-creator)

- [x] 3.1 Eval cases before the skill text: the cases or manual checks of 1.3 run against the current skill and show what fails today (axi named, no video); record that baseline in design.md "Measurements".
- [x] 3.2 Add a test in `plugins/bdk/tests/` that the pinned Playwright version is the same in `skills/e2e-check/references/drivers.md` and `skills/setup/references/e2e.md`, and that no file under `plugins/bdk/skills`, `agents` or `evals` (outside `evals/results/`) names `chrome-devtools-axi`; verify it fails now.
- [x] 3.3 With `/skill-creator`, rewrite `references/drivers.md` "`browser`": the Playwright driver per design D2-D6 (scratch dir, resolution, launch fallback, read after each action, console and >= 400 collection, actors as a suggestion, CAPTCHA `blocked`, the recording replay and the evidence names), the MCP section with the fallback to Playwright, and the axi section removed; update `SKILL.md` (`allowed-tools` per D7, step 4 "Evidence" naming the video, step 6 removing the scratch directory, the writable paths of the intro); verify 3.2 passes and `pnpm format:check` passes.
- [x] 3.4 Try the skill in separate test projects started with `claude --plugin-dir <repo>/plugins/bdk` (outside this repository): `click-counter.sh` and `web-hard-defects.sh`, each with project Playwright absent; then `click-counter.sh` with `@playwright/test` installed in the project, and once with Playwright's Chromium cache hidden (system Chrome path) and once with no browser at all (`Verdict: BLOCKED` with the install command). Verify each against the spec scenarios of `bdk-e2e-check`; fix any miss in `drivers.md` and record it under "Measurements".
- [x] 3.5 Run the same Change once with `--permission-mode default` and confirm no driver call asks for permission; add what is missing to `allowed-tools`.

## 3a. Evidence per review round

- [x] 3a.1 Eval graders first: `auto-review-first-round/graders/e2e-ran.md` points at `.bdk/runs/monthly-report/review/round-1/e2e/verdict.md`; `fixtures/tally-reviewed.sh` writes its E2E files into `review/round-1/e2e/`; add a `spec-conformance-conforming` grader that the report names `review/round-1/e2e/verdict.md`; verify the free eval check passes.
- [x] 3a.2 With `/skill-creator`: `e2e-check` step 1 derives the E2E directory from the log (spec `bdk-e2e-check` "Input and scenarios"); `review-round` reads `<round dir>/e2e/verdict.md` (the `round.md` step and its example); `close` and `spec-conformance` read the latest `verdict.md` among `.bdk/runs/<change>/e2e/` and `review/round-*/e2e/`; verify `grep -rn "runs/<change>/e2e" plugins/bdk/skills` shows only the standalone case of `e2e-check` and the two "latest" rules.
- [x] 3a.3 Run `e2e-check-*`, `spec-conformance-*`, `close-*` and `auto-review-first-round` (grants of `evals/README.md`); all pass; record the scores in design.md "Measurements".

## 4. /bdk:setup report (with /skill-creator)

- [x] 4.1 Eval case first: add `plugins/bdk/evals/setup-web-no-playwright/` (Vite app without Playwright; graders for the "Cannot ask" path: `package.json` has no Playwright dependency after the run, the reply names Playwright 1.63.0 per run and the install command it would have run, `.bdk/settings.yaml` has `driver: browser` and no `browser:` line, skill fired, plus the shared graders of `setup-web-app`); in `setup-web-app` change `no-browser-field.md` to match any `browser:` line and add a grader on the reply naming the project's Playwright; verify the free eval check loads all five `setup-*` cases.
- [x] 4.2 With `/skill-creator`, update `skills/setup/references/e2e.md` ("`browser`" per design D8: never write the field; detect Playwright and a browser; the install commands per package manager; the report line; the pinned version) and `skills/setup/SKILL.md` (step 3: the Playwright question among the open questions, nothing installed without an answer; `allowed-tools`: exactly the install commands of D8; step 9: the Playwright line); verify 3.2 passes.
- [x] 4.3 Run the `setup-*` cases (`evals/README.md` grants, clean `HOME`) and try `/bdk:setup` interactively in separate test projects: a pnpm web app without Playwright, accepting the install (`@playwright/test` in `package.json`, Chromium installed, report says project Playwright) and once declining it (`package.json` unchanged, report says per-run Playwright); a web app that has Playwright (no question); verify the settings name no `chrome-devtools-axi`; record the scores in design.md "Measurements".

## 5. ADR and decisions doc

- [x] 5.1 Write `docs/adr/0004-e2e-browser-driver-playwright.md` in the MADR shape of 0001-0003 (context with the measured numbers, decision, the answer to #194's objection, consequences, supersedes D5); mark D5 in `docs/design/2026-10-07-v3-skills-decisions.md` (index row and section) as superseded by ADR-0004; verify the docs build (`pnpm --filter @bdk/docs docs:build`) lists the ADR and its links resolve.

## 6. Acceptance and gates

- [x] 6.1 Acceptance signal end to end: (a) the broken browser scenario of `click-counter.sh` reported with Playwright, a screenshot and a video under `## Evidence`, run alone (`.bdk/runs/add-counter/e2e/`) and with a round log (`review/round-1/e2e/`); (b) the three hard defects of `web-hard-defects.sh` reported in 3 runs out of 3, the working scenario passed; (c) `/bdk:setup` on a web app without Playwright says how it will run Playwright and no setting mentions `chrome-devtools-axi`. Measure tokens, tool calls and time of the e2e-tester runs and compare with the 60k / 244 s baseline (design D4); record under "Measurements".
- [x] 6.2 Sync the main specs (`/opsx:sync`), then run every check CI runs (`.github/workflows/pr.yml`: `pnpm check`, `pnpm exec claude plugin validate .claude-plugin/marketplace.json --strict` and the per-plugin validation step, commitlint on the commit, `pnpm --filter @bdk/docs docs:build`), `openspec validate v3-267-e2e-playwright-driver --strict` and `openspec validate --specs --strict`; all pass.
