---
layout: home

hero:
  name: BDK
  text: Broneq Dev Kit
  tagline: Claude Code plugins that package reusable dev workflows - skills, agents and hooks.
  actions:
    - theme: brand
      text: v3 architecture
      link: /design/2026-10-07-v3-architecture
    - theme: alt
      text: Decisions
      link: /adr/0003-v3-architecture-skills-first
    - theme: alt
      text: GitHub
      link: https://github.com/broneq/bdk

features:
  - title: Architecture decisions
    details: Why BDK is built the way it is - one ADR per decision, with the alternatives that lost.
    link: /adr/0002-v3-repo-structure-and-release
    linkText: Read the ADRs
  - title: Designs
    details: How v3 works - the skills-first architecture, the repository layout, CI and the release flow.
    link: /design/2026-10-07-v3-repo-structure-cicd
    linkText: Read the designs
---

BDK v3 is being rebuilt on the `staging/v3` branch. Until it is released, this site holds its decisions and designs:

- [ADR-0002: v3 repository structure and release flow](./adr/0002-v3-repo-structure-and-release.md)
- [ADR-0003: v3 architecture, skills first](./adr/0003-v3-architecture-skills-first.md)
- [v3 architecture](./design/2026-10-07-v3-architecture.md)
- [v3 repository structure and CI/CD](./design/2026-10-07-v3-repo-structure-cicd.md)
