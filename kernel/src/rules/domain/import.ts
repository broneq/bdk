// How `rules import` reads a hand-written rule file (`kernel-cli/rules`, bdk
// rules import; design D-8 of v3-t31): the prefix from the file name, one rule
// per top-level bullet, the whole body when the file has no bullet. The
// import never judges content.

const PREFIX = /^[A-Z][A-Z0-9]*(?:-[A-Z][A-Z0-9]*)*$/;

/** `api-style.md` -> `API-STYLE`; undefined when nothing usable is left. */
export function prefixFromName(name: string): string | undefined {
  const prefix = name
    .replace(/\.md$/, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return PREFIX.test(prefix) ? prefix : undefined;
}

/** Why a project prefix is refused, or undefined when it is valid. */
export function prefixProblem(prefix: string): string | undefined {
  if (!PREFIX.test(prefix)) return `${prefix} is no rule prefix: [A-Z][A-Z0-9]*(-[A-Z][A-Z0-9]*)*`;
  if (prefix === "BDK" || prefix.startsWith("BDK-")) {
    return `${prefix}: BDK ids belong to the shipped pack; pick a project prefix`;
  }
  return undefined;
}

const BULLET = /^[-*+] +/;

/**
 * The rule texts of a body: each top-level bullet with its indented
 * continuation, or the whole trimmed body when there is no top-level bullet.
 * Headings and paragraphs between bullets are not part of any rule.
 */
export function ruleTexts(body: string): string[] {
  const texts: string[][] = [];
  let current: string[] | undefined;
  for (const line of body.split("\n")) {
    if (BULLET.test(line)) {
      current = [line.replace(BULLET, "")];
      texts.push(current);
    } else if (current !== undefined && (line.startsWith(" ") || line.startsWith("\t"))) {
      current.push(line.trim());
    } else {
      current = undefined;
    }
  }
  if (texts.length === 0) {
    const whole = body.trim();
    return whole === "" ? [] : [whole];
  }
  return texts.map((lines) => lines.join("\n").trim()).filter((text) => text !== "");
}
