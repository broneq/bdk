#!/usr/bin/env bash
# A project whose own skill-check plugin has a rule that throws on every skill
# (it reads `doc.body`, which documents do not have), so skill-check exits 3
# with `skill-check: internal error: rule acme/no-todo failed on ...`.
set -euo pipefail
mkdir -p skills/release-notes
cat > skills/release-notes/SKILL.md <<'MD'
---
name: release-notes
description: Drafts release notes from the merged pull requests since the last tag. Use when a release is being cut or when asked for release notes.
---

List the pull requests merged since the last tag with `git log --merges`, group them by their Conventional Commit type, and write one line per change in the past tense.
MD
cat > acme-rules.mjs <<'JS'
// The team's own skill-check rules.
export default {
  name: "acme",
  rules: [
    {
      id: "no-todo",
      kinds: ["skills"],
      defaultSeverity: "error",
      check(doc, ctx) {
        for (const match of doc.body.matchAll(/TODO/g)) {
          ctx.report({ message: "no TODO in a skill", match: match[0] });
        }
      },
    },
  ],
};
JS
cat > skill-check.config.mjs <<'JS'
import acme from "./acme-rules.mjs";

export default { targets: [{ kind: "skills", dirs: ["skills"] }], plugins: [acme] };
JS
git init -q && git add -A && git -c user.name=eval -c user.email=eval@example.com commit -qm "release-notes skill"
