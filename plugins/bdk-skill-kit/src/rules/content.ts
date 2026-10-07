import { defineRule } from "../index.ts";
import { escapeRegex, isBlockLine } from "./shared.ts";

export const body = defineRule({
  id: "body",
  kinds: ["skills", "agents"],
  defaultSeverity: "error",
  explain: [
    "Checks that the file has a non-empty body after the frontmatter.",
    "Why: the body is what the model follows when the skill loads; a skill with only frontmatter does nothing.",
    "Fix: write the instructions, or delete the file.",
  ].join("\n\n"),
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
  explain: [
    "Checks that `SKILL.md` has at most the maximum number of lines.",
    "Why: a long skill is skimmed, not read, and the whole file lands in context every time the skill runs.",
    "Fix: move detail that only some runs need into files under `references/` and link them from `SKILL.md`.",
    "Options: `max` is the limit, default 500.",
  ].join("\n\n"),
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
  explain: [
    "Checks that no line holds an absolute file-system path, a home-relative path (`~/...`) or a Windows drive path.",
    "Why: such a path exists only on the author's machine; a skill with one fails for every other user.",
    "Fix: write paths relative to the skill directory, or start them with a host variable such as `${CLAUDE_SKILL_DIR}`.",
  ].join("\n\n"),
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
  explain: [
    "Checks that the body names no model family or model ID from the list; the frontmatter `model` field is exempt.",
    "Why: a model name in prose goes stale with the next release, while a capability (`a fast model`, `the most capable model`) stays true.",
    "Fix: name the capability, not the model.",
    "Options: `names` is the list of regular expressions to match, case-insensitive, on whole words.",
  ].join("\n\n"),
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

/**
 * Wording that asks for the reasoning itself in the output, after the examples
 * in Anthropic's refusals guide (`reasoning_extraction`): a thinking or
 * scratchpad section, reasoning shown or written out, chain-of-thought steps.
 * Mere encouragement (`think carefully`) is not on the list: it asks for no
 * output.
 */
const REASONING_PHRASES = [
  "think step by step",
  "think step-by-step",
  "show your reasoning",
  "explain your reasoning",
  "show your thinking",
  "write out your thinking",
  "reason out loud",
  "chain of thought",
  "<thinking>",
  "<reasoning>",
  "scratchpad",
];

export const reasoningPrompts = defineRule<{ phrases: string[] }>({
  id: "reasoning-prompts",
  kinds: ["skills", "agents"],
  defaultSeverity: "warning",
  defaultOptions: { phrases: REASONING_PHRASES },
  explain: [
    "Checks that the body, `description` and `when_to_use` hold no phrase that asks the model to put its reasoning in the output, such as `think step by step`, `show your reasoning`, `chain of thought`, a `<thinking>` section or a scratchpad.",
    "Why: current models reason on their own, and a prompt that asks the model to reproduce its reasoning in the response can be declined outright (the `reasoning_extraction` refusal, which has no fallback model); on other models it only costs tokens. The wording counts wherever it reaches the model, so the description, which sits in the system prompt, is checked too.",
    "Fix: delete the phrase, and ask for what you need instead: a short summary of the actions taken, or the checks the result must pass.",
    "Options: `phrases` is the list of phrases to match, case-insensitive, on whole words; it replaces the default list.",
  ].join("\n\n"),
  check(doc, ctx) {
    const words = ctx.options.phrases.map((p) => escapeRegex(p.trim()).replace(/\s+/g, "\\s+"));
    const pattern = new RegExp(`(?<![\\w-])(?:${words.join("|")})(?![\\w-])`, "gi");
    const report = (line: number, text: string) => {
      for (const match of text.matchAll(pattern)) {
        ctx.report({
          line,
          message: `\`${match[0]}\` asks the model to put its reasoning in the output; current models reason on their own and may decline the request; ask for a summary of the actions taken instead`,
          match: match[0],
        });
      }
    };
    for (const key of ["description", "when_to_use"]) {
      const value = doc.frontmatter?.[key];
      if (typeof value === "string") report(doc.keyLines[key] ?? 1, value);
    }
    for (let i = doc.bodyStart - 1; i < doc.lines.length; i++) {
      report(i + 1, doc.lines[i] ?? "");
    }
  },
});

export const argumentsTypo = defineRule({
  id: "arguments-typo",
  kinds: ["skills", "agents"],
  defaultSeverity: "error",
  explain: [
    "Checks that the body never writes `$ARGUMENT` without the trailing `S`.",
    "Why: only `$ARGUMENTS` is substituted; the singular reaches the model as literal text.",
    "Fix: write `$ARGUMENTS`.",
  ].join("\n\n"),
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
  explain: [
    "Checks that a skill in the portable profile has no `!` block in its body and no `${CLAUDE_*}` substitution anywhere.",
    "Why: both are Claude Code syntax; another host passes them through as literal text, so the skill runs nothing and shows the variable name.",
    "Fix: drop the block or the variable, or move the skill to a claude-code target if it is only for Claude Code.",
  ].join("\n\n"),
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
