# Failure mode (design D-8)

`fm.sh`: the configuration's servers start behind `sh -c 'sleep 45; exec uvx ...'`, past the default 30 s `MCP_TIMEOUT`, with the user's default MCP settings (nonblocking start). BDK `features` stay on, so the session gets the graph or serena tier text for tools that never arrive. Haiku 4.5, one run per cell; raw runs in `runs/failure/`, per-run numbers in `results/failure-runs.md`.

| run | status at `init` | calls to missing tools | fallback | correctness | cost USD (normal median) | wall s (normal median) |
|---|---|---|---|---|---|---|
| V1 CG | graph `pending`, 0 MCP tools | 1 `ToolSearch` for `semantic_search_nodes_tool`: "No matching deferred tools found. Some MCP servers are still connecting" | `grep -r`, `Read` | 1.0 | 0.045 (0.024) | 24.9 (19.6) |
| V1 CS | serena `pending`, 0 MCP tools | none | `grep -r`, `Read` | 1.0 | 0.039 (0.026) | 14.9 (35.4) |
| V2 CG | graph `pending`, 0 MCP tools | none | `grep -rn`, 6 `Read` | 1.0 | 0.101 (0.041) | 49.1 (33.0) |
| V2 CS | serena `pending`, 0 MCP tools | none | `grep -rn`, 6 `Read` | 1.0 | 0.084 (0.057) | 32.5 (63.1) |

Behaviour, both servers alike:

- In a default session a slow server is never waited for: `init` lists it `pending`, its tools are not in the tool list, and the session finishes on `Bash` + `Read` before the server would even have failed. Nothing errors and no answer was wrong.
- The tier text costs at most one wasted call (a `ToolSearch` for a tool named by the tier), and the host's own reply names the cause ("still connecting").
- The fallback is dearer than a working graph on reference tracing (V2: 0.101 vs 0.041 USD), but in line with C0 (V2 C0 median 0.064 USD, 38 s) for one run.
- The earlier, blocking failure (`MCP_CONNECTION_NONBLOCKING=0`, a server `failed` at `init`) was seen only in the harness (README, Isolation check), not in default sessions.
