// The `docs-impact` job (.github/workflows/docs-impact.yml): reads the changed paths from
// `git diff --name-only $BASE...$HEAD` and the pull request body from $PR_BODY, and fails when
// the rule in docs-impact/rule.ts says the docs are missing.

import { execFileSync } from "node:child_process";

import { docsImpact } from "./docs-impact/rule.ts";

const { BASE, HEAD, PR_BODY } = process.env;
if (!BASE || !HEAD) {
  process.stderr.write("docs-impact: set BASE and HEAD to the commits to compare\n");
  process.exit(2);
}
const changed = execFileSync("git", ["diff", "--name-only", `${BASE}...${HEAD}`], {
  encoding: "utf8",
})
  .split("\n")
  .filter((path) => path !== "");
const result = docsImpact(changed, PR_BODY ?? "");
(result.ok ? process.stdout : process.stderr).write(`${result.message}\n`);
process.exitCode = result.ok ? 0 : 1;
