// The `review render` handler: the Change report, or with `--pr` the pull
// request decision page, which needs no active Change.
import { resolve } from "node:path";

import { globalDir } from "../../shared/config/index.ts";
import { isRefusal, refuse } from "../../shared/refusal/index.ts";
import type { Handler } from "../../shared/registry/index.ts";
import { findProjectRoot } from "../../shared/store/index.ts";
import { firstField, prInputSchema } from "../schema/render.ts";
import { missingOut, renderChangeReport, renderPrPage } from "../use-cases/render.ts";
import type { Format } from "../use-cases/render.ts";
import type { ReviewDeps } from "../use-cases/plan.ts";
import { renderResult } from "../render/render.ts";
import { changeReportHtml, prPageHtml } from "../render/report-html.ts";
import { changeReportMd, prPageMd } from "../render/report-md.ts";
import type { Templates } from "../use-cases/render.ts";

const TEMPLATES: Readonly<Record<Format, Templates>> = {
  html: { change: changeReportHtml, pr: prPageHtml },
  md: { change: changeReportMd, pr: prPageMd },
};

export function renderCommand(deps: ReviewDeps): Handler {
  return async (context) => {
    const format: Format = context.flags["--format"] === "md" ? "md" : "html";
    const templates = TEMPLATES[format];
    const out = context.flags["--out"];
    const pr = context.flags["--pr"];
    const where = { cwd: context.cwd, globalDir: globalDir(context.runtime) };
    if (typeof pr === "string") {
      if (typeof out !== "string") return missingOut();
      const raw =
        pr === "-" ? context.runtime.readStdin() : deps.store.read(resolve(context.cwd, pr));
      if (raw === undefined) {
        return refuse("input/not-found", `--pr ${pr} names no file`, [
          "bdk review render --pr - --out <file>",
        ]);
      }
      let json: unknown;
      try {
        json = JSON.parse(raw);
      } catch {
        return refuse("input/invalid-argument", "--pr input is not JSON", [
          "pass {prs: [{number, url, title, findings: [...]}]}",
        ]);
      }
      const parsed = prInputSchema.safeParse(json);
      if (!parsed.success) {
        return refuse("input/invalid-argument", `--pr input: ${firstField(parsed.error)}`, [
          "pass {prs: [{number, url, title, findings: [{path, line, severity, category, blocking, problem, why, fix}]}]}",
        ]);
      }
      const projectRoot = findProjectRoot(deps.store, context.cwd, context.workTree ?? context.cwd);
      const result = renderPrPage(
        deps,
        { ...where, projectRoot },
        { format, out, prs: parsed.data, templates },
      );
      return isRefusal(result) ? result : { data: result, text: renderResult(result) };
    }
    const change = context.resolveChange?.();
    if (change === undefined) throw new Error("review render resolves its Change in the handler");
    if (isRefusal(change)) return change;
    const result = await renderChangeReport(deps, change, {
      format,
      out: typeof out === "string" ? out : undefined,
      ...where,
      templates,
    });
    return isRefusal(result) ? result : { data: result, text: renderResult(result) };
  };
}
