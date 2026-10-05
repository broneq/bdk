// `pnpm acceptance:report`: writes docs/V3-ACCEPTANCE.md from the acceptance
// catalogue and the test titles (`acceptance-catalogue`, Acceptance report).
// The contract test regenerates the same text and fails when the committed
// file differs.
import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { collectTitles, readCatalogue, renderReport } from "../tests/support/acceptance.ts";

const root = join(import.meta.dirname, "../..");
writeFileSync(
  join(root, "docs/V3-ACCEPTANCE.md"),
  renderReport(readCatalogue(root), collectTitles(root)),
);
