// `bdk evidence coverage <test-id> <report>` (`kernel-cli/evidence`; T42 D5):
// the coverage of the lines the Change adds against its base, measured from a
// `tools.test` entry's report, with the verdict the kernel decides against the
// entry's `coverage.min`. The summary and the report are recorded as a
// `coverage` manifest through `evidence record`'s storage, tree hash and dedupe.
import { isAbsolute, join, relative, sep } from "node:path";

import { moduleValue, toolGroup, toolsModule } from "../../shared/config/index.ts";
import { isRefusal, refuse } from "../../shared/refusal/index.ts";
import type { Refusal } from "../../shared/refusal/index.ts";
import type { ActiveChange } from "../../shared/registry/index.ts";
import { addedLines, changeBase, firstMatch, resolveTicketRef } from "../../shared/store/index.ts";
import { coverageVerdict, measureCoverage, parseCoverage } from "../domain/coverage.ts";
import type { CoverageReport as CoverageResult } from "../domain/reports.ts";
import type { EvidenceDeps } from "./deps.ts";
import { recordEvidence } from "./record.ts";
import type { RecordWhere } from "./record.ts";
import { evidenceSettings, filePolicy } from "./scope.ts";

const MACHINE_EVIDENCE = ".bdk/.machine/evidence";

export interface CoverageInput {
  readonly test: string;
  /** As typed: relative to `cwd` unless absolute. */
  readonly report: string;
  readonly ticket: string | undefined;
}

export async function recordCoverage(
  deps: EvidenceDeps,
  change: ActiveChange,
  where: RecordWhere,
  input: CoverageInput,
): Promise<CoverageResult | Refusal> {
  const usage = `bdk evidence coverage ${input.test} ${input.report} --ticket <ticket>`;
  if (input.ticket === undefined) {
    return refuse("input/missing-argument", "evidence coverage needs --ticket", [usage]);
  }
  const resolved = evidenceSettings(deps, change.projectRoot, where.globalDir);
  if (isRefusal(resolved)) return resolved;
  const tests = toolGroup(moduleValue(toolsModule, resolved.value), "test").entries;
  const entry = tests.find((item) => item.id === input.test);
  if (entry === undefined) {
    return refuse("input/not-found", `tools.test has no entry ${input.test}`, [
      ...tests
        .filter((item) => item.coverage !== undefined)
        .map((item) => `bdk evidence coverage ${item.id} <report> --ticket ${input.ticket ?? ""}`),
      "bdk config show tools.test",
    ]);
  }
  const settings = entry.coverage;
  if (settings === undefined) {
    return refuse(
      "input/invalid-argument",
      `tools.test entry ${entry.id} has no coverage: command, report and format`,
      ["bdk config show tools.test", `bdk config set tools.test.${entry.id}.coverage ...`],
    );
  }
  const ref = resolveTicketRef(deps.store, change.projectRoot, change.dir, input.ticket);
  if (isRefusal(ref)) return ref;
  if (ref.record === undefined || !ref.open || ref.record.data.target !== change.id) {
    return refuse(
      "policy/no-open-ticket",
      `${input.ticket} is not an open ticket on ${change.id}; coverage measures the whole Change`,
      ["bdk attempt list", `bdk attempt open review-fix ${change.id}`],
    );
  }

  const reportPath = isAbsolute(input.report) ? input.report : join(where.cwd, input.report);
  const text = deps.store.read(reportPath);
  if (text === undefined) {
    return refuse("input/not-found", `coverage report ${input.report} does not exist`, [
      `run ${settings.command}, which writes ${settings.report}`,
    ]);
  }
  const report = parseCoverage(settings.format, text);
  if ("problem" in report) {
    return refuse("input/invalid-argument", `${input.report}: ${report.problem}`, [
      `set tools.test.${entry.id}.coverage.format to the report's format`,
      `run ${settings.command} to write a ${settings.format} report`,
    ]);
  }

  const base = await changeBase(deps.store, deps.git, change.projectRoot, change.dir);
  const policy = filePolicy(resolved.value);
  // The report is written by the run it measures, so it is never a changed file of its own.
  const reportFile = relative(change.projectRoot, reportPath).split(sep).join("/");
  const added = new Map(
    [...(await addedLines(deps.store, deps.git, change.projectRoot, base))].filter(
      ([path]) =>
        path !== reportFile &&
        !path.startsWith(".bdk/") &&
        firstMatch(policy.nonExecutable, path) === undefined,
    ),
  );
  const summary = measureCoverage({
    test: entry.id,
    format: settings.format,
    min: settings.min,
    added,
    report,
    projectRoot: change.projectRoot,
  });
  const verdict = coverageVerdict(summary);
  const name = `coverage-${entry.id}.json`;
  const summaryPath = join(change.projectRoot, MACHINE_EVIDENCE, name);
  deps.store.write(summaryPath, `${JSON.stringify(summary, null, 2)}\n`);

  const recorded = await recordEvidence(deps, change, where, {
    kind: "coverage",
    tool: entry.id,
    files: [summaryPath, reportPath],
    ticket: input.ticket,
    verdict,
    citations: [`${name}#/percent`],
  });
  if (isRefusal(recorded)) return recorded;
  return {
    evidence: recorded.evidence,
    tool: entry.id,
    min: summary.min,
    percent: summary.percent,
    covered: summary.covered,
    total: summary.total,
    unmeasured: summary.unmeasured,
    verdict,
  };
}
