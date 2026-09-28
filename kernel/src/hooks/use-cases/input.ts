// What the `hooks` use cases work on.
import type { GraphDeps } from "../../graph/index.ts";
import type { CommandIndex } from "../../shared/registry/index.ts";

/**
 * What the composition root provides: the graph's dependencies for
 * `prompt-expansion` and `session-end`, and the command index `pre-tool`
 * classifies kernel verbs against.
 */
export interface HooksDeps extends GraphDeps {
  readonly commands: CommandIndex;
}
