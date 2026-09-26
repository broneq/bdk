import { defineRule } from "../index.ts";
import { isBlockLine } from "./shared.ts";

export const body = defineRule({
  id: "body",
  kinds: ["skills", "agents"],
  defaultSeverity: "error",
  check(doc, ctx) {
    // An unclosed block has no body to speak of; `frontmatter` reports it.
    if (doc.frontmatterError?.includes("not closed")) return;
    const rest = doc.lines.slice(doc.bodyStart - 1);
    if (rest.every((line) => line.trim() === "")) {
      ctx.report({ line: doc.bodyStart, message: "the body after the frontmatter is empty" });
    }
  },
});

export const lineLimit = defineRule<{ max: number }>({
  id: "line-limit",
  kinds: ["skills"],
  defaultSeverity: "error",
  defaultOptions: { max: 500 },
  check(doc, ctx) {
    const { max } = ctx.options;
    if (doc.lines.length > max) {
      ctx.report({
        line: max + 1,
        message: `the skill file has ${doc.lines.length} lines; the limit is ${max}`,
        match: "line-limit",
      });
    }
  },
});

// A path that starts at the file-system root, the home directory or a drive
// letter. `${VAR}/...`, URLs and relative paths are preceded by a character
// the lookbehind excludes.
const ABSOLUTE =
  /(?<![\w$}.:/~-])(?:\/(?:Users|home|root|opt|var|tmp|etc|private)\/\S*|~\/\S*|[A-Za-z]:\\\S*)/g;

export const absolutePaths = defineRule({
  id: "absolute-paths",
  kinds: ["skills", "agents"],
  defaultSeverity: "error",
  check(doc, ctx) {
    doc.lines.forEach((line, i) => {
      for (const match of line.matchAll(ABSOLUTE)) {
        const path = match[0].replace(/[`'"),.;]+$/, "");
        ctx.report({
          line: i + 1,
          message: `absolute path \`${path}\`; use a path relative to the skill or a \${VAR}`,
          match: path,
        });
      }
    });
  },
});

export const modelNames = defineRule<{ names: string[] }>({
  id: "model-names",
  kinds: ["skills", "agents"],
  defaultSeverity: "error",
  defaultOptions: {
    names: ["haiku", "sonnet", "opus", "fable", "gpt-[0-9][a-z0-9.-]*", "gemini(?:-[a-z0-9.-]+)?"],
  },
  check(doc, ctx) {
    const pattern = new RegExp(`(?<![\\w-])(?:${ctx.options.names.join("|")})(?![\\w-])`, "gi");
    for (let i = doc.bodyStart - 1; i < doc.lines.length; i++) {
      for (const match of (doc.lines[i] ?? "").matchAll(pattern)) {
        ctx.report({
          line: i + 1,
          message: `the body names the model \`${match[0]}\`; name the capability, not the model`,
          match: match[0],
        });
      }
    }
  },
});

export const argumentsTypo = defineRule({
  id: "arguments-typo",
  kinds: ["skills", "agents"],
  defaultSeverity: "error",
  check(doc, ctx) {
    doc.lines.forEach((line, i) => {
      if (/\$ARGUMENT(?!S)/.test(line)) {
        ctx.report({
          line: i + 1,
          message: "`$ARGUMENT` is not substituted; write `$ARGUMENTS`",
          match: line,
        });
      }
    });
  },
});

const CLAUDE_VARIABLE = /\$\{CLAUDE_[A-Z0-9_]+\}/g;

/** A portable skill runs on hosts other than Claude Code, which run no `!` block and substitute no `${CLAUDE_*}`. */
export const portableSyntax = defineRule({
  id: "portable-syntax",
  kinds: ["skills"],
  defaultSeverity: "error",
  check(doc, ctx) {
    if (doc.target.profile !== "portable") return;
    doc.lines.forEach((text, i) => {
      for (const variable of new Set(text.match(CLAUDE_VARIABLE))) {
        ctx.report({
          line: i + 1,
          message: `\`${variable}\` is Claude Code syntax; other hosts pass it through as literal text`,
          match: `${variable}\0${text}`,
        });
      }
      if (i + 1 >= doc.bodyStart && isBlockLine(text)) {
        ctx.report({
          line: i + 1,
          message:
            "a `!` block is Claude Code syntax; other hosts show the command as text instead of running it",
          match: `!\0${text}`,
        });
      }
    });
  },
});
