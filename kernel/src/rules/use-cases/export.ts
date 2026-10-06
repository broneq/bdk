// `bdk rules export --claude` (`kernel-cli/rules`; design D-7 of v3-t31): the
// projection of the project's enabled rules into the two generated host
// files, rewritten by `accept` and `import` too. `--check` compares instead
// of writing, the CI form that catches a hand edit of `.bdk/rules/`.
import { join } from "node:path";

import { refuse } from "../../shared/refusal/index.ts";
import type { Refusal } from "../../shared/refusal/index.ts";
import { frontmatterFile } from "../../shared/store/index.ts";
import type { Store } from "../../shared/store/index.ts";
import { projectionFiles } from "../domain/projection.ts";
import type { ProjectionFile } from "../domain/projection.ts";
import type { ExportReport } from "../domain/report.ts";
import { projectRules } from "./context.ts";
import type { RuleContext } from "./context.ts";
import type { RulesDeps } from "./deps.ts";
import { formatRefusal } from "./check.ts";
import { loadContext } from "./settings.ts";
import { PROJECT_RULES_DIR } from "./store.ts";

export function exportRules(
  deps: RulesDeps,
  projectRoot: string,
  globalDir: string,
  check: boolean,
): ExportReport | Refusal {
  const context = loadContext(deps, projectRoot, globalDir);
  if ("refused" in context) return context;
  // Only the project's own rules are projected, so only their problems block it.
  const problem = formatRefusal(
    context.problems.filter((found) => found.file.startsWith(`${PROJECT_RULES_DIR}/`)),
  );
  if (problem !== undefined) return problem;
  const report = writeProjection(deps.store, projectRoot, context, !check);
  const drifted = report.files.filter((file) => file.changed).map((file) => file.path);
  if (check && drifted.length > 0) {
    return refuse(
      "policy/generated-drift",
      `${drifted.join(" and ")} differ from the rules under .bdk/rules/`,
      ["bdk rules export --claude", "commit the regenerated files"],
    );
  }
  return report;
}

/** Writes (or, with `write` false, only compares) the projection files; `changed` marks a difference. */
function writeProjection(
  store: Store,
  projectRoot: string,
  context: RuleContext,
  write = true,
): ExportReport {
  const files = projectionFiles(projectRules(context)).map((file) => {
    const path = join(projectRoot, file.path);
    const content = projectionText(file);
    const changed = store.read(path) !== content;
    if (write && changed) {
      if (content === undefined) store.remove(path);
      else store.write(path, content);
    }
    return {
      path: file.path,
      rules: file.rules,
      ...(file.paths === undefined ? {} : { paths: file.paths }),
      changed,
    };
  });
  return { files };
}

/** A projection file's text in the document shape; undefined when the file must not exist. */
function projectionText(file: ProjectionFile): string | undefined {
  if (file.body === undefined || file.frontmatter === undefined) return file.body;
  return frontmatterFile(file.frontmatter, file.body);
}

/** The projection paths that differ from the rules, written nowhere; `doctor` reports them. */
export function projectionDrift(store: Store, projectRoot: string, context: RuleContext): string[] {
  return writeProjection(store, projectRoot, context, false)
    .files.filter((file) => file.changed)
    .map((file) => file.path);
}

/** The projection paths a write changed, for `accept` and `import`. */
export function regenerate(store: Store, projectRoot: string, context: RuleContext): string[] {
  return writeProjection(store, projectRoot, context)
    .files.filter((file) => file.changed)
    .map((file) => file.path);
}
