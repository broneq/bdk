# BDK Shared Foundation

This file is injected into every session via SessionStart hook. It defines the BDK contract inherited by all skills.

## Tool Tier System

When exploring, searching, editing, or reviewing code, use the best available tool tier. The instructions below are injected based on your project's enabled features.

**Exploration & Architecture:**

<!-- CHAIN: explore.chain.json -->

**Symbol Search & Tracing:**

<!-- CHAIN: search.chain.json -->

**Impact Analysis:**

<!-- CHAIN: impact.chain.json -->

## Quality Rules

BDK ships language-agnostic `code-quality` and `architecture` rule sets used by `/bdk:cr` and `/bdk:create-plan`. Override or extend via the `quality` section in `.bdk/settings.json`. See README "Quality Rules" for the four usage patterns.
