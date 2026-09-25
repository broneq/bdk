import { readKernelVersion } from "../../shared/config/index.ts";
import type { Store } from "../../shared/store/index.ts";
import type { VersionReport } from "../domain/report.ts";

export interface VersionInput {
  readonly store: Store;
  readonly pluginRoot: string;
  readonly contract: VersionReport["contract"];
  readonly nodeVersion: string;
}

/** What the composition root provides; the command adds the running Node. */
export type ServiceDeps = Omit<VersionInput, "nodeVersion">;

export function version(input: VersionInput): VersionReport {
  return {
    kernel: readKernelVersion(input.store, input.pluginRoot),
    contract: input.contract,
    node: input.nodeVersion,
  };
}
