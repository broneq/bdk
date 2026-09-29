import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const VARIANTS = join(import.meta.dirname, "variants");

function skill(variant: string): string {
  return readFileSync(join(VARIANTS, `execute-${variant}`, "SKILL.md"), "utf8");
}

describe("execute variants", () => {
  it("keeps v3-thin at 200 lines or fewer (design D-5)", () => {
    expect(skill("thin").split("\n").length).toBeLessThanOrEqual(200);
  });

  it.each(["thin", "long"])("%s is a user-typed coordinator without Edit and Write", (variant) => {
    const text = skill(variant);
    const frontmatter = text.slice(0, text.indexOf("\n---", 4));
    expect(frontmatter).toMatch(new RegExp(`^name: execute-${variant}$`, "m"));
    expect(frontmatter).toMatch(/^disable-model-invocation: true$/m);
    expect(frontmatter).toMatch(/^disallowed-tools: .*\bEdit\b/m);
    expect(frontmatter).toMatch(/^disallowed-tools: .*\bWrite\b/m);
  });
});
