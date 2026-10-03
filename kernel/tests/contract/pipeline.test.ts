// `kernel-pipeline`, Pipeline file: the content test of the shipped
// `pipeline/pipeline.yaml` (design D-1). The file validates against the
// schema the kernel enforces and against the committed, generated
// `schema/pipeline.json` an editor reads through the relative modeline.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Ajv2020 } from "ajv/dist/2020.js";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

import { kindRegistry } from "../../src/graph/domain/kinds/index.ts";
import { declaredBy, pipelineErrors } from "../../src/graph/use-cases/pipeline.ts";
import { settingsRegistry } from "../../src/registrations.ts";
import { REPO_ROOT } from "../support/run.ts";

const shipped = readFileSync(join(REPO_ROOT, "pipeline", "pipeline.yaml"), "utf8");
const jsonSchema = JSON.parse(
  readFileSync(join(REPO_ROOT, "schema", "pipeline.json"), "utf8"),
) as Record<string, unknown>;
const validate = new Ajv2020({ strict: true, allErrors: true }).compile(jsonSchema);
const WHEN = shipped.replace(
  "  - id: review\n",
  '  - id: review\n    when: files.touched("src/billing/**")\n',
);

describe("pipeline/pipeline.yaml", () => {
  it("starts with the relative modeline", () => {
    expect(shipped.split("\n")[0]).toBe("# yaml-language-server: $schema=../schema/pipeline.json");
  });

  it("passes the kernel's schema and cross-checks", () => {
    const declared = declaredBy(settingsRegistry(), kindRegistry());
    expect(pipelineErrors(shipped, declared).errors).toStrictEqual([]);
  });

  it("the when: fixture fails the kernel's schema naming the key", () => {
    const declared = declaredBy(settingsRegistry(), kindRegistry());
    expect(pipelineErrors(WHEN, declared).errors).toStrictEqual(["nodes[16].when: unknown key"]);
  });

  it("is accepted by the generated schema/pipeline.json", () => {
    expect(validate(parse(shipped)), JSON.stringify(validate.errors)).toBe(true);
  });

  it("with when: is rejected by schema/pipeline.json on that key", () => {
    expect(validate(parse(WHEN))).toBe(false);
    expect(validate.errors).toContainEqual(
      expect.objectContaining({
        instancePath: "/nodes/16",
        keyword: "additionalProperties",
        params: { additionalProperty: "when" },
      }),
    );
  });
});
