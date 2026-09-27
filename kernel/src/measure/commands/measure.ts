import type { Handler } from "../../shared/registry/index.ts";
import { isRefusal } from "../../shared/refusal/index.ts";
import { renderMeasure } from "../render/measure.ts";
import { measure } from "../use-cases/measure.ts";
import type { MeasureDeps } from "../use-cases/measure.ts";

export function measureCommand(deps: MeasureDeps): Handler {
  return async (context) => {
    const report = await measure(
      deps,
      context.workTree ?? context.cwd,
      context.positionals["<range>"],
    );
    return isRefusal(report) ? report : { data: report, text: renderMeasure(report) };
  };
}
