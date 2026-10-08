import { join } from "node:path";
import { createMarkdownRenderer } from "vitepress";
import { describe, expect, it } from "vitest";
import { pageTitle } from "./page-title.ts";

const docs = join(import.meta.dirname, "..");

async function render(markdown: string): Promise<{ html: string; title: unknown }> {
  const md = await createMarkdownRenderer(docs, {
    config: (md) => {
      md.use(pageTitle);
    },
  });
  const env: Record<string, unknown> = {
    path: join(docs, "page.md"),
    relativePath: "page.md",
    cleanUrls: true,
  };
  const html = md.render(markdown, env);
  return { html, title: env.title };
}

describe("pageTitle", () => {
  it("splits '<title> - <summary>' into a title with the brand period and a lead", async () => {
    const { html, title } = await render("# Install - add the marketplace and `bdk`\n\nText.\n");
    expect(html).toContain(
      '<h1 id="install" tabindex="-1">Install<span class="bdk-dot" aria-hidden="true">.</span> <a',
    );
    expect(html).toContain('<p class="bdk-page-lead">Add the marketplace and <code>bdk</code></p>');
    expect(title).toBe("Install");
  });

  it("keeps code in the title part", async () => {
    const { html, title } = await render("# `bdk` CLI - every command\n");
    expect(html).toContain("<code>bdk</code> CLI<span");
    expect(title).toBe("bdk CLI");
  });

  it("leaves a heading without ' - ' as it is, with the period", async () => {
    const { html } = await render("# Overview\n");
    expect(html).toContain('Overview<span class="bdk-dot" aria-hidden="true">.</span> <a');
    expect(html).not.toContain("bdk-page-lead");
  });

  it("does not add a second period to a title that ends with one", async () => {
    const { html } = await render("# Done.\n");
    expect(html).not.toContain("bdk-dot");
  });

  it("touches only the first level-one heading", async () => {
    const { html } = await render("# A - one\n\n## B - two\n\n# C - three\n");
    expect(html).toContain(">B - two <a");
    expect(html).toContain(">C - three <a");
  });
});
