// The rule checks of `doctor` (`kernel-cli/service`; T31): read-only answers
// to what `rules import`, `rules check` and `rules export --claude --check`
// would do, so the diagnosis and the commands cannot disagree.
import { join, relative, sep } from "node:path";
import { parse } from "yaml";

import { splitFrontmatter } from "../../shared/store/index.ts";
import type { Store } from "../../shared/store/index.ts";
import { isProjection } from "../domain/projection.ts";
import { formatRefusal } from "./check.ts";
import { projectionDrift } from "./export.ts";
import { loadContext } from "./settings.ts";
import type { ReadDeps } from "./settings.ts";
import { PROJECT_RULES_DIR } from "./store.ts";

export interface RuleHealth {
  /** Hand-written `.claude/rules/` files without an id, relative to the project root. */
  readonly withoutId: readonly string[];
  /** Why `rules check` refuses; undefined when it passes. */
  readonly invalid?: string;
  /** The projection files `export --claude --check` finds changed; empty while `invalid` is set. */
  readonly drifted: readonly string[];
}

const HOST_RULES_DIR = ".claude/rules";

/** Undefined when the project has neither `.bdk/rules/` nor `.claude/rules/`. */
export function ruleHealth(
  deps: ReadDeps,
  projectRoot: string,
  globalDir: string,
): RuleHealth | undefined {
  const host = join(projectRoot, HOST_RULES_DIR);
  if (!deps.store.exists(join(projectRoot, PROJECT_RULES_DIR)) && !deps.store.exists(host)) {
    return undefined;
  }
  const withoutId = (deps.store.isDirectory(host) ? markdownFiles(deps.store, host) : [])
    .filter((path) => !isProjection(path.slice(path.lastIndexOf("/") + 1)))
    .filter((path) => !carriesId(deps.store.read(path) ?? ""))
    .map((path) => relative(projectRoot, path).split(sep).join("/"));
  const context = loadContext(deps, projectRoot, globalDir);
  if ("refused" in context) return { withoutId, invalid: context.why, drifted: [] };
  const refusal = formatRefusal(context.problems);
  if (refusal !== undefined) return { withoutId, invalid: refusal.why, drifted: [] };
  return { withoutId, drifted: projectionDrift(deps.store, projectRoot, context) };
}

function carriesId(text: string): boolean {
  const { frontmatter } = splitFrontmatter(text);
  if (frontmatter === undefined) return false;
  try {
    const parsed: unknown = parse(frontmatter);
    return typeof parsed === "object" && parsed !== null && "id" in parsed;
  } catch {
    return false;
  }
}

/** Every `*.md` below the directory, subdirectories included, in path order. */
export function markdownFiles(store: Store, dir: string): string[] {
  return store
    .list(dir)
    .flatMap((name) =>
      name.endsWith("/")
        ? markdownFiles(store, join(dir, name))
        : name.endsWith(".md")
          ? [join(dir, name)]
          : [],
    )
    .sort();
}
