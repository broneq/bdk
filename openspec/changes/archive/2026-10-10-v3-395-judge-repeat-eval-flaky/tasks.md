# Tasks

## 1. Skill text

- [x] 1.1 With `/skill-creator`: `judge`, `review-group`, `review-integration`, `triage` - no backtick, `$` or backslash in the text of `--summary`, `--evidence`, `--reason`; the `review-group` evidence example without backticks (design D1, D2)

## 2. Eval case

- [x] 2.1 `judge-previous-repeat/scaffold.sh`: the later finding's evidence quotes code in backticks (design D3)

## 3. Measurement

- [x] 3.1 Run `judge-*` 10 times, `review-*` and `triage-*` once; record the probe and the runs in `plugins/bdk/evals/README.md`

## 4. Docs

- [x] 4.1 No user-visible change: Docs-impact none; run `pnpm docs:reference`

## 5. Gates

- [x] 5.1 Run every CI check (`.github/workflows/`), `openspec validate v3-395-judge-repeat-eval-flaky --strict` and `openspec validate --specs --strict`
