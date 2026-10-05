/// <reference types="vitepress/client" />
// The default theme plus the Mermaid component that `mermaid` fences render to
// (markdown.ts).
import DefaultTheme from "vitepress/theme";
import type { Theme } from "vitepress";

import { Mermaid } from "./mermaid.ts";
import "./style.css";

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component("Mermaid", Mermaid);
  },
} satisfies Theme;
