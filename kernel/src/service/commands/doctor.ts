import type { Handler } from "../../shared/registry/index.ts";
import { renderDoctor } from "../render/doctor.ts";
import { doctor } from "../use-cases/doctor.ts";
import type { ServiceDeps } from "../use-cases/version.ts";

/** `--fix` repairs the schema findings; the index and merge-hash repairs land with T14, T20 and T30. */
export function doctorCommand(deps: ServiceDeps): Handler {
  return (context) => {
    const data = doctor({
      ...deps,
      nodeVersion: context.runtime.nodeVersion,
      cwd: context.cwd,
      workTree: context.workTree ?? context.cwd,
      fix: context.flags["--fix"] === true,
    });
    return { data, text: renderDoctor(data) };
  };
}
