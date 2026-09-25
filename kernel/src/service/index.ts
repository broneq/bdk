// The service slice (`kernel-cli/service`): `version` and `doctor`.
import type { CommandIndex, Registration } from "../shared/registry/index.ts";
import type { Store } from "../shared/store/index.ts";
import { doctorCommand } from "./commands/doctor.ts";
import { versionCommand } from "./commands/version.ts";

export interface ServiceDeps {
  readonly store: Store;
  readonly pluginRoot: string;
  readonly contract: CommandIndex["contract"];
}

export function serviceRegistrations(deps: ServiceDeps): Registration[] {
  return [
    { id: "version", handler: versionCommand(deps) },
    // doctor reports a too-old Node as a finding instead of refusing (kernel-cli, Invocation).
    { id: "doctor", handler: doctorCommand(deps), nodeGate: false },
  ];
}
