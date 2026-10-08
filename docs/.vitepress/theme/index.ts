import type { Theme } from "vitepress";
import DefaultTheme from "vitepress/theme";
import HomePage from "./home/HomePage.vue";
import Layout from "./Layout.vue";
import Mermaid from "./mermaid-diagram.ts";
import "./brand.css";
import "./style.css";

export default {
  extends: DefaultTheme,
  Layout,
  enhanceApp({ app }) {
    app.component("Mermaid", Mermaid);
    app.component("HomePage", HomePage);
  },
} satisfies Theme;
