import type { DecideResult } from "../schema/decide.ts";

export function renderDecide({ id, decision, issue }: DecideResult): string {
  return `${id} decision ${decision}${issue === undefined ? "" : ` ${issue}`}`;
}
