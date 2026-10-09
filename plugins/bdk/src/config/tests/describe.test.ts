import { describe, expect, it } from "vitest";
import { z } from "zod";

import { describeSettings } from "../domain/describe.ts";
import { SettingsSchema } from "../domain/settings.ts";

// Every settings key carries its user-facing description in the schema (spec `bdk-cli/config`,
// "Every settings key has a description"); the settings Reference is generated from it.

describe("describeSettings", () => {
  const docs = describeSettings(SettingsSchema);

  it("gives every key, item field and record value a description", () => {
    const missing = docs.filter((doc) => doc.description === "").map((doc) => doc.key);
    expect(missing).toEqual([]);
  });

  it("lists the keys of the Settings keys table", () => {
    const keys = docs.map((doc) => doc.key);
    expect(keys).toEqual(
      expect.arrayContaining([
        "tools.test",
        "tools.test.<id>.command",
        "tools.e2e.<id>.driver",
        "languages",
        "rules.disabled",
        "models",
        "models.<role>",
        "models.<role>.model",
        "models.<role>.effort",
        "policy.gates.design",
        "policy.budgets.review-rounds",
        "policy.escalation.model",
        "policy.escalation.effort",
        "plan.part.max-bytes",
        "steps.<orchestrator>",
        "steps.<orchestrator>.<id>.use",
        "execution.max-parallel",
        "hooks.subagent-git",
      ]),
    );
  });

  it("reports type, allowed values and default", () => {
    const byKey = new Map(docs.map((doc) => [doc.key, doc]));
    expect(byKey.get("policy.questions")).toMatchObject({
      type: "enum",
      values: ["decide-and-record", "stop"],
      default: "stop",
    });
    expect(byKey.get("plan.part.max-bytes")).toMatchObject({
      type: "integer",
      min: 1,
      default: 8192,
    });
    expect(byKey.get("plan.part.max-bytes")).not.toHaveProperty("max");
    expect(byKey.get("tools.test.<id>.scoped")).toMatchObject({ type: "string", required: false });
    expect(byKey.get("tools.test.<id>.command")).toMatchObject({ required: true });
  });

  it("gives every top-level key an example, and each example is valid settings", () => {
    const top = docs.filter((doc) => !doc.key.includes("."));
    expect(top.filter((doc) => (doc.examples ?? []).length === 0).map((doc) => doc.key)).toEqual(
      [],
    );
    for (const doc of top) {
      for (const example of doc.examples ?? []) {
        const parsed = SettingsSchema.safeParse({ [doc.key]: example });
        expect(parsed.success, `${doc.key}: ${JSON.stringify(example)}`).toBe(true);
      }
    }
  });

  it("names a key without a description", () => {
    const schema = z.strictObject({
      a: z
        .strictObject({ b: z.int().default(1) })
        .prefault({})
        .meta({ description: "A." }),
    });
    const keys = describeSettings(schema)
      .filter((doc) => doc.description === "")
      .map((doc) => doc.key);
    expect(keys).toEqual(["a.b"]);
  });
});
