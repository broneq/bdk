import { describe, expect, it } from "vitest";

import { fixedClock, systemClock } from "../index.ts";

describe("clock", () => {
  it("prints the system time as ISO 8601 UTC with milliseconds at a fixed width", () => {
    const before = Date.now();
    const at = systemClock.now();
    expect(at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect(Math.abs(Date.parse(at) - before)).toBeLessThan(2000);
  });

  it("returns the injected instant, normalised to the same format", () => {
    expect(fixedClock("2026-09-25T16:50:07.123Z").now()).toBe("2026-09-25T16:50:07.123Z");
    expect(fixedClock("2026-09-25T16:50:07Z").now()).toBe("2026-09-25T16:50:07.000Z");
    expect(fixedClock("2026-09-25T18:50:07.5+02:00").now()).toBe("2026-09-25T16:50:07.500Z");
  });

  it("rejects an instant that is not a date", () => {
    expect(() => fixedClock("yesterday")).toThrow("yesterday");
  });
});
