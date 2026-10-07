import { defineConfig } from "vitepress";

export default defineConfig({
  title: "BDK",
  description: "Broneq Dev Kit - Claude Code plugins with reusable dev workflows",
  cleanUrls: true,
  // The draft 1 archive stays exactly as written, and VitePress cannot compile it (raw HTML-like
  // text in HOST-FACTS.md). It stays out of the site; links into it are not checked.
  srcExclude: ["v3-draft1/**"],
  ignoreDeadLinks: [/\/v3-draft1\//],
  themeConfig: {
    nav: [
      { text: "Decisions", link: "/adr/0002-v3-repo-structure-and-release" },
      { text: "Designs", link: "/design/2026-10-07-v3-architecture" },
    ],
    sidebar: [
      {
        text: "Architecture decisions",
        items: [
          {
            text: "ADR-0001: Remove bundled MCP servers",
            link: "/adr/0001-remove-bundled-mcp-servers",
          },
          {
            text: "ADR-0002: Repository structure and release",
            link: "/adr/0002-v3-repo-structure-and-release",
          },
          { text: "ADR-0003: Skills first", link: "/adr/0003-v3-architecture-skills-first" },
        ],
      },
      {
        text: "Designs",
        items: [
          { text: "v3 architecture", link: "/design/2026-10-07-v3-architecture" },
          {
            text: "Repository structure and CI/CD",
            link: "/design/2026-10-07-v3-repo-structure-cicd",
          },
        ],
      },
    ],
    socialLinks: [{ icon: "github", link: "https://github.com/broneq/bdk" }],
  },
});
