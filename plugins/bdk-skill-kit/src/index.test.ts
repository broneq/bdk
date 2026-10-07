// The public API as the README shows it. `pnpm typecheck` covers this file, so
// a declaration change that breaks a documented config or plugin fails there.
import { describe, expect, it } from "vitest";
import { defineConfig, definePlugin, defineRule } from "./index.ts";

const noTodo = defineRule({
  id: "no-todo",
  kinds: ["skills"],
  defaultSeverity: "error",
  check(doc, ctx) {
    doc.lines.forEach((line, i) => {
      if (line.includes("TODO"))
        ctx.report({ line: i + 1, message: "resolve the TODO", match: line });
    });
  },
});

const maxWords = defineRule<{ max: number }>({
  id: "max-words",
  kinds: ["skills", "agents"],
  defaultSeverity: "warning",
  defaultOptions: { max: 100 },
  checkProject(docs, ctx) {
    for (const doc of docs) {
      if (doc.text.split(/\s+/).length > ctx.options.max)
        ctx.report({ file: doc.path, message: "long" });
    }
  },
});

const acme = definePlugin({ name: "acme", rules: [noTodo, maxWords] });

const config = defineConfig({
  targets: [{ kind: "skills", dirs: ["skills"], profile: "portable" }],
  plugins: [acme],
  rules: { "acme/max-words": ["error", { max: 50 }], layout: "off" },
  baseline: "baseline.json",
});

describe("public API", () => {
  it("returns its arguments unchanged", () => {
    expect(config.plugins?.[0]?.rules.map((r) => r.id)).toEqual(["no-todo", "max-words"]);
  });
});
