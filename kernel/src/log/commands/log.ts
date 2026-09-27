// The four T20 log handlers: flags in, use case, `--json` object or text out.
import type { FlagValue, Handler } from "../../shared/registry/index.ts";
import { isRefusal } from "../../shared/refusal/index.ts";
import { capLines, listPage } from "../../shared/output/index.ts";
import type { ActiveChange } from "../../shared/registry/index.ts";
import { renderAdd, renderList, renderResolve, renderShow } from "../render/log.ts";
import { addEntry } from "../use-cases/add.ts";
import type { LogDeps } from "../use-cases/deps.ts";
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
    const body = text(context.flags["--body"]);
    const result = await addEntry(deps, active(context.change), {
      type: context.positionals.type ?? "",
      summary: context.positionals["<summary>"] ?? "",
      refs: list(context.flags["--ref"]),
      body: body === "-" ? context.runtime.readStdin() : (body ?? ""),
      review: context.flags["--review"] === true,
      ...optional("status", text(context.flags["--status"])),
      ...optional("ticket", text(context.flags["--ticket"])),
      ...optional("supersedes", text(context.flags["--supersedes"])),
    });
    return isRefusal(result) ? result : { data: result, text: renderAdd(result) };
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
    });
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

/** `{key: value}` when the value is present, `{}` otherwise (exact optional properties). */
function optional<K extends string>(key: K, value: string | undefined): Partial<Record<K, string>> {
  return value === undefined ? {} : ({ [key]: value } as Partial<Record<K, string>>);
}
