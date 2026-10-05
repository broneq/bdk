import { globalDir } from "../../shared/config/index.ts";
import type { Handler } from "../../shared/registry/index.ts";
import { renderDoctor } from "../render/doctor.ts";
import { doctor } from "../use-cases/doctor.ts";
import type { Git } from "../../shared/git/index.ts";
import type { ServiceDeps } from "../use-cases/version.ts";

/** `--fix` repairs the schema findings; the index and merge-hash repairs land with T20 and T30. */
export function doctorCommand(deps: ServiceDeps & { readonly git: Git }): Handler {
  return async (context) => {
    const data = await doctor({
      ...deps,
      nodeVersion: context.runtime.nodeVersion,
      cwd: context.cwd,
      workTree: context.workTree ?? context.cwd,
      globalDir: globalDir(context.runtime),
      fix: context.flags["--fix"] === true,
    });
    return { data, text: renderDoctor(data) };
  };
}
