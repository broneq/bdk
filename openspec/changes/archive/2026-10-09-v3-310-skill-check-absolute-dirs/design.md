# Design

## Context

`loadTarget` in `src/config.ts` validates every `dirs` entry with `resolve(root, dir)`; `discover` in `src/discover.ts` scans `join(root, dir)`. For a relative entry both give the same path; for an absolute entry `join` yields `<root>/<abs path>`, which does not exist, so `readdirSync` throws and the CLI dies with a stack trace. `LoadedTarget.dirs` keeps the entries as written, because `doc.target.dirs` exposes them to rules and `name` defaults to the first one.

## Goals / Non-Goals

**Goals:**
- An absolute `dirs` entry is checked the same way as a relative one.
- One rule for resolving a target directory, in one place.

**Non-Goals:**
- Changing how finding paths are shown. They stay relative to the config root, as the spec requires; a directory outside the root shows as a `../` path.
- How an unexpected internal error is reported (stack trace, exit 1). That is a separate defect, tracked in #314.

## Decisions

### D1. A shared `targetDir(root, dir)` in `config.ts`

`config.ts` owns the meaning of a config path ("every config path is relative to" the config root), so it exports `targetDir(root, dir) = resolve(root, dir)`; `loadTarget` validates with it and `discover` scans with it.

Alternatives:
- Replace `join` with `resolve` inline in `discover.ts`. Fixes the bug but keeps two copies of the rule that drifted apart in the first place.
- Store resolved absolute directories on `LoadedTarget` (for example `LoadedTarget.paths`). Removes the call in discovery, but adds a second, parallel list to a public-facing type next to `dirs`, and every producer of a `LoadedTarget` (`testing.ts`, tests) must fill it. A one-line function is the smaller surface for the same guarantee.
- Normalise `dirs` to absolute paths in the loader. Changes `doc.target.dirs` and the default target `name` that rules and output see; a behaviour change for plugin rules with no benefit.

### D2. Keep document paths relative to the config root

`read` and `strays` keep `relative(root, ...)`. The spec says finding paths are relative to the config root, baselines fingerprint on that path, and path arguments are resolved against the same root (`runner.ts`), so `../` paths stay consistent end to end. `rules/structure.ts` reads `join(root, doc.dir, file)`, which resolves a `../` dir correctly.

## Risks / Trade-offs

- A config outside the project prints finding paths with `../` segments. Accepted: it is consistent with the spec and with path arguments, and such a config is a scratch or cross-project setup.
