// The ctx slice (`kernel-cli/ctx`): the prompt context of a skill, the
// installed `bdk-craft` skills and the STARTUP instructions, composed from
// the manifest, the configuration and the plugin files.
import type { Refusal } from "../shared/refusal/index.ts";
import type { Registration } from "../shared/registry/index.ts";
import { craftCommand } from "./commands/craft.ts";
import { skillCommand } from "./commands/skill.ts";
import { startupCommand } from "./commands/startup.ts";
import { executionModule, featuresModule, fragmentPrompts } from "./config.ts";
import type { ContextReport } from "./domain/report.ts";
import { renderCraft } from "./render/craft.ts";
import { renderStartup } from "./render/startup.ts";
import type { CtxDeps } from "./use-cases/input.ts";
import { readCraft } from "./use-cases/craft.ts";
import type { CraftInput } from "./use-cases/craft.ts";
import { readStartup } from "./use-cases/startup.ts";

export type { CtxDeps } from "./use-cases/input.ts";
export { demoteHeadings } from "./domain/markdown.ts";
export { installedCraft } from "./use-cases/craft.ts";
export { stageRuleText } from "./use-cases/parts.ts";
export type { CraftInput } from "./use-cases/craft.ts";

/** The rendered STARTUP instructions, as `bdk ctx startup` prints them. */
export function startupContext(deps: Pick<CtxDeps, "store" | "pluginRoot">): ContextReport {
  return renderStartup(readStartup(deps));
}

/** A `bdk-craft` skill as `bdk ctx craft` prints it, or the refusal. */
export function craftContext(input: CraftInput, name: string): ContextReport | Refusal {
  const skill = readCraft(input, name);
  return "refused" in skill ? skill : renderCraft(skill);
}

export const ctxConfig = {
  modules: [featuresModule, executionModule],
  prompts: fragmentPrompts,
};

export function ctxRegistrations(deps: CtxDeps): Registration[] {
  return [
    { id: "ctx-craft", handler: craftCommand(deps) },
    { id: "ctx-skill", handler: skillCommand(deps) },
    { id: "ctx-startup", handler: startupCommand(deps) },
  ];
}
