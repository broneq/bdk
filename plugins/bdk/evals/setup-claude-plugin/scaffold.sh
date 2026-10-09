#!/usr/bin/env bash
# A small Claude Code plugin: a manifest, one skill, a bin/ launcher its skill calls, node --test.
set -euo pipefail

cat > package.json <<'JSON'
{
  "name": "greeter-plugin",
  "version": "1.0.0",
  "type": "module",
  "bin": { "greet": "bin/greet.js" },
  "scripts": { "test": "node --test" }
}
JSON

cat > package-lock.json <<'JSON'
{
  "name": "greeter-plugin",
  "version": "1.0.0",
  "lockfileVersion": 3,
  "requires": true,
  "packages": { "": { "name": "greeter-plugin", "version": "1.0.0", "bin": { "greet": "bin/greet.js" } } }
}
JSON

mkdir -p .claude-plugin skills/greet bin src
cat > .claude-plugin/plugin.json <<'JSON'
{ "name": "greeter", "version": "1.0.0", "description": "Greets the user by name." }
JSON

cat > skills/greet/SKILL.md <<'MD'
---
name: greet
description: Greets the user by name. Use when the user asks to be greeted.
allowed-tools: Bash(${CLAUDE_PLUGIN_ROOT}/bin/greet.js *)
---

Run `"${CLAUDE_PLUGIN_ROOT}/bin/greet.js" <name>` and reply with its output.
MD

cat > bin/greet.js <<'JS'
#!/usr/bin/env node
import { greet } from "../src/greet.js";
const [name] = process.argv.slice(2);
if (name === "--help" || name === undefined) {
  console.log("Usage: greet <name>");
  process.exit(0);
}
console.log(greet(name));
JS
chmod +x bin/greet.js

cat > src/greet.js <<'JS'
export function greet(name) {
  return `Hello, ${name}!`;
}
JS

cat > src/greet.test.js <<'JS'
import { test } from "node:test";
import assert from "node:assert/strict";
import { greet } from "./greet.js";

test("greets by name", () => {
  assert.equal(greet("Ada"), "Hello, Ada!");
});
JS

cat > README.md <<'MD'
# greeter

A Claude Code plugin: `/greeter:greet Ada` greets Ada. Try it with `claude --plugin-dir .`.
MD

git init --quiet --initial-branch=main
git add .
git -c user.name="BDK eval" -c user.email="eval@example.invalid" commit --quiet -m "feat: greeter plugin"
