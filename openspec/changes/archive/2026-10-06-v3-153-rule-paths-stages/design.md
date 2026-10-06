# Design

## Context

See proposal.md - Why. The current mechanics this design replaces:

- `kernel/src/rules/use-cases/selection.ts`: `selectRules` filters candidates by `isCandidate` (language gate), `readBy` (a rule's `roles`, else `ROLE_PREFIXES` for bundle rules, else every rule-reading role for project rules) and `matchOf` (any `applies` glob matches any file; no file set means a match). Order: global first, then glob specificity, `since`, prefix, number (T31 design D-5). Callers: `dispatch build`, `rules show --role`, `rules explain`, `hooks session-start` (`load.ts`, counted with no file set).
- `kernel/src/ctx/use-cases/manifest.ts` and `parts.ts`: the parts `rules(<category>)`, `language-rules` and `project-rules` render whole categories, every language pack of `languages`, and every project rule, with no selection at all.
- `pipeline/pipeline.yaml`: only the `plan-part` node carries `rules: [code-quality, architecture, test-quality, plan]`; `kernel/src/graph/use-cases/instruction.ts` renders them through `categoryText`, and `pipeline.ts` validates the names against `RULE_CATEGORIES`.
- `shared/git` already has `workTreeFiles` (`git ls-files -z -c -o --exclude-standard`), used by `rules prune` for `no-match`.
- `shared/store/glob.ts` supports `*`, `**` and `?`, no braces.
- #152 (PR #154) removed `rules import`, `rules export` and the projection, and dropped `import` from `origin`; this design starts from that state.

## Goals / Non-Goals

**Goals:**

- One selection function answers every reader: a role in a package, a session skill through `ctx`, a pipeline node through its instruction.
- What a rule file says is the whole answer to "who reads this rule"; no table keyed by prefix or category remains.
- The shipped pack's readers stay as they are, except for the symmetric additions listed in proposal.md.

**Non-Goals:**

- A cap or a ranking that drops rules (T31 D-5 stands).
- Detecting frameworks from files; `languages` stays the switch, set by `/bdk:setup`.
- Changing the `applies` of ledger `learning` entries or `prompts.files.<key>`.

## Decisions

### D-1 Fields: `paths` and `stages`, required, explicit

The rule schema replaces `applies` (optional) with `paths` (required, non-empty array of globs) and `roles` (optional) with `stages` (required, non-empty, unique, values from `design | plan | execute | review`). `paths: ["**"]` is the way to say "every file"; `stages` has no wildcard. The schema stays at version 1 and has no migration (proposal.md, Resolution).

- Alternative: optional fields with "everywhere" as the default. Lost (user): a rule that is global because nobody wrote a field is the root of the 340-rule selection; the explicit form is readable in the file itself.
- Alternative: keep `roles` as an override next to `stages`. Lost: it breaks the writer/checker symmetry the stage gives, and ties project rules to BDK's internal roles.
- Alternative: the name `phases`. Lost (user): the pipeline file already calls these four values `stage`; one word for one thing.

### D-2 The stage table lives in `shared/vocabulary`

`RULE_STAGES = ["design", "plan", "execute", "review"]` and `ROLE_STAGE: Record<Role, RuleStage | undefined>` sit next to `ROLES`, so `rules`, `ctx`, `graph` and `dispatch` share them without a slice import. Each role maps to at most one stage (`runner`, `scout`, `lead`: none). A session skill names its stage in its manifest part (`{ kind: "rules", stage: "plan" }`); a pipeline node uses its own `stage` field when that value is in `RULE_STAGES`, so `intent` and `close` nodes get no "Rules" section.

- Alternative: the table inside the `rules` slice. Lost: `graph` and `ctx` would import it from `rules`, and the stage names are pipeline vocabulary, not rule vocabulary.
- Alternative: derive a skill's stage from its name. Lost: `/bdk:adr` is not a stage; one explicit field in the manifest is clearer than a naming rule.

### D-3 One selection function, one file-set rule

`selectRules` takes `{ rules, stage, files, languages, disabled }`. A candidate is a non-tombstone, enabled rule that passes the language gate; it is selected when `stages` contains `stage` and some glob of `paths` matches some file of the file set. The file set is the target's files when the target has them (task `Files:`, part union, a review group's files, fix files), and the work tree files otherwise. There is no "no file set" case any more, so `matchedBy` is always a glob.

Callers translate before they call: `dispatch build` and `rules show --role` / `rules explain` pass `ROLE_STAGE[role]` (a role with no stage selects nothing); `ctx skill` passes the part's stage; the instruction passes the node's stage. `hooks session-start` counts per role with the work tree files.

Order keeps T31 D-5 with one restatement: a rule whose best matching glob is `**` counts as global and sorts first; the rest sort by specificity of the best matching glob, then `since`, prefix, number. Deterministic, so the package `template-hash` stays stable for an unchanged work tree.

- Alternative: keep "no file set selects every rule" for artifacts and skills. Lost: it is the path by which a Python project's plan reads TypeScript rules, and by which a design verifier read all 609 imported rules.

### D-4 Work tree files read once per command, through `shared/git`

The commands that select without a target file set (`ctx skill`, `next` for a node instruction, `dispatch build` and `rules show --ticket` for an artifact or Change target, `hooks session-start`) call `workTreeFiles` once and pass the list down; `rules show --role` and `rules explain` always name their files. Ignored paths never count; untracked, not ignored files do, so a file just created for a new module counts before it is staged. `ctx` gains a `Git` dependency; its renderer stays synchronous over a list read before rendering.

- Alternative: only tracked files (`git ls-files -c`). Lost: a new project's first files are untracked; `rules prune` already uses the wider list, and two definitions of "the project's files" would disagree.
- Alternative: a file table in the index. Lost: another rebuild path and a staleness window for a list git gives in milliseconds.
- Alternative: a filesystem walk. Lost: it has to reimplement `.gitignore`, or counts `node_modules/`.

### D-5 `nodes[].rules` goes; the node's `stage` decides

The pipeline file schema drops `nodes[].rules`; `pipeline.ts` drops its category validation. A node of stage `design` or `plan` gets a "Rules" section with the D-3 selection for its stage, in the same line form as `ctx` (`- [<id>] <text>`, followed by ` (paths: <globs>)` unless `paths` is `["**"]`). A node of `execute` or `review` gets none: the session only dispatches there, and its agents read their rules through their packages. `RULE_CATEGORIES` and `categoryText` are removed.

- Alternative: keep `nodes[].rules`, now naming stages. Lost: a node already has a `stage`; a second field could disagree with it.
- Alternative: a "Rules" section for every node of a rule stage. Lost: an `execute` or `review` instruction would repeat, for the orchestrator that writes no code, the rules its agents already get.
- Alternative: no "Rules" section at all, leaving the rules to the stage skill's `ctx`. Lost: `/bdk:run` drives design and plan nodes with no rules part in its context, so its planner would lose the `BDK-PL` rules.

### D-6 The shipped pack is rewritten once, by category

Every bundle rule gets `stages` from the category table in proposal.md (a category's stages are every stage in which some reader reads it today, so no reader loses a rule) and `paths`:

- category packs: `["**"]`, except rules that already carry `applies` (the lockfile rule), which keep their globs as `paths`;
- `languages/javascript`: `**/*.js`, `**/*.mjs`, `**/*.cjs`, `**/*.jsx`;
- `languages/typescript`: `**/*.ts`, `**/*.mts`, `**/*.cts`, `**/*.tsx`;
- `languages/react`: `**/*.jsx`, `**/*.tsx`.

The rewrite is a one-off edit of the files (a throwaway script, not committed). A contract test pins the result: for a fixture work tree, each role, skill and node reads exactly the expected ids, which encode the table.

- Alternative: per-rule judgment of stages and paths now. Lost: it mixes this mechanical change with a content review; a later audit can narrow single rules.
- Alternative: `react` without `.jsx`. Lost: JSX in `.jsx` is the plain-JavaScript React case.

### D-7 Commands and outputs follow the fields

- `bdk rules accept`: `--path <glob>` and `--stage <stage>`, both repeatable and required; `--applies` and `--role` are removed (no alias, v3 unreleased).
- `bdk rules check`: a rule file without `paths` or `stages`, or with `applies` or `roles`, is `policy/rule-format` naming the fields.
- `bdk rules show`, `rules explain`: the rule objects carry `paths` and `stages` instead of `applies` and `roles`; `rules-show.json` and `rules-explain.json` change accordingly.
- `bdk rules prune` `no-match`: unchanged logic over `paths`; a rule with `["**"]` never reports `no-match` in a non-empty work tree.
- `ctx.json`: the part kinds `language-rules` and `project-rules` disappear; a `rules` part records its stage.

### D-8 Where the `/bdk:rules` skill and the docs change

The skill's candidate proposal carries `paths` and `stages` instead of `applies`; the admission text ("narrowest `applies` globs") becomes "narrowest `paths`, and the stages in which the choice is made or checked". The guide pages and the pack convention `rules/README.md` describe the two fields and the stage table instead of prefix sets.

## Risks / Trade-offs

- [`hooks session-start` and `bdk next` gain a `git ls-files` call; both have budgets in `pnpm test:perf`] -> one call per command, matched in memory with the cached glob regexes; the perf suites `session-start.perf.ts` and `next.perf.ts` stay the gate, and a large-tree fixture is added if the existing ones are too small to show the cost.
- [Instruction and package hash now depend on the work tree: adding the first `.py` file changes the plan instruction] -> intended; "byte-identical on an unchanged Change" still holds for an unchanged work tree, and the scenario says so.
- [Symmetric stages add rules to some readers (`verifier` gains `CQ` and language rules, `/bdk:adr` gains `EJ` and `SEC`)] -> counted in the change's contract test; `rules.warn-above` still warns, and `rules.disabled` switches single rules off.
- [A project whose `.bdk/rules/` still uses `applies`/`roles` stops working] -> `bdk rules check` and `bdk doctor` name the fields to rename; v3 is unreleased, as #152 assumes for `origin: import`.
