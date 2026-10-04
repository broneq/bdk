---
schema: 1
title: architecture
---

Two independent additions: src/ui/relativeTime.ts on dayjs and src/api/problemEquality.ts on fast-deep-equal. Neither module imports the other; each adds its library as a direct dependency with npm install.
