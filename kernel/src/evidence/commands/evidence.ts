// The evidence handlers: arguments in, use case, `--json` object or text out.
import { globalDir } from "../../shared/config/index.ts";
import { isRefusal } from "../../shared/refusal/index.ts";
import type { ActiveChange, FlagValue, Handler } from "../../shared/registry/index.ts";
import { renderRecord } from "../render/evidence.ts";
import type { EvidenceDeps } from "../use-cases/deps.ts";
import { recordEvidence } from "../use-cases/record.ts";

function text(value: FlagValue | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function list(value: FlagValue | undefined): string[] {
  if (value === undefined || value === true) return [];
  return typeof value === "string" ? [value] : [...value];
}

/** The registry sets `change` for every Change-scoped record before the handler runs. */
function active(change: ActiveChange | undefined): ActiveChange {
  if (change === undefined) throw new Error("evidence commands are Change-scoped");
  return change;
}

export function recordCommand(deps: EvidenceDeps): Handler {
  return async (context) => {
    const report = await recordEvidence(
      deps,
      active(context.change),
      { cwd: context.cwd, globalDir: globalDir(context.runtime) },
      {
        kind: context.positionals["<kind>"] ?? "",
        files: context.lists["<file>"] ?? [],
        ticket: text(context.flags["--ticket"]),
        verdict: text(context.flags["--verdict"]),
        citations: list(context.flags["--cite"]),
      },
    );
    return isRefusal(report) ? report : { data: report, text: renderRecord(report) };
  };
}
