// Renders one mermaid diagram in the browser, and again when the theme
// switches between light and dark. `code` is the fence content, URI-encoded
// (markdown.ts). A render function keeps the component plain TypeScript.
import { useData } from "vitepress";
import { defineComponent, h, onMounted, ref, useId, watch } from "vue";

/**
 * Gives the diagram the width of its viewBox instead of the column's: a wide
 * flowchart scaled to the column shrinks its labels below reading size, so it
 * scrolls instead (style.css).
 */
function naturalSize(svg: string): string {
  const width = /viewBox="[\d.-]+ [\d.-]+ ([\d.]+)/.exec(svg)?.[1];
  if (width === undefined) return svg;
  return svg
    .replace(/^<svg([^>]*?) width="100%"/, `<svg$1 width="${width}"`)
    .replace(/max-width: [\d.]+px;/, "");
}

export const Mermaid = defineComponent({
  name: "Mermaid",
  props: { code: { type: String, required: true } },
  setup(props) {
    const { isDark } = useData();
    const svg = ref("");
    const id = `mermaid-${useId()}`;

    async function render(): Promise<void> {
      const { default: mermaid } = await import("mermaid");
      mermaid.initialize({ startOnLoad: false, theme: isDark.value ? "dark" : "default" });
      svg.value = naturalSize((await mermaid.render(id, decodeURIComponent(props.code))).svg);
    }

    onMounted(render);
    watch(isDark, render);
    return () => h("div", { class: "mermaid", innerHTML: svg.value });
  },
});
