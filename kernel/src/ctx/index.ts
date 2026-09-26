// The ctx slice (`kernel-cli/ctx`). Its commands land with T13; T12 declares
// the settings it will read.
import { featuresModule, languagesModule, rulePrompts, toolsModule } from "./config.ts";

export const ctxConfig = {
  modules: [languagesModule, toolsModule, featuresModule],
  prompts: rulePrompts,
};
