// The settings `dispatch` reads (`kernel-settings`, Prompt values): the
// merge-conflict instruction of a merge ticket (T45). The risky areas the
// integration reviewer's package lists live in `review` (T42-K).
import { definePromptKey } from "../shared/config/index.ts";

/**
 * The project's instruction for resolving merge conflicts, copied into the
 * `Conflict` section of a merge ticket's package (`kernel-settings`, Prompt
 * values; T45). It names no BDK flow, so any merge can reuse it.
 */
export const mergeConflictsPrompt = definePromptKey({
  key: "fragments/merge-conflicts",
  consumer: "dispatch",
  owner: "T45",
  defaultFile: "fragments/merge-conflicts.md",
});
