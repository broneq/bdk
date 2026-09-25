import type { Handler } from "../../shared/registry/index.ts";
import { renderVersion } from "../render/version.ts";
import type { ServiceDeps } from "../index.ts";
import { version } from "../use-cases/version.ts";

export function versionCommand(deps: ServiceDeps): Handler {
  return (context) => {
    const data = version({ ...deps, nodeVersion: context.runtime.nodeVersion });
    return { data, text: renderVersion(data) };
  };
}
