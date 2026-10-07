import { basename } from "node:path";
import { defineRule, type Document } from "../index.ts";
import {
  allowedFields,
  descriptionCap,
  PERMISSION_MODES,
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
  explain: [
    "Checks that the file opens with a `---` line, a YAML map and a closing `---` line.",
    "Why: a host reads the name, description and settings of a skill or agent from that block; a file without it, or with YAML that does not parse as a map, is skipped or loaded with no metadata.",
    "Fix: put the frontmatter first, close it, and fix the YAML error the message quotes (indentation, a stray colon, a tab).",
  ].join("\n\n"),
  check(doc, ctx) {
    // The YAML error text carries a line and column, so it cannot be the match.
    if (doc.frontmatterError) {
      ctx.report({ line: 1, message: doc.frontmatterError, match: "frontmatter" });
    }
  },
});

/** Words the Skills API refuses in a skill name. */
const API_RESERVED = ["anthropic", "claude"];
/** Names Claude Code keeps for skills synced from claude.ai; a skill outside a plugin at such a name does not load. */
const CLAUDE_CODE_RESERVED = ["synced", "anthropic-skills"];

export const nameFormat = defineRule<{ prefix?: string }>({
  id: "name-format",
  kinds: ["skills", "agents"],
  defaultSeverity: "error",
  explain: [
    "Checks that `name` is present, a string of 1-64 characters in lowercase letters, digits and single hyphens, not at either end. In the portable profile a skill name must not contain the words `anthropic` or `claude`; in the claude-code profile, on a target with `plugin: false`, the skill names `synced` and `anthropic-skills` are reserved.",
    "Why: the name is the identifier hosts register, so a name outside the Agent Skills format is rejected on upload, the Skills API refuses the reserved words, and Claude Code does not load a skill outside a plugin at a reserved name. For agents the format and the 64-character cap are the kit's convention, not the host's: Claude Code accepts an agent name of up to 256 characters and refuses only `:` and a leading hyphen.",
    "Fix: rename the skill (and its directory, see `name-matches-dir`) to a plain kebab-case name without the reserved word.",
    "Options: `prefix` requires every name to start with that string, for example a plugin that namespaces its skills.",
  ].join("\n\n"),
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
    if (doc.kind !== "skills") return;
    if (doc.target.profile === "portable" && API_RESERVED.some((w) => name.includes(w))) {
      ctx.report({
        line,
        message: `\`name\` contains a word the Skills API reserves (${API_RESERVED.join(", ")}): \`${name}\``,
      });
    }
    if (
      doc.target.profile === "claude-code" &&
      !doc.target.plugin &&
      CLAUDE_CODE_RESERVED.includes(name)
    ) {
      ctx.report({
        line,
        message: `\`name\` is reserved by Claude Code, which does not load a skill outside a plugin at that name: \`${name}\``,
      });
    }
  },
});

export const nameMatchesDir = defineRule({
  id: "name-matches-dir",
  kinds: ["skills"],
  defaultSeverity: "error",
  explain: [
    "Checks that the frontmatter `name` equals the name of the skill directory.",
    "Why: hosts use one or the other depending on how a skill is invoked, so a mismatch makes `/name` and the model's view of the skill disagree.",
    "Fix: rename the directory or the `name` so they match.",
  ].join("\n\n"),
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
  explain: [
    "Checks that every skill directory holds `SKILL.md` in that exact case, and no directory under a skills dir holds Markdown without a skill file.",
    "Why: hosts load only `SKILL.md`; `skill.md`, `Skill.md` or a `README.md` next to nothing is silently not a skill.",
    "Fix: rename the file to `SKILL.md`, or move the stray Markdown out of the skills dir.",
  ].join("\n\n"),
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

/** `<tag>`, `</tag>` or `<tag/>`, with optional attributes. */
const XML_TAG = /<\/?[A-Za-z][\w:.-]*(?:\s[^<>]*)?\/?>/g;

export const description = defineRule<{ max?: number }>({
  id: "description",
  kinds: ["skills", "agents"],
  defaultSeverity: "error",
  explain: [
    "Checks that `description` is present, a non-empty string, within the length cap, and free of XML tags (`<tag>`, `</tag>`, `<tag/>`) outside backticks.",
    "Why: the description is what the model sees for every installed skill before it decides to load one; an empty one is never chosen, an over-long one is truncated by the host, and the Skills API rejects XML tags in it.",
    "Fix: write one to three sentences in the third person that say what the skill does and when to use it; mention a literal tag in backticks if you must.",
    "Options: `max` overrides the cap, whose default is the profile's: 1536 characters for `description` plus `when_to_use` in claude-code, 1024 for `description` in portable.",
  ].join("\n\n"),
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

    const prose = text.replace(/`[^`]*`/g, " ");
    for (const tag of new Set([...prose.matchAll(XML_TAG)].map((m) => m[0]))) {
      ctx.report({
        line,
        message: `\`description\` holds the XML tag \`${tag}\`; hosts reject tags in a description`,
        match: tag,
      });
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
const PERSON = /^(I'll|I'm|I will|I can|I|We|You)\b/;

export const descriptionFrontLoaded = defineRule<{ trigger: string }>({
  id: "description-front-loaded",
  kinds: ["skills"],
  defaultSeverity: "warning",
  explain: [
    "Checks that the description does not open with filler (`This skill`, `A skill`, `Skill for`, `Helps`, `Used to`) or a first- or second-person opener (`I`, `I'll`, `We`, `You`), and holds a trigger clause.",
    "Why: the first words are what the model scans when it picks a skill, and the trigger clause (`Use when ...`) is what makes the skill fire on the right task; a description that reads as a chat reply hurts discovery.",
    "Fix: lead with the capability in the third person (`Reviews ...`, `Converts ...`), then add `Use when ...` naming the tasks, files or errors that call for the skill.",
    "Options: `trigger` is the regular expression the trigger clause must match, case-insensitive; the default accepts `Use when|for|on|if|whenever`.",
  ].join("\n\n"),
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
    const person = PERSON.exec(text.trim());
    if (person) {
      ctx.report({
        line,
        message: `\`description\` opens with \`${person[0]}\`; write it in the third person, leading with what the skill does`,
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
  explain: [
    "Checks that every frontmatter key is one the profile admits: the six Agent Skills fields in portable, plus the Claude Code skill fields in claude-code; for agents, the Claude Code subagent fields, and `hooks`, `mcpServers`, `permissionMode` only on a target with `plugin: false`.",
    "Why: an unknown key is usually a typo that silently does nothing, a Claude-only key breaks a skill on another host, and plugin agents ignore the three fields that need `plugin: false`.",
    "Fix: fix the spelling, drop the key, move the skill to a claude-code target, or set `plugin: false` on the agents target when the agents live in `.claude/agents/` rather than a plugin.",
  ].join("\n\n"),
  check(doc, ctx) {
    const fm = doc.frontmatter;
    if (!fm) return;
    const allowed = allowedFields(doc.kind, doc.target.profile, doc.target.plugin);
    for (const key of Object.keys(fm)) {
      if (allowed.includes(key)) continue;
      const line = lineOf(doc, key);
      let message: string;
      if (
        doc.kind === "agents" &&
        (PLUGIN_IGNORED_AGENT_FIELDS as readonly string[]).includes(key)
      ) {
        message = `\`${key}\` is ignored for plugin agents (${PLUGIN_IGNORED_AGENT_FIELDS.join(", ")}); set \`plugin: false\` on the target when the agent lives in .claude/agents/, or drop the field`;
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
  explain: [
    "Checks that known fields have the documented type or enum: `effort`, `context`, `shell`, `permissionMode`, `memory`, `color`, `isolation` as enums; booleans as booleans; `compatibility` as 1-500 characters; `metadata` as a string map; tool lists as tool patterns; `hooks` as a map; `mcpServers` as a list.",
    "Why: a host that reads a wrong type falls back to its default or refuses the file, without telling the author.",
    "Fix: set the value the message lists.",
  ].join("\n\n"),
  check(doc, ctx) {
    const fm = doc.frontmatter;
    if (!fm) return;
    const allowed = allowedFields(doc.kind, doc.target.profile, doc.target.plugin);
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
    oneOf(
      "permissionMode",
      [...PERMISSION_MODES],
      `\`permissionMode\` must be one of ${PERMISSION_MODES.join(", ")}`,
    );
    if (has("hooks") && !isMap(fm.hooks)) fail("hooks", "`hooks` must be a map of hook events");
    if (has("mcpServers") && !isServerList(fm.mcpServers)) {
      fail(
        "mcpServers",
        "`mcpServers` must be a list of server names or single-key server definitions",
      );
    }
  },
});

const isMap = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** `mcpServers`: a server name, or `{ name: <config> }` with one key, per entry. */
function isServerList(value: unknown): boolean {
  return (
    Array.isArray(value) &&
    value.every(
      (entry: unknown) =>
        typeof entry === "string" || (isMap(entry) && Object.keys(entry).length === 1),
    )
  );
}

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
  explain: [
    "Checks that the skill stays reachable: `disable-model-invocation: true` together with `user-invocable: false` is an error, and `agent` without `context: fork` is a warning.",
    "Why: a skill nobody can start is dead weight in the skill listing, and `agent` only applies to a forked subagent.",
    "Fix: drop one of the two flags, or add `context: fork` next to `agent`.",
  ].join("\n\n"),
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
  explain: [
    "Checks that an agent file sets `model`.",
    "Why: an agent without `model` inherits whatever the parent session runs, so a model change reaches it unreviewed; off by default because many projects want that inheritance.",
    "Fix: set `model: inherit` to make the inheritance explicit, or a model alias.",
  ].join("\n\n"),
  check(doc, ctx) {
    if (doc.frontmatter && !("model" in doc.frontmatter))
      ctx.report({ line: 1, message: "`model` is missing" });
  },
});
