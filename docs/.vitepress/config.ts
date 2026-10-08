import { join } from "node:path";
import { defineConfig } from "vitepress";
import { archiveLinks } from "./archive-links.ts";
import { mermaidFence } from "./mermaid.ts";
import { pageTitle } from "./page-title.ts";
import { sidebar, sidebarItems } from "./sidebar.ts";

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
  head: [
    ["link", { rel: "icon", href: "/bdk/favicon.svg", type: "image/svg+xml" }],
    ["link", { rel: "icon", href: "/bdk/favicon.ico", sizes: "32x32" }],
    ["link", { rel: "apple-touch-icon", href: "/bdk/apple-touch-icon.png" }],
    ["meta", { name: "theme-color", content: "#0F1115" }],
  ],
  markdown: {
    // Code blocks are dark ink in both themes, as in the design system's articles.
    theme: "github-dark",
    config: (md) => {
      md.use(pageTitle);
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
      { text: "Guide", link: "/guide/" },
      { text: "Concepts", link: "/concepts/workflow" },
      { text: "Reference", link: "/reference/" },
      { text: "Decisions", link: adrs.at(-1)?.link ?? "/" },
      { text: "Designs", link: designs.at(-1)?.link ?? "/" },
    ],
    sidebar: sidebar(docsDir),
    search: { provider: "local" },
    outline: [2, 3],
    socialLinks: [{ icon: "github", link: "https://github.com/broneq/bdk" }],
  },
});
