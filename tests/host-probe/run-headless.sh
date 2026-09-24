#!/bin/sh
# Run the headless host checks from docs/HOST-FACTS.md in the current directory,
# which must be a scratch project (never this repo).
#
#   sh <repo>/tests/host-probe/run-headless.sh [check-id...]
#
# Each check runs `claude -p` with the probe plugin, records hook payloads into a
# per-check directory, and keeps only the payloads the check is about, as
# .probe-out/<check-id>--<file>. The claude -p JSON result is kept as
# .probe-out/<check-id>--Result.json. A check whose expected payload is missing is
# retried once, then reported as "not triggered".
#
# PROBE_MODEL  model for the probe sessions (default haiku; tool shapes do not depend on it)
set -u

here=$(cd "$(dirname "$0")" && pwd)
case "$(pwd)" in "$(cd "$here/../.." && pwd)"*) echo "run-headless: run from a scratch project, not the repo" >&2; exit 2 ;; esac
out="$(pwd)/.probe-out"
mkdir -p "$out"
model="${PROBE_MODEL:-haiku}"

setup_files() {
  printf 'alpha\n' > probe-edit.txt
  printf 'one\ntwo\n' > probe-multi.txt
  cat > probe.ipynb <<'EOF'
{"cells":[{"cell_type":"code","execution_count":null,"id":"c1","metadata":{},"outputs":[],"source":["print(1)"]}],"metadata":{},"nbformat":4,"nbformat_minor":5}
EOF
  rm -f probe-write.txt
}

# Save the skill text as the model received it (after ! blocks ran), or the
# host's refusal to render it, from the session transcript; hook payloads carry neither.
save_rendered() {
  first=$(ls "$1"/*-*.json 2>/dev/null | head -n 1)
  [ -n "$first" ] || return 0
  node -e '
    const fs = require("node:fs");
    const t = JSON.parse(fs.readFileSync(process.argv[1], "utf8")).transcript_path;
    if (!t || !fs.existsSync(t)) process.exit(0);
    const texts = fs.readFileSync(t, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l))
      .filter((m) => m.type === "user").map((m) => m.message.content)
      .flatMap((c) => (typeof c === "string" ? [c] : c.filter((b) => b.type === "text").map((b) => b.text)))
      .filter((x) => x.startsWith("Base directory for this skill") || x.startsWith("<local-command-stderr>"));
    if (texts.length) fs.writeFileSync(process.argv[2], JSON.stringify({ hook_event_name: "RenderedSkill", texts }));
  ' "$first" "$1/Rendered.json"
}

# run_check <id> <keep-regex> <allowed-tools|-> <prompt>
# The check counts as triggered when a payload or the claude -p result matches
# <keep-regex>; a host that refuses a tool call before PreToolUse leaves only the result.
run_check() {
  id=$1 keep=$2 allowed=$3 prompt=$4
  for attempt in 1 2; do
    setup_files
    tmp="$out/.run-$id"
    rm -rf "$tmp"; mkdir -p "$tmp"
    if [ "$allowed" = "-" ]; then
      BDK_PROBE_OUT="$tmp" claude -p --plugin-dir "$here" --model "$model" --permission-mode default \
        --output-format json "$prompt" > "$tmp/Result.json" 2> "$tmp/stderr.txt"
    else
      BDK_PROBE_OUT="$tmp" claude -p --plugin-dir "$here" --model "$model" --permission-mode default \
        --allowedTools "$allowed" --output-format json "$prompt" > "$tmp/Result.json" 2> "$tmp/stderr.txt"
    fi
    save_rendered "$tmp"
    hits=$(grep -lE "$keep" "$tmp"/*-*.json 2>/dev/null)
    if [ -n "$hits" ] || grep -qE "$keep" "$tmp/Result.json"; then
      rm -f "$out/$id--"*
      for f in $hits; do cp "$f" "$out/$id--$(basename "$f")"; done
      cp "$tmp/Result.json" "$out/$id--Result.json"
      [ -f "$tmp/Rendered.json" ] && cp "$tmp/Rendered.json" "$out/$id--Rendered.json"
      rm -rf "$tmp"
      echo "recorded      $id ($(printf '%s' "$hits" | grep -c .) payload(s), attempt $attempt)"
      return 0
    fi
  done
  rm -f "$out/$id--"*
  cp "$tmp/Result.json" "$out/$id--Result.json" 2>/dev/null
  rm -rf "$tmp"
  echo "not triggered $id (result kept as $id--Result.json)"
  return 1
}

tools_list() {
  mkdir -p "$out/.run-tools-list"
  BDK_PROBE_OUT="$out/.run-tools-list" claude -p --plugin-dir "$here" --model "$model" --output-format stream-json --verbose "Reply OK." 2>/dev/null \
    | node -e '
      let buf = ""; process.stdin.on("data", (d) => (buf += d)).on("end", () => {
        const init = buf.split("\n").filter(Boolean).map((l) => JSON.parse(l))
          .find((m) => m.type === "system" && m.subtype === "init");
        process.stdout.write(JSON.stringify({ hook_event_name: "Init", claude_code_version: init?.claude_code_version,
          permission_mode: init?.permissionMode,
          // Built-in tools only: MCP tool names reveal which services the account has connected.
          tools: init?.tools?.filter((t) => !t.startsWith("mcp__")),
          mcp_tool_count: init?.tools?.filter((t) => t.startsWith("mcp__")).length,
          slash_commands: init?.slash_commands?.filter((c) => /^bdk/.test(c)),
          agents: init?.agents?.filter((a) => /^bdk/.test(a)),
          skills: init?.skills?.filter((k) => /^bdk/.test(k)) }));
      });' > "$out/tools-list--Init.json"
  rm -rf "$out/.run-tools-list"
  echo "recorded      tools-list"
}

selected() { [ -z "$only" ] || echo " $only " | grep -q " $1 "; }
only="$*"
status=0

selected tools-list && tools_list
selected pre-bash && { run_check pre-bash '"tool_name":"Bash"' "Bash(echo *)" \
  "Use the Bash tool to run exactly: echo probe-bash. Then reply DONE." || status=1; }
selected pre-write && { run_check pre-write '"tool_name":"Write"' "Write" \
  "Use the Write tool to create the file probe-write.txt with the content: write. Then reply DONE." || status=1; }
selected pre-edit && { run_check pre-edit '"tool_name":"Edit"' "Read Edit" \
  "Use the Edit tool to replace alpha with beta in probe-edit.txt (read it first if the tool requires it). Then reply DONE." || status=1; }
selected pre-multiedit && { run_check pre-multiedit '"tool_name":"MultiEdit"|NO-MULTIEDIT' "Read MultiEdit" \
  "Use the MultiEdit tool to replace one with 1 and two with 2 in probe-multi.txt in a single call. If no tool named MultiEdit is in your tool list, do not use any other tool and reply NO-MULTIEDIT." || status=1; }
selected pre-notebookedit && { run_check pre-notebookedit '"tool_name":"NotebookEdit"' "Read NotebookEdit" \
  "Use the NotebookEdit tool to replace the source of cell c1 in probe.ipynb with print(2). Then reply DONE." || status=1; }
selected agent-fg && { run_check agent-fg '"tool_name":"(Task|Agent)"|"agent_id"' "Task Agent Bash(echo *)" \
  "Use the subagent tool (named Task or Agent) with subagent_type bdk-probe:probe-worker and prompt go. Run it in the foreground: do not set run_in_background. Reply with its answer." || status=1; }
selected agent-bg && { run_check agent-bg '"tool_name":"(Task|Agent)"|"agent_id"' "Task Agent Bash(echo *)" \
  "Use the subagent tool (named Task or Agent) with subagent_type bdk-probe:probe-worker, prompt go, and run_in_background set to true. Wait until it finishes, then reply with its answer." || status=1; }
selected skill-tool-plan && { run_check skill-tool-plan '"tool_name":"Skill"|disable-model-invocation|PLAN-PROBE-LOADED' "Skill" \
  "Call the Skill tool with skill bdk-probe:plan and args from-model. Do not type it as a slash command and do not use any other tool. Report exactly what the tool returned." || status=1; }
selected allowed && { run_check allowed '.' "-" "/bdk-probe:allowed" || status=1; }
selected allowed-control && { run_check allowed-control '.' "-" "/bdk-probe:unallowed" || status=1; }

exit $status
