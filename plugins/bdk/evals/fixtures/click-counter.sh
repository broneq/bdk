#!/usr/bin/env bash
# Fixture for the manual browser check of e2e-check (no eval case: the eval sandbox forbids
# binding a local port, see ../README.md "Host limits"). A configured BDK project with a tiny
# web app: a Node server with no dependencies serves one page whose "Add one" button is wired
# to an element that does not exist, so a click changes nothing while every HTTP response is
# 200. The Change `add-counter` says a click shows "Count: 1". One commit.
set -euo pipefail

cat > package.json <<'JSON'
{
  "name": "click-counter",
  "version": "0.1.0",
  "type": "module",
  "scripts": { "start": "node server.js" }
}
JSON

cat > server.js <<'JS'
import { createServer } from "node:http";
import { readFileSync } from "node:fs";

const PORT = Number(process.env.PORT ?? 5180);
const files = { "/": ["index.html", "text/html"], "/app.js": ["app.js", "text/javascript"] };

createServer((request, response) => {
  const file = files[request.url ?? "/"];
  if (file === undefined) {
    response.writeHead(404).end("not found");
    return;
  }
  response.writeHead(200, { "content-type": file[1] }).end(readFileSync(file[0]));
}).listen(PORT, () => console.log(`click-counter on http://localhost:${PORT}`));
JS

cat > index.html <<'HTML'
<!doctype html>
<html lang="en">
  <head><meta charset="utf-8"><link rel="icon" href="data:,"><title>Click counter</title></head>
  <body>
    <h1>Click counter</h1>
    <p id="count">Count: 0</p>
    <button id="add-one" type="button">Add one</button>
    <script type="module" src="/app.js"></script>
  </body>
</html>
HTML

cat > app.js <<'JS'
let count = 0;
const label = document.getElementById("count");
const button = document.getElementById("add");
button?.addEventListener("click", () => {
  count += 1;
  label.textContent = `Count: ${count}`;
});
JS

mkdir -p .bdk
cat > .bdk/settings.yaml <<'YAML'
# BDK project settings. Resolved values with their origins: bdk config show
languages: [javascript]
tools:
  e2e:
    - id: web
      start: npm start
      ready: http://localhost:5180
      driver: browser
YAML

cat > .gitignore <<'TXT'
/.bdk/runs/
/.bdk/settings.local.yaml
TXT

mkdir -p openspec/specs openspec/changes/archive openspec/changes/add-counter/specs/counter
printf 'schema: spec-driven\n' > openspec/config.yaml
touch openspec/specs/.gitkeep openspec/changes/archive/.gitkeep
printf 'schema: spec-driven\ncreated: 2026-10-01\n' > openspec/changes/add-counter/.openspec.yaml
cat > openspec/changes/add-counter/proposal.md <<'MD'
## Why

Users count things by clicking a button.

## What Changes

- A home page with a counter and an "Add one" button.
MD

cat > openspec/changes/add-counter/specs/counter/spec.md <<'MD'
## ADDED Requirements

### Requirement: Counter

The home page SHALL show a counter that starts at zero and an "Add one" button that increments it.

#### Scenario: Starts at zero

- **WHEN** the user opens the home page
- **THEN** the page shows `Count: 0`

#### Scenario: Add one

- **WHEN** the user clicks "Add one" on the home page
- **THEN** the page shows `Count: 1`
MD

git init --quiet --initial-branch=main
git add .
git -c user.name="BDK eval" -c user.email="eval@example.invalid" commit --quiet -m "feat: click counter"
