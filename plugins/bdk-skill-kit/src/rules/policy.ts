// Project policy rules (spec `skill-kit`, Project policy rules): checks whose
// values are a project's choices, so they are off by default and take them
// as options. Each validates its options, so a rule enabled without the
// values it needs is a configuration error.
import { isDeepStrictEqual } from "node:util";
import { defineRule } from "../index.ts";
import {
  blockLines,
  isNonEmptyString,
  isStringList,
  listOf,
  NAME,
  nameOf,
  regexProblem,
  toolList,
} from "./shared.ts";

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const blockForm = defineRule<{ patterns: string[] }>({
  id: "block-form",
  kinds: ["skills", "agents"],
  defaultSeverity: "off",
  defaultOptions: { patterns: [] },
  validateOptions({ patterns }) {
    if (!isStringList(patterns)) return "option `patterns` must be a list of regular expressions";
    const bad = patterns.map(regexProblem).find((p) => p !== undefined);
    return bad === undefined ? undefined : `option \`patterns\`: ${bad}`;
  },
  check(doc, ctx) {
    const forms = ctx.options.patterns.map((p) => new RegExp(`^(?:${p})$`));
    const message =
      forms.length === 0
        ? "a `!` block runs a shell command when the file loads; this project allows none"
        : "a `!` block must be the whole line and match one of the forms in the option `patterns`";
    for (const line of blockLines(doc)) {
      const text = doc.lines[line - 1] ?? "";
      if (!forms.some((form) => form.test(text))) ctx.report({ line, message, match: text });
    }
  },
});

export const blockAllowedTools = defineRule<{ require: string[] }>({
  id: "block-allowed-tools",
  kinds: ["skills"],
  defaultSeverity: "off",
  defaultOptions: { require: [] },
  validateOptions: ({ require }) =>
    isStringList(require) && require.length > 0
      ? undefined
      : "option `require` must list at least one `allowed-tools` entry",
  check(doc, ctx) {
    if (blockLines(doc).length === 0) return;
    const listed = toolList(doc.frontmatter?.["allowed-tools"]);
    const missing = ctx.options.require.filter((entry) => !listed.includes(entry));
    if (missing.length === 0) return;
    ctx.report({
      line: doc.keyLines["allowed-tools"] ?? 1,
      message: `a skill with a \`!\` block must list ${listOf(missing)} in \`allowed-tools\`; outside auto mode the host aborts a skill whose block command is not pre-approved`,
      match: "block-allowed-tools",
    });
  },
});

export interface ForbiddenTerm {
  /** Words or phrases; whitespace inside one matches any run of whitespace. */
  words: string[];
  /** `word` (default): not part of a longer word or hyphenated name. `substring`: anywhere. */
  match?: "word" | "substring";
  /** `anywhere` (default), or `code`: only in backticked spans and fenced lines. */
  where?: "anywhere" | "code";
  /** Why the term is forbidden and what to write instead. */
  message: string;
  /** Skill or agent names the term does not apply to. */
  allow?: string[];
}

function termProblem(value: unknown): string | undefined {
  const term = (typeof value === "object" && value !== null ? value : {}) as Record<
    string,
    unknown
  >;
  if (!isStringList(term.words) || term.words.length === 0 || !term.words.every(isNonEmptyString))
    return "`words` must list at least one word";
  if (!isNonEmptyString(term.message)) return "`message` must be a non-empty string";
  if (term.match !== undefined && term.match !== "word" && term.match !== "substring")
    return "`match` must be word or substring";
  if (term.where !== undefined && term.where !== "anywhere" && term.where !== "code")
    return "`where` must be anywhere or code";
  if (term.allow !== undefined && !isStringList(term.allow))
    return "`allow` must be a list of names";
  return undefined;
}

function termPattern(term: ForbiddenTerm): RegExp {
  const words = term.words.map((w) => escape(w.trim()).replace(/\s+/g, "\\s+")).join("|");
  return new RegExp(term.match === "substring" ? words : `(?<![\\w-])(?:${words})(?![\\w-])`, "g");
}

export const forbiddenText = defineRule<{ terms: ForbiddenTerm[] }>({
  id: "forbidden-text",
  kinds: ["skills", "agents"],
  defaultSeverity: "off",
  defaultOptions: { terms: [] },
  validateOptions({ terms }) {
    if (!Array.isArray(terms) || terms.length === 0)
      return "option `terms` must list at least one term";
    for (const [i, term] of terms.entries()) {
      const problem = termProblem(term);
      if (problem) return `option \`terms[${i}]\`: ${problem}`;
    }
    return undefined;
  },
  check(doc, ctx) {
    const name = nameOf(doc);
    const terms = ctx.options.terms
      .filter((term) => !(term.allow ?? []).includes(name))
      .map((term) => ({ term, pattern: termPattern(term) }));
    doc.lines.forEach((text, i) => {
      const code = doc.inFence(i + 1)
        ? text
        : [...text.matchAll(/`([^`]+)`/g)].map((m) => m[1]).join(" ");
      for (const { term, pattern } of terms) {
        const haystack = term.where === "code" ? code : text;
        for (const found of new Set([...haystack.matchAll(pattern)].map((m) => m[0]))) {
          ctx.report({
            line: i + 1,
            message: `\`${found}\`: ${term.message}`,
            match: `${found}\0${text}`,
          });
        }
      }
    });
  },
});

export interface FieldRequirement {
  /** Skill or agent names the requirement applies to. */
  names: string[];
  /** The frontmatter field. */
  field: string;
  /** The value the field must have. */
  equals?: unknown;
  /** Entries the field, read as a tool list, must contain. */
  includes?: string[];
  /** Why, appended to the message. */
  reason?: string;
}

function requirementProblem(value: unknown): string | undefined {
  const entry = (typeof value === "object" && value !== null ? value : {}) as Record<
    string,
    unknown
  >;
  if (!isStringList(entry.names) || entry.names.length === 0)
    return "`names` must list at least one name";
  if (!isNonEmptyString(entry.field)) return "`field` must be a non-empty string";
  if (entry.equals === undefined && entry.includes === undefined)
    return "set `equals`, `includes` or both";
  if (entry.includes !== undefined && !isStringList(entry.includes))
    return "`includes` must be a list of strings";
  if (entry.reason !== undefined && typeof entry.reason !== "string")
    return "`reason` must be a string";
  return undefined;
}

export const requiredFields = defineRule<{ entries: FieldRequirement[] }>({
  id: "required-fields",
  kinds: ["skills", "agents"],
  defaultSeverity: "off",
  defaultOptions: { entries: [] },
  validateOptions({ entries }) {
    if (!Array.isArray(entries) || entries.length === 0)
      return "option `entries` must list at least one entry";
    for (const [i, entry] of entries.entries()) {
      const problem = requirementProblem(entry);
      if (problem) return `option \`entries[${i}]\`: ${problem}`;
    }
    return undefined;
  },
  check(doc, ctx) {
    const fm = doc.frontmatter;
    if (!fm) return;
    const name = nameOf(doc);
    for (const entry of ctx.options.entries) {
      if (!entry.names.includes(name)) continue;
      const line = doc.keyLines[entry.field] ?? doc.keyLines.name ?? 1;
      const why = entry.reason ? `; ${entry.reason}` : "";
      const value = fm[entry.field];
      if (entry.equals !== undefined && !isDeepStrictEqual(value, entry.equals)) {
        ctx.report({
          line,
          message: `\`${name}\` must set \`${entry.field}: ${JSON.stringify(entry.equals)}\`${why}`,
          match: `${entry.field}\0equals`,
        });
      }
      const listed = toolList(value);
      const missing = (entry.includes ?? []).filter((item) => !listed.includes(item));
      if (missing.length > 0) {
        ctx.report({
          line,
          message: `\`${name}\` must list ${listOf(missing)} in \`${entry.field}\`${why}`,
          match: `${entry.field}\0includes`,
        });
      }
    }
  },
});

const isPositiveInteger = (v: unknown) => Number.isInteger(v) && (v as number) > 0;

export const bodyShape = defineRule<{
  maxLines?: number;
  maxSentences?: number;
  endsWith?: string;
}>({
  id: "body-shape",
  kinds: ["skills", "agents"],
  defaultSeverity: "off",
  defaultOptions: {},
  validateOptions({ maxLines, maxSentences, endsWith }) {
    if (maxLines === undefined && maxSentences === undefined && endsWith === undefined)
      return "set at least one of the options `maxLines`, `maxSentences` and `endsWith`";
    if (maxLines !== undefined && !isPositiveInteger(maxLines))
      return "option `maxLines` must be a positive integer";
    if (maxSentences !== undefined && !isPositiveInteger(maxSentences))
      return "option `maxSentences` must be a positive integer";
    if (endsWith !== undefined && !isNonEmptyString(endsWith))
      return "option `endsWith` must be a non-empty string";
    return undefined;
  },
  check(doc, ctx) {
    // An unclosed block has no body to speak of; `frontmatter` reports it.
    if (doc.frontmatterError?.includes("not closed")) return;
    const { maxLines, maxSentences, endsWith } = ctx.options;
    const body = doc.lines.slice(doc.bodyStart - 1).filter((text) => text.trim() !== "");
    const sentences = body.join(" ").match(/[.!?](?=\s|$)/g)?.length ?? 0;
    const problems: string[] = [];
    if (maxLines !== undefined && body.length > maxLines)
      problems.push(`${body.length} non-blank lines (limit ${maxLines})`);
    if (maxSentences !== undefined && sentences > maxSentences)
      problems.push(`${sentences} sentences (limit ${maxSentences})`);
    if (endsWith !== undefined && !(body.at(-1)?.trimEnd().endsWith(endsWith) ?? false))
      problems.push(`no final \`${endsWith}\``);
    if (problems.length === 0) return;
    ctx.report({
      line: doc.bodyStart,
      message: `the body has ${problems.join(", ")}`,
      // The counts change with every body edit; the fingerprint must not.
      match: "body-shape",
    });
  },
});

// A `/name` or `/plugin:name` token; a path segment (`a/b`, `/b.md`) is not one.
const SLASH_REF = /(?<![\w./:-])\/([a-z][a-z0-9-]*)(?::([a-z][a-z0-9-]*))?(?![\w/-]|\.\w)/g;
const SUBAGENT_TYPE = /subagent_type\W{1,4}([a-z][\w-]*(?::[a-z][\w-]*)?)/g;

export const namespacedRefs = defineRule<{ namespace: string; foreign: "warning" | "off" }>({
  id: "namespaced-refs",
  kinds: ["skills", "agents"],
  defaultSeverity: "off",
  defaultOptions: { namespace: "", foreign: "warning" },
  validateOptions({ namespace, foreign }) {
    if (typeof namespace !== "string" || !NAME.test(namespace))
      return "option `namespace` must be a kebab-case plugin name";
    if (foreign !== "warning" && foreign !== "off")
      return "option `foreign` must be warning or off";
    return undefined;
  },
  checkProject(docs, ctx) {
    const { namespace: ns, foreign } = ctx.options;
    const names = new Set(docs.map(nameOf));
    for (const doc of docs) {
      doc.lines.forEach((text, i) => {
        const at = { file: doc.path, line: i + 1 };
        for (const [ref, first = "", second] of text.matchAll(SLASH_REF)) {
          if (second === undefined && names.has(first)) {
            ctx.report({
              ...at,
              message: `write \`/${ns}:${first}\`, not \`${ref}\`; an unqualified name can resolve to another plugin's skill`,
              match: ref,
            });
          } else if (second !== undefined && first !== ns && foreign === "warning") {
            ctx.report({
              ...at,
              severity: "warning",
              message: `\`${ref}\` names another plugin's skill, which may not be installed`,
              match: ref,
            });
          }
        }
        for (const [, value = ""] of text.matchAll(SUBAGENT_TYPE)) {
          if (!value.includes(":") && names.has(value)) {
            ctx.report({
              ...at,
              message: `write \`subagent_type: ${ns}:${value}\`; a plugin agent is registered under its plugin's namespace`,
              match: value,
            });
          }
        }
      });
    }
  },
});
