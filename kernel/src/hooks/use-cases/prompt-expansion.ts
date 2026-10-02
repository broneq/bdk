// `bdk hooks prompt-expansion` (`kernel-cli/hooks`, Prompt-expansion outcomes;
// T24 design D-12, T41 design D2 to D5): the only writer of `source: user`
// stage transitions and the start of a run. A typed stage command ends its
// session's run and passes its gate when the gate is ready; `/bdk:run` writes
// the session's run marker and passes the ready gates its policy allows.
import { readGraph, stageOfCommand } from "../../graph/index.ts";
import { withChangeIndex } from "../../log/index.ts";
import { isRefusal, refuse } from "../../shared/refusal/index.ts";
import type { Refusal } from "../../shared/refusal/index.ts";
import type { ActiveChange } from "../../shared/registry/index.ts";
import { removeRunMarker, SESSION_ID, writeRunMarker } from "../../shared/store/index.ts";
import { expansionPayload } from "../domain/payload.ts";
import type { ExpansionPayload } from "../domain/payload.ts";
import type { PromptExpansionReport } from "../domain/report.ts";
import { bdkProject } from "./agents.ts";
import type { HookPlace } from "./agents.ts";
import type { HooksDeps } from "./input.ts";
import { enterStage, NAMESPACE, runGates, SKIP_VERIFY, writer } from "./stage-entry.ts";
import type { StageCall } from "./stage-entry.ts";

export interface PromptExpansionInput extends HookPlace {
  /** Resolves the Change bound to the branch; called only for a stage command or `run`. */
  readonly resolveChange: () => ActiveChange | Refusal;
}

const AUTO = "--auto";

export async function promptExpansion(
  deps: HooksDeps,
  input: PromptExpansionInput,
  raw: string,
): Promise<PromptExpansionReport | Refusal> {
  const payload = expansionPayload(raw);
  if (payload === undefined) return unmarked("a JSON object body");
  if (payload.commandName === undefined) return unmarked("command_name");
  if (!payload.commandName.startsWith(NAMESPACE)) return quiet(payload.commandName);
  const command = payload.commandName.slice(NAMESPACE.length);
  const stage = stageOfCommand(deps, `/${payload.commandName}`);
  if (command !== "run" && stage === undefined) return quiet(command);

  const missing = missingMarker(payload);
  if (missing !== undefined) return unmarked(missing);
  const call: StageCall = {
    command,
    session: payload.session ?? "",
    prompt: payload.prompt ?? `/${payload.commandName} ${payload.args ?? ""}`.trim(),
  };
  if (stage === undefined) return startRun(deps, input, call, payload.args ?? "");

  // A typed stage command hands the Change back to the user (T41 design D2).
  const project = bdkProject(deps, input);
  if (project !== undefined) removeRunMarker(deps.store, project, call.session);
  const change = input.resolveChange();
  if (isRefusal(change)) return change;
  return withChangeIndex(deps, change, async (index) => {
    const read = await readGraph(deps, change, index, input.globalDir);
    if (isRefusal(read)) return read;
    const skipVerify = command === "execute" && tokens(payload.args).includes(SKIP_VERIFY);
    const write = writer(deps, change, index, call);
    return enterStage(deps, change, read, call, stage, skipVerify, { by: "user" }, write);
  });
}

/** `/bdk:run [--auto] [<intent>]` (T41 design D4, D5). */
async function startRun(
  deps: HooksDeps,
  input: PromptExpansionInput,
  call: StageCall,
  args: string,
): Promise<PromptExpansionReport | Refusal> {
  if (!SESSION_ID.test(call.session)) {
    return refuse(
      "input/invalid-argument",
      `session_id ${call.session} cannot name a run marker; no run was started`,
      ["type /bdk:run again in a Claude Code session", "bdk doctor"],
    );
  }
  const words = tokens(args);
  const auto = words[0] === AUTO;
  const intent = (auto ? words.slice(1) : words).length > 0;
  const mark = (projectRoot: string): void => {
    writeRunMarker(deps.store, projectRoot, {
      schema: 1,
      session: call.session,
      prompt: call.prompt,
      auto,
      at: deps.clock.now(),
      "change-started": false,
    });
  };

  const change = input.resolveChange();
  if (isRefusal(change)) {
    if (change.rule !== "policy/no-active-change") return change;
    if (!intent) {
      return refuse(
        "policy/no-active-change",
        `${change.why}, and /${NAMESPACE}run names no intent to start one`,
        [`/${NAMESPACE}run "<intent>"`, "bdk change list"],
      );
    }
    const project = bdkProject(deps, input);
    if (project === undefined) return change;
    mark(project);
    return { decision: "pass", command: call.command, wrote: "none", run: { auto, intent } };
  }
  if (intent) {
    return refuse(
      "policy/change-exists",
      `${change.id} is active on this branch, so /${NAMESPACE}run cannot start another Change from an intent`,
      [`/${NAMESPACE}run`, "bdk change park"],
    );
  }
  return withChangeIndex(deps, change, async (index) => {
    const read = await readGraph(deps, change, index, input.globalDir);
    if (isRefusal(read)) return read;
    mark(change.projectRoot);
    const gates = await runGates(read, call, auto, writer(deps, change, index, call));
    if (isRefusal(gates)) return gates;
    return {
      decision: "pass",
      command: call.command,
      wrote: gates.passed.length > 0 ? "transition:policy" : "none",
      ...gates,
      run: { auto, intent },
    };
  });
}

function tokens(args: string | undefined): string[] {
  return (args ?? "").split(/\s+/).filter((token) => token !== "");
}

/** The first field of the user-typed marker (HOST-FACTS `upe-fields`) the payload lacks. */
function missingMarker(payload: ExpansionPayload): string | undefined {
  if (payload.event !== "UserPromptExpansion") return "hook_event_name UserPromptExpansion";
  if (payload.expansionType !== "slash_command") return "expansion_type slash_command";
  if (payload.session === undefined) return "session_id";
  return undefined;
}

function unmarked(field: string): Refusal {
  return refuse(
    "input/invalid-argument",
    `the UserPromptExpansion payload has no ${field}; no transition was written`,
    ["type the stage command yourself", "bdk doctor"],
  );
}

function quiet(command: string): PromptExpansionReport {
  return { decision: "pass", command, wrote: "none" };
}
