# T03 MCP evaluation - benchmark setup

Reproducibility data for `docs/V3-MCP-EVALUATION.md` (OpenSpec change `v3-t03-mcp-value-evaluation`). Everything here was fixed before the first measured run.

## Baseline

| Item | Value |
|---|---|
| Host | Claude Code 2.1.282, macOS (Darwin 27.0.0) |
| BDK under test | `cdea721` (v2.6.0 without the graph `Stop` hook), one copy per configuration with its `.mcp.json` replaced by `configs/<C>.mcp.json` |
| code-review-graph | 2.3.9 (resolved by unpinned `uvx code-review-graph serve`) |
| serena | `git+https://github.com/oraios/serena` HEAD, `7a29683` on 2026-09-25 |
| Benchmark | `BloopAI/vibe-kanban` `f4b0fd9`, TypeScript part only (design D-1) |
| Snapshot | orphan commit `8463854` with tree `5db3e84` (identical to `f4b0fd9`'s tree), built by `git commit-tree` with fixed author and dates, shallow-cloned without a remote. Runs never see the upstream history, so `git log` cannot reveal V5's fix commit. |

The machine has no Rust toolchain, so every package's `check` script (`tsc --noEmit`) is the only build verification. On the unloaded snapshot all four packages pass (`web-core`, `ui`, `remote-web`, `local-web`).

## Configurations

`configs/` holds, per configuration `C0`, `CG`, `CS`, `CGS` (design D-2):

- `<C>.mcp.json` - the servers exactly as in BDK's `.mcp.json`, filtered to the configuration. Copied into that configuration's BDK plugin copy as `.mcp.json`.
- `<C>.bdk-settings.json` - copied into the worktree as `.bdk/settings.json`, so BDK's tier fragments match the servers.
- `serena-project.yml` - copied into the worktree as `.serena/project.yml`; `language_servers: [typescript]`.

## Headless invocation

```bash
ENABLE_CLAUDEAI_MCP_SERVERS=false \
MCP_CONNECTION_NONBLOCKING=0 \
MCP_CONNECT_TIMEOUT_MS=120000 \
claude -p "<prompt>" \
  --model <model> \
  --output-format stream-json --verbose \
  --plugin-dir <bdk copy for C> \
  --setting-sources project,local \
  --no-session-persistence \
  --allowedTools 'Read,Edit,Write,Bash,Task,Skill,ToolSearch,mcp__plugin_bdk_code-review-graph__*,mcp__plugin_bdk_serena__*' \
  </dev/null
```

Why each flag (all verified with probe runs on 2026-09-25):

- **Servers come from the plugin, not `--mcp-config`.** Servers passed by `--mcp-config` are named `mcp__<server>__*`, while BDK's tier fragments and agent `tools:` lists name `mcp__plugin_bdk_<server>__*` (`.claude/rules/mcp-tool-naming.md`). Measured that way, BDK's subagents would never get the MCP tools. `--strict-mcp-config` also drops plugin servers (a probe with the full BDK `.mcp.json` listed no servers), so it is not used.
- **`--setting-sources project,local`** keeps user settings out: no user plugins, no user-level MCP servers (the user has unprefixed serena and code-review-graph at user level), no user `CLAUDE.md`. A probe asking the model about markers from the user's `CLAUDE.md`, RTK and caveman instructions answered no to all three, and yes to BDK's "Shared Foundation" and "Tool Tier System" sections. `init` lists only the plugins `bdk`, `agents-md` and `telemetry`, where the last two are built in.
- **`ENABLE_CLAUDEAI_MCP_SERVERS=false`** removes the account's claude.ai connectors. Without it, a CG probe carried 49 extra MCP tools (Atlassian, Claude Docs).
- **`MCP_CONNECTION_NONBLOCKING=0` and `MCP_CONNECT_TIMEOUT_MS=120000`** make the session wait for all servers before `init`. Without them, plugin servers are `pending` at `init`, MCP tools are deferred behind `ToolSearch`, and in a CGS probe both forced MCP calls failed with "No such tool available" because the servers were still connecting. That is a real failure mode of default sessions, measured in design D-8. For value runs, a server must be present from the first turn, otherwise the run measures connect latency rather than value. P1 and P3 measure connect time and failures separately.
- **`--allowedTools`** grants the MCP tools. Without it, headless calls are denied ("Claude requested permissions ... but you haven't granted it yet").
- **`</dev/null`** avoids the 3 s stdin wait.

Host fact that matters for the fallback tier: this Claude Code build exposes no `Grep` or `Glob` tool (the `init` tool list has `Bash`, `Read`, `Edit`, `Write`, `Task`, `Skill`, `ToolSearch` and others), so "no MCP" means search via `Bash` (`grep`, `rg`, `find`) plus `Read`.

## Isolation check

A run is valid only if its `system` / `init` event shows:

- plugins exactly `bdk` (from the configuration's copy), `agents-md` and `telemetry`,
- MCP servers exactly the configuration's, all `connected`, named `plugin:bdk:<server>`,
- no MCP tool whose prefix is not `mcp__plugin_bdk_<configured server>__`.

The harness discards and reruns a run that fails the check.

## Worktree reuse

Each configuration has its own worktree of the snapshot, prepared once: `pnpm install --frozen-lockfile --offline`, `.bdk/settings.json`, `.serena/project.yml`, and a built graph for CG / CGS. Before every run the worktree is reset with `git reset --hard && git clean -fdx -e node_modules -e .bdk -e .serena -e .code-review-graph`. So each run starts from the snapshot's files, with the warm caches a working developer has (installed dependencies, built graph, serena cache). The reset leaves files byte-identical to the state the graph was built from, so the graph is never stale at run start.

## Task set

`tasks/V<n>.prompt.md` is the exact prompt of each task, `tasks/V<n>.reference.json` its reference answer and grading mode (`exact`, `set`, `rubric`, `build`). Each prompt ends by asking for a fenced JSON block, so the deterministic graders read the answer rather than parse prose. How each reference was derived is in its `note`: by parsing import clauses (V3), by applying the change and running `tsc` (V4), by deleting the candidates and running `tsc` (V7), by performing the rename and running `tsc` (V8), from upstream commit `5a3dbfdc7` (V5), and from `package.json` plus import paths (V6). The references were committed before the first measured run.

V5's working tree is the snapshot with upstream fix `5a3dbfdc7` reverse-applied and left uncommitted, so the diff under review reintroduces the defect that commit fixed.
