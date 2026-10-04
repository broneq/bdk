import type { RenderResult } from "../domain/render.ts";

export function renderResult(result: RenderResult): string {
  return `wrote ${result.path}: ${String(result.undecided.length)} undecided, ${String(result.decided.length)} decided\n`;
}
