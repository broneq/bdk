import { join } from "node:path";
import { createMarkdownRenderer } from "vitepress";
import { describe, expect, it } from "vitest";
import { archiveLinks } from "./archive-links.ts";

const docs = join(import.meta.dirname, "..");
const github = "https://github.com/broneq/bdk/blob/main/docs";

async function render(markdown: string, relativePath = "design/page.md"): Promise<string> {
  const md = await createMarkdownRenderer(docs, {
    config: (md) => {
      md.use(archiveLinks, docs);
    },
  });
  return md.render(markdown, { path: join(docs, relativePath), relativePath, cleanUrls: true });
}

describe("archiveLinks", () => {
  it("points a relative link into the archive to the file on GitHub, keeping its anchor", async () => {
    const html = await render(
      "[findings](../v3-draft1/run-b1/2026-10-07-bdk-v3-findings.md#root-causes)",
    );

    expect(html).toContain(
      `href="${github}/v3-draft1/run-b1/2026-10-07-bdk-v3-findings.md#root-causes"`,
    );
  });

  it("resolves the link against the page's own directory", async () => {
    const html = await render("[facts](./v3-draft1/host/HOST-FACTS.md)", "index.md");

    expect(html).toContain(`href="${github}/v3-draft1/host/HOST-FACTS.md"`);
  });

  it("leaves links outside the archive to VitePress", async () => {
    const html = await render(
      "[adr](../adr/0002-v3-repo-structure-and-release.md) [web](https://example.com/v3-draft1/x.md)",
    );

    expect(html).toContain('href="./../adr/0002-v3-repo-structure-and-release"');
    expect(html).toContain('href="https://example.com/v3-draft1/x.md"');
  });

  it("fails naming the page and the link when the archive file does not exist", async () => {
    await expect(render("[gone](../v3-draft1/missing.md)")).rejects.toThrow(
      "design/page.md links to ../v3-draft1/missing.md, which does not exist in docs/",
    );
  });
});
