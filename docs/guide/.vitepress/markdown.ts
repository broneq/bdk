// Markdown options of the site, shared by config.ts and the anchor guard in
// kernel/tests/docs/, so the guard renders headings exactly as the site does.
import type { MarkdownOptions } from "vitepress";

/**
 * A `mermaid` fence renders as the theme's Mermaid component, client side.
 * Shiki has no gitignore grammar; ini colours its comments and patterns.
 */
export const markdown: MarkdownOptions = {
  languageAlias: { gitignore: "ini" },
  config(md) {
    const fence = md.renderer.rules.fence;
    md.renderer.rules.fence = (tokens, index, options, env, self) => {
      const token = tokens[index];
      if (token?.info.trim() === "mermaid") {
        return `<Mermaid code="${encodeURIComponent(token.content)}" />`;
      }
      return fence === undefined
        ? self.renderToken(tokens, index, options)
        : fence(tokens, index, options, env, self);
    };
  },
};
