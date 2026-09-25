import type { Handler } from "../../shared/registry/index.ts";
import { renderDoctor } from "../render/doctor.ts";
import type { ServiceDeps } from "../index.ts";
import { doctor } from "../use-cases/doctor.ts";

/** `--fix` is accepted and has nothing to repair until the checks of T12, T14, T20 and T30 land. */
export function doctorCommand(deps: ServiceDeps): Handler {
  return (context) => {
    const data = doctor({
      ...deps,
      nodeVersion: context.runtime.nodeVersion,
      cwd: context.cwd,
      workTree: context.workTree ?? context.cwd,
    });
    return { data, text: renderDoctor(data) };
  };
}
