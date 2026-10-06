## MODIFIED Requirements

### Requirement: bdk rules accept

Adopt a rule: the user's explicit decision, the only path by which a rule file is created. The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk rules accept <text> --prefix <PREFIX> [--kind house|knowledge] [--severity critical|high|medium|low] [--applies <glob>] [--role <role>] [--from <ref>] [--source <text>] [--verified <date>]`
- **Availability:** `orchestrator`
- **Mode:** `command`
- **Arguments:**
  - `<text>` (required). The rule text, one choice stated as an instruction; `-` reads it from stdin.
  - `--prefix <PREFIX>` (required). An existing or new project prefix; never `BDK`.
  - `--kind house|knowledge`. Default `house`.
  - `--severity critical|high|medium|low`. Default `medium`.
  - `--applies <glob>`. Repeatable; absent means global.
  - `--role <role>`. Repeatable; absent means the default of project rules.
  - `--from <ref>`. Repeatable; a qualified entry id (`<changeId>/L-...`) or attempt finding the rule comes from.
  - `--source <text>`, `--verified <date>`. Required with `--kind knowledge` and refused without it (`policy/rule-format`).
- **Behaviour:** Writes `.bdk/rules/<PREFIX>-<n>.md` where `<n>` is one above the highest number of the prefix, tombstones included, so a number is never reused; `origin` is the first `--from` ref, or `user` without one, and `evidence` holds every `--from` ref; `since` is today. Every `--from` ref must resolve in the index (`input/not-found`). Runs no model and proposes nothing: the audit skill (T42) calls it only after the user accepted the proposal, and the orchestrator-only guard keeps subagents from calling it (T3). Works without an active Change, because the audit runs in its own session. No other command or hook writes a rule file (`kernel-state`, Write map). Before its first write it creates `.bdk/.prettierrc` when the file is absent and never changes an existing one (`kernel-state`, Formatter guard).
- **Writes:** `.bdk/rules/`, `.bdk/.prettierrc`
- **Output:** `schema/cli/output/rules-accept.json`
- **Exit codes and rules:** `0, 2, 3, 4, 5`. Specific rules: `input/not-found`, `policy/rule-format`, `policy/duplicate-rule-id`, `state/corrupted-index`; plus the common rules of every command (`kernel-cli`, Exit codes and the error object).
- **Example:**

  ```bash
  bdk rules accept "Write paths go through command handlers; queries never mutate (CQRS)." --prefix ARCHP --applies "src/**" --from 2026-09-25-passwordless-login/L-m2x9v7qa --json
  ```

  ```json
  {
    "id": "ARCHP-1",
    "path": ".bdk/rules/ARCHP-1.md",
    "origin": "2026-09-25-passwordless-login/L-m2x9v7qa"
  }
  ```

- **Owner:** T31
- **Slice:** `rules`

#### Scenario: example run

- **WHEN** `bdk rules accept ... --json` runs as in the example
- **THEN** the exit code is 0 and stdout validates against `schema/cli/output/rules-accept.json`

#### Scenario: input/not-found

- **WHEN** `--from` names an entry the index does not hold
- **THEN** the exit code is 3, the error object carries `rule: input/not-found`, and nothing is written

#### Scenario: policy/rule-format

- **WHEN** `--kind knowledge` is given without `--verified`, or `--prefix BDK`
- **THEN** the exit code is 2 and the error object carries `rule: policy/rule-format`

#### Scenario: policy/duplicate-rule-id

- **WHEN** `rules check` already fails with a duplicate id for the prefix
- **THEN** the exit code is 2, the error object carries `rule: policy/duplicate-rule-id`, and nothing is written

#### Scenario: state/corrupted-index

- **WHEN** the SQLite index cannot be opened while `--from` refs are resolved
- **THEN** the exit code is 4 and the error object carries `rule: state/corrupted-index`

#### Scenario: numbers are never reused

- **WHEN** the project holds `API-1`, the tombstone `API-2` and `API-3`, and `rules accept ... --prefix API` runs
- **THEN** it writes `API-4`

#### Scenario: subagent cannot adopt

- **WHEN** a subagent runs `bdk rules accept ...` through Bash
- **THEN** the `pre-tool` hook denies the call and no rule file is written

#### Scenario: formatter guard created

- **WHEN** `bdk rules accept "Use the shared serializer" --prefix API --kind house --severity medium` runs successfully in a project without `.bdk/.prettierrc`
- **THEN** `.bdk/.prettierrc` exists with the guard content of `kernel-state`, Formatter guard, and running the command again leaves its bytes unchanged

#### Scenario: no host file written

- **WHEN** `bdk rules accept "Use the shared serializer" --prefix API --applies "src/api/**"` runs in a project whose `.claude/rules/` holds `naming.md`
- **THEN** the exit code is 0, `.bdk/rules/API-1.md` exists, the output has no `projection` field, and `.claude/rules/` holds only `naming.md`, byte for byte unchanged

## REMOVED Requirements

### Requirement: bdk rules import

**Reason**: The import cut hand-written `.claude/rules/*.md` files into one rule per top-level bullet and turned `paths:` loading hints into hard `applies` scopes. In a real project it produced 609 rules from 25 files and 340 rules for one file, all `kind: house`, without a review step (#153). `.claude/rules/` is the project's own Claude Code mechanism and stays separate from `.bdk/rules/`.

**Migration**: Keep hand-written rules in `.claude/rules/`, where Claude Code loads them. Adopt a rule for BDK agents one at a time with `bdk rules accept "<text>" --prefix <PREFIX> [--applies <glob>]`. Rules an earlier import wrote carry `origin: import`, which `bdk rules check` now refuses: set `origin: user` in each file you keep, and delete the others.

### Requirement: bdk rules export

**Reason**: The projection wrote BDK's project rules into `.claude/rules/bdk-generated*.md`, a directory the project owns, so Claude Code loaded imported rules twice from two sources of truth, and the union of every `applies` made the scoped file load almost always (#152). BDK agents read their rules through `bdk rules show`, which needs no projection.

**Migration**: Delete `.claude/rules/bdk-generated.md` and `.claude/rules/bdk-generated-scoped.md`. Nothing regenerates them; `bdk rules accept` no longer writes them and `bdk doctor` no longer reports them.
