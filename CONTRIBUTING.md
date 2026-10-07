# Contributing to BDK

BDK v3 is being rebuilt on `staging/v3`; this guide will describe its conventions once they exist. Until then, the way of working is the `## SDLC` section of `CLAUDE.md`.

## Checks

Node >= 22.18 and pnpm (the version in `package.json` `packageManager`; `corepack enable` provides it).

```bash
pnpm install
pnpm check        # lint, format check, typecheck, tests, build - the `check` job of PR CI
pnpm format       # rewrite files the format check rejects
pnpm exec claude plugin validate .claude-plugin/marketplace.json --strict
pnpm exec claude plugin validate plugins/<name> --strict   # the `plugins` job, per plugin
pnpm --filter @bdk/docs docs:dev                          # docs site with live reload
```

Commits follow Conventional Commits; the `commitlint` job checks every commit of a PR, and release-please builds versions and changelogs from them.

## Trying a change

Build first, then run a plugin from this repository in a separate test project, never in this repository:

```bash
pnpm build
claude --plugin-dir ~/projects/bdk/plugins/<name>
```

## Evals

Skills are measured with `claude plugin eval`, locally only, because every run is paid. How to run the suite and write a case: [`plugins/bdk/evals/README.md`](plugins/bdk/evals/README.md).
