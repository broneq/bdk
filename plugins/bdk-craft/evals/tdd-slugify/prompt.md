---
max_turns: 60
timeout_seconds: 900
allowed_tools: [Read, Glob, Grep, Write, Edit, Bash, Skill]
---

Add a function `slugify(title)` in `src/slugify.js` with tests next to it. It lowercases the title and joins its ASCII words with single hyphens, folds Polish diacritics (`Zażółć gęślą jaźń` becomes `zazolc-gesla-jazn`), never starts or ends with a hyphen, and returns at most 60 characters without cutting a word in half. Work test-first.
