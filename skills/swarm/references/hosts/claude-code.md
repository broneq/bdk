# Swarm on Claude Code

Facts measured in `docs/HOST-FACTS.md` of the BDK repository, Claude Code 2.1.284.

- **Background start.** Start an agent with the Agent tool, `run_in_background: true`, `subagent_type` set to `bdk:<adapter>` from the package's `adapter` field and the package path as the prompt. The call returns the child's id at once, and several such calls in one message run concurrently.
- **Escalation model.** For a package whose `bdk dispatch build` returns a `model`, add `model` with that value to the Agent call; it overrides the adapter's model (`model-override`, Claude Code 2.1.285).
- **A lead's turn.** A subagent that ends its turn ends; its background children keep running and report to `main` (`lead-detach`). A lead therefore waits with `bdk agents wait`, never by ending its turn.
- **Messages.** A `SendMessage` reaches a running agent at its next tool round (`send-live`) and resumes a finished one with its context (`send-by-id`); a message to `main` arrives at its next turn (`send-to-main`).
- **Resume.** Resume an agent with `SendMessage` to the id its Agent call returned, naming the missing report, the refusal or the silence.
- **No forked roles in a wave.** Forked skills (`bdk:<role>` through the Skill tool) do not run concurrently under `claude -p` (`fork-concurrency`). Use a fork only for a role that runs as a single instance.
- **No working directory per agent.** The Agent tool takes no working-directory parameter, so an agent starts in the session's directory. For a worktree part the package carries the work root, and the agent works inside that path. BDK does not use the Agent tool's own `isolation: worktree`: it branches from the default branch, not from the Change.
