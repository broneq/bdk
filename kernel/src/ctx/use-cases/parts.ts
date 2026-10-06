// One manifest part as the sections it prints. A part whose plugin file is
// missing is a broken plugin, not a user error: it throws, and inject mode
// turns that into a STOP block naming `bdk doctor`.
import { join } from "node:path/posix";
import { stringify } from "yaml";

import type * as z from "zod";

import { verifierLists } from "../../log/index.ts";
import type { VerifierCategory } from "../../log/index.ts";
import {
  keyOrigin,
  keySteps,
  moduleValue,
  NONE,
  promptContent,
  toolsModule,
  valueAt,
} from "../../shared/config/index.ts";
import type {
  ConfigModule,
  ConfigRegistry,
  PromptKey,
  Resolved,
  SetupClass,
} from "../../shared/config/index.ts";
import { ruleContext, stageRuleLines } from "../../rules/index.ts";
import type { RulesInput } from "../../rules/index.ts";
import type { RuleStage } from "../../shared/vocabulary/index.ts";
import { executionModule, featuresModule, fragmentPrompts } from "../config.ts";
import type { Section } from "../domain/report.ts";
import type { CtxInput } from "./input.ts";
import type { Part } from "./manifest.ts";

/** `files` are the work tree files a `rules` part selects over. */
export function sectionsOf(
  input: CtxInput,
  resolved: Resolved,
  part: Part,
  files: readonly string[],
): Section[] {
  switch (part.kind) {
    case "rules": {
      const body = stageRuleText(input, resolved, part.stage, files);
      if (body === "") return [];
      return [{ title: "Rules", body, part: { kind: "rules", source: `stage:${part.stage}` } }];
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
          body:
            entries === NONE
              ? `declared none (tools.${part.group}: none)\n`
              : entries === undefined
                ? "unset: no command configured\n"
                : entries.length === 0
                  ? "none configured\n"
                  : stringify(entries),
          part: { kind: "tools", source: `tools.${part.group}` },
        },
      ];
    }
    case "concurrency": {
      const concurrency = read(executionModule, resolved);
      return [
        {
          title: "Concurrency",
          body: `Run at most ${String(concurrency)} agents at once.\n`,
          part: { kind: "concurrency", source: "execution.concurrency" },
        },
      ];
    }
    case "verifier-policy": {
      const { blocking, notAFail } = verifierLists(resolved);
      return [
        {
          title: "Blocking categories (P8)",
          body: `${categoryLines(blocking)}\n#### Not a fail\n\n${categoryLines(notAFail)}`,
          part: { kind: "verifier-policy", source: "policy.verifier" },
        },
      ];
    }
    case "setup-coverage":
      return [
        {
          title: "Setup coverage",
          body: setupCoverage(input.settings, resolved),
          part: { kind: "setup-coverage", source: "setup" },
        },
      ];
    case "file": {
      const text = input.store.read(join(input.pluginRoot, part.path));
      if (text === undefined) throw new Error(`the plugin file ${part.path} is missing`);
      return [{ title: part.title, body: text, part: { kind: "file", source: part.path } }];
    }
  }
}

/**
 * The rules a stage reads over `files` as `- [<id>] <text>` lines: the `rules`
 * part prints them, and a pipeline node's instruction carries the same text.
 */
export function stageRuleText(
  input: RulesInput,
  resolved: Resolved,
  stage: RuleStage,
  files: readonly string[],
): string {
  return stageRuleLines(ruleContext(input, resolved), stage, files);
}

const SETUP_HEADINGS: readonly (readonly [SetupClass, string])[] = [
  ["derived", "Derived"],
  ["asked", "Asked"],
  ["default", "Not set by setup"],
];

/** One `- <key>: <value> (<origin>)` line per leaf key, under a heading per setup class. */
function setupCoverage(settings: ConfigRegistry, resolved: Resolved): string {
  const keys = settings.setupKeys();
  return SETUP_HEADINGS.map(([setup, heading]) => {
    const lines = keys
      .filter((entry) => entry.setup === setup)
      .map(({ key }) => {
        // A free-form mapping (`prompts.files.<key>`) reads as its entry count.
        const path = key.endsWith(".<key>") ? key.slice(0, -".<key>".length) : key;
        const steps = keySteps(settings.tree, path);
        const value = steps === undefined ? undefined : valueAt(resolved.value, steps);
        const shown = path === key ? coverageValue(value) : String(Object.keys(value ?? {}).length);
        return `- ${key}: ${shown} (${keyOrigin(resolved.merged.origins, path)})\n`;
      });
    return `#### ${heading}\n\n${lines.join("")}`;
  }).join("\n");
}

function coverageValue(value: unknown): string {
  if (value === undefined) return "unset";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (!Array.isArray(value)) return JSON.stringify(value);
  if (value.length === 0) return "[]";
  return value
    .map((item: unknown) =>
      typeof item === "object" && item !== null && "id" in item ? String(item.id) : String(item),
    )
    .join(", ");
}

function categoryLines(categories: readonly VerifierCategory[]): string {
  return categories.map((category) => `- ${category.id}: ${category.description}\n`).join("");
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
  return moduleValue(module, resolved.value);
}

/** R-11: Lavish only when switched on and installed, the terminal question otherwise. */
function lavish(input: CtxInput, resolved: Resolved): boolean {
  return read(featuresModule, resolved).lavish && input.which("lavish-axi") !== undefined;
}
