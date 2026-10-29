# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

## Before exploring, read these

- **`docs/concepts/glossary.md`**: the one glossary of this repository, the words BDK uses, published as the Concepts glossary of the docs site.
- **`docs/adr/`**: read ADRs that touch the area you're about to work in.

A new ADR in this repository follows the format in `CONTRIBUTING.md` ("ADRs"), checked by `tests/adr-format.test.ts`: `enforced-by` names only CI checks (tests, lint configs, workflows) or `none`, and the paid eval cases that measure a decision go in the optional `measured-by`.

A new term goes into `docs/concepts/glossary.md`, never into a root `GLOSSARY.md`: this repository keeps one glossary, on the docs site.

## File structure

Single-context repo:

```
/
├── docs/
│   ├── adr/
│   │   ├── 0001-remove-bundled-mcp-servers.md
│   │   └── ...
│   └── concepts/
│       └── glossary.md
└── plugins/
```

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a hypothesis, a test name), use the term as defined in `docs/concepts/glossary.md`. Don't drift to synonyms the glossary explicitly avoids.

If the concept you need isn't in the glossary yet, that's a signal: either you're inventing language the project doesn't use (reconsider) or there's a real gap (note it for `/domain-modeling`).

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than silently overriding:

> _Contradicts ADR-0007 (event-sourced orders), but worth reopening because…_
