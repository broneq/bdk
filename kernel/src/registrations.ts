// Every handler and every config module the kernel ships. A record of the
// index without a handler here answers `kernel/not-implemented` until its
// owner task adds one; a module is registered with its consumer (S6).
import { attemptConfig, attemptRegistrations } from "./attempt/index.ts";
import { changeRegistrations } from "./change/index.ts";
import { commitRegistrations } from "./commit/index.ts";
import type { ChangeDeps } from "./change/index.ts";
import { configRegistrations } from "./config/index.ts";
import type { ConfigDeps } from "./config/index.ts";
import { ctxConfig, ctxRegistrations } from "./ctx/index.ts";
import { dispatchRegistrations } from "./dispatch/index.ts";
import { evidenceConfig } from "./evidence/index.ts";
import type { CtxDeps } from "./ctx/index.ts";
import { exportRegistrations } from "./export/index.ts";
import { graphConfig, graphRegistrations } from "./graph/index.ts";
import { hooksRegistrations } from "./hooks/index.ts";
import type { HooksDeps } from "./hooks/index.ts";
import { logConfig, logRegistrations } from "./log/index.ts";
import type { LogDeps } from "./log/index.ts";
import { measureRegistrations } from "./measure/index.ts";
import { partRegistrations } from "./part/index.ts";
import type { MeasureDeps } from "./measure/index.ts";
import { queryRegistrations } from "./query/index.ts";
import { rulesConfig, rulesRegistrations } from "./rules/index.ts";
import type { RulesDeps } from "./rules/index.ts";
import type { QueryDeps } from "./query/index.ts";
import { serviceRegistrations } from "./service/index.ts";
import type { ServiceDeps } from "./service/index.ts";
import { createConfigRegistry, promptsModule } from "./shared/config/index.ts";
import type { ConfigRegistry } from "./shared/config/index.ts";
import { checkpointModule } from "./shared/store/index.ts";
import type { Registration } from "./shared/registry/index.ts";

export type KernelDeps = ServiceDeps &
  ConfigDeps &
  CtxDeps &
  HooksDeps &
  MeasureDeps &
  LogDeps &
  ChangeDeps &
  QueryDeps &
  RulesDeps;

export function registrations(deps: KernelDeps): Registration[] {
  return [
    ...serviceRegistrations(deps),
    ...configRegistrations(deps),
    ...ctxRegistrations(deps),
    ...hooksRegistrations(deps),
    ...measureRegistrations(deps),
    ...logRegistrations(deps),
    ...changeRegistrations(deps),
    ...graphRegistrations(deps),
    ...partRegistrations(deps),
    ...attemptRegistrations(deps),
    ...commitRegistrations(deps),
    ...queryRegistrations(deps),
    ...exportRegistrations(deps),
    ...rulesRegistrations(deps),
    ...dispatchRegistrations(deps),
  ];
}

/** The settings registry: every slice's modules plus the ones `shared/config` consumes. */
export function settingsRegistry(): ConfigRegistry {
  return createConfigRegistry({
    modules: [
      ...rulesConfig.modules,
      ...ctxConfig.modules,
      ...graphConfig.modules,
      ...attemptConfig.modules,
      ...logConfig.modules,
      ...evidenceConfig.modules,
      checkpointModule,
      promptsModule,
    ],
    prompts: [...rulesConfig.prompts, ...ctxConfig.prompts, ...graphConfig.prompts],
  });
}
