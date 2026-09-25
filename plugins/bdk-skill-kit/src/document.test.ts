import { describe, expect, it } from "vitest";
import { parseDocument } from "./document.ts";
import type { ResolvedTarget } from "./index.ts";

const target: ResolvedTarget = {
  kind: "skills",
  dirs: ["skills"],
  profile: "claude-code",
  name: "skills",
};

function parse(text: string, files: string[] = []) {
  return parseDocument({
    kind: "skills",
    target,
    path: "skills/demo/SKILL.md",
    dir: "skills/demo",
    text,
    files,
  });
}

describe("parseDocument", () => {
  it("reads the frontmatter map with the line of each key", () => {
    const doc = parse("---\nname: demo\ndescription: >-\n  Folded.\nmodel: x\n---\n\nBody\n");
    expect(doc.frontmatter).toEqual({ name: "demo", description: "Folded.", model: "x" });
    expect(doc.frontmatterError).toBeUndefined();
    expect(doc.keyLines).toEqual({ name: 2, description: 3, model: 5 });
    expect(doc.bodyStart).toBe(7);
    expect(doc.lines[7]).toBe("Body");
  });

  it("keeps every line with 1-based numbering and no trailing empty line", () => {
    const doc = parse("---\nname: demo\n---\nline four\n");
    expect(doc.lines).toEqual(["---", "name: demo", "---", "line four"]);
  });

  it("marks fenced code lines, fences included", () => {
    const doc = parse("---\nname: demo\n---\ntext\n```sh\nrun\n```\n~~~\nx\n~~~\nafter\n");
    expect([4, 5, 6, 7, 8, 9, 10, 11].map((n) => doc.inFence(n))).toEqual([
      false,
      true,
      true,
      true,
      true,
      true,
      true,
      false,
    ]);
  });

  it("does not close a backtick fence with a tilde fence", () => {
    const doc = parse("---\nname: demo\n---\n```\n~~~\nstill\n```\nout\n");
    expect(doc.inFence(6)).toBe(true);
    expect(doc.inFence(8)).toBe(false);
  });

  it("reports a file without frontmatter and treats the whole file as body", () => {
    const doc = parse("# Title\n");
    expect(doc.frontmatter).toBeUndefined();
    expect(doc.frontmatterError).toBe("the file does not open with a `---` frontmatter block");
    expect(doc.bodyStart).toBe(1);
  });

  it("reports an unclosed frontmatter block", () => {
    const doc = parse("---\nname: demo\n");
    expect(doc.frontmatter).toBeUndefined();
    expect(doc.frontmatterError).toBe("the frontmatter block is not closed with `---`");
  });

  it("reports frontmatter that is not a map", () => {
    const doc = parse("---\n- a\n- b\n---\nBody\n");
    expect(doc.frontmatter).toBeUndefined();
    expect(doc.frontmatterError).toBe("the frontmatter is not a YAML map");
    expect(doc.bodyStart).toBe(5);
  });

  it("reports frontmatter that does not parse", () => {
    const doc = parse("---\nname: [unclosed\n---\nBody\n");
    expect(doc.frontmatter).toBeUndefined();
    expect(doc.frontmatterError).toMatch(/^the frontmatter is not valid YAML: /);
  });

  it("reports duplicate keys as invalid YAML", () => {
    const doc = parse("---\nname: a\nname: b\n---\nBody\n");
    expect(doc.frontmatterError).toMatch(/^the frontmatter is not valid YAML: /);
  });

  it("accepts an empty frontmatter block as an empty map", () => {
    const doc = parse("---\n---\nBody\n");
    expect(doc.frontmatter).toEqual({});
    expect(doc.bodyStart).toBe(3);
  });

  it("handles CRLF line endings", () => {
    const doc = parse("---\r\nname: demo\r\n---\r\nBody\r\n");
    expect(doc.frontmatter).toEqual({ name: "demo" });
    expect(doc.lines).toEqual(["---", "name: demo", "---", "Body"]);
  });

  it("carries the skill directory's file list", () => {
    expect(parse("---\nname: demo\n---\nx\n", ["references/a.md"]).files).toEqual([
      "references/a.md",
    ]);
  });
});
