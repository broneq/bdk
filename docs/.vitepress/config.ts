import { join } from "node:path";
import { defineConfig } from "vitepress";
import { archiveLinks } from "./archive-links.ts";
import { mermaidFence } from "./mermaid.ts";
import { sidebarItems } from "./sidebar.ts";

const docsDir = join(import.meta.dirname, "..");
const adrs = sidebarItems(docsDir, "adr");
const designs = sidebarItems(docsDir, "design");

export default defineConfig({
  title: "BDK",
  description: "Broneq Dev Kit - Claude Code plugins with reusable dev workflows",
  // GitHub Pages serves the site at https://broneq.github.io/bdk/.
  base: "/bdk/",
  cleanUrls: true,
  // The draft 1 archive stays exactly as written, and VitePress cannot compile it (raw HTML-like
  // text in HOST-FACTS.md). It stays out of the site; archiveLinks points links into it to GitHub.
  srcExclude: ["v3-draft1/**"],
  markdown: {
    config: (md) => {
      md.use(archiveLinks, docsDir);
      md.use(mermaidFence);
    },
  },
  vite: {
    // Mermaid's diagram chunks (elk, cytoscape, mermaid.core) pass 500 kB. They load only on
    // pages with a diagram, after the page renders.
    build: { chunkSizeWarningLimit: 2000 },
  },
  themeConfig: {
    nav: [
      { text: "Decisions", link: adrs.at(-1)?.link ?? "/" },
      { text: "Designs", link: designs.at(-1)?.link ?? "/" },
    ],
    sidebar: [
      { text: "Architecture decisions", items: adrs },
      { text: "Designs", items: designs },
    ],
    socialLinks: [{ icon: "github", link: "https://github.com/broneq/bdk" }],
  },
});
