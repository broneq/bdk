// The kind registry (design D-2). The use cases take it as a dependency, so a
// test adds a kind without touching production code (`kernel-pipeline`, Kind
// extensibility).
import { ArchitectureKind, DesignKind, IntentKind, SpecDeltaKind } from "./documents.ts";
import type { Kind, KindRegistry } from "./kind.ts";
import { DesignIndexKind, DesignPartKind, ExecutePartKind, PlanPartKind } from "./parts.ts";
import { CloseKind, GateKind, postTaskSteps } from "./steps.ts";
import { DesignVerifyKind, PlanVerifyKind, ReviewKind } from "./verdicts.ts";

export { DESIGN_LIMIT_BYTES } from "./documents.ts";
export { PostTaskStepKind } from "./steps.ts";
export { BaseKind, fileChecks, live, partFiles } from "./kind.ts";
export type {
  ChangeView,
  Check,
  EvidenceFacts,
  FileFacts,
  GraphEntry,
  Inputs,
  Kind,
  KindRegistry,
  PlanPartFacts,
  WorkFacts,
} from "./kind.ts";

export function kindRegistry(extra: readonly Kind[] = []): KindRegistry {
  const kinds: Kind[] = [
    new IntentKind(),
    new DesignKind(),
    new ArchitectureKind(),
    new DesignPartKind(),
    new DesignIndexKind(),
    new DesignVerifyKind(),
    new PlanPartKind(),
    new PlanVerifyKind(),
    new GateKind(),
    new ExecutePartKind(),
    ...postTaskSteps(),
    new ReviewKind(),
    new SpecDeltaKind(),
    new CloseKind(),
    ...extra,
  ];
  return new Map(kinds.map((kind) => [kind.name, kind]));
}
