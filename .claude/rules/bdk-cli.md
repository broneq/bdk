---
paths:
  - "plugins/bdk/src/**"
  - "plugins/bdk/tests/**"
  - "openspec/specs/bdk-cli/**"
---

# bdk CLI

The `bdk` CLI helps skills; it never runs the process. Spec: `openspec/specs/bdk-cli/spec.md`.

- A command computes a result from its arguments and the files it reads, or writes what it was asked to write, and returns. It never decides what runs next, records which step of a skill ran, refuses work because another command did not run, prompts, or waits. The order of the work lives in skill text.
- A new command needs a recorded problem that an eval or a measurement showed (`CLAUDE.md`, "Building skills"). Name it in the Change.
- One slice per command group: `src/<group>/`. A new verb goes into its group's slice; a new group is a new slice, its row in `src/slices.ts`, and its spec `bdk-cli/<group>`.
- A slice owns its whole vertical: `commands/` (argv, help), `use-cases/` (logic; no argv, no stdout), `domain/` (types, pure rules), `store/` (its files), `render/` (text), `schema/` (zod schema of the `--json` result), `tests/`. One file per command in each layer.
- Reach another slice only through its `index.ts`, and add a matrix edge only for a use case that slice owns. Data several slices read goes through `shared/`.
- `shared/` takes only an OS boundary, the CLI frame, or code three or more slices import. Two slices needing the same helper keep two copies.
- File system, child processes, environment and `process` only in `src/main.ts` and `shared/` OS boundary modules; use cases get them injected and are unit-tested without them.
- Output: the result on stdout; `--json` prints one compact JSON document; errors are `<usage|env|internal>/<name>`; exit 0 ok, 1 "the answer is no" with a normal result, 2 usage, 3 environment, 4 internal. Read stdin only for an explicit `-`.

ESLint (`plugins/bdk/eslint.architecture.ts`, run by `pnpm lint`) enforces the matrix, the layer direction and the OS boundary; `plugins/bdk/tests/shared-admission.test.ts` the `shared/` admission. When they fail, fix the import; change `src/slices.ts` only with a reason in its `why` field. Never silence a `boundaries/*` rule with an `eslint-disable` comment.
