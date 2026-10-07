# Contributing to BDK

BDK v3 is being rebuilt on `staging/v3`; this guide will describe its conventions once they exist. Until then, the way of working is the `## SDLC` section of `CLAUDE.md`.

## Trying a change

Run BDK in a separate test project, never in this repository:

```bash
claude --plugin-dir ~/projects/bdk
```
