#!/usr/bin/env bash
# A small Express API with one commit: a health route on port 4000, node --test, no linter.
set -euo pipefail

cat > package.json <<'JSON'
{
  "name": "budget-api",
  "version": "0.4.0",
  "type": "module",
  "scripts": {
    "start": "node src/server.js",
    "test": "node --test"
  },
  "dependencies": { "express": "^5.1.0" }
}
JSON

cat > package-lock.json <<'JSON'
{
  "name": "budget-api",
  "version": "0.4.0",
  "lockfileVersion": 3,
  "requires": true,
  "packages": { "": { "name": "budget-api", "version": "0.4.0", "dependencies": { "express": "^5.1.0" } } }
}
JSON

cat > README.md <<'MD'
# budget-api

HTTP API for monthly budgets. `npm start` serves it on port 4000 (`PORT` overrides it).
MD

mkdir -p src
cat > src/app.js <<'JS'
import express from "express";

export function createApp() {
  const app = express();
  app.use(express.json());
  app.get("/health", (_req, res) => res.json({ ok: true }));
  app.get("/budgets/:month", (req, res) => res.json({ month: req.params.month, limit: 1000 }));
  return app;
}
JS

cat > src/server.js <<'JS'
import { createApp } from "./app.js";

const port = Number(process.env.PORT ?? 4000);
createApp().listen(port, () => console.log(`budget-api on http://localhost:${port}`));
JS

cat > src/budget.js <<'JS'
export function remaining(limit, spent) {
  return limit - spent.reduce((total, amount) => total + amount, 0);
}
JS

cat > src/budget.test.js <<'JS'
import { test } from "node:test";
import assert from "node:assert/strict";
import { remaining } from "./budget.js";

test("remaining subtracts what was spent", () => {
  assert.equal(remaining(100, [30, 20]), 50);
});
JS

git init --quiet --initial-branch=main
git add .
git -c user.name="BDK eval" -c user.email="eval@example.invalid" commit --quiet -m "feat: budget api"
