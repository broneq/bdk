// The evidence slice (`kernel-cli/evidence`): evidence manifests, the tree
// hash of a target and the citation validator (T4, P5).
import { evidenceModule } from "./config.ts";

export const evidenceConfig = {
  modules: [evidenceModule],
};
