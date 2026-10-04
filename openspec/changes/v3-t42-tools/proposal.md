# Proposal

## Why

Plan: docs/V3-IMPLEMENTATION-PLAN.md, T42 (Delivery, Change 4). Tracks #62.

The tools skills of the `bdk` plugin are still the v2 skills under the default `skills/` directory. They call no kernel, write to places v3 no longer owns (`.claude/rules/` by hand), and one of them (`commit`) is only a pointer to another plugin's skill. The final inventory (`docs/V3-SKILL-INVENTORY.md`, 13.1) lists eight tools skills under `skills/tools/`. Two are done (`cr`, `pr-review`, Changes 1-3 of T42). This Change delivers the other six and removes the v2 skills they replace.

## What Changes

- **`/bdk:commit`** moves to `skills/tools/commit/` and becomes BDK's own skill. It writes a conventional commit of the user's changes from the diff and the project's commit convention, stays model-invocable (13.1), and stops delegating to `/caveman:caveman-commit` (user decision 2026-10-04). Inside a Change it does not replace `bdk commit`, which commits tasks and review fixes.
- **`/bdk:docs`** (new) merges `update-docs` and `explain-complex-code` (OD-13 (b)). It has a create mode that writes architecture documentation for a module, and a refresh mode that brings an existing document back in line with the code. Stateless.
- **`/bdk:rules`** (new) merges `add-rule` and `refine-rules` over the T31 kernel commands (R-3, Q-4..Q-6). Its `audit` mode reads `bdk rules stats`, proposes rules and adopts each accepted one with `bdk rules accept`. Its `capture` mode records a lesson: as a `learning` entry inside a Change, or as a proposal for `rules accept` outside one. Its `check` mode runs `rules check`, `prune` and the projection check. It creates a rule only through `rules accept`. It removes one only on the user's approval, by setting `removed` so a tombstone stays, as `rules prune` prescribes.
- **`/bdk:adr`** (new) replaces `create-adr` (OD-1 (b)). It writes one MADR record to `docs/adr/` from either a free-form decision or a `decision` entry of a Change's ledger (user decision 2026-10-04). `design` does not grow a separate exporter.
- **`/bdk:doctor`** (new, R-14) runs `bdk doctor --json` and walks the findings, one repair per finding. It applies `bdk doctor --fix` for the repairs that need no system change, and asks before every system change.
- **`/bdk:bdk-cli`** (new, R-13) is a thin pointer to the kernel: when to reach for it, the invocation form, and `--help` as the only reference. It stays at most 30 lines.
- **BREAKING (skill names)**: `/bdk:add-rule`, `/bdk:refine-rules`, `/bdk:update-docs`, `/bdk:explain-complex-code` and `/bdk:create-adr` are removed. Their replacements are `rules`, `docs` and `adr`. The Python scripts of `refine-rules`, their pytest tests and the legacy evals of the removed skills go with them.
- The `ctx skill` manifest gains the new skills and drops the removed ones. `README.md`, the user guide and STARTUP name the new skills. The `skill-check` baseline drops the entries of every removed or rewritten file.

Out of scope:

- `debug` and `test-driven-development`, which `bdk-craft` replaces (`debugging`, `tdd`), and `mermaid-drawer`, which `bdk-craft` takes over. They move or go in `v3-t42-craft` (Change 5), so no skill is missing in between (user decision 2026-10-04).
- The second plugin and its marketplace entry (`v3-t42-craft`).
- `bin/bdk`, the short command name (T52, #119).
- The final README tables (T32).

## Capabilities

### New Capabilities

- `tools-skills`: the shape and behaviour of the tools skills `commit`, `docs`, `rules`, `adr`, `doctor` and `bdk-cli` of the `bdk` plugin, as `review-skills` holds `cr` and `pr-review`.

### Modified Capabilities

None. The kernel commands these skills call (`rules *`, `doctor`, `log add`, `log show`) are unchanged. `hooks skill-exists` stays as the mechanism for a skill that needs another skill, even though `commit` no longer uses it.

## Impact

- **New skill directories**: `skills/tools/{commit,docs,rules,adr,doctor,bdk-cli}/`.
- **Removed**:
  - `skills/{commit,add-rule,refine-rules,update-docs,explain-complex-code,create-adr}/`;
  - `tests/unit/skills/refine-rules/`;
  - `tests/evals/skills/{add-rule,refine-rules}/` and any legacy evals of the other removed skills.
- **Kernel**: `kernel/src/ctx/use-cases/manifest.ts` (manifest entries), the ctx snapshot, `kernel/tests/support/plugin-skills.test.ts`. A new contract test `kernel/tests/contract/tools-skills.test.ts`.
- **Docs**:
  - `README.md` (Skills and Removed skills tables);
  - `STARTUP_INSTRUCTIONS.md`, `CONTRIBUTING.md` and `CLAUDE.md` where they name removed skills;
  - `docs/guide/` (skills reference, the docs-and-decisions, rules-hygiene and troubleshooting pages, installation);
  - `.claude/rules/skills.md` (the `skill-exists` example);
  - `.claude/skills/docs-sync/references/docs-map.md`.
- **Config**: `skill-check.baseline.json` pruned; `pyproject.toml` if it names the removed scripts.
