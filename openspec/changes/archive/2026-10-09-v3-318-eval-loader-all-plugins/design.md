## Context

The free eval check of D6 in `v3-189-eval-setup` runs `claude plugin eval` at `--max-cost-usd 0`: the loader parses every case and every grader, reports a case that fails to load or a grader that cannot pass with the granted tools, and the zero ceiling stops every run before it starts (exit 2, `partialReason: cost_ceiling`). It was written for `plugins/bdk/evals/` alone. Since then `plugins/bdk-craft/evals/` (#207) and `plugins/bdk-skill-kit/evals/` (#314) gained cases that no CI check loads.

Measured with the pinned Claude Code 2.1.292 on `skill-check-internal-error`:

| `case.yaml` change | Loader at zero cost |
| --- | --- |
| unparsable YAML | `✗ ... YAML parse failed`, exit 1 |
| `schema_version: "9.9"` | `✗ ... requires a newer Claude Code`, exit 1 |
| `scaffold_script: missing.sh` | no problem, exit 2 |
| unknown key, top level or under `context` | no problem, exit 2 |

So the loader alone misses a broken scaffold; the `bdk` test already runs each case scaffold for that reason.

## Goals / Non-Goals

**Goals:** every plugin's eval cases are loaded and their scaffolds run by `pnpm check`, for free, and a plugin that adds cases is covered without anyone writing a test.

**Non-Goals:** checks specific to the `bdk` suite (shared fixtures, `<block>-<case>` names and tags, launcher, `gh` stand-in) stay where they are and do not become rules for other plugins. Paid runs stay local.

## Decisions

### D1: One repository test that discovers the suites

`tests/eval-suites.test.ts` lists `plugins/*/evals/` and keeps each directory that holds a case (a subdirectory with `prompt.md` or `case.yaml`, other than `fixtures/` and `results/`). It imports nothing from any plugin; it only spawns the pinned loader and bash on their files, so "plugins never import from each other" holds.

Alternatives: one test per plugin, copied from `plugins/bdk/tests/evals.test.ts`. Lost: about a hundred lines of spawn and parsing code copied three times and drifting, and a plugin that adds its first case without copying the test is silently unchecked again - the exact gap of this issue. A shared helper that each plugin's test imports would be a cross-plugin import.

### D2: Grants per plugin, listed in the test, with a completeness check

The loader checks graders against the tools passed with `--allow-tools`, and each plugin's eval README recommends its own grants: `bdk` `Write Edit`, `bdk-craft` `Write Edit Bash`, `bdk-skill-kit` `Bash Edit`. The test holds a map from plugin name to those grants and fails, naming the plugin, when a suite has no entry.

Alternatives: grant the union to every plugin - lost, because a `bdk` case whose grader needs `Bash` would pass CI while the README's command cannot pass it. Parse the grants from each README - lost, the `bdk` README holds many commands with different grants, so the parse would be a guess. A new grants file in each `evals/` - lost, a format of our own beside the loader's, for three short lists; the map with its completeness check fails just as loudly when a new suite appears.

### D3: The test runs every case scaffold

Loading at zero cost never runs a scaffold (table above), so the test runs each case's `scaffold_script` the way the harness does (empty directory, only `PATH`, a temporary `HOME` and `TMPDIR`, `TERM=dumb`) and fails on a missing script, a non-zero exit or stderr output, naming the plugin and the case. This moves the case-scaffold check of `plugins/bdk/tests/evals.test.ts` into the shared test unchanged; the shared-fixture check stays in the `bdk` test, because shared fixtures are a rule of the `bdk` suite only.

### D4: The planted broken-case check moves with the loader check

The proof that the check catches a broken case (a planted case with an unknown frontmatter key and one whose grader needs an ungranted tool) runs once, against a copy of one real suite, in the shared test. One proof is enough: every suite goes through the same `load` and `problems` functions.

### D5: Unknown `case.yaml` keys are not checked

The loader strips unknown `case.yaml` keys without a word (table above), unlike unknown `prompt.md` frontmatter keys, which fail to load. The test does not add its own `case.yaml` schema: it would be a copy of the loader's schema that drifts with each Claude Code upgrade. A misspelled `scaffold_script` is still caught in practice when the case's graders need the workspace the scaffold builds; the remaining gap is the loader's to close.

## Risks / Trade-offs

- [The test takes longer as suites grow] → loading is about one second per suite; scaffolds are the cost, and those of `bdk` already ran before this change.
- [A plugin's README changes its grants and the map does not] → the map's comment names the README as the source; a grader the new grants need fails the check, which points at the map.
