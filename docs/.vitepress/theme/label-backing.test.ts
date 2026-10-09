// @vitest-environment happy-dom
// happy-dom does no layout, so each text's box is stubbed; the drawn result is checked on the
// rendered site (change v3-339, design D5).

import { describe, expect, it } from "vitest";
import { backSequenceLabels } from "./label-backing.ts";

/** A sequence SVG shaped like Mermaid's: lifelines, a frame, a note, then messages. */
function sequence(): SVGSVGElement {
  document.body.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" aria-roledescription="sequence">
      <g><line class="actor-line" x1="50" y1="0" x2="50" y2="300"/><text class="actor">lead</text></g>
      <g data-et="control-structure">
        <line class="loopLine" x1="0" y1="100" x2="300" y2="100"/>
        <polygon class="labelBox"/><text class="labelText">alt</text>
        <text class="loopText"><tspan>[merge conflict]</tspan></text>
        <line class="loopLine" x1="0" y1="150" x2="300" y2="150"/>
        <text class="sectionTitle">[else]</text>
      </g>
      <g transform="translate(10,20)"><g transform="scale(2)"><text class="messageText">nested</text></g></g>
      <g><rect class="note"/><text class="noteText">a note</text></g>
      <text class="messageText">part NN</text>
      <line class="messageLine0" x1="50" y1="200" x2="250" y2="200"/>
    </svg>`;
  const svg = document.querySelector("svg");
  if (!svg) throw new Error("no svg");
  // Each text's box, keyed by its content.
  const boxes: Record<string, [number, number, number, number]> = {
    "[merge conflict]": [100, 110, 120, 21],
    "[else]": [130, 160, 40, 21],
    nested: [5, 6, 50, 21],
    "part NN": [120, 170, 60, 21],
  };
  for (const text of svg.querySelectorAll("text")) {
    const [x, y, width, height] = boxes[text.textContent] ?? [0, 0, 0, 0];
    Object.defineProperty(text, "getBBox", { value: () => ({ x, y, width, height }) });
  }
  return svg;
}

function textOf(svg: SVGSVGElement, content: string): SVGTextElement {
  const text = [...svg.querySelectorAll("text")].find((t) => t.textContent === content);
  if (!text) throw new Error(`no text ${content}`);
  return text;
}

describe("backSequenceLabels", () => {
  it("backs every message, frame condition and section title with a box 4 units wider on each side", () => {
    const svg = sequence();
    backSequenceLabels(svg);

    const backings = [...svg.querySelectorAll("rect.label-backing")].map((rect) =>
      ["x", "y", "width", "height"].map((name) => Number(rect.getAttribute(name))),
    );
    expect(backings).toEqual([
      [96, 110, 128, 21],
      [126, 160, 48, 21],
      [1, 6, 58, 21],
      [116, 170, 68, 21],
    ]);
  });

  it("puts each backed label right after its backing, in one layer after every line", () => {
    const svg = sequence();
    backSequenceLabels(svg);

    const layer = svg.lastElementChild as SVGGElement;
    expect(layer.classList.contains("label-layer")).toBe(true);
    for (const content of ["[merge conflict]", "[else]", "nested", "part NN"]) {
      const text = textOf(svg, content);
      expect(layer.contains(text)).toBe(true);
      expect(text.previousElementSibling?.classList.contains("label-backing")).toBe(true);
    }
    for (const line of svg.querySelectorAll("line")) {
      expect(line.compareDocumentPosition(layer) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(layer.contains(line)).toBe(false);
    }
  });

  it("keeps a label where Mermaid drew it when an ancestor is transformed", () => {
    const svg = sequence();
    backSequenceLabels(svg);

    expect(textOf(svg, "nested").parentElement?.getAttribute("transform")).toBe(
      "translate(10,20) scale(2)",
    );
    expect(textOf(svg, "part NN").parentElement?.hasAttribute("transform")).toBe(false);
  });

  it("leaves texts that sit on their own box where they are", () => {
    const svg = sequence();
    backSequenceLabels(svg);

    expect(textOf(svg, "alt").previousElementSibling?.classList.contains("labelBox")).toBe(true);
    expect(textOf(svg, "a note").previousElementSibling?.classList.contains("note")).toBe(true);
    expect(textOf(svg, "lead").previousElementSibling?.classList.contains("actor-line")).toBe(true);
    expect(svg.querySelectorAll("rect.label-backing")).toHaveLength(4);
  });
});
