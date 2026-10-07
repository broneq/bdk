import type { Command } from "../../shared/cli/index.ts";
import type { Files } from "../../shared/fs/index.ts";
import { renderReport } from "../render/report.ts";
import { reportFindings } from "../use-cases/report.ts";
import { arg, LOG } from "./flags.ts";

export function report(files: Files): Command {
  return {
    verb: "report",
    summary: "Write the folded log as report.md next to it, the round report",
    arguments: [LOG],
    run(input) {
      const result = reportFindings(files, { log: arg(input, "log") });
      return { data: result, text: renderReport(result) };
    },
  };
}
