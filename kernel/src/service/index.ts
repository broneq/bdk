// The service slice (`kernel-cli/service`): `version` and `doctor`.
import type { Registration } from "../shared/registry/index.ts";
import { doctorCommand } from "./commands/doctor.ts";
import { versionCommand } from "./commands/version.ts";
import type { ServiceDeps } from "./use-cases/version.ts";

export type { ServiceDeps } from "./use-cases/version.ts";

export function serviceRegistrations(deps: ServiceDeps): Registration[] {
  return [
    { id: "version", handler: versionCommand(deps) },
    // doctor reports a too-old Node as a finding instead of refusing (kernel-cli, Invocation).
    { id: "doctor", handler: doctorCommand(deps), nodeGate: false },
  ];
}
