import type { LevelResult } from "../schema/level.ts";

export function renderLevel({ id, level }: LevelResult): string {
  return `${id} level ${level}`;
}
