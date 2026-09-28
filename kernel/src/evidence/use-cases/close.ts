// The evidence an `ok` close of a code ticket needs (`kernel-cli/attempt`,
// attempt close; P5, T4, T23-D41, D43): the kernel first records `simplify`
// from the simplifier's stored report, then every post-task step must have a
// latest manifest under the ticket that passed or did not run within budget,
// is fresh against the target's tree and, for a pass, still cites what it
// recorded.
import { join } from "node:path";

import { refuse } from "../../shared/refusal/index.ts";
import type { Refusal, Rule } from "../../shared/refusal/index.ts";
import type { ActiveChange } from "../../shared/registry/index.ts";
import {
  partManifests,
  readDocument,
  readManifests,
  readPlanParts,
  taskHolders,
  ticketManifests,
} from "../../shared/store/index.ts";
import type { ManifestFile } from "../../shared/store/index.ts";
import type { EvidenceDeps } from "./deps.ts";
import { recordEvidence } from "./record.ts";
import { evidenceSettings, filePolicy, scopeOf, scopeTree } from "./scope.ts";
import { changedSince, sha256 } from "./tree.ts";

interface CloseStep {
  readonly kind: string;
  readonly role: string;
}

export interface CloseEvidenceInput {
  readonly ticket: string;
  readonly target: string;
  /** The post-task steps the pipeline applies, in pipeline order. */
  readonly steps: readonly CloseStep[];
  /** `policy.budgets.not-run`: the `not-run` manifests of a kind a part may hold. */
  readonly notRunBudget: number;
}

interface Problem {
  readonly rule: Extract<
    Rule,
    "policy/missing-evidence" | "policy/stale-evidence" | "policy/missing-citation"
  >;
  readonly why: string;
  readonly instead: string;
}

const REPORT_VERDICTS: Readonly<Record<string, "pass" | "not-run">> = {
  done: "pass",
  "done-with-concerns": "pass",
  blocked: "not-run",
  "needs-context": "not-run",
};

/** Undefined when every step's evidence holds; the refusal of the first failing rule otherwise. */
export async function closeEvidence(
  deps: EvidenceDeps,
  change: ActiveChange,
  globalDir: string,
  input: CloseEvidenceInput,
): Promise<Refusal | undefined> {
  const { ticket, target } = input;
  if (input.steps.some((step) => step.kind === "simplify")) {
    const recorded = await recordSimplify(deps, change, globalDir, ticket, target);
    if (recorded !== undefined) return recorded;
  }

  const settings = evidenceSettings(deps, change.projectRoot, globalDir);
  if ("refused" in settings) return settings;
  const parts = readPlanParts(deps.store, change.dir);
  const scope = scopeOf(parts, change.id, target) ?? parts;
  const current = await scopeTree(deps, change.projectRoot, filePolicy(settings.value), scope);
  const fresh = (manifest: ManifestFile) => manifest.data["tree-hash"] === current.treeHash;
  const manifests = readManifests(deps.store, change.dir);
  const own = ticketManifests(manifests, ticket);
  const part = taskHolders(parts).get(target)?.id ?? parts.find((p) => p.id === target)?.id;
  const inPart = part === undefined ? manifests : partManifests(manifests, part);

  const problems: Problem[] = [];
  for (const step of input.steps) {
    const dispatch = `bdk dispatch build ${target} ${step.role} ${ticket}`;
    const latest = latestOf(own, step.kind, fresh);
    if (latest === undefined) {
      problems.push({
        rule: "policy/missing-evidence",
        why: `${step.kind} has no manifest under ${ticket}`,
        instead: dispatch,
      });
      continue;
    }
    const { data } = latest;
    if (data.verdict !== "pass" && data.verdict !== "not-run") {
      problems.push({
        rule: "policy/missing-evidence",
        why: `${step.kind} ${data.id} says ${data.verdict ?? "no verdict"}`,
        instead: `bdk attempt close ${ticket} fail`,
      });
      continue;
    }
    if (!fresh(latest)) {
      const changed = changedSince(data.tree, current.tree);
      problems.push({
        rule: "policy/stale-evidence",
        why: `${step.kind} ${data.id} was recorded on another tree of ${target}${changed.length === 0 ? "" : `; changed: ${changed.join(", ")}`}`,
        instead: dispatch,
      });
      continue;
    }
    if (data.verdict === "pass") {
      const uncited = citationProblem(deps, change.projectRoot, latest);
      if (uncited !== undefined) {
        problems.push({
          rule: "policy/missing-citation",
          why: `${step.kind} ${data.id} ${uncited}`,
          instead: dispatch,
        });
      }
      continue;
    }
    const notRun = inPart.filter(
      (manifest) => manifest.data.kind === step.kind && manifest.data.verdict === "not-run",
    ).length;
    if (notRun > input.notRunBudget) {
      problems.push({
        rule: "policy/missing-evidence",
        why: `${step.kind} did not run in ${String(notRun)} manifests of ${part ?? change.id}, above policy.budgets.not-run ${String(input.notRunBudget)}`,
        instead: `bdk attempt close ${ticket} not-run --reason "<what was missing>"`,
      });
    }
  }

  const first = problems[0];
  if (first === undefined) return undefined;
  const same = problems.filter((problem) => problem.rule === first.rule);
  return refuse(first.rule, same.map((problem) => problem.why).join("; "), [
    ...new Set(same.map((problem) => problem.instead)),
  ]);
}

/** The `simplify` manifest from the ticket's stored simplifier report, when there is one. */
async function recordSimplify(
  deps: EvidenceDeps,
  change: ActiveChange,
  globalDir: string,
  ticket: string,
  target: string,
): Promise<Refusal | undefined> {
  const pkg = readDocument(
    deps.store,
    join(change.dir, "dispatch", `${target}-simplifier-${ticket}.md`),
  );
  const reportPath = pkg !== undefined && "data" in pkg ? pkg.data.report : undefined;
  if (typeof reportPath !== "string") return undefined;
  const path = join(change.projectRoot, reportPath);
  const report = readDocument(deps.store, path);
  const status = report !== undefined && "data" in report ? report.data.status : undefined;
  const verdict = typeof status === "string" ? REPORT_VERDICTS[status] : undefined;
  if (verdict === undefined) return undefined;
  const recorded = await recordEvidence(
    deps,
    change,
    { cwd: change.projectRoot, globalDir },
    { kind: "simplify", files: [path], ticket, verdict, citations: [], kernel: true },
  );
  return "refused" in recorded ? recorded : undefined;
}

/** The latest manifest of a kind; of two in one second the fresh one counts as the later. */
function latestOf(
  manifests: readonly ManifestFile[],
  kind: string,
  fresh: (manifest: ManifestFile) => boolean,
): ManifestFile | undefined {
  let latest: ManifestFile | undefined;
  for (const manifest of manifests) {
    if (manifest.data.kind !== kind) continue;
    if (
      latest === undefined ||
      manifest.data.at > latest.data.at ||
      fresh(manifest) ||
      !fresh(latest)
    ) {
      latest = manifest;
    }
  }
  return latest;
}

/** Why a `pass` no longer shows its result: no citation, or a committed file gone or changed. */
function citationProblem(
  deps: EvidenceDeps,
  projectRoot: string,
  manifest: ManifestFile,
): string | undefined {
  const { data } = manifest;
  if (data.source !== "kernel" && (data.citations ?? []).length === 0) {
    return "passes without a citation";
  }
  for (const file of data.files) {
    if (file.stored !== "committed") continue;
    const bytes = deps.store.readBytes(join(projectRoot, file.path));
    if (bytes === undefined) return `lost its committed file ${file.path}`;
    if (sha256(bytes) !== file.hash) return `has a changed committed file ${file.path}`;
  }
  return undefined;
}
