import type { Files } from "../../shared/fs/index.ts";
import { reportMarkdown } from "../domain/report.ts";
import type { ReportResult } from "../schema/report.ts";
import { writeReport } from "../store/log.ts";
import { listFindings } from "./list.ts";

export interface ReportInput {
  readonly log: string;
}

/** Folds the log and writes it as `review.md` next to it, whatever the levels are. */
export function reportFindings(files: Files, { log }: ReportInput): ReportResult {
  const view = listFindings(files, { log });
  return { report: writeReport(files, log, reportMarkdown(view)), counts: view.counts };
}
