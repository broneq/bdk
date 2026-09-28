import { globalDir } from "../../shared/config/index.ts";
import { isRefusal } from "../../shared/refusal/index.ts";
import type { Handler } from "../../shared/registry/index.ts";
import { renderPromptExpansion } from "../render/prompt-expansion.ts";
import type { HooksDeps } from "../use-cases/input.ts";
import { promptExpansion } from "../use-cases/prompt-expansion.ts";

/** Registered with `resolvesChange: "handler"`: only a stage command needs the Change. */
export function promptExpansionCommand(deps: HooksDeps): Handler {
  return async (context) => {
    const { resolveChange } = context;
    if (resolveChange === undefined) {
      throw new Error("hooks prompt-expansion is registered without the Change resolver");
    }
    const outcome = await promptExpansion(
      deps,
      { globalDir: globalDir(context.runtime), resolveChange },
      context.runtime.readStdin(),
    );
    return isRefusal(outcome) ? outcome : { data: outcome, text: renderPromptExpansion(outcome) };
  };
}
