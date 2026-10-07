# Design

## Context

`plugins/bdk` holds the CLI frame (#178) and the slices `config` (#179), `findings`, `git` and `run`. `config` already validates `languages` (kebab-case names) and `rules.disabled` (rule names) and exposes `loadConfig` through its `index.ts`. Draft 1 shipped a rule pack (`draft/v3-1:rules/`, 90 files: 86 from the v2 bullets and later additions, 4 plan rules) selected by a kernel; its README describes the frontmatter (`schema`, `id`, `kind`, `paths`, `stages`, `severity`, `origin`, `since`, `source`, `verified`). The measurement behind it is archived as `docs/v3-draft1/evals/V3-EVAL-RULES-NOOP.md`; the migration report (`draft/v3-1:docs/V3-RULES-MIGRATION.md`) kept every bullet that was not a measured no-op, 85 of 131, and kept all security bullets by a user exception.

Parallel tasks touch the same frame: #183 adds a repeatable string flag (`Flag.multiple`) and #185 and #183 map `loadConfig` states to `env/not-configured` and `env/config-invalid` (messages between the task agents, 2026-10-07).

## Goals / Non-Goals

**Goals:**

- One rule file format for the BDK pack and project rules, validated the same way.
- A pack that holds only rules with a measured effect, with the measurement named in each file and checked by a test.
- `bdk rules for` computes the selection deterministically; the skill puts the text into the prompt.

**Non-Goals:**

- No prompt assembly, no rule budget per prompt, no judge lookup by id (the blocks that read rules land in their own issues).
- No re-measurement of the dropped rules and no measurement harness in this repository; `/bdk:add-rule` and `/bdk:refine-rules` own adding and pruning rules later.
- No `bdk config check` validation of `.bdk/rules/`; the one reader of the files reports their problems.

## Decisions

### D1. Which draft rules survive: the 16 with a measured effect

The issue's acceptance signal ("only rules with measured effect are kept") and the design section "Rules" ("a rule stays in the pack only while a measurement shows that it changes the outcome") are stricter than draft 1's admission, which kept everything that was not a measured no-op. A measured effect exists for two classes of `V3-EVAL-RULES-NOOP.md`:

- `effective` (13): M2 `with` detects the seeded violation measurably more often than `without`, beyond the A/A noise floor. Bullets `architecture.04`, `.05`, `code-quality.01`, `.04`, `design-patterns.03`, `.05`, `.09`, `javascript.18`, `react.02`, `.10`, `.11`, `.18`, `typescript.13`.
- `corrects the model` (3): M1 WRONG for at least one model after the spot-check corrections: `react.15`, `react.16`, `react.20`. `design-patterns.14` was in this class before the spot-check and moved to `unclear`, so it is out.

They keep their draft ids (`BDK-ARCH-3`, `BDK-ARCH-4`, `BDK-CQ-1`, `BDK-CQ-4`, `BDK-DP-2`, `BDK-DP-4`, `BDK-DP-8`, `BDK-JS-8`, `BDK-REACT-2`, `-9`, `-10`, `-14`, `-15`, `-17`, `-19`, `BDK-TS-7`) and their draft text, so each traces to the migration report and the measurement row; the gaps in the numbering are the dropped rules.

Dropped: 52 `unclear` bullets (17 of them with `with` ahead within noise of 5 runs), the no-op candidates, the security bullets (all 9 measured no-op: the reviewer finds them without the rule; draft 1 kept them by a user exception that the v3 rule does not carry), `BDK-CQ-9` (lockfiles, added after the measurement) and the plan rules `BDK-PL-1` to `-4` (never measured). A dropped rule comes back through a measurement that shows its effect.

Alternatives: draft 1's admission (85 rules) - lost: it keeps 69 rules without measured effect against the acceptance signal, and the aggregate `with` gap of 0.25 does not say which bullets carry it. Keeping `unclear` bullets whose `with` median leads - lost: the report itself calls that within noise. Re-measuring now - lost: out of scope, paid, and the draft harness is not in this line.

### D2. Rule file format: id from the file name, a minimal frontmatter

Fields: `kind`, `paths`, `stages`; `source` and `verified` for `knowledge`; optional `measured` (`report`, `bullet`, `class`). The id is the file name, so a file cannot disagree with its id. Dropped draft fields: `schema` (one format, no consumer of a version), `id` (the file name), `severity` (no consumer; the judge levels findings), `origin` (derived from where the file lives), `since` (git history). The frontmatter is parsed with `yaml` (already a dependency) and validated with one zod `strictObject`, the pattern of `config` D1; a `knowledge` rule without `source` or `verified` is a refinement of that schema.

Alternatives: draft 1's full frontmatter - lost: five fields with no reader. Directory-derived stages (draft README table) - lost: a project rule has no category directory, and a field in the file reads the same in both places.

### D3. Admission is checked by a test, not by the CLI

Every pack rule names `measured.report`, `.bullet` and `.class`; a workspace test reads each pack file, opens the report and requires a row of its "Per bullet" table whose first cell is the bullet and whose class cell is the class, and that the class is `effective` or `corrects the model`. The CLI does not read `measured`: it selects, it does not judge admission (spec `bdk-cli`, "Commands help, they never govern"). Project rules may carry `measured` and are not checked: a team decides its own rules.

Alternatives: a table in `rules/README.md` - lost: a second list beside the files that drifts; the field is next to the rule it admits. No check at all - lost: the acceptance signal would rest on review.

### D4. Language packs by directory, the same convention for project rules

A rule under `languages/<name>/` belongs to the language pack `<name>`, in the BDK pack and under `.bdk/rules/` alike; the directory name is the name `languages` lists. A configured language with no rule in either place gives a warning, so a typo or a language BDK ships no rules for is visible, not silent.

Alternative: a `language` field - lost: the directory already groups the pack, and a field could contradict it.

### D5. Project rule ids may not start with `BDK-`

A project id starting with `BDK-` is an `env/invalid-rule`. Pack and project ids then never collide, and `rules.disabled` names one rule unambiguously. To change a BDK rule, a project disables it and adds its own.

Alternative: a project rule with a pack id overrides the pack rule - lost: a silent override is harder to see than disable-and-add, and a pack update would then change nothing for that project without any sign.

### D6. Command shape: `--stage` and the repeatable `--files`

`bdk rules for --stage <stage> [--files <file>]...`, as the design section "CLI" names it. `--files` uses the repeatable string flag that #183 adds to the frame (`Flag.multiple`, list values in `Input.flags`, `(repeatable)` in help); this Change implements the same shape so it does not wait for #183, and whichever merges second keeps one copy. Without `--files` the path condition is dropped: a design has no file set, and the stage and language conditions still apply. Files are made relative to the project root (`config`'s root), so a skill may pass paths from `bdk git groups` or absolute paths.

Alternatives: a variadic positional argument (`bdk rules for --stage review a.ts b.ts`) - lost: a second list mechanism in the frame next to #183's, and the documented surface names `--files`. Reading the list from stdin with `-` - lost: the list of a review group fits the command line (62 files in B1), and #182 owns the stdin boundary.

### D7. Glob matching with `minimatch`

Rule `paths` are matched with `minimatch` 10.2.6 (`dot: true`), already in the lockfile through ESLint, typed, ESM. `*` stays within a segment, `**` crosses directories, braces work.

Alternatives: `node:path` `matchesGlob` - lost: experimental on Node 22.18, the supported minimum. A hand-written matcher - lost: globs have edge cases a library already covers. `picomatch` - lost: needs separate types.

### D8. Errors and states

`loadConfig` states map to `env/not-configured` (hint `/bdk:setup`) and `env/config-invalid` (hint `bdk config check`), the codes #183 and #185 use. A missing pack directory (a broken install) is `env/no-rule-pack`, so it never passes as an empty pack. An invalid rule file, one listed but unreadable (a dangling link), or a second rule with the same id in one origin is `env/invalid-rule` naming the file (relative to the root, or the pack path) and the problem; a broken pack file is caught by the workspace tests before release, so one code covers both origins. An unknown id in `rules.disabled` is a warning with the closest id, as `rules.disabled` may name a rule a later pack removes. A file outside the project root gives a warning: it stays in `files` but no rule path can match it. All warnings are part of the result (as `bdk run status` does) and print after the rules in text mode.

### D9. Slice layout and wiring

```
src/rules/
  index.ts            rulesGroup(deps)
  commands/for.ts     --stage, --files -> input; render or JSON
  use-cases/for.ts    loadConfig (config/index.ts), read pack and project rules, select
  domain/rule.ts      rule file schema (zod), parse frontmatter text, kinds, stages
  domain/select.ts    selection, ordering, warnings (pure)
  store/rules.ts      walk a rules directory with shared/fs, return files and texts
  render/for.ts       Markdown text for a prompt
  schema/for.ts       zod schema of the --json result
  tests/              unit tests with an in-memory Files
```

`main.ts` passes `{ files, cwd, home, env, pack }`, where `pack` is `rules/` next to `dist/` (`new URL("../rules", import.meta.url)` in the bundle). `src/slices.ts` gains the row `rules: { imports: ["config"] }`. `pnpm build` copies nothing: the release snapshot already contains every non-dev file of the plugin directory, `rules/` included.

### D10. Text output

```
BDK rules for stage review: 3 rules, 2 files

## BDK-CQ-1
house; applies to src/a.ts, src/b.tsx

**Naming.** Descriptive identifiers; ...
```

A `knowledge` rule's line adds `verified <date>, source <url>`. Without `--files` the line reads `applies to any file of the stage`. The text is Markdown a skill can paste into a prompt as it is; the matched files tell a reviewer where each rule applies.

## Risks / Trade-offs

- [16 rules, 6 of them general, may lower detection against the full draft pack, whose aggregate gap was 0.25] -> the acceptance signal rules it; the dropped rules return by measurement, and the review blocks' evals (later issues) measure the reviewer with this pack.
- [The measurement is of a one-turn TypeScript/React review; the stages `design`, `plan`, `execute` of the kept rules are draft 1 routing, not measured] -> kept as draft 1 set them (writer and checker read the same rules); a stage-level eval of a block can narrow them.
- [The frame change overlaps #183] -> same shape agreed; conflict resolution keeps one copy.
- [A symbolic link to a directory under `.bdk/rules/` is not followed: `shared/fs` `list` reports it as a file entry] -> its `.md` files are not read; following links (with loop detection) is a change to the shared boundary, left for a project that needs it.
- [Knowledge rules age (`verified` 2026-09-30)] -> the date is in the output; `/bdk:refine-rules` owns re-checking.
