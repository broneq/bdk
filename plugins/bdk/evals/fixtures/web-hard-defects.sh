#!/usr/bin/env bash
# Fixture for the manual browser check of e2e-check (no eval case: the eval sandbox forbids
# binding a local port, see ../README.md "Host limits"). A configured BDK project with a tiny
# web app (a Node server with no dependencies) and the Change `add-account-page`, whose four
# scenarios hide three defects a script written before looking at the page could miss:
# - "Save profile on a narrow screen": below 480 px a fixed help bar covers the "Save profile"
#   button, the last element of the page, so a tap lands on the bar.
# - "Save a note": the save request fails; the page shows "Could not save" for 2 seconds, then
#   hides it and keeps the text, so the page looks saved.
# - "Place order once": the button is not disabled while the request runs (300 ms), so two
#   quick clicks create two orders.
# "No orders yet" works. One commit.
set -euo pipefail

cat > package.json <<'JSON'
{
  "name": "account-page",
  "version": "0.1.0",
  "type": "module",
  "scripts": { "start": "node server.js" }
}
JSON

cat > server.js <<'JS'
import { createServer } from "node:http";
import { readFileSync } from "node:fs";

const PORT = Number(process.env.PORT ?? 5182);
const files = { "/": ["index.html", "text/html"], "/app.js": ["app.js", "text/javascript"] };
const orders = [];

const json = (response, status, body) =>
  response.writeHead(status, { "content-type": "application/json" }).end(JSON.stringify(body));

createServer((request, response) => {
  const url = request.url ?? "/";
  if (request.method === "GET" && url === "/api/orders") return json(response, 200, orders);
  if (request.method === "POST" && url === "/api/orders") {
    setTimeout(() => {
      orders.push({ id: orders.length + 1 });
      json(response, 201, orders.at(-1));
    }, 300);
    return;
  }
  if (request.method === "POST" && url === "/api/profile") return json(response, 200, { ok: true });
  if (request.method === "POST" && url === "/api/notes") return json(response, 503, { error: "notes store offline" });
  const file = files[url];
  if (file === undefined) return response.writeHead(404).end("not found");
  response.writeHead(200, { "content-type": file[1] }).end(readFileSync(file[0]));
}).listen(PORT, () => console.log(`account-page on http://localhost:${PORT}`));
JS

cat > index.html <<'HTML'
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link rel="icon" href="data:,">
    <title>Account</title>
    <style>
      body { font-family: sans-serif; margin: 0 16px; }
      section { margin: 24px 0 0; }
      textarea, input { display: block; width: 100%; max-width: 360px; margin: 8px 0; }
      #help { position: fixed; right: 16px; bottom: 16px; padding: 12px 16px; background: #222; color: #fff; border-radius: 8px; }
      @media (max-width: 480px) {
        #help { left: 0; right: 0; bottom: 0; height: 140px; border-radius: 0; }
      }
    </style>
  </head>
  <body>
    <h1>Account</h1>
    <section>
      <h2>Orders</h2>
      <ul id="orders"></ul>
      <p id="no-orders">No orders yet</p>
      <button id="place-order" type="button">Place order</button>
    </section>
    <section>
      <h2>Note</h2>
      <label for="note">Note</label>
      <textarea id="note" rows="3"></textarea>
      <button id="save-note" type="button">Save note</button>
      <p id="note-status" role="status"></p>
    </section>
    <section>
      <h2>Profile</h2>
      <p id="profile-status" role="status"></p>
      <label for="name">Name</label>
      <input id="name">
      <button id="save-profile" type="button">Save profile</button>
    </section>
    <div id="help">Need help? Chat with us</div>
    <script type="module" src="/app.js"></script>
  </body>
</html>
HTML

cat > app.js <<'JS'
const list = document.getElementById("orders");
const empty = document.getElementById("no-orders");

function render(orders) {
  list.replaceChildren(...orders.map((order) => Object.assign(document.createElement("li"), { textContent: `Order #${order.id}` })));
  empty.hidden = orders.length > 0;
}

render(await (await fetch("/api/orders")).json());

document.getElementById("place-order").addEventListener("click", async () => {
  await fetch("/api/orders", { method: "POST" });
  render(await (await fetch("/api/orders")).json());
});

document.getElementById("save-note").addEventListener("click", async () => {
  const status = document.getElementById("note-status");
  const response = await fetch("/api/notes", { method: "POST", body: document.getElementById("note").value });
  status.textContent = response.ok ? "Note saved" : "Could not save";
  setTimeout(() => (status.textContent = ""), 2000);
});

document.getElementById("save-profile").addEventListener("click", async () => {
  await fetch("/api/profile", { method: "POST", body: document.getElementById("name").value });
  document.getElementById("profile-status").textContent = "Profile saved";
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
      ready: http://localhost:5182
      driver: browser
YAML

cat > .gitignore <<'TXT'
/.bdk/runs/
/.bdk/settings.local.yaml
TXT

mkdir -p openspec/specs openspec/changes/archive openspec/changes/add-account-page/specs/account
printf 'schema: spec-driven\n' > openspec/config.yaml
touch openspec/specs/.gitkeep openspec/changes/archive/.gitkeep
printf 'schema: spec-driven\ncreated: 2026-10-01\n' > openspec/changes/add-account-page/.openspec.yaml
cat > openspec/changes/add-account-page/proposal.md <<'MD'
## Why

Users manage their orders, a note and their profile on one page, on a phone as well as on a desktop.

## What Changes

- An account page with orders, a note and the profile.
MD

cat > openspec/changes/add-account-page/specs/account/spec.md <<'MD'
## ADDED Requirements

### Requirement: Orders

The account page SHALL list the user's orders and SHALL let the user place one order per click of "Place order".

#### Scenario: No orders yet

- **WHEN** the user opens the account page before placing an order
- **THEN** the page shows `No orders yet`

#### Scenario: Place order once

- **WHEN** the user clicks "Place order" twice in quick succession, as an impatient user does
- **THEN** the page lists exactly one order, `Order #1`

### Requirement: Note

The account page SHALL save the user's note.

#### Scenario: Save a note

- **WHEN** the user types `Call back on Monday` into Note and clicks "Save note"
- **THEN** the page shows `Note saved`, and no error message appears at any moment

### Requirement: Profile

The account page SHALL let the user save their name on any screen width.

#### Scenario: Save profile on a narrow screen

- **WHEN** the user opens the account page on a 375 px wide screen, types `Ada` into Name and taps "Save profile"
- **THEN** the page shows `Profile saved`
MD

git init --quiet --initial-branch=main
git add .
git -c user.name="BDK eval" -c user.email="eval@example.invalid" commit --quiet -m "feat: account page"
