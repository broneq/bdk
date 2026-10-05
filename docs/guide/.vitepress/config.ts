// The documentation site (capability `docs-site`): `pnpm docs:build` runs
// `vitepress build docs/guide`. A dead link fails the build; anchors are checked
// by kernel/tests/docs/anchors.test.ts.
import { defineConfig } from "vitepress";

import { markdown } from "./markdown.ts";
import { sidebar } from "./sidebar.ts";

export default defineConfig({
  title: "BDK",
  description: "Broneq Dev Kit - change-centric dev workflows for Claude Code",
  base: "/bdk/",
  lang: "en",
  lastUpdated: false,
  head: [["link", { rel: "icon", type: "image/svg+xml", href: "/bdk/favicon.svg" }]],
  markdown,
  // Mermaid's renderers (elk, cytoscape, katex) are lazy chunks that load only
  // on a page with a diagram; their size is not a page-load cost.
  vite: { build: { chunkSizeWarningLimit: 2000 } },
  themeConfig: {
    nav: [
      { text: "Getting started", link: "/getting-started/installation" },
      { text: "Workflows", link: "/workflows/full-pipeline" },
      { text: "Concepts", link: "/concepts/shared-foundation" },
      { text: "Reference", link: "/reference/skills" },
    ],
    sidebar,
    search: { provider: "local" },
    socialLinks: [{ icon: "github", link: "https://github.com/broneq/bdk" }],
    editLink: {
      pattern: "https://github.com/broneq/bdk/edit/main/docs/guide/:path",
      text: "Edit this page on GitHub",
    },
    outline: { level: [2, 3] },
  },
});
