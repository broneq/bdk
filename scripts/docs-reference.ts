// `pnpm docs:reference`: writes the Reference pages of the site from the plugin sources
// (v3-268-docs-site-user-docs, design D1). The drift test in docs-reference.test.ts fails while
// the committed pages differ from what this writes.

import { join } from "node:path";

import { writePages } from "./docs-reference/files.ts";
import { loadModel } from "./docs-reference/model.ts";
import { renderReference } from "./docs-reference/render.ts";

const dir = join(import.meta.dirname, "../docs/reference");
const changed = writePages(dir, renderReference(await loadModel()));
process.stdout.write(
  changed.length === 0
    ? "docs/reference is up to date\n"
    : `updated:\n${changed.map((path) => `  ${path}\n`).join("")}`,
);
