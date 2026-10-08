import type { MarkdownRenderer } from "vitepress";

/** Markdown-it's token, taken from the renderer's own types. */
type Token = ReturnType<MarkdownRenderer["parse"]>[number];

const SEPARATOR = " - ";

/**
 * Renders a page's first heading the way the design system draws a page header: every page
 * heading reads "<title> - <summary>", so the title stays in the `h1` and ends with the blue
 * period, and the summary follows as the lead paragraph. The page's `<title>` becomes the short
 * title, since VitePress reads it from the `h1` at render time.
 */
export function pageTitle(md: MarkdownRenderer): void {
  // Before markdown-it-anchor, which appends the permalink to the heading and ids it from the text.
  md.core.ruler.before("anchor", "page_title", (state) => {
    const tokens = state.tokens;
    const at = tokens.findIndex((token) => token.type === "heading_open" && token.tag === "h1");
    const inline = tokens[at + 1];
    if (at === -1 || inline?.type !== "inline" || !inline.children) return;

    const children = inline.children;
    const cut = children.findIndex(
      (child) => child.type === "text" && child.content.includes(SEPARATOR),
    );
    let lead: Token[] = [];
    const child = children[cut];
    if (child !== undefined) {
      const split = child.content.indexOf(SEPARATOR);
      const after = new state.Token("text", "", 0);
      after.content = child.content.slice(split + SEPARATOR.length);
      child.content = child.content.slice(0, split);
      // The summary starts a sentence of its own: sentence case, as the design system writes.
      after.content = after.content.charAt(0).toUpperCase() + after.content.slice(1);
      lead = [after, ...children.slice(cut + 1)];
      inline.children = children.slice(0, cut + 1);
    }

    const title = inline.children;
    const last = title.at(-1);
    if (!(last?.type === "text" && /[.!?]$/.test(last.content))) {
      const dot = new state.Token("html_inline", "", 0);
      dot.content = '<span class="bdk-dot" aria-hidden="true">.</span>';
      title.push(dot);
    }

    if (lead.length > 0) {
      const open = new state.Token("paragraph_open", "p", 1);
      open.attrSet("class", "bdk-page-lead");
      const body = new state.Token("inline", "", 0);
      body.children = lead;
      body.content = lead.map((token) => token.content).join("");
      const close = new state.Token("paragraph_close", "p", -1);
      tokens.splice(at + 3, 0, open, body, close);
    }
  });
}
