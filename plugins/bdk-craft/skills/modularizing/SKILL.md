---
name: modularizing
description: Module boundary choices - modules by domain feature, one public entry per module, dependencies pointing one way with no cycles, and the signals that a module should split. Use when structuring a codebase, splitting a module or untangling imports.
license: MIT
---

# Modularizing

A codebase organised by technical layer (`components/`, `services/`, `utils/`) spreads every feature across the whole tree and lets anything import anything. This skill fixes the boundaries: modules by feature, a public entry for each, and a dependency direction that a check can enforce.

## 1. Cut by feature, not by layer

- A module is a domain capability a user or the business would name: `checkout`, `catalog`, `accounts`, `notifications`. Its UI, logic, data access and tests live inside it.
- Layers live inside a module (`checkout/ui`, `checkout/domain`, `checkout/data`), not at the top of the tree.
- Find the candidates from the use cases and from what changes together: files that are always edited in the same commits belong in one module.
- Code shared by several modules goes into a small `shared` module only when it has no domain knowledge (formatting, an HTTP client wrapper). Domain code shared by two features signals a missing module.

## 2. Give every module one public entry

- Each module exposes its API through one entry file (`index.ts`, `__init__.py`, a package's exported surface). Everything else is internal.
- Other modules import only from that entry, never from a file deep inside: `import { placeOrder } from "../checkout"`, not `"../checkout/domain/placeOrder"`.
- The entry exports the smallest useful surface: functions, components and types other modules need. Internals stay unexported.
- A module's tests may reach its internals; other modules' tests may not.

## 3. Point dependencies one way

- Draw the module dependency graph and make it acyclic. When `a` imports `b` and `b` imports `a`, one of these fixes it:

| Cycle cause                       | Fix                                                                                          |
| --------------------------------- | -------------------------------------------------------------------------------------------- |
| `b` calls back into `a`           | Dependency inversion: `b` defines an interface or accepts a callback, `a` implements it      |
| Both need the same type           | Move the type into the module that owns the concept, or into `shared` when no module owns it |
| `b` reacts to something in `a`    | An event: `a` publishes, `b` subscribes, `a` never imports `b`                               |
| The two are really one capability | Merge them                                                                                   |

- Order modules in levels: feature modules depend on `shared`, never the reverse; the app shell (routing, composition root) depends on features, never the reverse.
- Enforce the rules with an import-boundary check in the project's linter or build, so a forbidden import fails the build instead of a review.

## 4. Know when to split

Split a module when one of these holds, and name the signal:

- Its public entry exports two groups of things that no caller uses together.
- Two teams or two release cadences change it.
- Its name needs "and" to describe it.
- Changing one part routinely breaks tests of the other part.

Do not split on size alone. A large module with one reason to change is fine.

## 5. Migrate step by step

Moving to feature modules in one change stalls a team. Move one feature at a time:

1. Create the module and its entry.
2. Move its files in, re-exporting from the old paths if many callers exist.
3. Update the callers to import from the entry, then delete the re-exports.
4. Add the boundary rule for that module, so it cannot regress.

## The output

Deliver the structure as a module map, the dependency rules and the migration steps:

```text
Module map
| Module | Capability | Public entry | Depends on |
| catalog | browse and filter products | src/catalog/index.ts | shared |
| checkout | cart, order placement | src/checkout/index.ts | catalog, shared |
| shared | HTTP client, formatting | src/shared/index.ts | - |

Rules
- Imports between modules go through the public entry only.
- No cycles; shared depends on no feature module.
- Enforced by: <the import-boundary check>

Migration
1. ...
```

## Anti-patterns

- Top-level `components/`, `services/`, `hooks/`, `utils/` holding every feature's code.
- Deep imports into another module's internals.
- A `utils` or `common` module that grows domain logic and is imported everywhere.
- Barrel files that re-export everything, which hides the real surface and makes cycles easy.
- Cycles broken by a lazy import instead of a fixed direction.
