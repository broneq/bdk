// Every handler the kernel ships. A record of the index without an entry here
// answers `kernel/not-implemented` until its owner task adds one.
import type { Registration } from "./shared/registry/index.ts";

export const registrations: readonly Registration[] = [];
