## REMOVED Requirements

### Requirement: bdk dispatch run

**Reason**: The kernel no longer spawns host processes. A wave runs through the host's own subagents: the orchestrator calls its Agent tool once per package, driven by the swarm skill of T23 part C, with per-host guidance in that skill's `references/hosts/`. A kernel-spawned `claude -p` counts as a user-typed prompt for the stage guard (HOST-FACTS `upe-headless`) and needs broad permission flags, and forked skills do not run concurrently under `claude -p` (HOST-FACTS `fork-concurrency`).
**Migration**: None; the command was never implemented (it answered `kernel/not-implemented`). `execution.runner` and `execution.host` are removed with it (`kernel-settings`); `execution.concurrency` stays and caps the swarm.
