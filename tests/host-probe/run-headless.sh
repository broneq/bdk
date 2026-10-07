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
#
# The bdk-part check also loads BDK itself from this checkout (build it first) and
# runs in its own fixture repository, ./bdk-part, with the permission prompts off.
set -u

here=$(cd "$(dirname "$0")" && pwd)
case "$(pwd)" in "$(cd "$here/../.." && pwd)"*) echo "run-headless: run from a scratch project, not the repo" >&2; exit 2 ;; esac
out="$(pwd)/.probe-out"
mkdir -p "$out"
model="${PROBE_MODEL:-haiku}"
repo=$(cd "$here/../.." && pwd)
# Set by a check that needs them: BDK loaded as a second plugin, and a permission mode.
bdk_plugin=""
mode=default
attempts="1 2"

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
# The check counts as triggered when a payload, the claude -p result or the timeline
# matches <keep-regex>; a host that refuses a tool call before PreToolUse leaves only
# the result, and a subagent's tool output is only in the timeline.
run_check() {
  id=$1 keep=$2 allowed=$3 prompt=$4
  for attempt in $attempts; do
    setup_files
    tmp="$out/.run-$id"
    rm -rf "$tmp"; mkdir -p "$tmp"
    if [ "$allowed" = "-" ]; then
      BDK_PROBE_OUT="$tmp" claude -p --plugin-dir "$here" ${bdk_plugin:+--plugin-dir "$bdk_plugin"} \
        --model "$model" --permission-mode "$mode" \
        --output-format json "$prompt" > "$tmp/Result.json" 2> "$tmp/stderr.txt"
    else
      BDK_PROBE_OUT="$tmp" claude -p --plugin-dir "$here" ${bdk_plugin:+--plugin-dir "$bdk_plugin"} \
        --model "$model" --permission-mode "$mode" \
        --allowedTools "$allowed" --output-format json "$prompt" > "$tmp/Result.json" 2> "$tmp/stderr.txt"
    fi
    save_rendered "$tmp"
    node "$here/timeline.mjs" "$tmp" "$tmp/Timeline.json" 2>/dev/null
    hits=$(grep -lE "$keep" "$tmp"/*-*.json 2>/dev/null)
    if [ -n "$hits" ] || grep -qE "$keep" "$tmp/Result.json" "$tmp/Timeline.json" 2>/dev/null; then
      rm -f "$out/$id--"*
      for f in $hits; do cp "$f" "$out/$id--$(basename "$f")"; done
      cp "$tmp/Result.json" "$out/$id--Result.json"
      [ -f "$tmp/Rendered.json" ] && cp "$tmp/Rendered.json" "$out/$id--Rendered.json"
      [ -f "$tmp/Timeline.json" ] && cp "$tmp/Timeline.json" "$out/$id--Timeline.json"
      rm -rf "$tmp"
      echo "recorded      $id ($(printf '%s' "$hits" | grep -c .) payload(s), attempt $attempt)"
      return 0
    fi
  done
  rm -f "$out/$id--"*
  cp "$tmp/Result.json" "$out/$id--Result.json" 2>/dev/null
  cp "$tmp/Timeline.json" "$out/$id--Timeline.json" 2>/dev/null
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

# A Change with part 01 (tasks 01-1, 01-2) started and its part ticket open, in
# a fresh repository at ./bdk-part; prints the implementer package path (#166).
part_fixture() {
  rm -rf bdk-part && mkdir bdk-part && cd bdk-part || return 1
  git init -q && printf '# app\n' > README.md && setup_files && git add -A && git commit -qm initial
  kernel() { node "$repo/dist/bdk.mjs" "$@"; }
  field() { node -e 'let b="";process.stdin.on("data",d=>b+=d).on("end",()=>console.log(JSON.parse(b)[process.argv[1]]))' "$1"; }
  change=$(kernel change new "Greet the user" --profile tiny --reason probe --json | field change)
  mkdir -p ".bdk/changes/$change/plan/parts"
  for task in 01-1 01-2; do
    printf '## %s Write the %s greeting\n\n**Files:**\n\n- Create: `src/%s.ts`\n\n**Verification:** none\n\n' "$task" "$task" "$task"
  done | { printf -- '---\nschema: 1\nid: "01"\ntitle: Greetings\ngoal: Two greeting modules\nsuccess-measure: both exist\ndo-not-touch: []\ndepends-on: []\nspec-impact: none\n---\n'; cat; } \
    > ".bdk/changes/$change/plan/parts/01-part.md"
  kernel done plan --json > /dev/null && kernel part start 01 --json > /dev/null || return 1
  ticket=$(kernel attempt open part 01 --json | field ticket)
  kernel dispatch build 01 implementer "$ticket" --json | field path
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
selected skill-tool-pretool && { run_check skill-tool-pretool '"tool_name":"Skill"' "Skill" \
  "Call the Skill tool with skill bdk-probe:open-stage and args from-model. Do not type it as a slash command and do not use any other tool. Report exactly what the tool returned." || status=1; }
selected skill-tool-upe && { run_check skill-tool-upe '"hook_event_name":"UserPromptExpansion"|OPEN-STAGE-LOADED' "Skill" \
  "Call the Skill tool with skill bdk-probe:open-stage and args from-model. Do not type it as a slash command and do not use any other tool. Report exactly what the tool returned." || status=1; }
selected skill-tool-disallowed && { run_check skill-tool-disallowed 'RO-NO-WRITE|WRITER-|"tool_name":"Write"' "Skill Write" \
  "Call the Skill tool with skill bdk-probe:ro-stage and follow what it says. Do not type it as a slash command." || status=1; }
selected skill-tool-writer && { run_check skill-tool-writer 'WRITER-|"tool_name":"Write"' "Skill Write" \
  "Call the Skill tool with skill bdk-probe:writer and follow what it says. Do not type it as a slash command." || status=1; }
selected allowed && { run_check allowed '.' "-" "/bdk-probe:allowed" || status=1; }
selected allowed-control && { run_check allowed-control '.' "-" "/bdk-probe:unallowed" || status=1; }
selected wrapper-old-rule && { run_check wrapper-old-rule '.' "-" "/bdk-probe:wrapper-old-rule" || status=1; }
selected wrapper && { run_check wrapper '.' "-" "/bdk-probe:wrapper" || status=1; }

# Where the host puts the plugin's bin/ on PATH (T52, bin/bdk): the Bash tool of
# the main thread and of a subagent, a skill's ! block, and a hook command.
selected plugin-bin-bash && { run_check plugin-bin-bash 'PROBE-BIN main' "Bash(probe-bin *)" \
  "Use the Bash tool to run exactly: probe-bin main. Then reply with its output verbatim." || status=1; }
selected plugin-bin-subagent && { run_check plugin-bin-subagent 'PROBE-BIN sub' "Task Agent Bash(probe-bin *)" \
  "Use the subagent tool (named Task or Agent) with subagent_type bdk-probe:probe-spawner in the foreground and this prompt: Use the Bash tool to run exactly: probe-bin sub. Reply with its one output line and nothing else. Reply with the subagent's answer verbatim." || status=1; }
selected plugin-bin-skill && { run_check plugin-bin-skill 'PROBE-BIN skill|BDK STOP|requires approval' "-" "/bdk-probe:plugin-bin" || status=1; }
selected plugin-bin-hook && { run_check plugin-bin-hook '"hook_event_name":"BinPath"' "-" "Reply OK." || status=1; }

selected fork-agent && { run_check fork-agent 'role-fork-ran|ROLE-FORK' "Skill Bash(echo *) Bash(sleep *)" \
  "Call the Skill tool with skill bdk-probe:role-fork. Do not use any other tool. Reply with exactly what it returned." || status=1; }
selected fork-concurrency && { run_check fork-concurrency '.' "Skill Bash(echo *) Bash(sleep *)" \
  "In ONE message, make two Skill tool calls at once: skill bdk-probe:role-fork and skill bdk-probe:role-fork-b. Do not use any other tool. Reply with both results." || status=1; }
selected sub-bang && { run_check sub-bang 'ROLE-BANG|SUB-BANG' "Task Agent Skill Bash(echo *)" \
  "Use the subagent tool (named Task or Agent) with subagent_type bdk-probe:probe-spawner in the foreground and this prompt: Call the Skill tool with skill bdk-probe:role-bang and report verbatim what it returned. Reply with the subagent's answer verbatim." || status=1; }
selected nested && { run_check nested '"agent_type":"bdk-probe:probe-worker"' "Task Agent Bash(echo *)" \
  "Use the subagent tool (named Task or Agent) with subagent_type bdk-probe:probe-spawner in the foreground and this prompt: Use the Agent tool with subagent_type bdk-probe:probe-worker and prompt go, in the foreground, and report its answer. Reply with the subagent's answer verbatim." || status=1; }
selected send-message-name && { run_check send-message-name '"tool_name":"SendMessage"' "Task Agent SendMessage Bash(echo *)" \
  "Step 1: use the subagent tool (named Task or Agent) with subagent_type bdk-probe:probe-worker, name alpha, prompt go, in the foreground, and wait for it. Step 2: use the subagent tool with subagent_type bdk-probe:probe-spawner, name beta, in the foreground, with this prompt: Use the SendMessage tool to send the message PING-FROM-BETA to the agent named alpha, then report verbatim what the tool returned, and also list the agent names in your sibling roster if you have one. Reply with beta's answer verbatim." || status=1; }

selected send-message-live && { run_check send-message-live '.' "Task Agent SendMessage Bash(echo *) Bash(sleep *)" \
  "Step 1: use the subagent tool (named Task or Agent) with subagent_type bdk-probe:probe-spawner, name alpha, run_in_background true, and this prompt: Run with the Bash tool: sleep 25. Then reply with every message you received from other agents, verbatim, or NONE. Step 2: immediately after, use the subagent tool with subagent_type bdk-probe:probe-spawner, name beta, in the foreground, with this prompt: Use the SendMessage tool to send the message PING-FROM-BETA to the agent named alpha, then report verbatim what the tool returned. Step 3: wait for alpha to finish. Reply with beta's answer and alpha's answer, verbatim." || status=1; }

selected send-message-id && { run_check send-message-id '.' "Task Agent SendMessage Bash(echo *)" \
  "Step 1: use the subagent tool (named Task or Agent) with subagent_type bdk-probe:probe-worker, prompt go, in the foreground. Its result contains an agentId. Step 2: use the subagent tool with subagent_type bdk-probe:probe-spawner in the foreground, with this prompt (put the real agentId from step 1 in place of ID): Use the SendMessage tool with to set to ID and the message PING-FROM-BETA, then report verbatim what the tool returned. Reply with the step 1 agentId and beta's answer verbatim." || status=1; }

selected send-message-main && { run_check send-message-main '.' "Task Agent SendMessage Bash(echo *)" \
  "Use the subagent tool (named Task or Agent) with subagent_type bdk-probe:probe-spawner, run_in_background true, and this prompt: Use the SendMessage tool with to set to main and the message CRITICAL-FROM-SUB, report verbatim what the tool returned, then reply DONE. Wait until it finishes. Reply with every message you received from it, verbatim, and its final answer." || status=1; }

# Agent lifecycle and messaging checks for the T41 agent registry.
selected lifecycle && { run_check lifecycle '"hook_event_name":"Subagent(Start|Stop)"|"tool_name":"Agent"' "Task Agent Bash(echo *)" \
  "Use the subagent tool (named Task or Agent) with subagent_type bdk-probe:probe-spawner in the foreground and this prompt: Use the Agent tool with subagent_type bdk-probe:probe-worker and prompt go, in the foreground, and report its answer. Reply with the subagent's answer verbatim." || status=1; }

selected lifecycle-bg && { run_check lifecycle-bg '"hook_event_name":"Subagent(Start|Stop)"|"tool_name":"Agent"' "Task Agent Bash(echo *) Bash(sleep *)" \
  "Use the subagent tool (named Task or Agent) with subagent_type bdk-probe:probe-sleeper, run_in_background true, and this prompt: Run with the Bash tool, one call each: sleep 5, then echo bg-done. Then reply BG-DONE. Wait until it finishes, then reply with its answer and its agentId." || status=1; }

selected stop-kill && { run_check stop-kill '"tool_name":"TaskStop"|"hook_event_name":"Subagent(Start|Stop)"' "Task Agent TaskStop Bash(echo *) Bash(sleep *)" \
  "Step 1: use the subagent tool (named Task or Agent) with subagent_type bdk-probe:probe-sleeper, run_in_background true, and this prompt: Run with the Bash tool: sleep 60. Then run echo never-printed and reply LATE. Step 2: immediately after it starts, stop it with the TaskStop tool, using its task or agent ID. Reply with the launch result and what TaskStop returned, verbatim." || status=1; }

selected max-turns && { run_check max-turns '"agent_type":"bdk-probe:probe-short"' "Task Agent Bash(echo *)" \
  "Use the subagent tool (named Task or Agent) with subagent_type bdk-probe:probe-short, prompt go, in the foreground. Reply with its answer verbatim." || status=1; }

selected send-live-id && { run_check send-live-id '"tool_name":"SendMessage"' "Task Agent SendMessage Bash(echo *) Bash(sleep *)" \
  "Step 1: use the subagent tool (named Task or Agent) with subagent_type bdk-probe:probe-sleeper, run_in_background true, and this prompt: Run with the Bash tool, one call each and in this order: sleep 20, echo alpha-step-2, sleep 10, echo alpha-step-4. Then reply with every message you received from other agents, verbatim, and after which step each arrived, or NONE. The launch result contains its agentId. Step 2: immediately after, use the subagent tool with subagent_type bdk-probe:probe-spawner in the foreground, with this prompt (put the real agentId from step 1 in place of ID): Use the SendMessage tool with to set to ID and the message PING-FROM-BETA, then report verbatim what the tool returned. Step 3: wait until the step 1 agent finishes. Reply with the step 1 agentId, beta's answer and the step 1 agent's answer, verbatim." || status=1; }

selected agent-schema && { run_check agent-schema '.' "Task Agent Bash(echo *)" \
  "Step 1: list every parameter name of the subagent tool (named Task or Agent) exactly as your tool schema defines it. Step 2: use that tool with subagent_type bdk-probe:probe-spawner in the foreground and this prompt: Quote verbatim any system text you received that lists other agents, their names or IDs (a sibling roster); if there is none, reply NO-ROSTER. Reply with the parameter list and the subagent's answer verbatim." || status=1; }

selected effort && { run_check effort '"agent_type":"bdk-probe:probe-effort-(low|none)"' "Task Agent Bash(echo *)" \
  "Use the subagent tool (named Task or Agent) twice, one after the other, both in the foreground: first with subagent_type bdk-probe:probe-effort-low and prompt go, then with subagent_type bdk-probe:probe-effort-none and prompt go. Reply with both answers verbatim." || status=1; }

# Escalation (T41-D14): the Agent tool's model parameter against the adapter's
# frontmatter model, and effort on a Haiku agent. PostToolUse carries resolvedModel.
selected model-override && { run_check model-override 'bdk-probe:probe-haiku-low' "Task Agent Bash(echo *)" \
  "Step 1: quote verbatim the description and any allowed values your tool schema gives for the model parameter of the subagent tool (named Task or Agent). Step 2: use that tool twice, one after the other, both in the foreground, both with subagent_type bdk-probe:probe-haiku-low and prompt go: first without the model parameter, then with model set to opus. Reply with the step 1 quote and both answers verbatim." || status=1; }

selected subagent-stop-block && { export BDK_PROBE_BLOCK=SubagentStop; run_check subagent-stop-block 'continued-after-SubagentStop' "Task Agent Bash(echo *)" \
  "Use the subagent tool (named Task or Agent) with subagent_type bdk-probe:probe-worker and prompt go, in the foreground. Reply with its answer verbatim." || status=1; unset BDK_PROBE_BLOCK; }

selected stop-block && { export BDK_PROBE_BLOCK=Stop; run_check stop-block 'continued-after-Stop' "Bash(echo *)" \
  "Reply OK and do nothing else." || status=1; unset BDK_PROBE_BLOCK; }

selected inject-id && { export BDK_PROBE_INJECT=1; run_check inject-id 'BDK-AGENT-ID' "Task Agent Bash(echo *)" \
  "Use the subagent tool (named Task or Agent) with subagent_type bdk-probe:probe-spawner in the foreground and this prompt: Quote verbatim every line in your context that starts with BDK-AGENT-ID, or reply NONE. Reply with the subagent's answer verbatim." || status=1; unset BDK_PROBE_INJECT; }

# A subagent leading its own background children (T41 tree topology).
selected lead-wait && { export BDK_PROBE_INJECT=1; run_check lead-wait 'CHILD-DONE' "Task Agent SendMessage Bash(echo *) Bash(sleep *)" \
  "Use the subagent tool (named Task or Agent) with subagent_type bdk-probe:probe-spawner in the foreground and this prompt: Your own agent ID is on the line starting with BDK-AGENT-ID in your context. Use the Agent tool with subagent_type bdk-probe:probe-sleeper, run_in_background true, and this prompt, with your agent ID in place of PARENT: Run with the Bash tool: sleep 8. Then use the SendMessage tool with to set to PARENT and the message PING-FROM-CHILD. Then run sleep 8 and reply CHILD-DONE. After launching it, wait until it finishes, then reply with every message you received from it, verbatim, and its final answer. Reply with the subagent's answer verbatim." || status=1; unset BDK_PROBE_INJECT; }

selected lead-detach && { run_check lead-detach '"hook_event_name":"Subagent(Start|Stop)"' "Task Agent Bash(echo *) Bash(sleep *)" \
  "Use the subagent tool (named Task or Agent) with subagent_type bdk-probe:probe-spawner in the foreground and this prompt: Use the Agent tool with subagent_type bdk-probe:probe-sleeper, run_in_background true, and this prompt: Run with the Bash tool: sleep 10, then reply CHILD-DONE. Right after launching it, reply SPAWNED and end your turn; do not wait for it. Then wait until every background agent of this session has finished and reply with the subagent's answer and anything you learned about the background agent's result, verbatim." || status=1; }

selected lead-fg && { export BDK_PROBE_INJECT=1; run_check lead-fg 'A-DONE' "Task Agent SendMessage Bash(echo *) Bash(sleep *)" \
  "Use the subagent tool (named Task or Agent) with subagent_type bdk-probe:probe-spawner in the foreground and this prompt: Your own agent ID is on the line starting with BDK-AGENT-ID in your context. In ONE message make two Agent tool calls at once, both with subagent_type bdk-probe:probe-sleeper and in the foreground (no run_in_background). Prompt A, with your agent ID in place of PARENT: Run with the Bash tool: sleep 5. Then use the SendMessage tool with to set to PARENT and the message PING-FROM-A. Then run sleep 10 and reply A-DONE. Prompt B: Run with the Bash tool: sleep 20, then reply B-DONE. When both return, reply with every message you received, verbatim, both answers, and whether PING-FROM-A reached you before or after the two Agent calls returned. Reply with the subagent's answer verbatim." || status=1; unset BDK_PROBE_INJECT; }

# Run diagnostics (T47): which event a failed Bash call fires, and a session whose
# transcripts hold every event kind the diagnostics transcript reader reads.
selected post-tool-failure && { run_check post-tool-failure '"hook_event_name":"PostToolUse(Failure)?"' "Bash(echo *) Bash(sh *)" \
  "Use the Bash tool twice, one call each and in this order: echo probe-ok, then sh -c 'echo probe-fail >&2; exit 2'. Then reply DONE." || status=1; }

selected transcript-layout && { run_check transcript-layout '"hook_event_name"' "Skill Task Agent AskUserQuestion Bash(echo *) Bash(sleep *) Bash(node *)" \
  "Do these steps in order, one tool call each. 1: use the Bash tool to run exactly: node $repo/dist/bdk.mjs change status --json. 2: use the Bash tool to run exactly: echo probe-repeat. 3: run exactly the same command again: echo probe-repeat. 4: use the subagent tool (named Task or Agent) with subagent_type bdk-probe:probe-worker and prompt go, in the foreground. 5: use the subagent tool with subagent_type bdk-probe:probe-sleeper, run_in_background true, and this prompt: Run with the Bash tool: sleep 3, then reply BG-DONE. Wait until it finishes. 6: use the AskUserQuestion tool once with the question Continue? and the options Yes and No. 7: call the Skill tool with skill bdk-probe:open-stage and args from-model; its reply line is your final answer." || status=1; }

# A real BDK implementer running a whole part in the background (#166): it commits
# each task through `bdk check run` and stores its report.
selected bdk-part && (
  part_package=$(part_fixture) || { echo "not triggered bdk-part (fixture failed)"; exit 1; }
  # One attempt: a second one would run on the part the first one committed.
  cd bdk-part && bdk_plugin=$repo mode=bypassPermissions attempts=1
  run_check bdk-part 'report of a|kind[^a-z]{0,6}report' "-" \
    "Use the Agent tool with subagent_type bdk:worker, run_in_background true, and this prompt: $part_package. Wait until it finishes, then reply with its answer verbatim."
  rc=$?
  node "$repo/dist/bdk.mjs" agents list --all --json > "$out/bdk-part--Agents.json" 2>&1
  git log --format='%s%n%(trailers)' > "$out/bdk-part--GitLog.txt" 2>&1
  exit $rc
) || status=1

exit $status
