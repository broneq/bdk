# What can see MCP connect status (task 7.2)

| Source | What it exposes | Evidence |
|---|---|---|
| `SessionStart` hook input | Nothing about MCP: only `session_id`, `transcript_path`, `cwd`, `hook_event_name`, `source`. | `results/availability/sessionstart-input.json`, captured by the hook in `results/availability/probe-hook-command.txt` |
| `claude mcp list` from inside a hook | Connect status per server, but by running its own health check, which starts every server again (a second serena and graph process per session). It takes no `--plugin-dir`, so it only sees plugins the user has installed. In one probe it hung session start for more than 5 minutes until killed. | `results/availability/claude-mcp-list-in-hook.txt` |
| `init` event (stream-json) | `mcp_servers[].status`. In the default nonblocking start it is `pending` for every plugin server, and it can race between `pending` and `connected`; only with `MCP_CONNECTION_NONBLOCKING=0` is it final. `init` reaches `--output-format stream-json` consumers, not hooks or skills. | `runs/failure/*/*.jsonl` (all `pending`), `runs/haiku/*/*.jsonl` (all `connected`, blocking) |
| T01 payloads (2.1.281) | The recorded Init payload has the tool list and `mcp_tool_count`, no per-server status. | `tests/fixtures/host-payloads/2.1.281/tools-list.json` |
| Per-session MCP log | Connect start, timeout, success with time, failure reason. Lives under `~/Library/Caches/claude-cli-nodejs/<cwd>/mcp-logs-plugin-<plugin>-<server>/`, an undocumented path. | P3 copies it per session (`p3.sh`) |

Conclusion: no documented, cheap source tells a hook or skill at session start whether a server connected; at that moment it usually has not connected yet. Selecting the tier by availability is not possible on 2.1.282. The recommendation (report, failure mode) is tier text that works without the tools: name the fallback in the same fragment ("if these tools are absent, use grep and Read"), which the failure-mode runs show the model already does unprompted.
