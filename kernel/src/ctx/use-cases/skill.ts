// `bdk ctx skill <name>`: the manifest entry of a skill, resolved against the
// configuration. A removed v2 key is dropped before validation (design D-6),
// so the context does not depend on it; unknown keys and invalid values
// refuse, because context from a configuration nobody meant is worse than none.
import { closest, resolveOrRefuse } from "../../shared/config/index.ts";
import { workTreeFiles } from "../../shared/git/index.ts";
import { refuse } from "../../shared/refusal/index.ts";
import type { Refusal } from "../../shared/refusal/index.ts";
import type { ComposedContext } from "../domain/report.ts";
import type { CtxInput } from "./input.ts";
import { SKILL_CONTEXT } from "./manifest.ts";
import { sectionsOf } from "./parts.ts";

export async function composeSkill(
  input: CtxInput,
  name: string,
): Promise<ComposedContext | Refusal> {
  const parts = Object.hasOwn(SKILL_CONTEXT, name) ? SKILL_CONTEXT[name] : undefined;
  if (parts === undefined) return notFound(name);
  const resolved = resolveOrRefuse(input, { removed: "ignore" });
  if ("refused" in resolved) return resolved;
  // Only a `rules` part reads the work tree, so a skill without one runs no git.
  const files = parts.some((part) => part.kind === "rules")
    ? await workTreeFiles(input.git, input.projectRoot)
    : [];
  return {
    heading: `BDK context: ${name}`,
    sections: parts.flatMap((part) => sectionsOf(input, resolved, part, files)),
  };
}

function notFound(name: string): Refusal {
  const hint = closest(name, Object.keys(SKILL_CONTEXT));
  return refuse("input/not-found", `${name} is not a skill with a BDK context`, [
    hint === undefined
      ? "bdk ctx skill <name>, with the name of the skill being loaded"
      : `bdk ctx skill ${hint}`,
    "check the skill name in the context lines",
  ]);
}
