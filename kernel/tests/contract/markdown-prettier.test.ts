// `kernel-state`, Markdown document shape (#140): every Markdown kind the
// kernel writes, written through `dist/bdk.mjs`, is already what the
// repository's pinned Prettier makes of it with default options, so a
// project's format hook never rewrites kernel output.
import { readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { format } from "prettier";
import { describe, expect, it } from "vitest";

import { answered, bdk, read } from "../support/repo.ts";
import { fileStore } from "../../src/shared/store/index.ts";
import { creating, reviewed } from "../../src/spec/tests/e2e-support.ts";

/** Paths the kernel writes; plan parts, design files and deltas are the host's. */
const KERNEL_WRITTEN = [
  /^\.bdk\/changes\/[^/]+\/change\.md$/,
  /^\.bdk\/changes\/[^/]+\/(log|attempts|evidence|dispatch|reports)\/[^/]+\.md$/,
  /^\.bdk\/changes\/[^/]+\/(plan|design)\/index\.md$/,
  /^\.bdk\/rules\/[^/]+\.md$/,
  /^\.bdk\/specs\/.+\/spec\.md$/,
  /^\.claude\/rules\/bdk-generated(-scoped)?\.md$/,
];

function kernelMarkdown(root: string): string[] {
  return readdirSync(root, { recursive: true, encoding: "utf8" })
    .map((path) => relative(root, join(root, path)))
    .filter((path) => KERNEL_WRITTEN.some((pattern) => pattern.test(path)))
    .sort();
}

/** A reviewed Change with its living spec merged, rules adopted and imported, entries with and without a body. */
function project(): string {
  const change = reviewed({ deltas: { "auth/login": creating(["Magic link sent", ["sent"]]) } });
  const { root } = change;
  answered(bdk(["spec", "merge", "--json"], root), "output/spec-merge.json");
  answered(
    bdk(
      [
        "log",
        "add",
        "decision",
        "Shared serializer",
        "--ref",
        "change.md",
        "--body",
        "Chose it.",
        "--json",
      ],
      root,
    ),
    "output/log-add.json",
  );
  answered(
    bdk(["log", "add", "observation", "No body", "--ref", "change.md", "--json"], root),
    "output/log-add.json",
  );
  answered(
    bdk(["rules", "accept", "Use the shared serializer", "--prefix", "API", "--json"], root),
    "output/rules-accept.json",
  );
  fileStore().write(
    join(root, "imported/api-style.md"),
    "---\npaths: ['src/**']\n---\n\n- Name handlers after their route.\n- Return typed errors.\n",
  );
  answered(bdk(["rules", "import", "imported", "--json"], root), "output/rules-import.json");
  answered(bdk(["rules", "export", "--claude", "--json"], root), "output/rules-export.json");
  return root;
}

describe("kernel Markdown is Prettier-stable", () => {
  // Read now: the repository is removed before the tests run.
  const root = project();
  const texts = new Map(kernelMarkdown(root).map((path) => [path, read(root, path)]));
  const paths = [...texts.keys()];

  it("covers every kind", () => {
    const kinds = [
      /\/change\.md$/,
      /\/log\/.+-decision-/,
      /\/log\/.+-observation-/,
      /\/log\/.+-assumption-/,
      /\/attempts\//,
      /\/evidence\//,
      /\/dispatch\//,
      /\/reports\//,
      /\/plan\/index\.md$/,
      /^\.bdk\/rules\/API-1\.md$/,
      /^\.bdk\/rules\/API-STYLE-1\.md$/,
      /^\.bdk\/specs\/auth\/login\/spec\.md$/,
      /^\.claude\/rules\/bdk-generated\.md$/,
    ];
    for (const kind of kinds)
      expect(
        paths.some((path) => kind.test(path)),
        String(kind),
      ).toBe(true);
  });

  it.each(paths)("%s", async (path) => {
    const text = texts.get(path) ?? "";
    expect(await format(text, { filepath: path })).toBe(text);
  });
});
