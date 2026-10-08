#!/usr/bin/env bash
# The habit-board app of setup-web-app without Playwright: no @playwright/test, no
# playwright.config.ts, no e2e/ tests. One commit.
set -euo pipefail
bash "$(dirname "$0")/../setup-web-app/scaffold.sh"
node -e '
const fs = require("node:fs");
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
delete pkg.scripts["test:e2e"];
delete pkg.devDependencies["@playwright/test"];
fs.writeFileSync("package.json", JSON.stringify(pkg, null, 2) + "\n");
'
rm -r playwright.config.ts e2e
git add -A
git -c user.name="BDK eval" -c user.email="eval@example.invalid" commit --quiet --amend -m "feat: habit board"
