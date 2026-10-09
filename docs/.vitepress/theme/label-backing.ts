const svgNamespace = "http://www.w3.org/2000/svg";

/**
 * The sequence texts Mermaid draws with no background: messages, frame conditions and section
 * titles. Participant names, notes and the frame's label tab sit on a filled box of their own.
 */
const bareLabels = "text.messageText, text.loopText, text.sectionTitle";

/** Space between a label's letters and a line that passes behind it, left and right. */
const sidePadding = 4;

/**
 * Gives every bare label of a drawn sequence diagram a box in the page colour (`.label-backing`,
 * filled in `brand.css`) and lifts label and box into one layer drawn after everything else, so a
 * lifeline or frame line passes behind the text instead of through it, whatever order Mermaid
 * draws in. Each label keeps its ancestors' transforms, so it stays where Mermaid put it.
 */
export function backSequenceLabels(svg: SVGSVGElement): void {
  const labels = [...svg.querySelectorAll<SVGTextElement>(bareLabels)];
  if (labels.length === 0) return;
  const layer = svg.appendChild(document.createElementNS(svgNamespace, "g"));
  layer.classList.add("label-layer");
  for (const label of labels) {
    // Measured before the move: the box is in the label's own coordinates either way.
    const box = label.getBBox();
    const holder = layer.appendChild(document.createElementNS(svgNamespace, "g"));
    const transform = inheritedTransform(label, svg);
    if (transform) holder.setAttribute("transform", transform);
    const backing = holder.appendChild(document.createElementNS(svgNamespace, "rect"));
    backing.classList.add("label-backing");
    backing.setAttribute("x", String(box.x - sidePadding));
    backing.setAttribute("y", String(box.y));
    backing.setAttribute("width", String(box.width + 2 * sidePadding));
    backing.setAttribute("height", String(box.height));
    holder.appendChild(label);
  }
}

/** The `transform` attributes between `element` and `svg`, outermost first, as SVG composes them. */
function inheritedTransform(element: Element, svg: SVGSVGElement): string {
  const transforms: string[] = [];
  for (
    let parent: Element | null = element.parentElement;
    parent && parent !== svg;
    parent = parent.parentElement
  ) {
    const transform = parent.getAttribute("transform");
    if (transform) transforms.unshift(transform);
  }
  return transforms.join(" ");
}
