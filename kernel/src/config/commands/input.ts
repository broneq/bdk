// Where the layers are for this call: the project root found from the working
// directory and the global directory from the environment.
import { globalDir } from "../../shared/config/index.ts";
import type { Handler } from "../../shared/registry/index.ts";
import { findProjectRoot } from "../../shared/store/index.ts";
import type { ConfigDeps, ConfigInput } from "../use-cases/input.ts";

type Context = Parameters<Handler>[0];

export function configInput(deps: ConfigDeps, context: Context): ConfigInput {
  const workTree = context.workTree ?? context.cwd;
  return {
    ...deps,
    globalDir: globalDir(context.runtime),
    projectRoot: findProjectRoot(deps.store, context.cwd, workTree),
  };
}
