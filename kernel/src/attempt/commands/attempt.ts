// The four attempt handlers: arguments in, use case, `--json` object or text out.
import { globalDir } from "../../shared/config/index.ts";
import { capLines, listPage } from "../../shared/output/index.ts";
import { isRefusal } from "../../shared/refusal/index.ts";
import type { ActiveChange, FlagValue, Handler } from "../../shared/registry/index.ts";
import { renderClose, renderList, renderOpen, renderShow } from "../render/attempt.ts";
import { closeAttempt } from "../use-cases/close.ts";
import type { AttemptDeps } from "../use-cases/deps.ts";
import { listAttempts } from "../use-cases/list.ts";
import { openAttempt } from "../use-cases/open.ts";
import { showAttempt } from "../use-cases/show.ts";

function text(value: FlagValue | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}

/** The registry sets `change` for every Change-scoped record before the handler runs. */
function active(change: ActiveChange | undefined): ActiveChange {
  if (change === undefined) throw new Error("attempt commands are Change-scoped");
  return change;
}

export function openCommand(deps: AttemptDeps): Handler {
  return async (context) => {
    const report = await openAttempt(deps, active(context.change), globalDir(context.runtime), {
      loop: context.positionals["<loop>"] ?? "",
      target: context.positionals["<target>"] ?? "",
      escalate: context.flags["--escalate"] === true,
    });
    return isRefusal(report) ? report : { data: report, text: renderOpen(report) };
  };
}

export function closeCommand(deps: AttemptDeps): Handler {
  return async (context) => {
    const report = await closeAttempt(
      deps,
      active(context.change),
      { cwd: context.cwd, globalDir: globalDir(context.runtime) },
      {
        ticket: context.positionals["<ticket>"] ?? "",
        outcome: context.positionals.outcome ?? "",
        envelope: text(context.flags["--envelope"]),
        reason: text(context.flags["--reason"]),
      },
    );
    return isRefusal(report) ? report : { data: report, text: renderClose(report) };
  };
}

export function listCommand(deps: AttemptDeps): Handler {
  return async (context) => {
    const all = context.flags["--all"] === true;
    const target = text(context.flags["--for"]);
    const report = await listAttempts(deps, active(context.change), globalDir(context.runtime), {
      for: target,
      all,
    });
    if (isRefusal(report)) return report;
    const page = listPage(report.items, { all, ...(target === undefined ? {} : { for: target }) });
    return {
      data: { ...page, ...(report.budgets === undefined ? {} : { budgets: report.budgets }) },
      text: capLines(renderList(report), { all }),
    };
  };
}

export function showCommand(deps: AttemptDeps): Handler {
  return async (context) => {
    const report = await showAttempt(
      deps,
      active(context.change),
      globalDir(context.runtime),
      context.positionals["<ticket>"] ?? "",
    );
    return isRefusal(report) ? report : { data: report, text: renderShow(report) };
  };
}
