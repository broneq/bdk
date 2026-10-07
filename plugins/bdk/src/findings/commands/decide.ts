import type { Command } from "../../shared/cli/index.ts";
import type { Files } from "../../shared/fs/index.ts";
import { DECISIONS } from "../domain/events.ts";
import { renderDecide } from "../render/decide.ts";
import { decide as decideFinding } from "../use-cases/decide.ts";
import { arg, LOG, text } from "./flags.ts";

export function decide(files: Files): Command {
  return {
    verb: "decide",
    summary: "Append the decision on a finding; the latest decision counts",
    arguments: [
      LOG,
      { name: "id", description: "The finding id, as add printed it", required: true },
      { name: "decision", description: DECISIONS.join(", "), required: true },
    ],
    flags: {
      issue: { type: "string", description: "The issue that tracks it; required for defer only" },
      reason: { type: "string", description: "Why this decision, in one line" },
    },
    run(input) {
      const result = decideFinding(files, {
        log: arg(input, "log"),
        id: arg(input, "id"),
        decision: arg(input, "decision"),
        issue: text(input, "issue"),
        reason: text(input, "reason"),
      });
      return { data: result, text: renderDecide(result) };
    },
  };
}
