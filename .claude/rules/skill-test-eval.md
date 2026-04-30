---
paths:
  - "tests/evals/**"
---

# Skill Evals

Store evals in `tests/evals/skills/<skill-name>/`.

## Directory Structure

```
tests/evals/skills/<skill-name>/
├── evals/
│   └── evals.json              ← test prompts + assertions (codebase-agnostic)
└── iterations/
    └── iteration-N/            ← results from one eval run
        ├── benchmark.json
        ├── benchmark.md        ← optional
        ├── feedback.json       ← optional
        └── eval-N-<slug>/
            ├── eval_metadata.json  ← may be at eval level or inside variant dirs
            ├── with_skill/
            │   ├── outputs/    ← response.md / plan.md / transcript_summary.md
            │   └── run-1/      ← grading.json, timing.json
            └── old_skill/      ← or without_skill/ depending on skill
                ├── outputs/
                └── run-1/
```

## Guidelines

- **Eval prompts must be codebase-agnostic** — test skill behavior (structure, agent count, TDD format), not specific classes or files
- **Assertions check structural properties** — e.g. "plan has 2+ approaches", "tasks use ✅/❌ markers", "correct agent count for complexity"
- **Iterations accumulate** — each `/skill-creator` run adds new `iteration-N/`, no overwrite