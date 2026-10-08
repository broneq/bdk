import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

import { loadModel } from "./docs-reference/model.ts";
import { checkNames } from "./docs-reference/names.ts";
import { renderReference } from "./docs-reference/render.ts";

// Hand-written pages name only what exists (spec `docs-site`): every Guide and Concepts page,
// prose and Mermaid blocks, against the plugin sources.

const DOCS = join(import.meta.dirname, "../docs");
const HAND_WRITTEN = ["guide", "concepts"];

function pages(): Map<string, string> {
  return new Map(
    HAND_WRITTEN.flatMap((dir) => {
      let files: string[];
      try {
        files = readdirSync(join(DOCS, dir), { recursive: true, encoding: "utf8" });
      } catch {
        return [];
      }
      return files
        .filter((file) => file.endsWith(".md"))
        .sort()
        .map((file) => [`docs/${dir}/${file}`, readFileSync(join(DOCS, dir, file), "utf8")]);
    }),
  );
}

it("names only skills, agents, commands, settings keys and Reference entries that exist", async () => {
  const model = await loadModel();
  expect(
    checkNames(model, renderReference(model), pages()),
    "Update these pages: they name something the plugins no longer have.",
  ).toEqual([]);
});
