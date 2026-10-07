## 1. `tools.e2e[].browser` in the configuration

- [x] 1.1 Failing tests first in `plugins/bdk/src/config/tests/domain.test.ts`: `browser: chrome-devtools-mcp` on an e2e item is valid, `browser: playwright` is a problem naming `tools.e2e.<id>.browser` with the allowed values, and `resolveKey("tools.e2e.web.browser")` resolves; see them fail with `pnpm exec vitest run plugins/bdk/src/config`
- [x] 1.2 Add the optional enum to the `E2e` item in `plugins/bdk/src/config/domain/settings.ts` (design D9); the tests of 1.1 pass

## 2. Eval cases first

- [x] 2.1 Write the shared fixture `plugins/bdk/evals/fixtures/tally-cli.sh` (Node CLI, `.bdk/settings.yaml` with a `cli` entry, `openspec/` with the Change `add-total`: two drivable scenarios, one broken in the product, one internal scenario; git commit) and the cases `e2e-check-cli-broken` and `e2e-check-no-e2e` (design D10)
- [x] 2.2 Write the web project (static page and a small Node server, `browser` entry, a counter button that does nothing); planned as case `e2e-check-web-broken`, moved to `fixtures/click-counter.sh` in 4.4 (an eval run cannot bind a local port)
- [x] 2.3 Run the free check `pnpm exec vitest run plugins/bdk/tests/evals.test.ts`; it loads the new cases and runs the new scaffolds; confirm the cases fail without the skill (one paid probe without the plugin, `--runs 1`)

## 3. The block

- [x] 3.1 Build `plugins/bdk/skills/e2e-check/SKILL.md` with `/skill-creator` (design D1-D7): `!` config block, input, scenarios, start/ready/stop, drive, evidence files, findings, skipped path, reply; `references/drivers.md` for `cli`, `http`, `browser` (axi and MCP)
- [x] 3.2 Write `plugins/bdk/agents/e2e-tester.md` (sonnet, `skills: [e2e-check]`, `disallowedTools: Edit, NotebookEdit`)
- [x] 3.3 Run `bdk-skill-kit:skill-check` on the skill and the agent and fix every finding; `claude plugin validate plugins/bdk --strict` passes
- [x] 3.4 Add the setup rule for `browser` to `plugins/bdk/skills/setup/references/e2e.md` (design D9)
- [x] 3.5 Add the e2e cases, their grants and run command to `plugins/bdk/evals/README.md`

## 4. Acceptance end to end

- [x] 4.1 Build the plugin; in a test project scaffolded from `tally-cli.sh` outside this repository, run `claude -p` with `--plugin-dir plugins/bdk` asking to check `add-total` end to end; check the finding for the broken scenario, `Result: pass` for the working one, `not-driven` for the internal one, `Verdict: FAIL`, and an unchanged `git status` outside `.bdk/runs/`
- [x] 4.2 Same project, through the agent: ask the session to have `bdk:e2e-tester` check the Change; check the agent writes the files (no host refusal) and replies with the verdict line
- [x] 4.3 Web project from `fixtures/click-counter.sh`: the browser finds the dead button; no `chrome-devtools-axi` session or server is left running
- [x] 4.4 Run the eval cases with and without the plugin (`--runs 1`), fix the skill or graders until they pass, record scores, time, cost and host problems under "Measurements" in design.md
- [x] 4.5 Run every CI check (`pnpm check`, `claude plugin validate` of the marketplace and every plugin, the rest of `.github/workflows/`), `openspec validate v3-194-e2e-check-block --strict` and `openspec validate --specs --strict`
