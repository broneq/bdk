// What the `hooks` use cases work on.
import type { GraphDeps } from "../../graph/index.ts";
import type { CommandIndex } from "../../shared/registry/index.ts";
import type { RegistryOpener } from "../../shared/store/index.ts";

/**
 * What the composition root provides: the graph's dependencies for
 * `prompt-expansion` and `session-end`, the command index `pre-tool`
 * classifies kernel verbs against, and the agent registry.
 */
export interface HooksDeps extends GraphDeps {
  readonly commands: CommandIndex;
  /** The agent registry the agent hooks and guards read and write (T41-D6). */
  readonly openRegistry: RegistryOpener;
}
