import { globalDir } from "../../shared/config/index.ts";
import { isRefusal, refuse } from "../../shared/refusal/index.ts";
import type { Refusal } from "../../shared/refusal/index.ts";
import { stdinBody } from "../../shared/registry/index.ts";
import type { Handler } from "../../shared/registry/index.ts";
import { findProjectRoot, resolveActiveChange } from "../../shared/store/index.ts";
import { renderLogPath, renderReport, renderSlice, renderWritePath } from "../render/report.ts";
import { diagnosticsLog } from "../use-cases/log.ts";
import { diagnosticsSlice } from "../use-cases/slice.ts";
import { diagnosticsWrite } from "../use-cases/write.ts";
import { diagnosticsReport } from "../use-cases/report.ts";
import type { DiagnosticsDeps, Place } from "../use-cases/report.ts";

type Context = Parameters<Handler>[0];

/** Events before and after the cited one without --before or --after. */
const SLICE_DEFAULT = 10;

function place(deps: DiagnosticsDeps, context: Context): Place {
  return {
    projectRoot: findProjectRoot(deps.store, context.cwd, context.workTree ?? context.cwd),
    globalDir: globalDir(context.runtime),
  };
}

function text(context: Context, name: string): string | undefined {
  const value = context.flags[name];
  return typeof value === "string" ? value : undefined;
}

/** The active Change, read only to choose the default session. */
function activeChange(deps: DiagnosticsDeps, context: Context) {
  return () =>
    resolveActiveChange(deps.store, deps.git, {
      cwd: context.cwd,
      workTree: context.workTree ?? context.cwd,
    });
}

export function reportCommand(deps: DiagnosticsDeps): Handler {
  return async (context) => {
    const report = await diagnosticsReport(
      deps,
      place(deps, context),
      { session: text(context, "--session"), stage: text(context, "--stage") },
      activeChange(deps, context),
    );
    return isRefusal(report) ? report : { data: report, text: renderReport(report) };
  };
}

export function logCommand(deps: DiagnosticsDeps): Handler {
  return async (context) => {
    const report = await diagnosticsLog(
      deps,
      place(deps, context),
      { session: text(context, "--session"), full: context.flags["--full"] === true },
      activeChange(deps, context),
    );
    return isRefusal(report) ? report : { data: report, text: renderLogPath(report) };
  };
}

export function sliceCommand(deps: DiagnosticsDeps): Handler {
  return async (context) => {
    const before = count(context, "--before");
    const after = count(context, "--after");
    if (typeof before !== "number") return before;
    if (typeof after !== "number") return after;
    const report = await diagnosticsSlice(
      deps,
      place(deps, context),
      {
        cite: context.positionals["<cite>"] ?? "",
        session: text(context, "--session"),
        before,
        after,
      },
      activeChange(deps, context),
    );
    return isRefusal(report) ? report : { data: report, text: renderSlice(report) };
  };
}

function count(context: Context, name: string): number | Refusal {
  const raw = text(context, name);
  if (raw === undefined) return SLICE_DEFAULT;
  return /^\d+$/.test(raw)
    ? Number(raw)
    : refuse("input/invalid-argument", `${name} must be a whole number of events`, [
        `bdk diagnostics slice ${context.positionals["<cite>"] ?? "<cite>"} ${name} 10`,
      ]);
}

export function writeCommand(deps: DiagnosticsDeps): Handler {
  return async (context) => {
    const markdown = await stdinBody(context.runtime, ["bdk diagnostics write < report.md"]);
    if (typeof markdown !== "string") return markdown;
    const report = await diagnosticsWrite(
      deps,
      place(deps, context),
      { session: text(context, "--session"), markdown },
      activeChange(deps, context),
    );
    return isRefusal(report) ? report : { data: report, text: renderWritePath(report) };
  };
}
