import { join } from "node:path";
import { createMarkdownRenderer } from "vitepress";
import { describe, expect, it } from "vitest";
import { mermaidFence } from "./mermaid.ts";

const docs = join(import.meta.dirname, "..");

async function render(markdown: string): Promise<string> {
  const md = await createMarkdownRenderer(docs, {
    config: (md) => {
      md.use(mermaidFence);
    },
  });
  return md.render(markdown, {
    path: join(docs, "page.md"),
    relativePath: "page.md",
    cleanUrls: true,
  });
}

describe("mermaidFence", () => {
  it("turns a mermaid block into a Mermaid element carrying the encoded source", async () => {
    const source = 'flowchart LR\n  A["<b>a</b> {{x}}"] -->|"yes & no"| B\n';
    const html = await render("```mermaid\n" + source + "```\n");

    const match = /^<Mermaid code="([^"]*)" \/>$/.exec(html.trim());
    expect(match?.[1]).toBeDefined();
    expect(decodeURIComponent(match?.[1] ?? "")).toBe(source);
  });

  it("renders every other fence as before", async () => {
    const html = await render("```ts\nconst a = 1;\n```\n");

    expect(html).not.toContain("<Mermaid");
    expect(html).toContain("language-ts");
  });
});
