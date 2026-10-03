// The evidence slice (`kernel-cli/evidence`): evidence manifests, the tree
// hash of a target, the citation validator (T4, P5) and the coverage verdict
// of the lines a Change adds (T42).
import type { Registration } from "../shared/registry/index.ts";
import { checkCommand, coverageCommand, recordCommand } from "./commands/evidence.ts";
import { evidenceModule } from "./config.ts";
import type { EvidenceDeps } from "./use-cases/deps.ts";

export type { EvidenceDeps } from "./use-cases/deps.ts";
export { closeEvidence } from "./use-cases/close.ts";
export { currentTrees, filePolicy } from "./use-cases/scope.ts";
export { fileClass } from "./use-cases/tree.ts";

export const evidenceConfig = {
  modules: [evidenceModule],
};

export function evidenceRegistrations(deps: EvidenceDeps): Registration[] {
  return [
    { id: "evidence-record", handler: recordCommand(deps) },
    { id: "evidence-coverage", handler: coverageCommand(deps) },
    { id: "evidence-check", handler: checkCommand(deps) },
  ];
}
