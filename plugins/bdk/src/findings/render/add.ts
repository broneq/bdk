import type { AddResult } from "../schema/add.ts";

export function renderAdd({ id }: AddResult): string {
  return id;
}
