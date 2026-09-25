import { defineRule } from "../index.ts";

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const FLAG = /(?<![\w-])--[a-z][a-z0-9-]*/g;
const FREE_FLAGS = new Set(["--help", "--json"]);

/**
 * A skill that fronts a CLI (`metadata.fronts-cli: <command>`) stays thin: it
 * says when to reach for the tool and defers usage to `<command> --help` (R-13).
 */
export const cliFront = defineRule<{ maxLines: number; maxFlags: number; maxUsageRows: number }>({
  id: "cli-front",
  kinds: ["skills"],
  defaultSeverity: "error",
  defaultOptions: { maxLines: 30, maxFlags: 3, maxUsageRows: 2 },
  check(doc, ctx) {
    const metadata = doc.frontmatter?.metadata;
    const command =
      typeof metadata === "object" && metadata !== null
        ? (metadata as Record<string, unknown>)["fronts-cli"]
        : undefined;
    if (typeof command !== "string" || command === "") return;
    const { maxLines, maxFlags, maxUsageRows } = ctx.options;
    const who = `a skill fronting \`${command}\``;
    const bodyLines = doc.lines.slice(doc.bodyStart - 1);

    if (doc.frontmatter?.["disable-model-invocation"] === true) {
      ctx.report({
        line: doc.keyLines["disable-model-invocation"] ?? 1,
        message: `${who} must stay model-invocable; drop \`disable-model-invocation: true\``,
        match: "disable-model-invocation",
      });
    }
    if (doc.lines.length > maxLines) {
      ctx.report({
        line: maxLines + 1,
        message: `${who} has ${doc.lines.length} lines; the limit is ${maxLines}`,
        match: "lines",
      });
    }
    const cmd = escape(command);
    if (!bodyLines.some((line) => new RegExp(`(?<![\\w-])${cmd}\\b.*--help`).test(line))) {
      ctx.report({
        line: doc.bodyStart,
        message: `${who} must point at \`${command} --help\` (or \`${command} <group> --help\`) as the usage reference`,
        match: "help",
      });
    }
    const flags = [
      ...new Set(bodyLines.flatMap((line) => [...line.matchAll(FLAG)].map((m) => m[0]))),
    ].filter((f) => !FREE_FLAGS.has(f));
    if (flags.length > maxFlags) {
      ctx.report({
        line: doc.bodyStart,
        message: `${who} names ${flags.length} flags (${flags.join(", ")}); usage belongs in \`${command} --help\``,
        match: "flags",
      });
    }
    const row = new RegExp(`^\\s*(?:\\|\\s*|[-*+]\\s+)\`?(?:--[a-z]|${cmd}\\s+[a-z])`);
    const rows = bodyLines.filter((line) => row.test(line)).length;
    if (rows > maxUsageRows) {
      ctx.report({
        line: doc.bodyStart,
        message: `${who} documents usage in ${rows} table or list rows; usage belongs in \`${command} --help\``,
        match: "rows",
      });
    }
  },
});
