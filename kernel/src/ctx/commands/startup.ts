import type { Handler } from "../../shared/registry/index.ts";
import { renderStartup } from "../render/startup.ts";
import type { CtxDeps } from "../use-cases/input.ts";
import { readStartup } from "../use-cases/startup.ts";

/** Standalone: no work tree and no configuration (`kernel-cli`, Invocation). */
export function startupCommand(deps: CtxDeps): Handler {
  return () => {
    const report = renderStartup(readStartup(deps));
    return { data: report, text: report.content };
  };
}
