# Swarm on Claude Code

Facts measured in `docs/HOST-FACTS.md` of the BDK repository, Claude Code 2.1.283.

- **Wave.** Dispatch a wave through the Agent tool: one call per package, every call of the wave in one message. The calls of one message run concurrently. Set `subagent_type` to `bdk:<adapter>` from the package's `adapter` field, and the prompt to the package path.
- **No forked roles in a wave.** Forked skills (`bdk:<role>` through the Skill tool) do not run concurrently under `claude -p` (`fork-concurrency`). Use a fork only for a role that runs as a single instance, where concurrency does not matter.
- **Resume.** Resume an agent with `SendMessage` to the agent ID its Agent result returned, naming the missing report or the refusal (`send-by-id`). A finished agent resumes with its context.
- **Critical finding.** An agent's `SendMessage` to `main` arrives at your next turn, not in the middle of it (`send-to-main`). Read it before you dispatch again.
- **Nested agents.** The host allows a subagent to start subagents (`nested-agents`), but no BDK adapter carries the Agent tool in 3.0, so the swarm stays flat.
