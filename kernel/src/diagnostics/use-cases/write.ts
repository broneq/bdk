// `bdk diagnostics write` (`kernel-cli/diagnostics`; `kernel-state`,
// Diagnostics analysis file): checks the analysis on stdin and stores it at
// `.bdk/.machine/diagnostics/<change>-<session>.md`, replacing an earlier one.
import { join, relative } from "node:path";

import { refuse, RULES } from "../../shared/refusal/index.ts";
import type { Refusal } from "../../shared/refusal/index.ts";
import type { ActiveChange } from "../../shared/registry/index.ts";
import { ROLES } from "../../shared/vocabulary/index.ts";
import {
  checkSection,
  ISSUE_HEADING,
  issueSection,
  missingHeading,
  quoteCandidates,
} from "../domain/analysis.ts";
import type { SectionLine } from "../domain/analysis.ts";
import type { WriteReport } from "../domain/report.ts";
import { sessionFileName } from "./logs.ts";
import { chooseSession } from "./report.ts";
import type { DiagnosticsDeps, Place } from "./report.ts";
import { sessionChange } from "../domain/scope.ts";

const SECTION = ISSUE_HEADING.slice(3);

export async function diagnosticsWrite(
  deps: DiagnosticsDeps,
  place: Place,
  choice: { readonly session?: string | undefined; readonly markdown: string },
  active: () => ActiveChange | Refusal,
): Promise<WriteReport | Refusal> {
  const heading = missingHeading(choice.markdown);
  if (heading !== undefined) {
    return refuse("input/invalid-argument", `the analysis has no ${heading} heading`, [
      `add the heading ${heading} to the analysis`,
    ]);
  }
  const chosen = chooseSession(deps, place, choice, active);
  if ("refused" in chosen) return chosen;

  const section = issueSection(choice.markdown);
  const violation =
    checkSection(section, {
      rules: new Set(RULES),
      roles: new Set(ROLES),
      settingsKeys: new Set(deps.settings.keys),
    }) ?? (await trackedQuote(deps, place.projectRoot, quoteCandidates(section)));
  if (violation !== undefined) {
    return refuse(
      "policy/project-code",
      `line ${String(violation.line)} of section ${SECTION} ${violation.check}`,
      [
        "describe the line in words instead of quoting it",
        `move the quote to a section above ${SECTION}`,
      ],
    );
  }
  const name = `${sessionFileName(sessionChange(chosen.journal, chosen.session), chosen.session)}.md`;
  const path = join(place.projectRoot, ".bdk", ".machine", "diagnostics", name);
  deps.store.write(path, choice.markdown);
  return { path: relative(place.projectRoot, path) };
}

/** The first candidate equal, both trimmed, to a line of a file git tracks. */
async function trackedQuote(
  deps: DiagnosticsDeps,
  projectRoot: string,
  candidates: readonly SectionLine[],
): Promise<{ readonly line: number; readonly check: string } | undefined> {
  if (candidates.length === 0) return undefined;
  const patterns = [...new Set(candidates.map((candidate) => candidate.text))];
  const result = await deps.git.run(
    [
      "grep",
      "-z",
      "-n",
      "-F",
      "-I",
      "--no-color",
      ...patterns.flatMap((text) => ["-e", text]),
      "--",
      ".",
    ],
    projectRoot,
  );
  if (result.code > 1) throw new Error(`git grep failed: ${result.stderr.trim()}`);
  const tracked = new Map<string, { readonly file: string; readonly line: string }>();
  for (const row of result.stdout.split("\n")) {
    const [file, line, content] = row.split("\0");
    if (file === undefined || line === undefined || content === undefined) continue;
    const text = content.trim();
    if (!tracked.has(text)) tracked.set(text, { file, line });
  }
  for (const candidate of candidates) {
    const where = tracked.get(candidate.text);
    if (where !== undefined) {
      return { line: candidate.line, check: `equals line ${where.line} of ${where.file}` };
    }
  }
  return undefined;
}
