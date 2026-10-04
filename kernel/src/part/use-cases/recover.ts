// Worktree recovery in `bdk rebuild` (`kernel-cli/service`, bdk rebuild;
// `kernel-state`, Part worktree; T45 design D9): the kernel worktrees and
// part branches of a Change settled against its part states. A worktree
// without the home marker is the user's and is never touched; a branch with
// commits the home checkout lacks is never deleted.
import { join } from "node:path";

import { checkoutWorktree, listWorktrees, removeWorktree } from "../../shared/git/index.ts";
import type { Git } from "../../shared/git/index.ts";
import {
  isolationOf,
  listEntries,
  partBranch,
  readHomeMarker,
  readPlanParts,
} from "../../shared/store/index.ts";
import type { EntryRow, IndexDb } from "../../shared/store/index.ts";
import type { PartDeps } from "./deps.ts";
import { fillWorktree, isAncestor, worktreeDir } from "./worktree.ts";
import type { WorktreeSettings } from "./worktree.ts";

export interface RecoveredWorktree {
  readonly part: string;
  readonly path: string;
  readonly action: "kept" | "removed" | "recreated";
}

export interface Recovery {
  readonly worktrees: RecoveredWorktree[];
  readonly warnings: string[];
}

interface Location {
  readonly id: string;
  readonly dir: string;
  readonly projectRoot: string;
}

/** The parts whose latest `part start` marker is later than their latest done marker. */
function liveParts(entries: readonly EntryRow[]): Map<string, EntryRow> {
  const latest = new Map<string, { start?: EntryRow; done?: EntryRow }>();
  for (const entry of entries) {
    if (entry.type !== "transition" || entry.source !== "kernel") continue;
    const nn = /^execute-part:(\d{2})$/.exec(entry.to ?? "")?.[1];
    if (nn === undefined) continue;
    const slot = latest.get(nn) ?? {};
    const key = entry.inputHash === undefined ? "start" : "done";
    const known = slot[key];
    if (known === undefined || later(entry, known)) slot[key] = entry;
    latest.set(nn, slot);
  }
  const live = new Map<string, EntryRow>();
  for (const [nn, { start, done }] of latest) {
    if (start !== undefined && (done === undefined || later(start, done))) live.set(nn, start);
  }
  return live;
}

function later(a: EntryRow, b: EntryRow): boolean {
  return a.at > b.at || (a.at === b.at && a.id > b.id);
}

/** Whether the start marker recorded a worktree: its body names `workdir`. */
function startedInWorktree(deps: PartDeps, change: Location, marker: EntryRow): boolean {
  const name = deps.store
    .list(join(change.dir, "log"))
    .find((file) => file.endsWith(`-${marker.id}.md`));
  const text = name === undefined ? undefined : deps.store.read(join(change.dir, "log", name));
  return text !== undefined && /^workdir: /m.test(text);
}

async function partBranches(git: Git, home: string, change: string): Promise<Map<string, string>> {
  const prefix = partBranch(change, "");
  const result = await git.run(
    ["for-each-ref", "--format=%(refname:short)", `refs/heads/${prefix}`],
    home,
  );
  const branches = new Map<string, string>();
  for (const line of result.stdout.split("\n")) {
    const nn = /^bdk-part\/.+\/(\d{2})$/.exec(line.trim())?.[1];
    if (nn !== undefined) branches.set(nn, line.trim());
  }
  return branches;
}

/** Settles the kernel worktrees and part branches of one Change. */
export async function recoverWorktrees(
  deps: PartDeps,
  index: IndexDb,
  change: Location,
  settings: WorktreeSettings,
): Promise<Recovery> {
  const home = change.projectRoot;
  const worktrees: RecoveredWorktree[] = [];
  const warnings: string[] = [];
  const parts = readPlanParts(deps.store, change.dir);
  const live = liveParts(listEntries(index, change.id, { type: "transition" }));
  const isLive = (nn: string) => live.has(nn) && parts.some((part) => part.id === nn);
  const branches = await partBranches(deps.git, home, change.id);
  const merged = async (branch: string) => isAncestor(deps.git, home, branch, "HEAD");
  const seen = new Set<string>();

  for (const entry of await listWorktrees(deps.git, home)) {
    const nn = /^bdk-part\/.+\/(\d{2})$/.exec(entry.branch ?? "")?.[1];
    if (nn === undefined || entry.branch !== partBranch(change.id, nn)) continue;
    if (!deps.store.isDirectory(entry.path)) continue;
    const marker = readHomeMarker(deps.store, entry.path);
    if (marker?.change !== change.id) continue;
    seen.add(nn);
    if (isLive(nn)) {
      worktrees.push({ part: nn, path: entry.path, action: "kept" });
    } else if (await merged(entry.branch)) {
      await removeWorktree(deps.git, home, entry.path, entry.branch);
      worktrees.push({ part: nn, path: entry.path, action: "removed" });
    } else {
      worktrees.push({ part: nn, path: entry.path, action: "kept" });
      warnings.push(
        `branch ${entry.branch} of part ${nn}, which is not live, holds commits the home checkout lacks; kept with its worktree ${entry.path}`,
      );
    }
  }

  for (const [nn, branch] of branches) {
    if (seen.has(nn)) continue;
    if (!isLive(nn)) {
      if (await merged(branch)) {
        await removeWorktree(deps.git, home, worktreeDir(settings, change, nn), branch);
      } else {
        warnings.push(
          `branch ${branch} of part ${nn}, which is not live, holds commits the home checkout lacks; kept`,
        );
      }
      continue;
    }
    seen.add(nn);
    const path = worktreeDir(settings, change, nn);
    await deps.git.run(["worktree", "prune"], home);
    const added = await checkoutWorktree(deps.git, home, path, branch);
    if (!added.ok) {
      warnings.push(`part ${nn}: git worktree add ${path} ${branch} failed: ${added.output}`);
      continue;
    }
    const filled = await fillWorktree(deps, change, path, settings);
    worktrees.push({ part: nn, path, action: "recreated" });
    warnings.push(
      "failed" in filled
        ? `part ${nn}: worktree ${path} recreated from ${branch}, but its setup failed: ${filled.failed}; the worktree stays for you to finish`
        : `part ${nn}: worktree ${path} recreated from ${branch}`,
    );
  }

  for (const [nn, marker] of live) {
    if (seen.has(nn)) continue;
    const part = parts.find((found) => found.id === nn);
    if (part === undefined || isolationOf(part.data) !== "worktree") continue;
    if (!startedInWorktree(deps, change, marker)) continue;
    warnings.push(
      `part ${nn} was started in a worktree, but neither the worktree nor the branch ${partBranch(change.id, nn)} exists; close its start marker, then run bdk part start ${nn}`,
    );
  }
  return { worktrees, warnings };
}
