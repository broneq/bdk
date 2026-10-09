import { describe, expect, it } from "vitest";
import { blockLabelLines, diagramProblems, type DrawnDiagram, pagePath } from "./diagram-fit.ts";

describe("pagePath", () => {
  it("drops .md, and an index page is its directory", () => {
    expect(pagePath("concepts/rules.md")).toBe("concepts/rules");
    expect(pagePath("guide/index.md")).toBe("guide/");
    expect(pagePath("index.md")).toBe("");
  });
});

/** A diagram drawn at its own size, with no labels. */
function diagram(changes: Partial<DrawnDiagram> = {}): DrawnDiagram {
  return {
    naturalWidth: 500,
    drawnWidth: 500,
    overflow: 0,
    labels: [],
    blockTexts: [],
    ...changes,
  };
}

const page = "docs/concepts/x.md";
const flowchart = { line: 3, code: "flowchart TB\n  A -->|archived, openspec/ uncommitted| B" };
const sequence = {
  line: 20,
  code: [
    "sequenceDiagram",
    "  alt Status: done",
    "    A->>B: go",
    "  else blocked,<br/>questions: stop",
    "    A->>B: stop",
    "  end",
    "  par batches of execution.max-parallel",
    "    A->>B: go",
    "  and",
    "    A->>B: go",
    "  end",
  ].join("\n"),
};

describe("diagramProblems: fit", () => {
  it("passes a diagram drawn at 0.8 of its size or more, whose frame does not scroll", () => {
    expect(
      diagramProblems(
        page,
        [flowchart, sequence],
        [diagram(), diagram({ naturalWidth: 717, drawnWidth: 574 })],
      ),
    ).toEqual([]);
  });

  it("names the block line, the scale and the widest diagram that fits", () => {
    expect(
      diagramProblems(
        page,
        [flowchart, sequence],
        [diagram(), diagram({ naturalWidth: 960, drawnWidth: 576, overflow: 2 })],
      ),
    ).toEqual([
      "docs/concepts/x.md:20: drawn at 0.60 of its size (960 px wide); at most 720 px fits at 0.8",
      "docs/concepts/x.md:20: its frame scrolls sideways by 2 px",
    ]);
  });

  it("fails a diagram it cannot measure, with no fit or label findings", () => {
    const labels = [{ text: "archived, openspec/ uncommitted", lines: 2 }];
    expect(
      diagramProblems(
        page,
        [flowchart, sequence],
        [diagram({ naturalWidth: 0, labels }), diagram({ naturalWidth: Number.NaN })],
      ),
    ).toEqual([
      "docs/concepts/x.md:3: not laid out, so its fit cannot be measured",
      "docs/concepts/x.md:20: not laid out, so its fit cannot be measured",
    ]);
  });

  it("fails a diagram that shows its Mermaid error, with the error", () => {
    expect(
      diagramProblems(
        page,
        [flowchart, sequence],
        [diagram(), diagram({ naturalWidth: 0, error: "Parse error on line 2" })],
      ),
    ).toEqual(["docs/concepts/x.md:20: does not draw: Parse error on line 2"]);
  });

  it("names a page whose blocks did not all draw", () => {
    expect(diagramProblems(page, [flowchart, sequence], [diagram()])).toEqual([
      "docs/concepts/x.md: 2 mermaid blocks, 1 drawn diagrams",
    ]);
  });
});

describe("diagramProblems: label lines", () => {
  it("passes a flowchart label drawn on the lines its author wrote", () => {
    const labels = [
      { text: "archived, openspec/ uncommitted", lines: 1 },
      { text: "Agent bdk:implementer<br/>/bdk:implement-part", lines: 2 },
    ];
    expect(diagramProblems(page, [flowchart], [diagram({ labels })])).toEqual([]);
  });

  it("names a flowchart label Mermaid broke into more lines than its source has", () => {
    const labels = [{ text: "archived, openspec/ uncommitted", lines: 2 }];
    expect(diagramProblems(page, [flowchart], [diagram({ labels })])).toEqual([
      'docs/concepts/x.md:3: label "archived, openspec/ uncommitted" shows 2 lines, its source 1',
    ]);
  });

  it("passes block labels drawn as written, inside their blocks", () => {
    const blockTexts = [
      { text: "[Status: done]", overflow: 0 },
      { text: "[blocked,", overflow: 0 },
      { text: "questions: stop]", overflow: 0 },
      { text: "[batches of execution.max-parallel]", overflow: 0 },
    ];
    expect(diagramProblems(page, [sequence], [diagram({ blockTexts })])).toEqual([]);
  });

  it("names a block label Mermaid broke because it is wider than its block, once", () => {
    const blockTexts = [
      { text: "[batches of", overflow: 0 },
      { text: "execution.max-parallel]", overflow: 0 },
    ];
    expect(diagramProblems(page, [sequence], [diagram({ blockTexts })])).toEqual([
      'docs/concepts/x.md:20: block label "[batches of execution.max-parallel]" is wider than its block, so Mermaid breaks it; break it with <br/>',
    ]);
  });

  it("names a block label line that runs past its block", () => {
    const blockTexts = [
      { text: "[blocked,", overflow: 0 },
      { text: "questions: stop]", overflow: 12.4 },
    ];
    expect(diagramProblems(page, [sequence], [diagram({ blockTexts })])).toEqual([
      'docs/concepts/x.md:20: block label line "questions: stop]" runs 13 px past its block; break it with <br/>',
    ]);
  });
});

describe("blockLabelLines", () => {
  it("is each line of each block label as Mermaid draws it, in brackets", () => {
    expect([...blockLabelLines(sequence.code)]).toEqual([
      "[Status: done]",
      "[blocked,",
      "questions: stop]",
      "[batches of execution.max-parallel]",
    ]);
  });
});
