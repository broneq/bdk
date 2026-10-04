// `bdk evidence check <target|evidence-id>` (`kernel-cli/evidence`; T23-D16,
// D45, D54): the latest manifest of each kind of a task, part or Change, or
// one manifest by its `E-` id, against the current tree hash of its target.
import type { CheckReport } from "../domain/reports.ts";
import { refuse } from "../../shared/refusal/index.ts";
import type { Refusal } from "../../shared/refusal/index.ts";
import type { ActiveChange } from "../../shared/registry/index.ts";
import { readManifests, readPlanParts, workRootOf } from "../../shared/store/index.ts";
import type { ManifestFile } from "../../shared/store/index.ts";
import type { EvidenceDeps } from "./deps.ts";
import { evidenceSettings, filePolicy, scopeOf, scopeTree } from "./scope.ts";
import { changedSince } from "./tree.ts";

const EVIDENCE_ID = /^E-[0-9a-z]{8}$/;

export async function checkEvidence(
  deps: EvidenceDeps,
  change: ActiveChange,
  globalDir: string,
  subject: string,
): Promise<CheckReport | Refusal> {
  const manifests = readManifests(deps.store, change.dir);
  const parts = readPlanParts(deps.store, change.dir);
  let target = subject;
  let checked: ManifestFile[];
  if (EVIDENCE_ID.test(subject)) {
    const manifest = manifests.find((found) => found.data.id === subject);
    if (manifest === undefined) {
      return refuse("input/not-found", `${change.id} has no evidence ${subject}`, [
        "bdk evidence check <target>",
      ]);
    }
    target = manifest.data.target;
    checked = [manifest];
  } else {
    if (scopeOf(parts, change.id, subject) === undefined) {
      return refuse("input/not-found", `${change.id} holds no task, part or Change ${subject}`, [
        "bdk part list",
      ]);
    }
    checked = manifests.filter((manifest) => manifest.data.target === subject);
  }

  const settings = evidenceSettings(deps, change.projectRoot, globalDir);
  if ("refused" in settings) return settings;
  // An artifact target (a verifier ticket's manifest) covers the whole Change.
  const scope = scopeOf(parts, change.id, target) ?? parts;
  const root = await workRootOf(deps.git, deps.store, change, parts, target);
  const current = await scopeTree(deps, root, filePolicy(settings.value), scope);
  const fresh = (manifest: ManifestFile) => manifest.data["tree-hash"] === current.treeHash;
  // Manifests are in `at` order; of two with one `at` the fresh one counts as the later.
  const latest = new Map<string, ManifestFile>();
  for (const manifest of checked) {
    const known = latest.get(manifest.data.kind);
    if (
      known === undefined ||
      manifest.data.at > known.data.at ||
      fresh(manifest) ||
      !fresh(known)
    ) {
      latest.set(manifest.data.kind, manifest);
    }
  }
  const evidence = [...latest.values()].map((manifest) => ({
    evidence: manifest.data.id,
    kind: manifest.data.kind,
    treeHash: manifest.data["tree-hash"],
    fresh: fresh(manifest),
    ...(manifest.data.verdict === undefined ? {} : { verdict: manifest.data.verdict }),
    changedSince: changedSince(manifest.data.tree, current.tree),
  }));
  return {
    fresh: evidence.length > 0 && evidence.every((entry) => entry.fresh),
    treeHash: current.treeHash,
    evidence,
  };
}
