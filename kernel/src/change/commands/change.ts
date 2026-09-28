// The change handlers (T20, T22 `checkpoint` and `takeover`): arguments in,
// use case, `--json` object or text out.
import { globalDir } from "../../shared/config/index.ts";
import { capLines, listPage } from "../../shared/output/index.ts";
import { isRefusal } from "../../shared/refusal/index.ts";
import type { ActiveChange, FlagValue, Handler } from "../../shared/registry/index.ts";
import { findProjectRoot } from "../../shared/store/index.ts";
import {
  renderCheckpoint,
  renderClose,
  renderList,
  renderNew,
  renderPark,
  renderResume,
  renderStatus,
  renderTakeover,
} from "../render/change.ts";
import { checkpoint } from "../use-cases/checkpoint.ts";
import { closeChange } from "../use-cases/close.ts";
import type { ChangeDeps } from "../use-cases/deps.ts";
import { listAllChanges } from "../use-cases/list.ts";
import { newChange } from "../use-cases/new.ts";
import { parkChange } from "../use-cases/park.ts";
import { resumeChange } from "../use-cases/resume.ts";
import { changeStatus } from "../use-cases/status.ts";
import { takeover } from "../use-cases/takeover.ts";

function text(value: FlagValue | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function values(value: FlagValue | undefined): string[] {
  if (value === undefined || value === true) return [];
  return typeof value === "string" ? [value] : [...value];
}

/** The registry sets `change` for every Change-scoped record before the handler runs. */
function active(change: ActiveChange | undefined): ActiveChange {
  if (change === undefined) throw new Error("this change command is Change-scoped");
  return change;
}

export function newCommand(deps: ChangeDeps): Handler {
  return async (context) => {
    const report = await newChange(
      deps,
      { cwd: context.cwd, workTree: context.workTree ?? context.cwd, environment: context.runtime },
      {
        intent: context.positionals["<intent>"] ?? "",
        kind: context.flags["--kind"] === "bug" ? "bug" : "feature",
        profile: text(context.flags["--profile"]),
        reason: text(context.flags["--reason"]),
        inferred: context.flags["--inferred"] === true,
      },
    );
    return isRefusal(report) ? report : { data: report, text: renderNew(report) };
  };
}

export function statusCommand(deps: ChangeDeps): Handler {
  return async (context) => {
    const report = await changeStatus(deps, active(context.change), globalDir(context.runtime));
    return isRefusal(report) ? report : { data: report, text: renderStatus(report) };
  };
}

export function listCommand(deps: ChangeDeps): Handler {
  return async (context) => {
    const all = context.flags["--all"] === true;
    const projectRoot = findProjectRoot(deps.store, context.cwd, context.workTree ?? context.cwd);
    const items = await listAllChanges(deps, projectRoot, { archived: all });
    return { data: listPage(items, { all }), text: capLines(renderList(items), { all }) };
  };
}

export function resumeCommand(deps: ChangeDeps): Handler {
  return async (context) => {
    const report = await resumeChange(
      deps,
      {
        cwd: context.cwd,
        workTree: context.workTree ?? context.cwd,
        globalDir: globalDir(context.runtime),
      },
      {
        id: context.positionals["<id>"] ?? "",
        option: text(context.flags["--option"]),
        profile: text(context.flags["--profile"]),
      },
    );
    return isRefusal(report) ? report : { data: report, text: renderResume(report) };
  };
}

export function parkCommand(deps: ChangeDeps): Handler {
  return async (context) => {
    const report = await parkChange(deps, active(context.change), globalDir(context.runtime), {
      reason: text(context.flags["--reason"]),
      options: values(context.flags["--option"]),
    });
    return isRefusal(report) ? report : { data: report, text: renderPark(report) };
  };
}

export function checkpointCommand(deps: ChangeDeps): Handler {
  return async (context) => {
    const report = await checkpoint(deps, active(context.change), globalDir(context.runtime));
    return isRefusal(report) ? report : { data: report, text: renderCheckpoint(report) };
  };
}

export function takeoverCommand(deps: ChangeDeps): Handler {
  return async (context) => {
    const report = await takeover(deps, active(context.change), {
      closeTickets: context.flags["--close-tickets"] === true,
    });
    return isRefusal(report) ? report : { data: report, text: renderTakeover(report) };
  };
}

export function closeCommand(deps: ChangeDeps): Handler {
  return async (context) => {
    const dryRun = context.flags["--dry-run"] === true;
    const report = await closeChange(deps, active(context.change), globalDir(context.runtime), {
      dryRun,
    });
    return isRefusal(report) ? report : { data: report, text: renderClose(report, dryRun) };
  };
}
