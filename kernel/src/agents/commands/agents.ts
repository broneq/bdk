import { globalDir } from "../../shared/config/index.ts";
import { isRefusal, refuse } from "../../shared/refusal/index.ts";
import type { Handler } from "../../shared/registry/index.ts";
import { findProjectRoot } from "../../shared/store/index.ts";
import { renderList, renderShow, renderWait } from "../render/agents.ts";
import type { AgentsDeps } from "../use-cases/deps.ts";
import { AGENT_STATES, listAgents, showAgent } from "../use-cases/list.ts";
import type { AgentState } from "../use-cases/list.ts";
import { WAIT_DEFAULT_SECONDS, waitFor } from "../use-cases/wait.ts";

type Context = Parameters<Handler>[0];

function place(deps: AgentsDeps, context: Context) {
  return {
    projectRoot: findProjectRoot(deps.store, context.cwd, context.workTree ?? context.cwd),
    globalDir: globalDir(context.runtime),
  };
}

function text(context: Context, name: string): string | undefined {
  const value = context.flags[name];
  return typeof value === "string" ? value : undefined;
}

export function listCommand(deps: AgentsDeps): Handler {
  return async (context) => {
    const state = text(context, "--state");
    if (state !== undefined && !(AGENT_STATES as readonly string[]).includes(state)) {
      return refuse("input/invalid-argument", `--state must be one of ${AGENT_STATES.join(", ")}`, [
        "bdk agents list --state running",
      ]);
    }
    const childrenOf = text(context, "--children-of");
    const affectedBy = text(context, "--affected-by");
    const report = await listAgents(
      deps,
      place(deps, context),
      {
        ...(childrenOf === undefined ? {} : { childrenOf }),
        ...(affectedBy === undefined ? {} : { affectedBy }),
        ...(state === undefined ? {} : { state: state as AgentState }),
        all: context.flags["--all"] === true,
      },
      () => {
        if (context.resolveChange === undefined) {
          throw new Error("agents list resolves the Change in its handler");
        }
        return context.resolveChange();
      },
    );
    return isRefusal(report) ? report : { data: report, text: renderList(report) };
  };
}

export function showCommand(deps: AgentsDeps): Handler {
  return async (context) => {
    const report = await showAgent(
      deps,
      place(deps, context),
      context.positionals["<agent-id>"] ?? "",
    );
    return isRefusal(report) ? report : { data: report, text: renderShow(report) };
  };
}

export function waitCommand(deps: AgentsDeps): Handler {
  return async (context) => {
    const raw = text(context, "--timeout");
    const timeout = raw === undefined ? WAIT_DEFAULT_SECONDS : Number(raw);
    const report = await waitFor(
      deps,
      place(deps, context),
      context.positionals["<agent-id>"] ?? "",
      timeout,
    );
    return isRefusal(report) ? report : { data: report, text: renderWait(report) };
  };
}
