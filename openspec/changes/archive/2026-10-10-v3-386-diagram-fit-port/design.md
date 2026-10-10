# Design

## D1: Port 0, not retry

Port 0 lets the OS pick a port that is free at bind time, so no race and no retry loop exist. A retry on `EADDRINUSE` over a fixed range would still collide when many runs start together. VitePress `serve` returns the polka instance; the code waits for `listening` when the socket is not yet bound, then reads `server.address().port`.

The VitePress log line prints `localhost:0` (its own option value); the check does not use it.

## Verification

Two `docs/.vitepress/diagram-fit.ts` runs started together against one built site both exit 0 (local Chrome via `channel: "chrome"`, since the Playwright browser download is blocked here; CI installs its own).
