import { describe, expect, it } from "vitest";

import {
  effectiveProfile,
  isConfirmed,
  parkedQuestion,
  stageOf,
  supersededBy,
} from "../derived.ts";
import type { EntryFacts } from "../derived.ts";

let counter = 0;
function entry(partial: Partial<EntryFacts> & Pick<EntryFacts, "type">): EntryFacts {
  counter++;
  return {
    id: `L-${String(counter).padStart(8, "0")}`,
    at: "2026-09-25T10:00:00Z",
    source: "kernel",
    refs: ["design.md"],
    ...partial,
  };
}

const same = (to: string): string => to;

describe("stageOf", () => {
  it("maps the target of the latest transition through the resolver", () => {
    const stages: Record<string, string> = { "plan-part:02": "plan", design: "design" };
    const resolve = (to: string): string => stages[to] ?? to;
    expect(stageOf([entry({ type: "transition", to: "plan-part:02" })], resolve)).toBe("plan");
    expect(stageOf([entry({ type: "transition", to: "review" })], resolve)).toBe("review");
    expect(stageOf([], resolve)).toBe("intent");
  });

  it("is intent without transitions", () => {
    expect(stageOf([entry({ type: "decision" })], same)).toBe("intent");
  });

  it("is the to of the latest transition", () => {
    expect(
      stageOf(
        [
          entry({ type: "transition", to: "plan", at: "2026-09-25T11:00:00Z" }),
          entry({ type: "transition", to: "design", at: "2026-09-25T10:00:00Z" }),
        ],
        same,
      ),
    ).toBe("plan");
  });

  it("breaks a tie by the greater id", () => {
    expect(
      stageOf(
        [
          entry({ type: "transition", to: "b", id: "L-zzzzzzzz" }),
          entry({ type: "transition", to: "a", id: "L-aaaaaaaa" }),
        ],
        same,
      ),
    ).toBe("b");
  });
});

describe("parkedQuestion", () => {
  it("finds the latest park question without a resume decision", () => {
    const park = entry({ type: "question", park: true, options: ["a", "b"] });
    expect(parkedQuestion([entry({ type: "question" }), park])?.id).toBe(park.id);
  });

  it("is undefined once a decision names the question", () => {
    const park = entry({ type: "question", park: true });
    const resume = entry({ type: "decision", refs: [park.id], at: "2026-09-25T11:00:00Z" });
    expect(parkedQuestion([park, resume])).toBeUndefined();
  });

  it("looks only at the latest park question", () => {
    const first = entry({ type: "question", park: true, at: "2026-09-25T09:00:00Z" });
    const resume = entry({ type: "decision", refs: [first.id] });
    const second = entry({ type: "question", park: true, at: "2026-09-25T12:00:00Z" });
    expect(parkedQuestion([first, resume, second])?.id).toBe(second.id);
  });
});

describe("supersededBy", () => {
  it("maps each superseded id to the entry naming it", () => {
    const old = entry({ type: "decision" });
    const next = entry({ type: "decision", supersedes: old.id });
    expect(supersededBy([old, next])).toStrictEqual(new Map([[old.id, next.id]]));
  });
});

describe("effectiveProfile", () => {
  it("is the largest of change.md and the profile decisions", () => {
    expect(effectiveProfile("small", [entry({ type: "decision", profile: "large" })])).toBe(
      "large",
    );
    expect(effectiveProfile("large", [entry({ type: "decision", profile: "small" })])).toBe(
      "large",
    );
    expect(effectiveProfile("tiny", [])).toBe("tiny");
  });
});

describe("isConfirmed", () => {
  it("is true for a user Change", () => {
    expect(isConfirmed("user", [])).toBe(true);
  });

  it("is false for an inferred Change until a user transition exists", () => {
    expect(isConfirmed("inferred", [entry({ type: "transition", source: "kernel" })])).toBe(false);
    expect(isConfirmed("inferred", [entry({ type: "transition", source: "user" })])).toBe(true);
  });
});
