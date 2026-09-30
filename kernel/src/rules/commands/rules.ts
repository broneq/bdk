// The rules handlers other than `show` (T31): flags in, use case, `--json`
// object or text out. None is Change-scoped: the project root comes from the
// working directory, so `accept` runs in the audit's own session.
import { globalDir } from "../../shared/config/index.ts";
import { capLines } from "../../shared/output/index.ts";
import { isRefusal, refuse } from "../../shared/refusal/index.ts";
import type { Refusal } from "../../shared/refusal/index.ts";
import type { FlagValue, Handler } from "../../shared/registry/index.ts";
import { findProjectRoot } from "../../shared/store/index.ts";
import type { Role } from "../../shared/vocabulary/index.ts";
import {
  renderAccept,
  renderCheck,
  renderExplain,
  renderExport,
  renderImport,
  renderPrune,
  renderStats,
} from "../render/outputs.ts";
import { acceptRule } from "../use-cases/accept.ts";
import type { AcceptInput } from "../use-cases/accept.ts";
import { checkRules } from "../use-cases/check.ts";
import type { RulesDeps } from "../use-cases/deps.ts";
import { explainRules } from "../use-cases/explain.ts";
import { exportRules } from "../use-cases/export.ts";
import { importRules } from "../use-cases/import.ts";
import { pruneRules } from "../use-cases/prune.ts";
import { ruleStats } from "../use-cases/stats.ts";

type Context = Parameters<Handler>[0];

function text(value: FlagValue | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function list(value: FlagValue | undefined): string[] {
  if (value === undefined || value === true) return [];
  return typeof value === "string" ? [value] : [...value];
}

function projectRoot(deps: RulesDeps, context: Context): string {
  return findProjectRoot(deps.store, context.cwd, context.workTree ?? context.cwd);
}

/** A positive integer flag, undefined when absent, or the refusal naming it. */
function positive(context: Context, name: string): number | undefined | Refusal {
  const value = text(context.flags[name]);
  if (value === undefined) return undefined;
  if (!/^[1-9][0-9]*$/.test(value)) {
    return refuse("input/invalid-argument", `${name} is ${value}; expected a positive integer`, [
      `bdk ${context.record.argv.join(" ")} ${name} 3`,
    ]);
  }
  return Number(value);
}

export function checkCommand(deps: RulesDeps): Handler {
  return (context) => {
    const report = checkRules(
      deps,
      projectRoot(deps, context),
      globalDir(context.runtime),
      context.cwd,
      context.positionals["<path>"],
    );
    return isRefusal(report) ? report : { data: report, text: renderCheck(report) };
  };
}

export function explainCommand(deps: RulesDeps): Handler {
  return (context) => {
    const report = explainRules(
      deps,
      projectRoot(deps, context),
      globalDir(context.runtime),
      context.cwd,
      context.positionals["<file>"] ?? "",
      (text(context.flags["--role"]) ?? "implementer") as Role,
    );
    return isRefusal(report) ? report : { data: report, text: renderExplain(report) };
  };
}

export function pruneCommand(deps: RulesDeps): Handler {
  return async (context) => {
    const uncited = positive(context, "--uncited");
    if (typeof uncited === "object") return uncited;
    const page = await pruneRules(
      deps,
      projectRoot(deps, context),
      globalDir(context.runtime),
      uncited,
    );
    return isRefusal(page) ? page : { data: page, text: capLines(renderPrune(page)) };
  };
}

export function importCommand(deps: RulesDeps): Handler {
  return (context) => {
    const report = importRules(deps, projectRoot(deps, context), globalDir(context.runtime), {
      cwd: context.cwd,
      dir: context.positionals["<dir>"],
      dryRun: context.flags["--dry-run"] === true,
      prefix: text(context.flags["--prefix"]),
    });
    return isRefusal(report) ? report : { data: report, text: capLines(renderImport(report)) };
  };
}

export function exportCommand(deps: RulesDeps): Handler {
  return (context) => {
    const report = exportRules(
      deps,
      projectRoot(deps, context),
      globalDir(context.runtime),
      context.flags["--check"] === true,
    );
    return isRefusal(report) ? report : { data: report, text: renderExport(report) };
  };
}

export function statsCommand(deps: RulesDeps): Handler {
  return async (context) => {
    const minChanges = positive(context, "--min-changes");
    if (typeof minChanges === "object") return minChanges;
    const all = context.flags["--all"] === true;
    const report = await ruleStats(deps, projectRoot(deps, context), globalDir(context.runtime), {
      minChanges,
      entries: context.flags["--entries"] === true,
      all,
    });
    return isRefusal(report)
      ? report
      : { data: report, text: capLines(renderStats(report), { all }) };
  };
}

export function acceptCommand(deps: RulesDeps): Handler {
  return async (context) => {
    const prefix = text(context.flags["--prefix"]);
    if (prefix === undefined) {
      return refuse("input/missing-argument", "rules accept needs --prefix <PREFIX>", [
        'bdk rules accept "<text>" --prefix <PREFIX>',
      ]);
    }
    const body = context.positionals["<text>"] ?? "";
    const input: AcceptInput = {
      text: body === "-" ? context.runtime.readStdin() : body,
      prefix,
      kind: (text(context.flags["--kind"]) ?? "house") as AcceptInput["kind"],
      severity: (text(context.flags["--severity"]) ?? "medium") as AcceptInput["severity"],
      applies: list(context.flags["--applies"]),
      roles: list(context.flags["--role"]),
      from: list(context.flags["--from"]),
      source: text(context.flags["--source"]),
      verified: text(context.flags["--verified"]),
    };
    const report = await acceptRule(
      deps,
      projectRoot(deps, context),
      globalDir(context.runtime),
      input,
    );
    return isRefusal(report) ? report : { data: report, text: renderAccept(report) };
  };
}
