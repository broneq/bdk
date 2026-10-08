#!/usr/bin/env bash
# A small Vite + React app with one commit: Vitest, ESLint, a build, and Playwright with a webServer.
set -euo pipefail

cat > package.json <<'JSON'
{
  "name": "habit-board",
  "version": "0.2.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:e2e": "playwright test",
    "lint": "eslint ."
  },
  "dependencies": { "react": "^19.1.0", "react-dom": "^19.1.0" },
  "devDependencies": {
    "@playwright/test": "^1.55.0",
    "@vitejs/plugin-react": "^5.0.0",
    "eslint": "^9.30.0",
    "typescript": "^5.9.0",
    "vite": "^7.1.0",
    "vitest": "^3.2.0"
  }
}
JSON

cat > pnpm-lock.yaml <<'YAML'
lockfileVersion: '9.0'

settings:
  autoInstallPeers: true
  excludeLinksFromLockfile: false
YAML

cat > README.md <<'MD'
# habit-board

A board of daily habits. `pnpm dev` serves it on http://localhost:5173.
MD

cat > tsconfig.json <<'JSON'
{ "compilerOptions": { "target": "ES2022", "module": "ESNext", "jsx": "react-jsx", "strict": true, "noEmit": true }, "include": ["src"] }
JSON

cat > vite.config.ts <<'TS'
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({ plugins: [react()] });
TS

cat > eslint.config.js <<'JS'
export default [{ files: ["src/**/*.{ts,tsx}"], rules: {} }];
JS

cat > playwright.config.ts <<'TS'
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  webServer: { command: "pnpm dev", url: "http://localhost:5173", reuseExistingServer: true },
  use: { baseURL: "http://localhost:5173" },
});
TS

cat > index.html <<'HTML'
<!doctype html>
<html lang="en">
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
HTML

mkdir -p src e2e
cat > src/main.tsx <<'TSX'
import { createRoot } from "react-dom/client";
import { App } from "./App";

createRoot(document.getElementById("root")!).render(<App />);
TSX

cat > src/streak.ts <<'TS'
export function streak(days: boolean[]): number {
  let count = 0;
  for (let i = days.length - 1; i >= 0 && days[i]; i--) count++;
  return count;
}
TS

cat > src/App.tsx <<'TSX'
import { streak } from "./streak";

export function App() {
  return <h1>Habit board: {streak([true, true])} day streak</h1>;
}
TSX

cat > src/streak.test.ts <<'TS'
import { expect, test } from "vitest";
import { streak } from "./streak";

test("counts the trailing done days", () => {
  expect(streak([true, false, true, true])).toBe(2);
});
TS

cat > e2e/home.spec.ts <<'TS'
import { expect, test } from "@playwright/test";

test("shows the board", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading")).toContainText("Habit board");
});
TS

git init --quiet --initial-branch=main
git add .
git -c user.name="BDK eval" -c user.email="eval@example.invalid" commit --quiet -m "feat: habit board"

# A lavish-axi stub that npx -y runs first: Lavish runs in this session.
mkdir -p node_modules/lavish-axi node_modules/.bin
cat > node_modules/lavish-axi/package.json <<'JSON'
{ "name": "lavish-axi", "version": "0.0.0-eval", "bin": { "lavish-axi": "cli.js" } }
JSON
cat > node_modules/lavish-axi/cli.js <<'JS'
#!/usr/bin/env node
if (process.argv[2] === "--version") console.log("0.0.0-eval");
else { console.error("lavish-axi: setup only checks the version"); process.exit(1); }
JS
chmod +x node_modules/lavish-axi/cli.js
ln -s ../lavish-axi/cli.js node_modules/.bin/lavish-axi
