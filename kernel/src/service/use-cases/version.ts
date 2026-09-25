import { readKernelVersion } from "../../shared/config/index.ts";
import type { Store } from "../../shared/store/index.ts";
import type { VersionOutput } from "../schema/version.ts";

export interface VersionInput {
  readonly store: Store;
  readonly pluginRoot: string;
  readonly contract: VersionOutput["contract"];
  readonly nodeVersion: string;
}

export function version(input: VersionInput): VersionOutput {
  return {
    kernel: readKernelVersion(input.store, input.pluginRoot),
    contract: input.contract,
    node: input.nodeVersion,
  };
}
