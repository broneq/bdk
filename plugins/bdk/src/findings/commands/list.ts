import type { Command } from "../../shared/cli/index.ts";
import type { Files } from "../../shared/fs/index.ts";
import { DECISIONS, LEVELS } from "../domain/events.ts";
import { renderList } from "../render/list.ts";
import { listFindings } from "../use-cases/list.ts";
import { arg, LOG, text } from "./flags.ts";

export function list(files: Files): Command {
  return {
    verb: "list",
    summary: "Fold the log: findings with their latest level and decision, and counts",
    arguments: [LOG],
    flags: {
      level: {
        type: "string",
        description: `List only this level: ${[...LEVELS, "unleveled"].join(", ")}`,
      },
      decision: {
        type: "string",
        description: `List only this decision: ${[...DECISIONS, "undecided"].join(", ")}; fix is what to fix`,
      },
    },
    run(input) {
      const filters = { level: text(input, "level"), decision: text(input, "decision") };
      const result = listFindings(files, { log: arg(input, "log"), ...filters });
      return { data: result, text: renderList(result, filters) };
    },
  };
}
