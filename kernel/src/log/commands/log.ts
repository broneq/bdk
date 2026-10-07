// The log handlers (T20, T23 `ingest`): flags in, use case, `--json` object or text out.
import { resolve } from "node:path";

import { globalDir } from "../../shared/config/index.ts";
import { stdinBody } from "../../shared/registry/index.ts";
import type { FlagValue, Handler } from "../../shared/registry/index.ts";
import { isRefusal, refuse } from "../../shared/refusal/index.ts";
import { capLines, listPage } from "../../shared/output/index.ts";
import type { ActiveChange } from "../../shared/registry/index.ts";
import type { Disposition } from "../../shared/vocabulary/index.ts";
import {
  renderAdd,
  renderDecide,
  renderIngest,
  renderList,
  renderResolve,
  renderShow,
  renderTriage,
} from "../render/log.ts";
import { addEntry } from "../use-cases/add.ts";
import { decideEntry } from "../use-cases/decide.ts";
import type { LogDeps } from "../use-cases/deps.ts";
import { ingestReport } from "../use-cases/ingest.ts";
import { triageEntry } from "../use-cases/triage.ts";
import { listLog } from "../use-cases/list.ts";
import { resolveEntry } from "../use-cases/resolve.ts";
import { showEntry } from "../use-cases/show.ts";

function text(value: FlagValue | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function list(value: FlagValue | undefined): string[] {
  if (value === undefined || value === true) return [];
  return typeof value === "string" ? [value] : [...value];
}

/** The registry sets `change` for every Change-scoped record before the handler runs. */
function active(change: ActiveChange | undefined): ActiveChange {
  if (change === undefined) throw new Error("log commands are Change-scoped");
  return change;
}

export function addCommand(deps: LogDeps): Handler {
  return async (context) => {
    const flag = text(context.flags["--body"]);
    const body =
      flag === "-"
        ? await stdinBody(context.runtime, ['bdk log add <type> "<summary>" --body "<text>"'])
        : (flag ?? "");
    if (typeof body !== "string") return body;
    const result = await addEntry(deps, active(context.change), globalDir(context.runtime), {
      type: context.positionals.type ?? "",
      summary: context.positionals["<summary>"] ?? "",
      refs: list(context.flags["--ref"]),
      body,
      review: context.flags["--review"] === true,
      ...optional("status", text(context.flags["--status"])),
      ...optional("ticket", text(context.flags["--ticket"])),
      ...optional("supersedes", text(context.flags["--supersedes"])),
      ...optional("category", text(context.flags["--category"])),
      ...optional("severity", text(context.flags["--severity"])),
      ...(context.flags["--applies"] === undefined
        ? {}
        : { applies: list(context.flags["--applies"]) }),
    });
    return isRefusal(result) ? result : { data: result, text: renderAdd(result) };
  };
}

export function ingestCommand(deps: LogDeps): Handler {
  return async (context) => {
    const ticket = text(context.flags["--ticket"]);
    const file = text(context.flags["--file"]);
    if (ticket === undefined || file === undefined) {
      return refuse(
        "input/missing-argument",
        "log ingest needs --ticket, the role's open ticket, and --file, the report; stdin is never read",
        [`bdk log ingest --ticket ${ticket ?? "<ticket>"} --file <draft>`],
      );
    }
    const input = deps.store.read(resolve(context.cwd, file));
    if (input === undefined) {
      return refuse("input/not-found", `--file ${file} names no file`, [
        "write the report to the draft path of your package, then run log ingest again",
      ]);
    }
    if (input.trim() === "") {
      return refuse(
        "input/missing-argument",
        `${file} is empty; log ingest reads the report, its envelope as frontmatter`,
        [`bdk log ingest --ticket ${ticket} --file <draft>`],
      );
    }
    const report = await ingestReport(deps, active(context.change), { ticket, text: input });
    return isRefusal(report) ? report : { data: report, text: renderIngest(report) };
  };
}

export function listCommand(deps: LogDeps): Handler {
  return async (context) => {
    const all = context.flags["--all"] === true;
    const target = text(context.flags["--for"]);
    const items = await listLog(deps, active(context.change), {
      ...optional("type", text(context.flags["--type"])),
      ...optional("status", text(context.flags["--status"])),
      ...(context.flags["--review"] === true ? { review: true } : {}),
      ...optional("for", target),
      ...optional("sinceTicket", text(context.flags["--since-ticket-start"])),
    });
    if (isRefusal(items)) return items;
    return {
      data: listPage(items, { all, ...optional("for", target) }),
      text: capLines(renderList(items), { all }),
    };
  };
}

export function showCommand(deps: LogDeps): Handler {
  return async (context) => {
    const shown = await showEntry(deps, active(context.change), context.positionals["<id>"] ?? "");
    return isRefusal(shown) ? shown : { data: shown, text: renderShow(shown) };
  };
}

export function resolveCommand(deps: LogDeps): Handler {
  return async (context) => {
    const result = await resolveEntry(deps, active(context.change), {
      id: context.positionals["<id>"] ?? "",
      status: context.positionals.status ?? "",
      ...optional("by", text(context.flags["--by"])),
      ...optional("reason", text(context.flags["--reason"])),
    });
    return isRefusal(result) ? result : { data: result, text: renderResolve(result) };
  };
}

export function triageCommand(deps: LogDeps): Handler {
  return async (context) => {
    const result = await triageEntry(deps, active(context.change), {
      id: context.positionals["<id>"] ?? "",
      level: context.positionals.level ?? "",
      ...optional("reason", text(context.flags["--reason"])),
    });
    return isRefusal(result) ? result : { data: result, text: renderTriage(result) };
  };
}

export function decideCommand(deps: LogDeps): Handler {
  return async (context) => {
    const result = await decideEntry(deps, active(context.change), {
      id: context.positionals["<id>"] ?? "",
      // The registry checks the value against the record's `values` before the handler runs.
      disposition: (context.positionals.disposition ?? "defer") as Disposition,
      ...optional("reason", text(context.flags["--reason"])),
      ...optional("issue", text(context.flags["--issue"])),
      review: context.flags["--review"] === true,
    });
    return isRefusal(result) ? result : { data: result, text: renderDecide(result) };
  };
}

/** `{key: value}` when the value is present, `{}` otherwise (exact optional properties). */
function optional<K extends string>(key: K, value: string | undefined): Partial<Record<K, string>> {
  return value === undefined ? {} : ({ [key]: value } as Partial<Record<K, string>>);
}
