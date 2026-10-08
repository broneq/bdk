import { useData } from "vitepress";
import { defineComponent, h, nextTick, onMounted, ref, useId, watch } from "vue";

// A diagram shrinks to the page width, but not below this share of its own width: text stays
// readable and a wide diagram scrolls sideways instead, mostly on phones.
const minScale = 0.6;

/** A design system token as the page resolves it now, in the current theme. */
function token(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/**
 * Mermaid's base theme in the design system's colors and type: hairline boxes on the raised
 * surface, ink lines, the brand blue only as the accent of notes and highlights. Read from the
 * tokens on every draw, so a theme switch redraws in the other theme's values.
 */
function brandVariables(): Record<string, string> {
  const surface = token("--bg-raised");
  const subtle = token("--bg-subtle");
  const text = token("--fg-default");
  const body = token("--fg-body");
  const line = token("--fg-muted");
  const border = token("--line-strong");
  return {
    darkMode: String(document.documentElement.classList.contains("dark")),
    fontFamily: token("--font-sans"),
    fontSize: "14px",
    background: token("--bg-page"),
    primaryColor: surface,
    primaryTextColor: text,
    primaryBorderColor: border,
    secondaryColor: subtle,
    secondaryTextColor: text,
    secondaryBorderColor: border,
    tertiaryColor: subtle,
    tertiaryTextColor: text,
    tertiaryBorderColor: border,
    lineColor: line,
    textColor: body,
    mainBkg: surface,
    nodeBorder: border,
    clusterBkg: subtle,
    clusterBorder: token("--line-default"),
    edgeLabelBackground: token("--bg-page"),
    titleColor: text,
    actorBkg: surface,
    actorBorder: border,
    actorTextColor: text,
    actorLineColor: line,
    signalColor: body,
    signalTextColor: text,
    labelBoxBkgColor: subtle,
    labelBoxBorderColor: border,
    labelTextColor: text,
    loopTextColor: text,
    noteBkgColor: subtle,
    noteBorderColor: token("--accent"),
    noteTextColor: text,
    activationBkgColor: subtle,
    activationBorderColor: border,
    sequenceNumberColor: token("--fg-on-accent"),
  };
}

/**
 * Draws one diagram from the URI-encoded `code` that the `mermaid` fence rule writes. Until the
 * diagram is drawn (and without JavaScript) the source shows as code. Mermaid loads only in the
 * browser and only on pages with a diagram; the diagram is drawn again when the theme changes.
 */
export default defineComponent({
  name: "Mermaid",
  props: { code: { type: String, required: true } },
  setup(props) {
    const { isDark } = useData();
    const source = decodeURIComponent(props.code);
    const id = `mermaid-${useId()}`;
    const root = ref<HTMLElement>();
    const svg = ref("");
    const error = ref("");
    let drawn = 0;

    async function draw(): Promise<void> {
      const attempt = ++drawn;
      try {
        const { default: mermaid } = await import("mermaid");
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          theme: "base",
          themeVariables: brandVariables(),
        });
        // render() draws a syntax error as a diagram of its own; parse() throws it instead, so
        // the reader gets the error with the source.
        await mermaid.parse(source);
        // Mermaid sizes the labels in a scratch element inside `root`, so the page styles that
        // apply to the drawn diagram apply to the measurement too, and no label is cut off.
        const { svg: result } = await mermaid.render(id, source, root.value);
        // A theme switch during the render started a newer one; its result wins.
        if (attempt === drawn) {
          svg.value = result;
          error.value = "";
          await nextTick();
          const drawing = root.value?.querySelector("svg");
          if (drawing) {
            drawing.style.minWidth = `${String(Math.round(drawing.viewBox.baseVal.width * minScale))}px`;
          }
        }
      } catch (reason) {
        if (attempt === drawn) {
          error.value = reason instanceof Error ? reason.message : String(reason);
        }
      }
    }

    onMounted(draw);
    watch(isDark, draw);

    return () => {
      if (svg.value && !error.value) {
        return h("div", { ref: root, class: "mermaid", innerHTML: svg.value });
      }
      return h("div", { ref: root, class: "mermaid mermaid-source" }, [
        error.value ? h("p", { class: "mermaid-error" }, `Diagram error: ${error.value}`) : null,
        h("pre", h("code", source)),
      ]);
    };
  },
});
