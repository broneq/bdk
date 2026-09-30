// One manifest part as the sections it prints. A part whose plugin file is
// missing is a broken plugin, not a user error: it throws, and inject mode
// turns that into a STOP block naming `bdk doctor`.
import { join } from "node:path/posix";
import { stringify } from "yaml";

import type * as z from "zod";

import { promptContent } from "../../shared/config/index.ts";
import type { ConfigModule, PromptKey, Resolved } from "../../shared/config/index.ts";
import {
  languageRules,
  packRules,
  PROJECT_RULES_DIR,
  projectRules,
  RULE_CATEGORIES,
  ruleContext,
  ruleLines,
} from "../../rules/index.ts";
import type { RulesInput } from "../../rules/index.ts";

/** The BDK pack categories a `rules` part or a pipeline node may name. */
export { RULE_CATEGORIES };
import { executionModule, featuresModule, fragmentPrompts, toolsModule } from "../config.ts";
import type { Section } from "../domain/report.ts";
import type { CtxInput } from "./input.ts";
import type { Part } from "./manifest.ts";

export function sectionsOf(input: CtxInput, resolved: Resolved, part: Part): Section[] {
  switch (part.kind) {
    case "rules":
      return [
        {
          title: `Rules: ${part.category}`,
          body: categoryText(input, resolved, part.category),
          part: { kind: "rules", source: `rules/${part.category}` },
        },
      ];
    case "language-rules":
      return languageRules(ruleContext(input, resolved)).map(({ language, rules }) => ({
        title: `Language rules: ${language}`,
        body: ruleLines(rules),
        part: { kind: "language-rules", source: `rules/languages/${language}` },
      }));
    case "project-rules": {
      const rules = projectRules(ruleContext(input, resolved));
      if (rules.length === 0) return [];
      return [
        {
          title: "Project rules",
          body: ruleLines(rules),
          part: { kind: "project-rules", source: PROJECT_RULES_DIR },
        },
      ];
    }
    case "fragment": {
      const choice = lavish(input, resolved) ? "lavish" : "ask-user";
      const key = declared(fragmentPrompts, `fragments/decision/${choice}`);
      return [
        {
          title: "Asking the user",
          body: prompt(input, resolved, key),
          part: { kind: "fragment", source: key },
        },
      ];
    }
    case "tools": {
      const entries = read(toolsModule, resolved)[part.group];
      return [
        {
          title: `Project commands: ${part.group}`,
          body: entries.length === 0 ? "none configured\n" : stringify(entries),
          part: { kind: "tools", source: `tools.${part.group}` },
        },
      ];
    }
    case "concurrency": {
      const { concurrency } = read(executionModule, resolved);
      return [
        {
          title: "Concurrency",
          body: `Run at most ${String(concurrency)} agents at once.\n`,
          part: { kind: "concurrency", source: "execution.concurrency" },
        },
      ];
    }
    case "file": {
      const text = input.store.read(join(input.pluginRoot, part.path));
      if (text === undefined) throw new Error(`the plugin file ${part.path} is missing`);
      return [{ title: part.title, body: text, part: { kind: "file", source: part.path } }];
    }
  }
}

/**
 * The enabled pack rules of one category as `- [<id>] <text>` lines, as `ctx
 * skill` prints them; the graph's instructions carry the same text. An
 * unknown category is a broken manifest or pipeline and throws.
 */
export function categoryText(input: RulesInput, resolved: Resolved, category: string): string {
  if (!RULE_CATEGORIES.includes(category)) {
    throw new Error(`${category} is not a rule category of the pack`);
  }
  return ruleLines(packRules(ruleContext(input, resolved), category));
}

function prompt(input: CtxInput, resolved: Resolved, key: string): string {
  const value = resolved.prompts.values.get(key);
  if (value === undefined) throw new Error(`the prompt value ${key} has no file in any layer`);
  return promptContent(input.store, value);
}

/** `key`, checked against the fragment keys `ctx` declares. */
function declared(prompts: readonly PromptKey[], key: string): string {
  const found = prompts.some((prompt) =>
    prompt.key.endsWith("/*") ? key.startsWith(prompt.key.slice(0, -1)) : prompt.key === key,
  );
  if (!found) throw new Error(`${key} is not a prompt key ctx declares`);
  return key;
}

/** A module's value, typed by its schema; the resolution already validated it. */
function read<S extends z.ZodType>(module: ConfigModule<S>, resolved: Resolved): z.output<S> {
  return module.schema.parse(resolved.value[module.key]);
}

/** R-11: Lavish only when switched on and installed, the terminal question otherwise. */
function lavish(input: CtxInput, resolved: Resolved): boolean {
  return read(featuresModule, resolved).lavish && input.which("lavish-axi") !== undefined;
}
