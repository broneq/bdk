// The service slice (`kernel-cli/service`): `version`, `doctor` and `rebuild`.
import type { Registration } from "../shared/registry/index.ts";
import { doctorCommand } from "./commands/doctor.ts";
import { rebuildCommand } from "./commands/rebuild.ts";
import { versionCommand } from "./commands/version.ts";
import type { RebuildDeps } from "./use-cases/rebuild.ts";
import type { ServiceDeps as VersionDeps } from "./use-cases/version.ts";

export type ServiceDeps = VersionDeps & RebuildDeps;

export function serviceRegistrations(deps: ServiceDeps): Registration[] {
  return [
    { id: "version", handler: versionCommand(deps) },
    // doctor reports a too-old Node as a finding instead of refusing (kernel-cli, Invocation).
    { id: "doctor", handler: doctorCommand(deps), nodeGate: false },
    { id: "rebuild", handler: rebuildCommand(deps) },
  ];
}
