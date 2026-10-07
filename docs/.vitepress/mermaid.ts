import type { MarkdownRenderer } from "vitepress";

/**
 * Renders a `mermaid` fence as the `Mermaid` component of the theme, which draws the diagram in
 * the browser. The source is URI-encoded, so neither Vue (`{{ }}`) nor HTML in it is interpreted.
 */
export function mermaidFence(md: MarkdownRenderer): void {
  const fence = md.renderer.rules.fence;
  md.renderer.rules.fence = (tokens, idx, options, env, self) => {
    const token = tokens[idx];
    if (token?.info.trim() === "mermaid") {
      return `<Mermaid code="${encodeURIComponent(token.content)}" />\n`;
    }
    return fence ? fence(tokens, idx, options, env, self) : self.renderToken(tokens, idx, options);
  };
}
