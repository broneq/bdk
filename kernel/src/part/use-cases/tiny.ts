// The tiny guard (`kernel-loops`, Tiny guard; T22 design D-15): `commit` and
// `part done` of a `tiny` Change measure the Change's commits, from the
// parent of its first trailer commit to `HEAD`, and record one kernel
// `finding` for the review gate when they outgrow the profile. Never refuses.
import { appendEntry } from "../../log/index.ts";
import type { LogDeps } from "../../log/index.ts";
import { measure } from "../../measure/index.ts";
import type { ActiveChange } from "../../shared/registry/index.ts";
import { trailerCommits } from "../../shared/git/index.ts";
import type { IndexDb } from "../../shared/store/index.ts";

/** T20 design D-11: what a `tiny` Change may change in all. */
const LIMITS = { files: 2, modules: 1, lines: 50 } as const;

/** The id of the finding written or found, or undefined when the Change fits. */
export async function tinyGuard(
  deps: LogDeps,
  change: ActiveChange,
  index: IndexDb,
): Promise<string | undefined> {
  const first = (await trailerCommits(deps.git, change.projectRoot, change.id)).at(-1);
  if (first === undefined) return undefined;
  const report = await measure(deps, change.projectRoot, `${first.commit}^..HEAD`);
  // The Change's first commit is the root commit: there is no parent to measure from.
  if ("refused" in report) return undefined;
  const modules = report.modules.length;
  if (report.files <= LIMITS.files && modules <= LIMITS.modules && report.lines <= LIMITS.lines) {
    return undefined;
  }
  const written = await appendEntry(
    deps,
    change,
    index,
    {
      type: "finding",
      // Numbers only, no plural: the ledger dedupe normalises digits, so one open entry stays.
      summary:
        `tiny Change outgrew its profile: files ${String(report.files)}, modules ${String(modules)}, ` +
        `lines ${String(report.lines)} (limits: files ${String(LIMITS.files)}, ` +
        `modules ${String(LIMITS.modules)}, lines ${String(LIMITS.lines)})`,
      status: "proposed",
      review: true,
      refs: ["change.md"],
      body: `Measured ${report.range}: ${report.modules.join(", ")}. Raise the profile at the review gate or keep it tiny.\n`,
    },
    { dedupe: true },
  );
  return "refused" in written ? undefined : written.entry.id;
}
