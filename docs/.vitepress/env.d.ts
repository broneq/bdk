// Types for what Vite resolves in the theme, such as CSS imports.
/// <reference types="vitepress/client" />

// Single-file components of the theme (Layout.vue, home/HomePage.vue).
declare module "*.vue" {
  import type { DefineComponent } from "vue";
  const component: DefineComponent;
  export default component;
}
