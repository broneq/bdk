// `kernel-pipeline`, Extensibility: a kind added by registration plus a node
// in a test pipeline works through `next`, `explain`, `validate`, `done` and
// `change status` with the production command code unchanged.
import { describe, expect, it } from "vitest";
import { parse, stringify } from "yaml";

import { changeStatusOutput } from "../../change/schema/outputs.ts";
import { ctxConfig } from "../../ctx/index.ts";
import { createConfigRegistry, definePromptKey, promptsModule } from "../../shared/config/index.ts";
import { BaseKind, fileChecks, kindRegistry } from "../domain/kinds/index.ts";
import type { ChangeView, Check, Inputs } from "../domain/kinds/index.ts";
import { graphConfig } from "../index.ts";
import { doneOutput, explainOutput, nextOutput, validateOutput } from "../schema/outputs.ts";
import { DIR, harness, PLUGIN } from "./support.ts";

// A kind writes inside the Change layout (`kernel-state`); spec-delta/ takes any slug.
class NotesKind extends BaseKind {
  readonly name = "notes";
  writes(): readonly string[] {
    return ["spec-delta/notes.md"];
  }
  inputs(): Inputs {
    return { files: ["spec-delta/notes.md"] };
  }
  validate(view: ChangeView): Check[] {
    return fileChecks(view, "spec-delta/notes.md");
  }
}

interface Data {
  nodes: Record<string, unknown>[];
}

function extended() {
  const settings = createConfigRegistry({
    modules: [...ctxConfig.modules, ...graphConfig.modules, promptsModule],
    prompts: [
      ...ctxConfig.prompts,
      ...graphConfig.prompts,
      definePromptKey({
        key: "pipeline/notes",
        consumer: "graph",
        owner: "test",
        defaultFile: "pipeline/notes.md",
      }),
    ],
  });
  const h = harness({ kinds: kindRegistry([new NotesKind()]), settings });
  const file = `${PLUGIN}/pipeline/pipeline.yaml`;
  const data = parse(h.store.read(file) ?? "") as Data;
  const at = data.nodes.findIndex((node) => node.id === "intent") + 1;
  data.nodes.splice(at, 0, { id: "notes", kind: "notes", stage: "intent", requires: ["intent"] });
  for (const node of data.nodes) {
    if (node.id === "design") node.requires = ["notes"];
  }
  h.store.write(file, stringify(data));
  h.store.write(`${PLUGIN}/pipeline/notes.md`, "Write the notes of Change {change} to {paths}.\n");
  return h;
}

describe("a kind and a node added by registration", () => {
  it("next, validate, done and explain work on it", async () => {
    const h = extended();
    const next = nextOutput.parse((await h.run(["next", "--json"])).json);
    expect(next.artifact).toMatchObject({ id: "notes", kind: "notes", state: "ready" });
    expect(next.instruction).toContain(
      "Write the notes of Change 2026-09-25-login to .bdk/changes/2026-09-25-login/spec-delta/notes.md.",
    );
    expect(validateOutput.parse((await h.run(["validate", "--json"])).json)).toMatchObject({
      artifact: "notes",
      valid: false,
    });
    h.store.write(`${DIR}/spec-delta/notes.md`, "Notes.\n");
    expect((await h.run(["validate", "--json"])).json).toMatchObject({ valid: true });
    const done = doneOutput.parse((await h.run(["done", "notes", "--json"])).json);
    expect(done).toMatchObject({ artifact: "notes", state: "done", next: "design" });
    const explain = explainOutput.parse((await h.run(["explain", "design", "--json"])).json);
    expect(explain.chain.map((node) => [node.id, node.state])).toStrictEqual([
      ["design", "ready"],
      ["notes", "done"],
      ["intent", "done"],
    ]);
  });

  it("change status lists it", async () => {
    const h = extended();
    const status = changeStatusOutput.parse((await h.run(["change", "status", "--json"])).json);
    expect(status.nodes.map((node) => node.id).slice(0, 3)).toStrictEqual([
      "intent",
      "notes",
      "design",
    ]);
  });
});
