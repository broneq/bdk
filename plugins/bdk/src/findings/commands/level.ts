import type { Command } from "../../shared/cli/index.ts";
import type { Files } from "../../shared/fs/index.ts";
import { LEVELS } from "../domain/events.ts";
import { renderLevel } from "../render/level.ts";
import { setLevel } from "../use-cases/level.ts";
import { arg, LOG, text } from "./flags.ts";

export function level(files: Files): Command {
  return {
    verb: "level",
    summary: "Append the level of a finding; the latest level counts",
    arguments: [
      LOG,
      { name: "id", description: "The finding id, as add printed it", required: true },
      { name: "level", description: LEVELS.join(", "), required: true },
    ],
    flags: { reason: { type: "string", description: "Why this level, in one line" } },
    run(input) {
      const result = setLevel(files, {
        log: arg(input, "log"),
        id: arg(input, "id"),
        level: arg(input, "level"),
        reason: text(input, "reason"),
      });
      return { data: result, text: renderLevel(result) };
    },
  };
}
