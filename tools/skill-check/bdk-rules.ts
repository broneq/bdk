// BDK's skill-check plugin (spec `skill-content-checks`, design D-10 of
// v3-t15-skill-check): the rules only BDK's own skills and agents follow.
import { basename } from "node:path";

import { type Document, definePlugin, defineRule } from "bdk-skill-kit";

/**
 * The `content-wrapper` regex of the kernel-cli spec (Invocation), as written
 * there. tools/skill-check/contract/wrapper-parity.test.ts keeps the two equal.
 */
export const CONTENT_WRAPPER_PATTERN =
  String.raw`^!` +
  "`" +
  String.raw`node "\$\{CLAUDE_PLUGIN_ROOT\}/dist/bdk\.mjs" (ctx (skill|role) [a-z][a-z0-9-]*|ctx startup|next) 2>&1 \|\| echo "BDK STOP: kernel unavailable \(exit \$\?\)\. Install Node >= 22\.13 and run /bdk:setup\."` +
  "`$";
const CONTENT_WRAPPER = new RegExp(CONTENT_WRAPPER_PATTERN);

/** The host runs a `!` block that opens at the start of a line or after whitespace. */
const BLOCK_OPENER = /(?:^|\s)!`/;
const KERNEL_RULE = "Bash(node ${CLAUDE_PLUGIN_ROOT}/dist/bdk.mjs *)";

const nameOf = (doc: Document): string =>
  typeof doc.frontmatter?.name === "string"
    ? doc.frontmatter.name
    : doc.kind === "skills"
      ? basename(doc.dir)
      : basename(doc.path, ".md");

/** A tool list field as entries: a YAML list, or a string split on spaces and commas outside parentheses. */
function toolList(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === "string");
  if (typeof value !== "string") return [];
  return value.match(/[^\s,(]+(?:\([^)]*\))?/g) ?? [];
}

const lineNumbers = (doc: Document, test: (line: string) => boolean): number[] =>
  doc.lines.flatMap((line, i) => (test(line) ? [i + 1] : []));

export const wrapperForm = defineRule({
  id: "wrapper-form",
  kinds: ["skills", "agents"],
  defaultSeverity: "error",
  check(doc, ctx) {
    for (const line of lineNumbers(doc, (text) => BLOCK_OPENER.test(text))) {
      const text = doc.lines[line - 1] ?? "";
      if (CONTENT_WRAPPER.test(text)) continue;
      ctx.report({
        line,
        message:
          "a `!` block must be the whole line and match the content-wrapper form of the kernel-cli spec (Invocation)",
        match: text,
      });
    }
  },
});

export const wrapperAllowedTools = defineRule({
  id: "wrapper-allowed-tools",
  kinds: ["skills"],
  defaultSeverity: "error",
  check(doc, ctx) {
    if (!doc.lines.some((text) => BLOCK_OPENER.test(text))) return;
    if (toolList(doc.frontmatter?.["allowed-tools"]).includes(KERNEL_RULE)) return;
    ctx.report({
      line: doc.keyLines["allowed-tools"] ?? 1,
      message: `a skill with a \`!\` block must list \`${KERNEL_RULE}\` in \`allowed-tools\`, or the host drops the whole skill in default permission mode`,
    });
  },
});

export const noMcpTools = defineRule({
  id: "no-mcp-tools",
  kinds: ["skills", "agents"],
  defaultSeverity: "error",
  check(doc, ctx) {
    for (const line of lineNumbers(doc, (text) => text.includes("mcp__plugin_bdk_"))) {
      ctx.report({
        line,
        message:
          "BDK ships no MCP server; call the kernel through `bdk` instead of a `mcp__plugin_bdk_` tool",
        match: doc.lines[line - 1] ?? "",
      });
    }
  },
});

export const gateInvocation = defineRule<{ gates: string[] }>({
  id: "gate-invocation",
  kinds: ["skills"],
  defaultSeverity: "error",
  defaultOptions: { gates: ["plan", "execute", "close", "run"] },
  check(doc, ctx) {
    const name = nameOf(doc);
    if (!ctx.options.gates.includes(name) || doc.frontmatter?.["disable-model-invocation"] === true)
      return;
    ctx.report({
      line: doc.keyLines["disable-model-invocation"] ?? doc.keyLines.name ?? 1,
      message: `the gate skill \`${name}\` must set \`disable-model-invocation: true\`, so only the user starts it`,
    });
  },
});

const READ_ONLY_TOOLS = ["Edit", "Write", "NotebookEdit"];

export const gateDisallowedTools = defineRule<{ readOnlyGates: string[] }>({
  id: "gate-disallowed-tools",
  kinds: ["skills"],
  defaultSeverity: "error",
  defaultOptions: { readOnlyGates: ["execute", "close"] },
  check(doc, ctx) {
    const name = nameOf(doc);
    if (!ctx.options.readOnlyGates.includes(name)) return;
    const listed = toolList(doc.frontmatter?.["disallowed-tools"]);
    const missing = READ_ONLY_TOOLS.filter((tool) => !listed.includes(tool));
    if (missing.length === 0) return;
    ctx.report({
      line: doc.keyLines["disallowed-tools"] ?? doc.keyLines.name ?? 1,
      message: `the gate skill \`${name}\` must list ${missing.map((t) => `\`${t}\``).join(", ")} in \`disallowed-tools\`; it delegates edits to workers`,
    });
  },
});

export const adapterShape = defineRule({
  id: "adapter-shape",
  kinds: ["agents"],
  defaultSeverity: "off",
  check(doc, ctx) {
    const body = doc.lines.slice(doc.bodyStart - 1).filter((text) => text.trim() !== "");
    const sentences = body.join(" ").match(/[.!?](?=\s|$)/g)?.length ?? 0;
    if (body.length === 1 && sentences === 1 && body[0]?.trim().endsWith(".")) return;
    ctx.report({
      line: doc.bodyStart,
      message: `an adapter's body is exactly one sentence that ends with a period; this one has ${body.length} line(s) and ${sentences} sentence(s)`,
      // The counts change with every body edit; the fingerprint must not.
      match: "adapter-shape",
    });
  },
});

export const craftNoKernel = defineRule({
  id: "craft-no-kernel",
  kinds: ["skills"],
  defaultSeverity: "error",
  check(doc, ctx) {
    if (doc.target.profile !== "portable") return;
    const coupled = (text: string) =>
      BLOCK_OPENER.test(text) || text.includes("${CLAUDE_PLUGIN_ROOT}");
    for (const line of lineNumbers(doc, coupled)) {
      ctx.report({
        line,
        message:
          "a portable skill runs on hosts without the BDK plugin: no `!` block and no `${CLAUDE_PLUGIN_ROOT}`",
        match: doc.lines[line - 1] ?? "",
      });
    }
  },
});

// Commands that name one stack's tooling (skill-lint 6). Words that are also
// plain English count only inside code: a backticked span or a fenced line.
const COMMANDS_ANYWHERE = [
  "pytest",
  "npm test",
  "yarn test",
  "cargo test",
  "cargo build",
  "rspec",
  "mvn",
  "gradle",
  "ruff",
  "eslint",
  "golangci-lint",
  "rubocop",
  "flake8",
];
const COMMANDS_IN_CODE = ["go test", "jest", "mocha", "make"];
const commandPattern = (commands: string[]) =>
  new RegExp(
    `(?<![\\w-])(${commands.map((c) => c.replace(" ", "\\s+")).join("|")})(?![\\w-])`,
    "g",
  );
const ANYWHERE = commandPattern(COMMANDS_ANYWHERE);
const IN_CODE = commandPattern(COMMANDS_IN_CODE);

export const noLanguageCommands = defineRule<{ allow: string[] }>({
  id: "no-language-commands",
  kinds: ["skills", "agents"],
  defaultSeverity: "error",
  // `setup` detects the stack, so it names what it maps (portability-check.md).
  defaultOptions: { allow: ["setup"] },
  check(doc, ctx) {
    if (ctx.options.allow.includes(nameOf(doc))) return;
    doc.lines.forEach((text, i) => {
      const code = doc.inFence(i + 1)
        ? text
        : [...text.matchAll(/`([^`]+)`/g)].map((m) => m[1]).join(" ");
      const found = [...text.matchAll(ANYWHERE), ...code.matchAll(IN_CODE)].map((m) => m[1] ?? "");
      for (const command of new Set(found)) {
        ctx.report({
          line: i + 1,
          message: `\`${command}\` names one stack's tooling; say what to run ("the project's test suite") and let the project settings name the command`,
          match: `${command}\0${text}`,
        });
      }
    });
  },
});

// A `/name` or `/plugin:name` token; a path segment (`a/b`, `/b.md`) is not one.
const SLASH_REF = /(?<![\w./:-])\/([a-z][a-z0-9-]*)(?::([a-z][a-z0-9-]*))?(?![\w/-]|\.\w)/g;
const SUBAGENT_TYPE = /subagent_type\W{1,4}([a-z][\w-]*(?::[a-z][\w-]*)?)/g;

export const namespacedRefs = defineRule({
  id: "namespaced-refs",
  kinds: ["skills", "agents"],
  defaultSeverity: "error",
  checkProject(docs, ctx) {
    const names = new Set(docs.map(nameOf));
    for (const doc of docs) {
      doc.lines.forEach((text, i) => {
        const report = (message: string, match: string, severity?: "warning") => {
          ctx.report({
            file: doc.path,
            line: i + 1,
            message,
            match,
            ...(severity ? { severity } : {}),
          });
        };
        for (const [ref, first = "", second] of text.matchAll(SLASH_REF)) {
          if (second === undefined && names.has(first)) {
            report(
              `write \`/bdk:${first}\`, not \`${ref}\`; an unqualified name can resolve to another plugin`,
              ref,
            );
          } else if (second !== undefined && first !== "bdk") {
            report(
              `\`${ref}\` names another plugin's skill; BDK cannot rely on it being installed`,
              ref,
              "warning",
            );
          }
        }
        for (const [, value = ""] of text.matchAll(SUBAGENT_TYPE)) {
          if (!value.includes(":") && names.has(value)) {
            report(
              `write \`subagent_type: bdk:${value}\`; the plugin agent is registered under its namespace`,
              value,
            );
          }
        }
      });
    }
  },
});

export default definePlugin({
  name: "bdk",
  rules: [
    wrapperForm,
    wrapperAllowedTools,
    noMcpTools,
    gateInvocation,
    gateDisallowedTools,
    adapterShape,
    craftNoKernel,
    noLanguageCommands,
    namespacedRefs,
  ],
});
