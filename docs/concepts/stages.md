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
| `/bdk:design-draft` | main conversation | the proposal and the map; the code itself when there is no map | the spec deltas with runnable scenarios, and `design.md` with each decision, its alternatives and why they lost | code, plan parts |
| `/bdk:verify-design` | `bdk:verifier` (opus) | the proposal, the deltas, the design, the map, the code | every claim about the code, scenario runnability, coverage of the proposal, decisions with real alternatives, concrete risks, readiness for a plan | wording, style, a choice among valid alternatives the design argued |

The design is where the product's shape and the architecture are settled: where the logic lives, the shape of the data, the interfaces, how failures are handled, and the product points the proposal leaves open, such as formats, limits, defaults and what the user sees when something fails. Each such decision weighs at least two approaches, with their trade-offs and diagrams, and a self-critique of the chosen one: a bottleneck, a failure mode, a hidden cost, an unconfirmed assumption. A change to the data model is always put to you: approving a design is not approving a schema.

The specs it writes describe behaviour only: every requirement has scenarios in WHEN / THEN form that can run against the product. They become the acceptance criteria of everything after.

A design fails verification for: a false claim about the code, a requirement with no answer or one the design contradicts, a capability with no spec delta, a scenario that cannot run, an ignored failure path, a decision against the proposal.

## Plan

| Block | Agent | Works from | Produces or checks | Leaves alone |
|---|---|---|---|---|
| `/bdk:plan-draft` | main conversation | the proposal, the deltas, the design, and the code the design names with its callers and tests | plan parts: the exact files of each part, the scenarios it makes true, and tasks with the file, the interface and what verifies it | code, specs, the design, and any product choice the design left open (named as a design gap instead) |
| `/bdk:verify-plan` | `bdk:verifier` (opus) | every part, the deltas, the design, `bdk plan check` | every named symbol and path exists as written, each scenario is owned by exactly one part, every design decision is carried out, dependencies between parts, callers of a changed interface | style of the parts beyond these |

The plan cuts the work so that one agent builds a part without coming back, and so that independent parts run in parallel. Each part carries every fact it needs, because its implementer reads only the part, the specs and the design. A task never guesses a signature: every path and function it names comes from a file the planner read. Parts are held to `plan.part.max-tasks`, `plan.part.max-files` and `plan.part.max-bytes`.

## Execute

| Block | Agent | Works from | Produces or checks | Leaves alone |
|---|---|---|---|---|
| `/bdk:implement-part` | `bdk:implementer` (sonnet) | the part, its scenarios, the design, the [rules](./rules.md) for its files, your `CLAUDE.md` and `AGENTS.md`, the code each task builds on | acceptance tests first, seen red for the right reason, then the code, then your checks green | files outside the part, code no task asks for, git history (the lead commits) |
| `/bdk:conform-part` | `bdk:conformer` (sonnet) | the diff, the part, its scenarios, the rules, your project instructions | each changed line against the rules, the instructions and the tasks: the interface as specified, the test that verifies it, the code doing what the requirement says; fixes only what keeps behaviour (a name, a comment, dead code) | bugs and missing features (they need a test and a review), formatting a linter checks |

A part whose tasks contradict each other or their scenario is a plan defect: the implementer stops and says so instead of picking a side. The lead agent only composes: it runs the parts in waves, commits, merges and keeps the state, and never writes product code.

## Review

A review round runs these blocks in parallel, then the judge:

| Block | Agent | Looks for | Leaves alone |
|---|---|---|---|
| `/bdk:review-group` | `bdk:reviewer` (sonnet), one per group of files | behaviour at the edges (empty and missing values, signs and units, error paths) traced with a concrete input; tests that would not fail if the behaviour broke; changed lines that break a [rule](./rules.md); outside input reaching a query, a shell, a file path or an eval unchecked; whether an earlier finding's failure still happens | formatting and style a linter checks; problems that need files outside its group |
| `/bdk:review-integration` | `bdk:integration-reviewer` (opus) | each scenario followed from the product's entry point to its result; each scenario proved by a test at a level that can prove it; contracts one part changes that another uses differently (fields, units, empty values, order, error codes, config keys, file formats); behaviour no scenario names | the line-by-line review the group reviewers did |
| `/bdk:e2e-check` | `bdk:e2e-tester` (sonnet) | the running product, driven through each scenario as a user would ([E2E checks](./e2e.md)) | the code: it judges only what the product shows |
| `bdk check run` | none | your test, lint and build commands | nothing else |
| `/bdk:judge` | `bdk:judge` (sonnet) | each finding traced through the code: does the failure really happen, or does a guard, a type or a test prevent it; then a level by what the product does | new problems; decisions (triage makes them) |

Every finding needs a failure scenario: the input and what goes wrong. The judge levels by the product's behaviour: `blocker` when the product breaks a scenario or the intent, a check is red, a security hole, data loss or a regression; `should-fix` when it works but breaks a rule or a project instruction or has a named maintenance cost; a rule broken alone is never a blocker; a failure that does not hold is `not-a-problem`, not a lower level. Details are on [findings](./findings.md).

So a review is not a proofreading pass: style a linter can check is left to the linter, and a finding that cannot show a failure is dropped by the judge.

## Close

| Block | Agent | Checks | Leaves alone |
|---|---|---|---|
| `/bdk:spec-conformance` | `bdk:verifier` (opus) | each spec delta is true of the product after the Change (each scenario followed from its entry point), no E2E scenario failed, removed behaviour is gone, and nothing a user can observe (a command, option, output, exit code, endpoint, page, config key) is missing from the specs | code quality, test coverage, style (reviews own them); running the product or its tests |

The specs it passes become the main specs, the living documentation, so a gap here is a gap in your documentation.

## Debug and PR review

- `/bdk:diagnose-bug` reproduces the bug on the running product before it reads the code for a cause, names a root cause only when the code shows it, and writes the fix as a one-part Change whose spec keeps the reproduction as a scenario. It never changes what a spec promised to fit the code, and says nothing is fixed until the part is built.
- `/bdk:pr-review` runs the group reviewers, the integration reviewer and the judge on any pull request, with the pull request's title, description and linked issues as the intent; it posts one review after you agree, and fixes nothing.

## Sources

- `plugins/bdk/skills/*/SKILL.md` of each block named on this page, and `plugins/bdk/agents/*.md`
