// Every handler the kernel ships. A record of the index without an entry here
// answers `kernel/not-implemented` until its owner task adds one.
import { serviceRegistrations } from "./service/index.ts";
import type { ServiceDeps } from "./service/index.ts";
import type { Registration } from "./shared/registry/index.ts";

export type KernelDeps = ServiceDeps;

export function registrations(deps: KernelDeps): Registration[] {
  return [...serviceRegistrations(deps)];
}
