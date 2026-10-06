// The site's sidebar as plain data: config.ts renders it, and the drift guard
// in kernel/tests/docs/ reads it without loading VitePress (`docs-site`, Site
// drift guards). A link is the page path under docs/guide/ without `.md`;
// `/` is index.md and a trailing `/` is the directory's index.md.
import type { DefaultTheme } from "vitepress";

export const sidebar = [
  { text: "Home", link: "/" },
  {
    text: "Getting started",
    items: [
      { text: "Installation", link: "/getting-started/installation" },
      { text: "Setup", link: "/getting-started/setup" },
      { text: "Your first feature", link: "/getting-started/first-feature" },
      { text: "Migration from v2", link: "/getting-started/migration-from-v2" },
    ],
  },
  {
    text: "Workflows",
    items: [
      { text: "Tiny changes", link: "/workflows/tiny" },
      { text: "Small changes", link: "/workflows/small" },
      { text: "Large changes", link: "/workflows/large" },
      { text: "Debugging", link: "/workflows/debugging" },
      { text: "Code review", link: "/workflows/code-review" },
      { text: "Docs and decisions", link: "/workflows/docs-and-decisions" },
      { text: "Rules hygiene", link: "/workflows/rules-hygiene" },
      { text: "Diagnostics", link: "/workflows/diagnostics" },
    ],
  },
  {
    text: "Concepts",
    items: [
      { text: "The Change pipeline", link: "/concepts/change-pipeline" },
      { text: "Context", link: "/concepts/context" },
      { text: "Verification scoping", link: "/concepts/verification-scoping" },
      { text: "Worktree parts", link: "/concepts/worktree-parts" },
      { text: "Agents", link: "/concepts/agents" },
      { text: "Quality and language rules", link: "/concepts/quality-and-language-rules" },
    ],
  },
  {
    text: "Reference",
    items: [
      { text: "Skills", link: "/reference/skills" },
      { text: "Agents", link: "/reference/agents" },
      { text: "Configuration", link: "/reference/configuration" },
      { text: "Hooks", link: "/reference/hooks" },
      { text: "Artifacts", link: "/reference/artifacts" },
    ],
  },
  { text: "Troubleshooting", link: "/troubleshooting" },
  {
    text: "Contributing",
    items: [
      { text: "Overview", link: "/contributing/" },
      { text: "Evals", link: "/contributing/evals" },
    ],
  },
  { text: "Changelog", link: "/changelog" },
] satisfies DefaultTheme.SidebarItem[];
