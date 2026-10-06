// `bdk rules prune` (`kernel-cli/rules`; design D-9 of v3-t31): rules whose
// globs match no file of the work tree, and rules no entry of the last
// `<n>` Changes cites, reported once the project has that many Changes. A
// language pack `languages` does not list is no candidate and is left out.
// Reports only; removal is a tombstone the user writes.
import {
  listAllEntries,
  listChanges,
  matchesGlob,
  refreshAll,
  withIndex,
} from "../../shared/store/index.ts";
import { workTreeFiles } from "../../shared/git/index.ts";
import { listPage } from "../../shared/output/index.ts";
import type { ListPage } from "../../shared/output/index.ts";
import type { Refusal } from "../../shared/refusal/index.ts";
import type { PruneItem } from "../domain/report.ts";
import { citationsOf } from "./citations.ts";
import type { RulesDeps } from "./deps.ts";
import { isCandidate } from "./selection.ts";
import { loadContext } from "./settings.ts";

export async function pruneRules(
  deps: RulesDeps,
  projectRoot: string,
  globalDir: string,
  uncited: number | undefined,
): Promise<ListPage<PruneItem> | Refusal> {
  const context = loadContext(deps, projectRoot, globalDir);
  if ("refused" in context) return context;
  const window = uncited ?? context.uncitedChanges;
  const files = await workTreeFiles(deps.git, projectRoot);
  return withIndex(deps.openIndex, deps.store, projectRoot, (index) => {
    refreshAll(index);
    const recent = listChanges(index)
      .sort((a, b) => b.at.localeCompare(a.at) || a.id.localeCompare(b.id))
      .slice(0, window);
    const counted = recent.length >= window;
    const inWindow = new Set(recent.map((change) => change.id));
    const cited = citationsOf(
      listAllEntries(index).filter((entry) => inWindow.has(entry.changeId)),
    );
    const disabled = new Set(context.disabled);
    const items: PruneItem[] = [];
    for (const rule of context.rules) {
      if (rule.removed !== undefined || disabled.has(rule.id)) continue;
      if (!isCandidate(rule, context.languages)) continue;
      const globs = rule.paths;
      if (!files.some((file) => globs.some((glob) => matchesGlob(glob, file)))) {
        items.push({
          id: rule.id,
          reason: "no-match",
          detail: `paths: ${JSON.stringify(globs)} matches 0 files`,
        });
      }
      if (counted && !cited.has(rule.id)) {
        items.push({
          id: rule.id,
          reason: "uncited",
          detail: `no entry of the last ${String(window)} Changes names ${rule.id}`,
        });
      }
    }
    return listPage(items);
  });
}
