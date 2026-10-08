// The docs-impact rule (spec `repo-sdlc`, "Pull requests that change behaviour without docs say
// why"; v3-268-docs-site-user-docs, design D9): a pull request that changes what a BDK user sees
// changes a Guide or Concepts page too, or says why it does not.

/** Sources of user-visible behaviour. */
const WATCHED = [
  /^plugins\/[^/]+\/skills\//,
  /^plugins\/[^/]+\/agents\//,
  /^plugins\/[^/]+\/hooks\//,
  /^plugins\/[^/]+\/src\//,
  /^openspec\/specs\//,
];

/** The hand-written user docs; the Reference is generated and checked by its own test. */
const DOCS = [/^docs\/guide\//, /^docs\/concepts\//];

/** `Docs-impact: none - <reason>` on a line of its own, with a reason, not the placeholder. */
const REASON = /^Docs-impact: none - (?!<reason>)\S/m;

export interface Impact {
  readonly ok: boolean;
  readonly message: string;
}

export function docsImpact(changed: readonly string[], body: string): Impact {
  const watched = changed.filter((path) => WATCHED.some((pattern) => pattern.test(path)));
  if (watched.length === 0) {
    return { ok: true, message: "No skill, agent, hook, plugin source or main spec changed." };
  }
  const docs = changed.filter((path) => DOCS.some((pattern) => pattern.test(path)));
  if (docs.length > 0) {
    return { ok: true, message: `User docs changed with the sources: ${docs.join(", ")}.` };
  }
  if (REASON.test(body.replaceAll("\r\n", "\n"))) {
    return { ok: true, message: "The pull request says why no user docs change." };
  }
  return {
    ok: false,
    message: [
      "This pull request changes what a BDK user sees, but no page under docs/guide/ or docs/concepts/:",
      ...watched.map((path) => `  ${path}`),
      "Update the pages that describe it, or add this line to the pull request description:",
      "  Docs-impact: none - <reason>",
    ].join("\n"),
  };
}
