## MODIFIED Requirements

### Requirement: bdk doctor

Diagnose the runtime, the layout and the state; one known repair action per finding. The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk doctor [--fix]`
- **Availability:** `read`
- **Mode:** `command`
- **Arguments:**
  - `--fix`. Apply the repairs that need no system change (index rebuild, schema refresh, modeline); never installs software.
- **Behaviour:** Checks: Node version (HOST-FACTS `node-sqlite-min`; a line older than 22 is not supported and does not reach `doctor`, the wrapper's STOP line names the minimum instead), the v2 layout with the `/bdk:setup` instruction, spec `bdk-merge-hash` mismatches, index freshness, schema modeline and offline copy. It does not check `uv`, `uvx` or any MCP server: the plugin ships none (ADR-0001). `/bdk:doctor` (T02 decision R-14) runs this and asks before every system change. Exits 0 with `ok: false` when a finding has level `warn` or `fail`, and 0 with `ok: true` and an empty `findings` list when nothing is wrong; exit 5 only when the kernel itself cannot run (`runtime/not-a-repo`). `doctor` is exempt from the Node gate of `kernel-cli`, Invocation: a Node below 22.13.0 is the `node-version` finding with level `fail`, whose `repair` is an install or switch line, never exit 5. `layout` is `v2` when any of the five paths v2 left exists, in this order `.bdk/settings.json`, `.bdk/runs/`, `.bdk/plans/`, `.bdk/design/`, `.bdk/verify-plan/` (the same list `/bdk:setup` deletes, `stage-skills`), which yields the `v2-layout` finding with level `warn`, a `summary` naming the paths found and `repair: /bdk:setup`; `v3` when `.bdk/` holds none of them; `none` without `.bdk/`. The ignore check (T32) runs in a git work tree that has `.bdk/`: `bdk-ignored` (level `fail`) when `git check-ignore --no-index` reports `.bdk/settings.yaml` as ignored, which a v2 rule ignoring `.bdk/` as a whole does, so the files BDK commits would never reach git; the summary names the rule and the file it comes from (`git check-ignore --verbose`), and the repair is `/bdk:setup`, which replaces the rule with the two ignored paths of `kernel-state`, Ignored paths. The schema checks (T12) run when `.bdk/settings.yaml` exists: `schema-modeline` (level `warn`) when a present settings file of the project or local layer has no yaml-language-server modeline or one pointing at another version than the running kernel's, and `schema-offline` (level `warn`) when `.bdk/.machine/schema/settings.json` is absent or differs from the running kernel's schema; both repair with `bdk doctor --fix`, which adds or rewrites the modeline as the file's first line (keeping the rest of the file byte for byte) and rewrites the offline copy, then reports the findings that remain. The `merge-hash` check (T30) runs when `.bdk/specs/` exists: one finding with level `fail` per `.bdk/specs/**/spec.md` whose body does not hash to its `bdk-merge-hash`, or that carries none (`kernel-state`, Living spec file); the summary names the file and says it was edited outside `spec merge`, and the repair is the command that restores the file from the last close commit that touched it, `git restore --source=$(git log -1 --format=%H --grep='^chore(bdk): close' -- <file>) -- <file>` (a wanted edit goes into a spec delta of a Change instead). It never refuses: `change close` and `spec merge` refuse on the same mismatch (`policy/merge-hash-mismatch`). The index freshness check arrives with its owner task (T14 / T20). The rule check (T31) runs when `.bdk/rules/` exists: `rules-invalid` (level `fail`) when `bdk rules check` would refuse, naming the first problem, with `repair: bdk rules check`. `.claude/rules/` belongs to the project and its host, so `doctor` never reports a file there.
- **Writes:** nothing in the Change directory (`writes[]` stays empty, as for every `read` command); with `--fix`, the first line of `.bdk/settings.yaml` and `.bdk/settings.local.yaml` and `.bdk/.machine/schema/settings.json`
- **Output:** `schema/cli/output/doctor.json`
- **Exit codes and rules:** `0, 3, 5`. No specific rule; the common rules of every command (`kernel-cli`, Exit codes and the error object).
- **Example:**

  ```bash
  bdk doctor --json
  ```

  ```json
  {
    "ok": false,
    "version": {
      "kernel": "3.0.0",
      "contract": 3,
      "node": "22.12.0"
    },
    "layout": "v2",
    "findings": [
      {
        "id": "node-version",
        "level": "fail",
        "summary": "Node 22.12.0 is below 22.13.0; node:sqlite needs a flag",
        "repair": "nvm install 24 && nvm use 24"
      },
      {
        "id": "v2-layout",
        "level": "warn",
        "summary": ".bdk/settings.json and .bdk/plans/ found",
        "repair": "/bdk:setup"
      }
    ]
  }
  ```

- **Owner:** T11
- **Slice:** `service`

#### Scenario: example run

- **WHEN** `bdk doctor --json` runs as in the example
- **THEN** the exit code is 0 and stdout validates against `schema/cli/output/doctor.json`

#### Scenario: no uv check

- **WHEN** `bdk doctor --json` runs on a machine without `uv` or `uvx` on `PATH`
- **THEN** no finding names `uv`, `uvx` or an MCP server

#### Scenario: v2 layout

- **WHEN** `bdk doctor --json` runs in a git work tree whose `.bdk/` holds `settings.json` and `plans/`
- **THEN** the exit code is 0, `ok` is `false`, `layout` is `v2`, and `findings` holds `v2-layout` with level `warn`, a summary naming `.bdk/settings.json` and `.bdk/plans/`, and `repair: /bdk:setup`

#### Scenario: Node below the minimum

- **WHEN** `bdk doctor --json` runs on a Node below 22.13.0 that loads the bundle
- **THEN** the exit code is 0, `ok` is `false` and `findings` holds `node-version` with level `fail`, the running and the minimum version in the summary, and an install or switch line as the repair

#### Scenario: healthy project

- **WHEN** `bdk doctor --json` runs on Node 22.13.0 or later in a git work tree without a v2 layout, whose settings files, if any, carry the current modeline and whose offline schema copy is current
- **THEN** the exit code is 0, `ok` is `true` and `findings` is empty

#### Scenario: settings file without modeline

- **WHEN** `bdk doctor --json` runs in a project whose `.bdk/settings.yaml` has no yaml-language-server modeline
- **THEN** the exit code is 0, `ok` is `false` and `findings` holds `schema-modeline` with level `warn` and `repair: bdk doctor --fix`

#### Scenario: fix the schema findings

- **WHEN** `bdk doctor --fix --json` runs in a project whose `.bdk/settings.yaml` has no modeline and whose offline schema copy is absent
- **THEN** `.bdk/settings.yaml` starts with the modeline of the running kernel's version followed by its previous content unchanged, `.bdk/.machine/schema/settings.json` equals `bdk config schema --json`'s schema, and neither `schema-modeline` nor `schema-offline` is among the findings

#### Scenario: policy/merge-hash-mismatch

- **WHEN** a spec file's content hash differs from its `bdk-merge-hash` (V1-7)
- **THEN** `doctor` does not refuse: the exit code is 0 and the mismatch is the `merge-hash` finding

#### Scenario: manual edit of a merged spec

- **WHEN** `bdk spec merge` wrote `.bdk/specs/auth/login/spec.md` and a line of its body is then edited by hand, and `bdk doctor --json` runs
- **THEN** the exit code is 0, `ok` is `false`, and `findings` holds `merge-hash` with level `fail` naming `.bdk/specs/auth/login/spec.md`

#### Scenario: hand-written rule file without an id

- **WHEN** `.claude/rules/naming.md` exists without an `id` in its frontmatter, `.bdk/rules/` holds only valid rules, and `bdk doctor --json` runs
- **THEN** the exit code is 0 and `findings` holds no finding that names `.claude/rules/naming.md`

#### Scenario: invalid project rule

- **WHEN** `.bdk/rules/API-1.md` carries `origin: import` and `bdk doctor --json` runs
- **THEN** the exit code is 0, `ok` is `false`, and `findings` holds `rules-invalid` with level `fail` and `repair: bdk rules check`

#### Scenario: v2 plan verification reports only

- **WHEN** `bdk doctor --json` runs in a git work tree whose `.bdk/` holds `verify-plan/` and `design/` and none of the other v2 paths
- **THEN** `layout` is `v2`, and `findings` holds `v2-layout` with level `warn`, a summary naming `.bdk/design/` and `.bdk/verify-plan/`, and `repair: /bdk:setup`

#### Scenario: v2 ignore rule

- **WHEN** `bdk doctor --json` runs in a git work tree whose `.gitignore` holds the line `/.bdk/` and whose `.bdk/settings.yaml` exists
- **THEN** the exit code is 0, `ok` is `false`, and `findings` holds `bdk-ignored` with level `fail`, a summary naming `.gitignore` and `/.bdk/`, and `repair: /bdk:setup`

#### Scenario: only the v3 paths ignored

- **WHEN** `bdk doctor --json` runs in a git work tree whose `.gitignore` holds exactly `/.bdk/.machine/` and `/.bdk/settings.local.yaml` as `.bdk` rules
- **THEN** no finding is `bdk-ignored`
