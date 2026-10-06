// `docs-site`, Drift guard 6: every `bdk <command>` that `README.md` or a site
// page names, in inline code or in a code block, resolves to a command of the
// registry the kernel dispatches from. A bare group (`bdk rules`) passes when
// the group has commands. The migration page names v2 commands on purpose.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import commands from "../../../schema/cli/commands.json" with { type: "json" };
import { loadIndex, resolve } from "../../src/shared/registry/index.ts";
import { REPO_ROOT } from "../support/run.ts";
import { isSnippetPage, readPage, sitePages } from "./site.ts";

const index = loadIndex(commands);

const MIGRATION_PAGE = "getting-started/migration-from-v2.md";

const sources = [
  { name: "README.md", text: readFileSync(join(REPO_ROOT, "README.md"), "utf8") },
  ...sitePages()
    .filter((page) => page !== MIGRATION_PAGE && !isSnippetPage(readPage(page)))
    .map((page) => ({ name: page, text: readPage(page) })),
];

/** The command words after `bdk`: lowercase words up to the first argument, flag or placeholder. */
function commandWords(after: string): string[] {
  const words: string[] = [];
  for (const token of after.trim().split(/\s+/)) {
    if (!/^[a-z][a-z-]*$/.test(token) || words.length === 3) break;
    words.push(token);
  }
  return words;
}

function resolves(words: readonly string[]): boolean {
  if (resolve(index, words) !== undefined) return true;
  return words.length === 1 && index.commands.some((record) => record.argv[0] === words[0]);
}

/** The code on each line: inline code spans, or the whole line inside a fenced block. */
function codeByLine(text: string): (readonly [number, string])[] {
  const code: (readonly [number, string])[] = [];
  let fenced = false;
  text.split("\n").forEach((line, index) => {
    if (/^\s*(```|~~~)/.test(line)) {
      fenced = !fenced;
      return;
    }
    if (fenced) code.push([index + 1, line]);
    else for (const span of line.matchAll(/`([^`]+)`/g)) code.push([index + 1, span[1] ?? ""]);
  });
  return code;
}

/** `line: bdk <group> <verb>` for every command mention in `text` that the registry does not have. */
function unknownCommands(text: string): string[] {
  return codeByLine(text).flatMap(([line, code]) =>
    [...code.matchAll(/(?<![\w/:.-])bdk(?=\s|$)/g)]
      .map((match) => commandWords(code.slice(match.index + "bdk".length).split(/[;&|]/)[0] ?? ""))
      .filter((words) => words.length > 0 && !resolves(words))
      .map((words) => `${String(line)}: bdk ${words.slice(0, 2).join(" ")}`),
  );
}

describe("every bdk command named resolves", () => {
  it.each([
    ["`bdk import`", ["1: bdk import"]],
    ["```sh\nbdk change open x\n```", ["2: bdk change open"]],
    ["`bdk config set tools.test none`", []],
    ["`bdk rules` and `bdk next --json`", []],
    ["`/bdk:plan`, `bdk-craft` and the `bdk` launcher", []],
  ])("in %j finds %j", (text, found) => {
    expect(unknownCommands(text)).toStrictEqual(found);
  });

  it.each(sources)("$name names only registry commands", ({ text }) => {
    expect(unknownCommands(text), "see bdk --help for the commands").toStrictEqual([]);
  });
});
