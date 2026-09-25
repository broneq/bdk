# P1 connect (design D-6)

Time from process start to the `init` event of `claude -p` (2.1.282, Haiku 4.5, killed at `init`, no tokens) with `MCP_CONNECTION_NONBLOCKING=0`, `MCP_CONNECT_TIMEOUT_MS=600000`, `MCP_TIMEOUT=600000`, so `init` waits until every server connected and a slow start is measured instead of cut off at the default 30 s. Each label starts in the worktree of its configuration (`wt/C0`, `wt/CG`, `wt/CS`), so BDK's SessionStart hooks see the matching `.bdk/settings.json`; with the graph on, `register-graph-repo` runs `uvx code-review-graph register` and `status` inside that time.

Warm: the user's uv cache and uv tools as they are (10 starts). Cold: a fresh, empty `UV_CACHE_DIR` and `UV_TOOL_DIR` per start (3 starts). Starts run one at a time. The host was not idle: the load average before each start was 9-19 (the user's own sessions, endpoint security), recorded per start in the raw files `results/p1/warm.jsonl` and `results/p1/cold.jsonl`.

| label | spec | mode | n | median s | min-max s | over C0 median s | over 30 s default | failures | raw times s |
|---|---|---|---|---|---|---|---|---|---|
| C0 | no MCP server (baseline) | warm | 10 | 0.45 | 0.43-1.01 | +0.00 | 0/10 | 0 | 1.01, 0.65, 0.44, 0.43, 0.44, 0.45, 0.45, 0.43, 0.46, 0.43 |
| P1-G | `uvx code-review-graph serve` | warm | 10 | 1.31 | 1.24-5.29 | +0.87 | 0/10 | 0 | 5.29, 1.77, 1.50, 1.24, 1.27, 1.36, 1.28, 1.28, 1.30, 1.33 |
| P1-Gpin | `uvx code-review-graph==2.3.9 serve` | warm | 10 | 1.29 | 1.23-2.72 | +0.85 | 0/10 | 0 | 1.34, 1.30, 1.32, 1.29, 1.27, 1.23, 1.23, 1.29, 1.46, 2.72 |
| P1-S | `uvx --from git+https://github.com/oraios/serena serena start-mcp-server ...` | warm | 10 | 1.85 | 1.76-5.30 | +1.41 | 0/10 | 0 | 5.30, 1.91, 2.12, 1.82, 1.80, 1.76, 1.88, 1.83, 1.82, 1.91 |
| P1-Ssha | `uvx --from git+https://github.com/oraios/serena@7a29683... serena ...` | warm | 10 | 1.71 | 1.55-4.13 | +1.26 | 0/10 | 0 | 4.13, 1.55, 1.59, 1.83, 1.76, 3.08, 2.84, 1.65, 1.63, 1.66 |
| P1-Spypi | `uvx --from serena-agent==1.7.0 serena ...` | warm | 10 | 1.83 | 1.76-6.72 | +1.38 | 0/10 | 0 | 6.72, 1.84, 1.81, 1.79, 1.76, 1.80, 2.90, 4.11, 2.33, 1.80 |
| C0 | no MCP server (baseline) | cold | 3 | 0.43 | 0.39-0.48 | +0.00 | 0/3 | 0 | 0.48, 0.39, 0.43 |
| P1-G | `uvx code-review-graph serve` | cold | 3 | 41.05 | 37.50-45.28 | +40.62 | 3/3 | 0 | 45.28, 41.05, 37.50 |
| P1-Gpin | `uvx code-review-graph==2.3.9 serve` | cold | 3 | 37.15 | 31.24-41.14 | +36.72 | 3/3 | 0 | 41.14, 37.15, 31.24 |
| P1-S | `uvx --from git+https://github.com/oraios/serena serena start-mcp-server ...` | cold | 3 | 22.09 | 20.89-25.76 | +21.66 | 0/3 | 0 | 25.76, 20.89, 22.09 |
| P1-Ssha | `uvx --from git+https://github.com/oraios/serena@7a29683... serena ...` | cold | 3 | 24.28 | 18.68-25.63 | +23.85 | 0/3 | 0 | 18.68, 24.28, 25.63 |
| P1-Spypi | `uvx --from serena-agent==1.7.0 serena ...` | cold | 3 | 33.14 | 26.92-34.08 | +32.71 | 2/3 | 0 | 26.92, 34.08, 33.14 |

Notes:

- Warm, one session at a time, each server adds about 0.9 s (graph) and 1.3-1.4 s (serena) over C0; the first start of each label is slower (up to 5-7 s).
- Cold, the graph needs 31-45 s (time to `init` also covers the `register-graph-repo` hook, which runs `uvx code-review-graph` itself against the same empty cache) and serena 19-34 s. Under the default `MCP_TIMEOUT` of 30 s, all 6 cold graph starts and 2 of 9 cold serena starts (both PyPI-pinned) would have been `failed`. A cold cache is the state after installing uv, clearing its cache, or a first run of a new pin.
- Pinning does not change warm connect time. The PyPI pin of serena is the slowest cold.
- In the value runs (4 sessions starting together, warm), the MCP logs show 1.4-20.1 s per server, median 7.4-7.8 s for both servers: parallel starts contend (uv cache lock, CPU). Three Sonnet attempts hit `CONNECT_TIMEOUT` while an unrelated `uvx` build held the uv cache lock (README, Isolation check). P3 measures parallel starts.
