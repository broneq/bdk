// Hand-written pages name only what exists (spec `docs-site`; v3-268-docs-site-user-docs,
// design D5). Reads the Guide and Concepts pages, prose and Mermaid blocks, for the names the
// docs convention writes in a fixed form and checks each against the source model:
//
//   /<plugin>:<skill>      a skill            bdk:<agent>         an agent (or skill) of bdk
//   bdk <group> <verb>     a bdk command      policy.budgets.x    a settings key, full path
//   [text](/reference/<page>#<anchor>)        an entry of a Reference page
//   BDK-<AREA>-<N>         a rule of the BDK rule pack
//
// Commands are read only in code spans and Mermaid blocks: in prose "the bdk CLI" is a word.

import type { Model } from "./model.ts";

const PLACEHOLDER = /^<.*>$/;
/** Last segments that make a dotted word a file name, not a settings key. */
const FILE_EXTENSIONS = new Set(["json", "jsonl", "md", "yaml", "yml", "ts", "mjs", "js"]);

interface Line {
  readonly number: number;
  readonly text: string;
  /** The parts of the line where commands are read: code spans, or all of a Mermaid line. */
  readonly code: readonly string[];
}

function lines(page: string): Line[] {
  let inMermaid = false;
  let inFence = false;
  return page.split("\n").map((text, index) => {
    const number = index + 1;
    const fence = /^\s*```(\w*)/.exec(text);
    if (fence !== null) {
      if (inFence || inMermaid) {
        inFence = false;
        inMermaid = false;
      } else if (fence[1] === "mermaid") {
        inMermaid = true;
      } else {
        inFence = true;
      }
      return { number, text: "", code: [] };
    }
    if (inMermaid || inFence) return { number, text, code: [text] };
    return { number, text, code: [...text.matchAll(/`([^`]+)`/g)].map((match) => match[1] ?? "") };
  });
}

function settingMatches(written: readonly string[], key: string): boolean {
  const parts = key.split(".");
  if (parts.length !== written.length) return false;
  return parts.every(
    (part, i) =>
      part === written[i] ||
      PLACEHOLDER.test(part) ||
      written[i] === "*" ||
      PLACEHOLDER.test(written[i] ?? ""),
  );
}

function anchorsOf(reference: ReadonlyMap<string, string>): Map<string, Set<string>> {
  const anchors = new Map<string, Set<string>>();
  for (const [path, page] of reference) {
    const route = `/reference/${path.slice(0, -".md".length)}`;
    anchors.set(route, new Set([...page.matchAll(/\{#([a-z0-9-]+)\}/g)].map((m) => m[1] ?? "")));
  }
  return anchors;
}

/** `../reference/bdk/skills.md#plan` and `/reference/bdk/skills#plan` as `/reference/bdk/skills`. */
function referenceRoute(target: string): string | undefined {
  const path = /(?:^|\/)reference\/([^#]+)$/.exec(target)?.[1];
  return path === undefined ? undefined : `/reference/${path.replace(/\.md$/, "")}`;
}

/**
 * Every name on `pages` (path to Markdown) that the model does not hold, as
 * `<path>:<line>: <problem>`, in page and line order.
 */
export function checkNames(
  model: Model,
  reference: ReadonlyMap<string, string>,
  pages: ReadonlyMap<string, string>,
): string[] {
  const plugins = new Map(model.plugins.map((plugin) => [plugin.name, plugin]));
  const namespace = [...plugins.keys()].sort((a, b) => b.length - a.length).join("|");
  const skillPattern = new RegExp(`(?<![\\w./-])(/?)(${namespace}):([a-z0-9][a-z0-9-]*)`, "g");
  const groups = new Map(model.cli.map((group) => [group.name, group]));
  const roots = new Set(
    model.settings.filter((doc) => !doc.key.includes(".")).map((doc) => doc.key),
  );
  const keyPattern = new RegExp(
    `(?<![\\w./-])((?:${[...roots].join("|")})(?:\\.(?:[a-z0-9-]+|<[a-z-]+>|\\*))+)`,
    "g",
  );
  const keys = model.settings.map((doc) => doc.key);
  const anchors = anchorsOf(reference);
  const ruleIds = new Set(model.rules.map((rule) => rule.id));

  const problems: string[] = [];
  for (const [path, page] of pages) {
    for (const line of lines(page)) {
      const report = (problem: string): void => {
        problems.push(`${path}:${line.number}: ${problem}`);
      };
      const text = line.text === "" ? line.code.join(" ") : line.text;

      for (const match of text.matchAll(skillPattern)) {
        const [, slash, pluginName = "", name = ""] = match;
        const plugin = plugins.get(pluginName);
        const skill = plugin?.skills.some((candidate) => candidate.name === name) ?? false;
        const agent = plugin?.agents.some((candidate) => candidate.name === name) ?? false;
        if (slash === "/" && !skill) report(`no skill /${pluginName}:${name}`);
        if (slash === "" && !skill && !agent) report(`no agent or skill ${pluginName}:${name}`);
      }

      for (const code of line.code) {
        for (const match of code.matchAll(/(?<![\w/.-])bdk ([a-z][a-z-]*)(?: ([a-z][a-z-]*))?/g)) {
          const [, groupName = "", verb] = match;
          const group = groups.get(groupName);
          if (group === undefined) {
            report(`no command group bdk ${groupName}`);
            continue;
          }
          const verbs = group.commands.flatMap((command) => command.verb ?? []);
          if (verb !== undefined && verbs.length > 0 && !verbs.includes(verb)) {
            report(`no command bdk ${groupName} ${verb}`);
          }
        }
      }

      for (const match of text.matchAll(keyPattern)) {
        const key = match[1] ?? "";
        const written = key.split(".");
        if (FILE_EXTENSIONS.has(written.at(-1) ?? "")) continue;
        if (!keys.some((candidate) => settingMatches(written, candidate))) {
          report(`no settings key ${key}`);
        }
      }

      for (const match of text.matchAll(/(?<![\w-])BDK-[A-Z]+-\d+(?![\w-])/g)) {
        if (!ruleIds.has(match[0])) report(`no rule ${match[0]}`);
      }

      for (const match of text.matchAll(/\]\(([^)\s]+)#([^)\s]+)\)/g)) {
        const route = referenceRoute(match[1] ?? "");
        if (route === undefined) continue;
        const anchor = match[2] ?? "";
        if (!(anchors.get(route)?.has(anchor) ?? false)) report(`no anchor #${anchor} on ${route}`);
      }
    }
  }
  return problems;
}
