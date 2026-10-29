---
status: accepted
date: 2026-10-29
decision-makers: broneq
enforced-by:
  - plugins/bdk/eslint.architecture.ts
  - plugins/bdk/tests/architecture-lint.test.ts
  - plugins/bdk/tests/shared-admission.test.ts
---

# ADR-0009: The `bdk` CLI is built as vertical slices with an import matrix enforced by ESLint

## Context and Problem Statement

The `bdk` CLI only helps the skills ([ADR-0003](0003-v3-architecture-skills-first.md)), but it still grows: ten command groups, each with its own files, schemas and tests. The draft 1 kernel kept its commands in a central index written ahead of the code (73 records, 25 commands that never ran), and its slices leaked into each other through helpers shared too early. Agents write most of this code, often one command at a time, and see only the files they open. How is the CLI source laid out so that a command lands in one place, the boundaries between groups hold, and an agent learns about a broken boundary where it writes it?

## Decision Drivers

- **One place per command:** a new verb changes one directory and its tests, not four layers spread over the tree.
- **Boundaries that hold without review:** a violation shows at the import line, in the editor and in every scoped lint run an agent does.
- **No size without use:** no central index, no shared helper before a third user.
- **Testable without the OS:** every use case runs in unit tests against injected boundaries.

## Considered Options

1. **Vertical slices with an import matrix as data, enforced by ESLint.**
2. **Horizontal layers** (`cli/ services/ domain/`) across all commands.
3. **Hexagonal ports and adapters.**
4. **A flat `commands/` directory**, one file per command.
5. **Vertical slices enforced by a vitest structural test** or by `dependency-cruiser` instead of ESLint.

## Decision Outcome

**Chosen option: 1.**

- **One slice per command group**, `plugins/bdk/src/<group>/`, plus `shared/` and the composition root `src/main.ts`. A slice owns the whole vertical of its commands in fixed layers, one file per command in each: `commands/` (argv to typed input, help), `use-cases/` (logic; no argv, no stdout), `domain/` (types and pure rules, no IO), `store/` (its own files), `render/` (text), `schema/` (the zod schema of the `--json` result), `tests/`. The layers point one way.
- **The import matrix is data in code.** `src/slices.ts` lists every slice, the slices whose `index.ts` its use cases may import, and a `why` for each row; it lists every `shared/` module with the reason it was admitted. A slice reaches another only through its `index.ts`, along a row of that matrix, which stays acyclic. Data several slices read goes through `shared/`, not through a slice edge.
- **`shared/` admits three kinds of module only:** an OS boundary, the CLI frame (routing, help, flags, output, errors, exit codes), or code three or more slices import. Anything else lives in the slice that needs it, so two slices that need the same helper keep two copies on purpose.
- **The OS only at the edge.** OS modules (`node:fs`, `node:child_process`, `node:os`, the network and terminal modules) and the global `process` appear only in `src/main.ts` and in the `shared/` modules admitted as OS boundaries.
- **No central command index.** Each command is declared in its own slice; the help and the generated CLI Reference come from that declaration.
- **ESLint enforces it.** `plugins/bdk/eslint.architecture.ts` generates the rules from `src/slices.ts` (`eslint-plugin-boundaries` for the matrix and the layers, `no-restricted-imports` and `no-restricted-globals` for the OS boundary) and fails at load time when the slice directories and the matrix disagree or the matrix has a cycle. Inline `eslint-disable` comments have no effect in `src/` (`noInlineConfig`), so a `boundaries/*` failure is fixed by fixing the import. The one check that is not per import, the three-slice admission, is `plugins/bdk/tests/shared-admission.test.ts`.

It is the only option that puts a command in one place, keeps groups from leaking into each other, and reports a broken boundary at the line where it is written.

### Consequences

- ✅ A new verb is a change inside one slice; a new group is one new directory and one row in `src/slices.ts`, with the reason in its `why`.
- ✅ Agents see a broken boundary in the scoped lint run they do anyway, with the rule name at the import.
- ✅ Every use case is unit-tested with in-memory files, a scripted git and fake streams.
- ❌ Deliberate duplication: two slices hold two copies of a small helper (the rule vocabulary in `config` and `rules`, for example) until a third slice needs it.
- ❌ Every slice pays for the full layer anatomy, also when a command is small.
- 🟡 The matrix grows by review: an edge with a weak `why` is the thing to question in a pull request.

## Pros and Cons of the Options

### 1 - Vertical slices, matrix as data, ESLint

- Good: one place per command; the matrix is one reviewable view, edited in the same commit as the import it allows; feedback in the editor.
- Bad: a plugin dependency (`eslint-plugin-boundaries`); duplication over sharing.

### 2 - Horizontal layers

- Good: familiar.
- Bad: a command touches four directories; nothing keeps one group's domain out of another's.

### 3 - Hexagonal ports

- Good: strict separation of IO.
- Bad: one adapter per port for a CLI whose IO is a few files and git; the same benefit comes from injecting the `shared/` boundaries.

### 4 - Flat `commands/`

- Good: least structure for eight commands.
- Bad: no group boundary, so groups with their own model (the findings log, the check plan) leak into each other as they grow.

### 5 - Structural test or `dependency-cruiser`

- Good: no lint plugin; a test can check anything.
- Bad: the violation shows only when tests run, away from the import; a hand-written import parser to maintain, or a second tool and config format run as its own CI step.
