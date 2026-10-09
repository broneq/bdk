## 1. Skill

- [x] 1.1 `plugins/bdk/skills/review-round/SKILL.md` step 4 "Integration and E2E": the integration reviewer first, both in one message, neither started after the other has returned, with the reason; description and opening line follow (design D2)

## 2. Eval

- [x] 2.1 Record a trace of `auto-review-first-round` and read how a message's tool calls appear in it
- [x] 2.2 Add the grader `auto-review-first-round/graders/integration-with-e2e.md` (design D3); correct the case description
- [x] 2.3 Run `auto-review-first-round` and `auto-review-fix-round` with the plugin (`--ablation none`); both pass
- [x] 2.4 `plugins/bdk/evals/README.md`: name the grader and record the run

## 3. Measurement

- [x] 3.1 `/bdk:run` on `household-book-queued.sh` with the method of `v3-208-measure-speed-b1` D3; read per round the start and end of every worker
- [x] 3.2 Record the result in design.md "Measurement" and the README's B1 paragraph

## 4. Docs

- [x] 4.1 `docs/concepts/orchestrators.md`, section `/bdk:review-round`: the sequence diagram's second parallel block (after the reviewers and the check run, integration reviewer first) and the prose under it
- [x] 4.2 `pnpm docs:reference`

## 5. Gates

- [x] 5.1 `pnpm check`, every job of `.github/workflows/pr.yml`, `openspec validate --specs --strict`
