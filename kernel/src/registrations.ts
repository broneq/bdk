// Every handler and every config module the kernel ships. A record of the
// index without a handler here answers `kernel/not-implemented` until its
// owner task adds one; a module is registered with its consumer (S6).
import { configRegistrations } from "./config/index.ts";
import type { ConfigDeps } from "./config/index.ts";
import { ctxConfig } from "./ctx/index.ts";
import { serviceRegistrations } from "./service/index.ts";
import type { ServiceDeps } from "./service/index.ts";
import { createConfigRegistry, promptsModule } from "./shared/config/index.ts";
import type { ConfigRegistry } from "./shared/config/index.ts";
import type { Registration } from "./shared/registry/index.ts";

export type KernelDeps = ServiceDeps & ConfigDeps;

export function registrations(deps: KernelDeps): Registration[] {
  return [...serviceRegistrations(deps), ...configRegistrations(deps)];
}

/** The settings registry: every slice's modules plus the ones `shared/config` consumes. */
export function settingsRegistry(): ConfigRegistry {
  return createConfigRegistry({
    modules: [...ctxConfig.modules, promptsModule],
    prompts: [...ctxConfig.prompts],
  });
}
