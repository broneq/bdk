import { describe, expect, it } from "vitest";
import { sectionOf } from "./sections.ts";

describe("sectionOf", () => {
  it("names the section of a page under the site base", () => {
    expect(sectionOf("/bdk/guide/install")).toEqual({ label: "Guide", numbered: true });
    expect(sectionOf("/bdk/guide/")).toEqual({ label: "Guide", numbered: true });
    expect(sectionOf("/bdk/reference/bdk/skills")).toEqual({ label: "Reference", numbered: false });
    expect(sectionOf("/bdk/adr/0003-v3-architecture-skills-first")?.label).toBe(
      "Architecture decision",
    );
  });

  it("has no section for the home page", () => {
    expect(sectionOf("/bdk/")).toBeUndefined();
  });
});
