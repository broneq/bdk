// The review round marker (`kernel-state`, Review round marker; #166):
// `.bdk/.machine/review-round` exists while a `review-fix` ticket is open, so
// the PreToolUse prefilter starts the kernel for a main-thread file edit only
// then. It only gates the prefilter: the guard decides from the attempt
// records, so a marker left behind costs one kernel start, never a deny.
import { join } from "node:path";

import type { Store } from "./store.ts";

export function reviewRoundPath(projectRoot: string): string {
  return join(projectRoot, ".bdk", ".machine", "review-round");
}

export function writeReviewRound(store: Store, projectRoot: string, ticket: string): void {
  store.write(reviewRoundPath(projectRoot), `${ticket}\n`);
}

export function removeReviewRound(store: Store, projectRoot: string): void {
  store.remove(reviewRoundPath(projectRoot));
}
