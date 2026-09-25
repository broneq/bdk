# Pin specs (design D-9, task 7.3)

| Server | Spec measured (unpinned) | Pin candidates | Re-resolved at start? | P1 warm / cold median s |
|---|---|---|---|---|
| code-review-graph | `uvx code-review-graph serve` (resolved to 2.3.9, the latest on PyPI on 2026-09-25) | `uvx code-review-graph==2.3.9 serve` | No for either form once cached: both start with `UV_OFFLINE=1`. `uvx code-review-graph` also reuses a matching `uv tool install` of the package (this host has 2.3.9 installed as a uv tool), so a user's own install silently decides the version of the unpinned spec. | unpinned 1.31 / 41.05; pinned 1.29 / 37.15 |
| serena | `uvx --from git+https://github.com/oraios/serena serena start-mcp-server ...` (HEAD `7a29683`) | `git+https://github.com/oraios/serena@7a2968335f2198b966864de1ce3655c8e485a653` (the measured code); `serena-agent==1.7.0` (PyPI release of 2026-08-09, `v1.7.0` = `949a27e`, 153 commits and 300 files behind the measured HEAD; supports every flag BDK passes: `--context`, `--project-from-cwd`, modes `interactive`, `editing`, `no-memories`) | Unpinned: yes, every start queries `https://api.github.com/repos/oraios/serena/commits/HEAD` (`uvx -v`) and fails offline; that is unauthenticated GitHub API traffic per session (rate limit 60 per hour per IP). SHA and PyPI pins: no, both start with `UV_OFFLINE=1`. | HEAD 1.85 / 22.09; SHA 1.71 / 24.28; PyPI 1.83 / 33.14 |

Each spec was started in a clean shell (`uvx ... --help`, then as an MCP server in P1); all connected. Raw P1 times: `results/p1-connect.md`. Whether pins move into a `uv.lock` is T32's question.
