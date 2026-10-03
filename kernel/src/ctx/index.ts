// The ctx slice (`kernel-cli/ctx`): the prompt context of a skill and the
// STARTUP instructions, composed from the manifest, the configuration and
// the plugin files.
import type { Registration } from "../shared/registry/index.ts";
import { skillCommand } from "./commands/skill.ts";
import { startupCommand } from "./commands/startup.ts";
import { executionModule, featuresModule, fragmentPrompts } from "./config.ts";
import type { ContextReport } from "./domain/report.ts";
import { renderStartup } from "./render/startup.ts";
import type { CtxDeps } from "./use-cases/input.ts";
import { readStartup } from "./use-cases/startup.ts";

export type { CtxDeps } from "./use-cases/input.ts";
export { categoryText, RULE_CATEGORIES } from "./use-cases/parts.ts";

/** The rendered STARTUP instructions, as `bdk ctx startup` prints them. */
export function startupContext(deps: Pick<CtxDeps, "store" | "pluginRoot">): ContextReport {
  return renderStartup(readStartup(deps));
}

export const ctxConfig = {
  modules: [featuresModule, executionModule],
  prompts: fragmentPrompts,
};

export function ctxRegistrations(deps: CtxDeps): Registration[] {
  return [
    { id: "ctx-skill", handler: skillCommand(deps) },
    { id: "ctx-startup", handler: startupCommand(deps) },
  ];
}
