import { existsSync } from "node:fs";
import { join, posix } from "node:path";
import type { MarkdownEnv, MarkdownRenderer } from "vitepress";

const archive = "v3-draft1/";
const github = "https://github.com/broneq/bdk/blob/main/docs/";

/**
 * The `docs/v3-draft1/` archive is not part of the site (it does not compile), so a relative
 * link into it would be dead there. This plugin points such links to the file on GitHub, on
 * `main`, the branch the site deploys from. VitePress does not check absolute links, so the
 * plugin checks the target itself: a link to a missing archive file fails the build.
 */
export function archiveLinks(md: MarkdownRenderer, docsDir: string): void {
  md.core.ruler.push("archive_links", (state) => {
    const env = state.env as MarkdownEnv;
    for (const token of state.tokens.flatMap((block) => block.children ?? [])) {
      const href = token.type === "link_open" ? token.attrGet("href") : null;
      // Skip anchors and links with a scheme (`https:`, `mailto:`) or protocol-relative ones.
      if (href === null || href.startsWith("#") || /^([a-z][a-z\d+.-]*:|\/\/)/i.test(href)) {
        continue;
      }
      const hashAt = href.indexOf("#");
      const path = hashAt === -1 ? href : href.slice(0, hashAt);
      const hash = hashAt === -1 ? "" : href.slice(hashAt);
      const target = path.startsWith("/")
        ? posix.normalize(path.slice(1))
        : posix.join(posix.dirname(env.relativePath), path);
      if (!target.startsWith(archive)) {
        continue;
      }
      if (!existsSync(join(docsDir, target))) {
        throw new Error(`${env.relativePath} links to ${href}, which does not exist in docs/`);
      }
      token.attrSet("href", github + target + hash);
    }
  });
}
