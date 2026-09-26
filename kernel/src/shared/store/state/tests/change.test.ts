import { describe, expect, it } from "vitest";

import { KernelRefusal } from "../../../refusal/index.ts";
import { memoryStore } from "../../store.ts";
import { readChange } from "../documents.ts";
import { renderDocument } from "../render.ts";
import * as example from "./examples.ts";

const DIR = "/repo/.bdk/changes/2026-09-25-passwordless-login";
const at = (path: string): string => `${DIR}/${path}`;
const LOG = "log/20260925T094107Z-decision-L-m2x9v7qa.md";
const OTHER_LOG = "log/20260925T113502Z-finding-L-m2x9v7qa.md";

function whyOf(action: () => unknown): string {
  try {
    action();
  } catch (error) {
    if (error instanceof KernelRefusal) {
      expect(error.refusal.rule).toBe("state/ledger-invalid");
      return error.refusal.why;
    }
    throw error;
  }
  throw new Error("expected a refusal");
}

describe("readChange", () => {
  it("reads every document of the Change, nested directories included", () => {
    const store = memoryStore({
      [at("change.md")]: renderDocument(example.change, ""),
      [at(LOG)]: renderDocument(example.decision, "Body.\n"),
      [at("spec-delta/auth-login.md")]: "## ADDED Requirements\n",
    });
    const documents = readChange(store, DIR);
    expect([...documents.keys()]).toStrictEqual([
      at("change.md"),
      at(LOG),
      at("spec-delta/auth-login.md"),
    ]);
    expect(documents.get(at(LOG))?.kind).toBe("entry");
  });

  it("answers an empty map for a missing directory", () => {
    expect(readChange(memoryStore(), DIR).size).toBe(0);
  });

  it("names both files of a duplicate entry id", () => {
    const store = memoryStore({
      [at(LOG)]: renderDocument(example.decision, ""),
      [at(OTHER_LOG)]: renderDocument(
        { ...example.finding, id: "L-m2x9v7qa", at: "2026-09-25T11:35:02Z" },
        "",
      ),
    });
    const why = whyOf(() => readChange(store, DIR));
    expect(why).toContain("L-m2x9v7qa");
    expect(why).toContain(LOG);
    expect(why).toContain(OTHER_LOG);
  });

  it("names both files of a duplicate ticket", () => {
    const first = "attempts/task-redispatch-02-3-A-7f3kx2p9.md";
    const second = "attempts/verify-fix-02-3-A-7f3kx2p9.md";
    const store = memoryStore({
      [at(first)]: renderDocument(example.attempt, ""),
      [at(second)]: renderDocument({ ...example.attempt, loop: "verify-fix" }, ""),
    });
    const why = whyOf(() => readChange(store, DIR));
    expect(why).toContain("A-7f3kx2p9");
    expect(why).toContain(first);
    expect(why).toContain(second);
  });

  it("lets a ticket repeat across its attempt, package and report", () => {
    const store = memoryStore({
      [at("attempts/task-redispatch-02-3-A-7f3kx2p9.md")]: renderDocument(example.attempt, ""),
      [at("dispatch/02-3-implementer-A-7f3kx2p9.md")]: renderDocument(example.dispatch, ""),
      [at("reports/02-3-implementer-A-7f3kx2p9.md")]: renderDocument(example.report, ""),
      [at("evidence/02-3-E-5hq0m2vd.md")]: renderDocument(example.evidence, ""),
    });
    expect(readChange(store, DIR).size).toBe(4);
  });

  it("refuses an invalid file like readDocument", () => {
    const store = memoryStore({ [at("notes.md")]: "# Notes\n" });
    expect(whyOf(() => readChange(store, DIR))).toContain("notes.md");
  });
});
