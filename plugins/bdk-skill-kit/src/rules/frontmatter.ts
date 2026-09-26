import { basename } from "node:path";
import { defineRule, type Document } from "../index.ts";
import {
  allowedFields,
  descriptionCap,
  PLUGIN_IGNORED_AGENT_FIELDS,
  PORTABLE_FIELDS,
} from "../profiles.ts";
import { NAME } from "./shared.ts";

/** The line of a frontmatter key, or line 1 when the key is absent. */
const lineOf = (doc: Document, key: string) => doc.keyLines[key] ?? 1;

export const frontmatter = defineRule({
  id: "frontmatter",
  kinds: ["skills", "agents"],
  defaultSeverity: "error",
  check(doc, ctx) {
    // The YAML error text carries a line and column, so it cannot be the match.
    if (doc.frontmatterError) {
      ctx.report({ line: 1, message: doc.frontmatterError, match: "frontmatter" });
    }
  },
});

export const nameFormat = defineRule<{ prefix?: string }>({
  id: "name-format",
  kinds: ["skills", "agents"],
  defaultSeverity: "error",
  defaultOptions: {},
  check(doc, ctx) {
    const fm = doc.frontmatter;
    if (!fm) return;
    const name = fm.name;
    if (name === undefined) {
      ctx.report({ line: 1, message: "`name` is missing" });
      return;
    }
    const line = lineOf(doc, "name");
    if (typeof name !== "string") {
      ctx.report({ line, message: "`name` must be a string" });
      return;
    }
    if (name.length > 64) {
      ctx.report({
        line,
        message: `\`name\` is ${name.length} characters; the limit is 64`,
        match: "name-length",
      });
      return;
    }
    if (!NAME.test(name)) {
      ctx.report({
        line,
        message: `\`name\` must be lowercase letters, digits and single hyphens, not at either end: \`${name}\``,
      });
      return;
    }
    const { prefix } = ctx.options;
    if (prefix && !name.startsWith(prefix)) {
      ctx.report({ line, message: `\`name\` must start with \`${prefix}\`: \`${name}\`` });
    }
  },
});

export const nameMatchesDir = defineRule({
  id: "name-matches-dir",
  kinds: ["skills"],
  defaultSeverity: "error",
  check(doc, ctx) {
    const name = doc.frontmatter?.name;
    const dir = basename(doc.dir);
    if (typeof name === "string" && name !== dir) {
      ctx.report({
        line: lineOf(doc, "name"),
        message: `\`name\` is \`${name}\` but the skill directory is \`${dir}\``,
      });
    }
  },
});

export const skillFileName = defineRule({
  id: "skill-file-name",
  kinds: ["skills"],
  defaultSeverity: "error",
  check(doc, ctx) {
    const file = basename(doc.path);
    if (file !== "SKILL.md") {
      ctx.report({ message: `the skill file is \`${file}\`; hosts load only \`SKILL.md\`` });
    }
  },
  checkProject(_docs, ctx) {
    for (const dir of ctx.strays) {
      ctx.report({ file: dir, message: "the directory holds Markdown but no `SKILL.md`" });
    }
  },
});

export const description = defineRule<{ max?: number }>({
  id: "description",
  kinds: ["skills", "agents"],
  defaultSeverity: "error",
  defaultOptions: {},
  check(doc, ctx) {
    const fm = doc.frontmatter;
    if (!fm) return;
    const text = fm.description;
    const line = lineOf(doc, "description");
    if (text === undefined) {
      ctx.report({ line, message: "`description` is missing" });
      return;
    }
    if (typeof text !== "string") {
      ctx.report({ line, message: "`description` must be a string" });
      return;
    }
    if (text.trim() === "") {
      ctx.report({ line, message: "`description` is empty" });
      return;
    }

    const max = ctx.options.max ?? descriptionCap(doc.target.profile);
    const extra =
      doc.target.profile === "claude-code" && typeof fm.when_to_use === "string"
        ? fm.when_to_use
        : undefined;
    const length = text.length + (extra?.length ?? 0);
    if (length > max) {
      const what = extra === undefined ? "`description`" : "`description` plus `when_to_use`";
      ctx.report({
        line,
        message: `${what} is ${length} characters; the limit is ${max}`,
        match: "description-length",
      });
    }
  },
});

const FILLER = /^(this skill|a skill|skill for|helps|used to)\b/i;

export const descriptionFrontLoaded = defineRule<{ trigger: string }>({
  id: "description-front-loaded",
  kinds: ["skills"],
  defaultSeverity: "warning",
  defaultOptions: { trigger: "\\bUse (when|for|on|if|whenever)\\b" },
  check(doc, ctx) {
    const text = doc.frontmatter?.description;
    if (typeof text !== "string" || text.trim() === "") return;
    const line = lineOf(doc, "description");
    const filler = FILLER.exec(text.trim());
    if (filler) {
      ctx.report({
        line,
        message: `\`description\` opens with filler (\`${filler[0]}\`); lead with what the skill does`,
      });
    }
    const trigger = new RegExp(ctx.options.trigger, "i");
    if (!trigger.test(text)) {
      ctx.report({
        line,
        message: `\`description\` has no trigger clause matching ${String(trigger)}`,
        match: "trigger-clause",
      });
    }
  },
});

export const fields = defineRule({
  id: "fields",
  kinds: ["skills", "agents"],
  defaultSeverity: "error",
  check(doc, ctx) {
    const fm = doc.frontmatter;
    if (!fm) return;
    const allowed = allowedFields(doc.kind, doc.target.profile);
    for (const key of Object.keys(fm)) {
      if (allowed.includes(key)) continue;
      const line = lineOf(doc, key);
      let message: string;
      if (
        doc.kind === "agents" &&
        (PLUGIN_IGNORED_AGENT_FIELDS as readonly string[]).includes(key)
      ) {
        message = `\`${key}\` is ignored for plugin agents (${PLUGIN_IGNORED_AGENT_FIELDS.join(", ")}); move the agent to .claude/agents/ or drop the field`;
      } else if (doc.target.profile === "portable") {
        message = `\`${key}\` is not a field of the portable profile (Agent Skills standard: ${PORTABLE_FIELDS.join(", ")})`;
      } else {
        message = `\`${key}\` is not a field of the claude-code ${doc.kind} profile`;
      }
      ctx.report({ line, message, match: key });
    }
  },
});

const EFFORT = ["low", "medium", "high", "xhigh", "max"];
const COLORS = ["red", "blue", "green", "yellow", "purple", "orange", "pink", "cyan"];
const TOOL = /^(?:[A-Z][A-Za-z0-9]*(?:\(.*\))?|mcp__[\w-]+)$/;

const isStringList = (v: unknown) =>
  typeof v === "string" || (Array.isArray(v) && v.every((x) => typeof x === "string"));

export const fieldValues = defineRule({
  id: "field-values",
  kinds: ["skills", "agents"],
  defaultSeverity: "error",
  check(doc, ctx) {
    const fm = doc.frontmatter;
    if (!fm) return;
    const allowed = allowedFields(doc.kind, doc.target.profile);
    const has = (key: string) => key in fm && allowed.includes(key);
    const fail = (key: string, message: string) => {
      ctx.report({ line: lineOf(doc, key), message, match: key });
    };
    const oneOf = (key: string, values: string[], message: string) => {
      if (has(key) && !values.includes(fm[key] as string)) fail(key, message);
    };

    oneOf("effort", EFFORT, `\`effort\` must be one of ${EFFORT.join(", ")}`);
    for (const key of [
      "name",
      "description",
      "when_to_use",
      "argument-hint",
      "license",
      "model",
      "agent",
      "initialPrompt",
    ]) {
      if (has(key) && key !== "name" && key !== "description" && typeof fm[key] !== "string") {
        fail(key, `\`${key}\` must be a string`);
      }
    }
    for (const key of [
      "disable-model-invocation",
      "user-invocable",
      "background",
      "omitClaudeMd",
    ]) {
      if (has(key) && typeof fm[key] !== "boolean") fail(key, `\`${key}\` must be true or false`);
    }
    for (const key of ["allowed-tools", "disallowed-tools", "arguments", "paths", "skills"]) {
      if (has(key) && !isStringList(fm[key]))
        fail(key, `\`${key}\` must be a string or a list of strings`);
    }
    if (has("compatibility")) {
      const c = fm.compatibility;
      if (typeof c !== "string" || c.length === 0 || c.length > 500) {
        fail("compatibility", "`compatibility` must be a string of 1-500 characters");
      }
    }
    if (has("metadata")) {
      const m = fm.metadata;
      const ok =
        typeof m === "object" &&
        m !== null &&
        !Array.isArray(m) &&
        Object.values(m).every((v) => typeof v === "string");
      if (!ok) fail("metadata", "`metadata` must map strings to strings");
    }

    if (doc.kind === "skills") {
      if (has("context") && fm.context !== "fork") fail("context", "`context` must be `fork`");
      oneOf("shell", ["bash", "powershell"], "`shell` must be bash or powershell");
      return;
    }
    for (const key of ["tools", "disallowedTools"]) {
      if (!has(key)) continue;
      const value = fm[key];
      if (!isStringList(value)) {
        fail(key, `\`${key}\` must be a comma-separated string or a list of strings`);
        continue;
      }
      const entries = typeof value === "string" ? splitTools(value) : value;
      for (const entry of entries) {
        if (!TOOL.test(entry.trim())) {
          fail(
            key,
            `\`${key}\` entry \`${entry.trim()}\` is not a tool name, \`Name(...)\` or \`mcp__...\``,
          );
        }
      }
    }
    if (has("maxTurns") && !(Number.isInteger(fm.maxTurns) && (fm.maxTurns as number) > 0)) {
      fail("maxTurns", "`maxTurns` must be a positive integer");
    }
    oneOf("memory", ["user", "project", "local"], "`memory` must be one of user, project, local");
    oneOf("color", COLORS, `\`color\` must be one of ${COLORS.join(", ")}`);
    if (has("isolation") && fm.isolation !== "worktree")
      fail("isolation", "`isolation` must be `worktree`");
  },
});

/** Splits `Read, Bash(git add *, git commit *)` on commas outside parentheses. */
function splitTools(value: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of value) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      out.push(current);
      current = "";
    } else current += ch;
  }
  out.push(current);
  return out.filter((s) => s.trim() !== "");
}

export const invocation = defineRule({
  id: "invocation",
  kinds: ["skills"],
  defaultSeverity: "error",
  check(doc, ctx) {
    const fm = doc.frontmatter;
    if (!fm) return;
    if (fm["disable-model-invocation"] === true && fm["user-invocable"] === false) {
      ctx.report({
        line: lineOf(doc, "disable-model-invocation"),
        message:
          "`disable-model-invocation: true` with `user-invocable: false` leaves no way to run the skill",
      });
    }
    if ("agent" in fm && fm.context !== "fork") {
      ctx.report({
        line: lineOf(doc, "agent"),
        severity: "warning",
        message: "`agent` applies only with `context: fork`",
      });
    }
  },
});

export const requireModel = defineRule({
  id: "require-model",
  kinds: ["agents"],
  defaultSeverity: "off",
  check(doc, ctx) {
    if (doc.frontmatter && !("model" in doc.frontmatter))
      ctx.report({ line: 1, message: "`model` is missing" });
  },
});
