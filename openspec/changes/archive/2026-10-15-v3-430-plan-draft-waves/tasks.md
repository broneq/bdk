## 1. Eval case

- [x] 1.1 Confirm `plan-draft-household-book` reaches the path: its `plan-check-clean` grader fails a plan of more than three waves; the room is read from the final `bdk plan check` of each kept workspace

## 2. Skill

- [x] 2.1 With /skill-creator, rewrite `plan-draft` step 3: a function another feature's part calls is a contract in a wave-1 part, work no other part uses leaves the early parts, the longest chain is walked, every part keeps one eighth of `plan.part.max-bytes`; step 5 checks the room, step 6 may use it

## 3. Measurement

- [x] 3.1 Run `plan-draft-household-book` 3 times on `sonnet`, `--ablation none --keep-temp`; read the waves and each foundation part's bytes; record cost, time and result in design "Measurement" and `plugins/bdk/evals/README.md`

## 4. Docs

- [x] 4.1 `docs/concepts/stages.md`, "How a plan is cut": shared functions in wave 1, leaf work later, room in each part; no diagram draws the cut
- [x] 4.2 `pnpm docs:reference`

## 5. Gates

- [x] 5.1 `pnpm check`, `openspec validate --specs --strict`, sync and archive
