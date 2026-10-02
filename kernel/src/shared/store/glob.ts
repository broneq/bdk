// The globs of a plan part's `do-not-touch` and a learning's `applies`
// (`kernel-state`), matched against paths relative to the project root:
// `*` and `?` stay inside one path segment, `**` spans segments, and a glob
// naming a directory (a trailing `/`, or no wildcard at all) covers every
// path under it.

const cache = new Map<string, RegExp>();

/** Whether `path` (relative, `/`-separated) matches `glob`. */
export function matchesGlob(glob: string, path: string): boolean {
  return patternOf(glob).test(normalize(path));
}

/**
 * The first path of `own` that one of `other` covers or that covers one of
 * `other`: two `Files:` lists that touch one file.
 */
export function filesOverlap(own: readonly string[], other: readonly string[]): string | undefined {
  return own.find((path) =>
    other.some((theirs) => matchesGlob(theirs, path) || matchesGlob(path, theirs)),
  );
}

/** The first glob of `globs` that `path` matches, or undefined. */
export function firstMatch(globs: readonly string[], path: string): string | undefined {
  return globs.find((glob) => matchesGlob(glob, path));
}

function patternOf(glob: string): RegExp {
  const known = cache.get(glob);
  if (known !== undefined) return known;
  const pattern = new RegExp(`^${source(normalize(glob))}$`);
  cache.set(glob, pattern);
  return pattern;
}

function normalize(path: string): string {
  return path.replace(/^(?:\.\/)+/, "").replace(/^\/+/, "");
}

function source(glob: string): string {
  const directory = glob.endsWith("/") || !/[*?]/.test(glob);
  const body = glob.replace(/\/+$/, "");
  let out = "";
  for (let at = 0; at < body.length; at += 1) {
    const char = body.charAt(at);
    if (char === "*" && body.charAt(at + 1) === "*") {
      const slash = body.charAt(at + 2) === "/";
      out += slash ? "(?:.*/)?" : ".*";
      at += slash ? 2 : 1;
    } else if (char === "*") out += "[^/]*";
    else if (char === "?") out += "[^/]";
    else out += char.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  }
  return directory ? `${out}(?:/.*)?` : out;
}
