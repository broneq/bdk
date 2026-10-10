# Proposal

## Why

Tracks #386.

`docs:diagram-fit` serves the built site on the fixed port `4179`. Two runs at once on one machine (several worktrees) make the second die with `EADDRINUSE`, a failure that says nothing about any diagram.

## What Changes

- `docs/.vitepress/diagram-fit.ts` serves the built site on a free port chosen by the OS (port `0`) and reads the bound port from the server.
- The `docs-site` spec states that the check does not depend on a fixed port.

## Capabilities

### New Capabilities

None.

### Modified Capabilities
- `docs-site`: the diagram-fit check runs in parallel on one machine.

## Impact

- Changed: `docs/.vitepress/diagram-fit.ts`.
- User docs: none. The check is a contributor tool and no Guide or Concepts page describes it.
