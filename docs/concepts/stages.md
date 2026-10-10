# What each stage checks - and what it leaves alone

Every stage of BDK has one job, and the blocks in it are told as much what not to look at as what to look at. A design is about the product and the architecture, not code style. A review is about whether the product does what the Change promised, not about commas. This page says, per stage, what each block works from, what it produces or checks, and what it deliberately ignores.

Two principles run through all of them:

- **The author never checks its own work.** The design is checked by `bdk:verifier`, a separate agent on a fresh context; the plan the same; the code is conformed by `bdk:conformer`, not by the agent that wrote it; the specs are checked at close by a verifier that did not build the Change. A checker writes only its report, so it never ends up checking its own fix.
- **A claim is not evidence.** Verifiers check every statement about the code against the file and line it names, and treat what a design, a plan part or an implementer's report says the code does as a claim to verify, not as a fact.

## Propose

`/bdk:propose` writes `proposal.md`: why the Change is needed, what changes, the capabilities of the main specs it touches, what is out of scope, and its impact. It reads the issue or your intent and every main spec the Change touches, and the code only as far as the impact section needs to name files.

It leaves alone: how to build it and in which order (design and plan decide that), and mapping the code (design's first block does). It asks you only when two readings of the intent would change behaviour differently.

## Design

| Block | Agent | Works from | Produces or checks | Leaves alone |
|---|---|---|---|---|
| `/bdk:explore` | `bdk:explorer` (haiku) | the proposal, then the code its nouns lead to, one level of callers and callees, their tests | a code map: what the Change touches, the patterns in use, the tests, the gaps, each with a file and line | any approach or recommendation: facts only |
| `/bdk:design-draft` | `bdk:designer`; its questions reach you through the main conversation | the proposal and the map; the code itself when there is no map; the [rules](./rules.md) of stage `design` | the spec deltas with runnable scenarios, and `design.md` with each decision, its alternatives and why they lost | code, plan parts |
| `/bdk:verify-design` | `bdk:verifier` (opus) | the proposal, the deltas, the design, the map, the code, the rules of stage `design` | every claim about the code, scenario runnability, coverage of the proposal, decisions with real alternatives, concrete risks, readiness for a plan, the design rules kept | wording, style, a choice among valid alternatives the design argued |

The design is where the product's shape and the architecture are settled: where the logic lives, the shape of the data, the interfaces, how failures are handled, and the product points the proposal leaves open, such as formats, limits, defaults and what the user sees when something fails. Each such decision weighs at least two approaches, with their trade-offs and diagrams, and a self-critique of the chosen one: a bottleneck, a failure mode, a hidden cost, an unconfirmed assumption. A change to the data model is always put to you: approving a design is not approving a schema.

The specs it writes describe behaviour only: every requirement has scenarios in WHEN / THEN form that can run against the product. They become the acceptance criteria of everything after.

A design fails verification for: a false claim about the code, a requirement with no answer or one the design contradicts, a capability with no spec delta, a scenario that cannot run, an ignored failure path, a decision against the proposal, a broken design rule you did not agree to depart from.

## Plan

| Block | Agent | Works from | Produces or checks | Leaves alone |
|---|---|---|---|---|
| `/bdk:plan-draft` | `bdk:planner` | the proposal, the deltas, the design, the code the design names with its callers and tests, and the [rules](./rules.md) of stage `plan` | plan parts: the exact files of each part, the scenarios it makes true (a scenario the code already satisfies is marked ` (behaviour present)`), and tasks with the file, the interface and what verifies it | code, specs, the design, and any product choice the design left open (named as a design gap instead) |
| `/bdk:verify-plan` | `bdk:verifier` (opus) | every part, the deltas, the design, `bdk plan check`, the rules of stage `plan` for each part's files | every named symbol and path exists as written, each scenario is owned by exactly one part, the ` (behaviour present)` markers match the code, every design decision is carried out, dependencies between parts, callers of a changed interface, the plan rules kept by each part | style of the parts beyond these |

The plan cuts the work so that one agent builds a part without coming back, and so that independent parts run in parallel. Each part carries every fact it needs, because its implementer reads only the part, the specs and the design. A task never guesses a signature: every path and function it names comes from a file the planner read. Parts are held to `plan.part.max-tasks`, `plan.part.max-files` and `plan.part.max-bytes`.

### How a plan is cut

A plan is a directory of part files, `openspec/changes/<change>/plan/parts/01.md`, `02.md`, ... Each part is a slice of the work that one implementer builds alone, and its frontmatter says how it fits with the others:

| Key | What it means |
|---|---|
| `id` | The file stem, quoted: `"02"` for `02.md`. |
| `depends-on` | The parts whose output this part uses, such as `["01"]`; `[]` when none. The part starts only after they are merged. |
| `isolation` | `worktree`: the part is built in its own git worktree, in parallel with the other parts of its wave; when it is the only part of its wave left to build, it is built in the main checkout instead, since there is nothing to isolate it from. `shared`: the part changes state outside its files that a parallel part could change too (a lockfile, generated code, a migration sequence), so it is built in the main checkout, alone in its wave. |
| `files` | Every file the part creates or changes, tests included, as exact repository-relative paths. |

**Waves** follow from `depends-on` alone. A part with no dependency is in wave 1; any other part is one wave after its latest dependency. For example, with `02` and `03` depending on `01`, and `04` on `02`:

| Wave | Parts | Why |
|---|---|---|
| 1 | `01` | no dependency |
| 2 | `02`, `03` | both depend on `01` only |
| 3 | `04` | depends on `02`, which is in wave 2 |

The parts of a wave run in parallel and the next wave starts when they are merged, so the number of waves, not the number of parts, decides how long the build takes. The planner aims at the fewest waves the dependencies allow: `depends-on` lists only what a part really uses, and two parts of one wave never list the same file, so they never conflict when merged.

**When you review a plan**, read each part file for:

- `## Goal`: what works after the part, in one or two sentences.
- `## Acceptance scenarios`: the spec scenarios the part makes true. Each scenario of the deltas belongs to exactly one part.
- `## Tasks`: numbered contracts, each with the `File` it changes, the `Interface` it adds or changes, and what verifies it (`Verified by`). A task names real paths and signatures; it holds no code.
- The frontmatter: does `depends-on` name only parts whose output this one needs, and is `shared` kept for parts that really change state outside their files? Every extra edge and every shared part adds a wave.

`bdk plan check <dir>` prints the waves, a row per part with its size against the limits, and the problems it finds. What each problem means and what to do about it: [the problems of `bdk plan check`](/reference/bdk/cli#plan-check-problems).

## Execute

| Block | Agent | Works from | Produces or checks | Leaves alone |
|---|---|---|---|---|
| `/bdk:implement-part` | `bdk:implementer` (sonnet) | the part, its scenarios, the design, the [rules](./rules.md) for its files, your `CLAUDE.md` and `AGENTS.md`, the code each task builds on | acceptance tests first, seen red for the right reason, then the code, then your checks green and a changed spec delta valid (`openspec validate --strict`) | files outside the part, code no task asks for, git history (the lead commits) |
| `/bdk:conform-part` | `bdk:conformer` (sonnet) | the diff, the part, its scenarios, the rules, your project instructions | each changed line against the rules, the instructions and the tasks: the interface as specified, the test that verifies it, the code doing what the requirement says, a changed spec delta that OpenSpec accepts; fixes only what keeps behaviour (a name, a comment, dead code) | bugs and missing features (they need a test and a review), formatting a linter checks |

Your test, lint and build commands run inside each part, not after the stage: the implementer runs the new acceptance tests red before any code and all checks green after it, the conformer runs them again after its fixes, and a merge conflict is checked once resolved. Nothing checks a wave once it is merged; the first check of the whole project is the first round of review. [Where execute runs your checks](./orchestrators.md#where-execute-runs-your-checks) lists each run.

A part whose tasks contradict each other or their scenario is a plan defect: the implementer stops and says so instead of picking a side.

One acceptance test is not seen red: the test of a scenario the part marks ` (behaviour present)`. `/bdk:plan-fixes` marks a scenario so when a review finding asks for its missing test and the code already does it; the implementer expects that test to pass at its first run and reports `green at first run (behaviour present)`. When the part and the code disagree (an unmarked test passes before any code, or a marked one fails), that is a plan defect too. The lead agent only composes: it runs the parts in waves, commits, merges and keeps the state, and never writes product code.

## Review

A review round runs the group reviewers and your checks in parallel, then the spec check, the integration reviewer and the E2E check together, then the judge:

| Block | Agent | Looks for | Leaves alone |
|---|---|---|---|
| `/bdk:review-group` | `bdk:reviewer` (sonnet), one per group of files | behaviour at the edges (empty and missing values, signs and units, error paths) traced with a concrete input; tests that would not fail if the behaviour broke; changed lines that break a [rule](./rules.md) or your project instructions (`CLAUDE.md`, `AGENTS.md`, `.claude/rules/*.md` on the way to its files); outside input reaching a query, a shell, a file path or an eval unchecked; whether an earlier finding's failure still happens | formatting and style a linter checks; problems that need files outside its group |
| `/bdk:review-integration` | `bdk:integration-reviewer` (opus) | each scenario followed from the product's entry point to its result; each scenario proved by a test at a level that can prove it; contracts one part changes that another uses differently (fields, units, empty values, order, error codes, config keys, file formats); behaviour no scenario names | the line-by-line review the group reviewers did |
| `/bdk:spec-conformance --round` | `bdk:verifier` (opus) | the check of [Close](#close), run in every round so what close would refuse is fixed here: each scenario and each SHALL sentence of the spec deltas for the inputs it names (an absolute and a relative path), and behaviour a user can observe, such as an error message, that no delta describes | E2E results (the E2E tester logs its own failures); code quality |
| `/bdk:e2e-check` | `bdk:e2e-tester` (sonnet) | the running product, driven as a user would through up to 5 paths per user process the proposal adds or changes ([E2E checks](./e2e.md)) | the code: it judges only what the product shows |
| `bdk check run` | none | your test, lint and build commands | nothing else |
| `/bdk:judge` | `bdk:judge` (sonnet) | each finding traced through the code: does the failure really happen, or does a guard, a type or a test prevent it; does the rule or instruction it cites say that, for that file; then a level by what the product does | new problems; decisions (triage makes them) |

Every finding needs a failure scenario: the input and what goes wrong. The judge levels by the product's behaviour: `blocker` when the product breaks a scenario or the intent, the specs would not describe the product after archive (a spec check finding, even when the product works), a check is red, a security hole, data loss or a regression; `should-fix` when it works but breaks a rule or a project instruction, has a named maintenance cost, or a scenario the Change owes has no test; a rule broken alone is never a blocker; a failure that does not hold is `not-a-problem`, not a lower level. Details are on [findings](./findings.md).

So a review is not a proofreading pass: style a linter can check is left to the linter, and a finding that cannot show a failure is dropped by the judge.

## Close

| Block | Agent | Checks | Leaves alone |
|---|---|---|---|
| `/bdk:spec-conformance` | `bdk:verifier` (opus) | each spec delta is true of the product after the Change (each scenario followed from its entry point, each SHALL sentence for the inputs it names), no E2E path failed, removed behaviour is gone, and nothing a user can observe (a command, option, output, exit code, endpoint, page, config key) is missing from the specs | code quality, test coverage, style (reviews own them); running the product or its tests |

The specs it passes become the main specs, the living documentation, so a gap here is a gap in your documentation. Every review round runs the same check first, so close fails only on what changed after the last round.

## Debug and PR review

- `/bdk:diagnose-bug` reproduces the bug on the running product before it reads the code for a cause, names a root cause only when the code shows it, and writes the fix as a one-part Change whose spec keeps the reproduction as a scenario. It never changes what a spec promised to fit the code, and says nothing is fixed until the part is built.
- `/bdk:pr-review` runs the group reviewers, the integration reviewer and the judge on any pull request, with the pull request's title, description and linked issues as the intent; it posts one review after you agree, and fixes nothing. With several pull requests it starts one lead each and asks once for all. `--verify` re-checks the `blocker` and `should-fix` findings of your previous review at the new head and reviews the commits added since it with the same blocks, posts one review of what is left and what is new, and resolves the threads of the fixed findings.

## Sources

- `plugins/bdk/skills/*/SKILL.md` of each block named on this page, and `plugins/bdk/agents/*.md`
