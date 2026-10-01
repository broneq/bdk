## MODIFIED Requirements

### Requirement: v2 banner

Every page that describes v2 behaviour SHALL open, directly under its title, with the same admonition. The admonition SHALL say that the page describes BDK v2 and that the v3 documentation (T50) replaces it. The snippet pages that include `CHANGELOG.md` and `CONTRIBUTING.md` SHALL carry no banner. A page a task has already rewritten for v3 (T31: `concepts/quality-and-language-rules.md` and `workflows/rules-hygiene.md`; T41: `getting-started/setup.md`) SHALL carry no banner either, and the test SHALL list it by name, so a page leaves the banner only by a task's decision. A test SHALL enforce that every other page carries the banner until T50 removes the test together with the banners.

#### Scenario: page without the banner

- **WHEN** a page under `docs/guide/` other than the changelog and contributing snippets and the pages rewritten for v3 lacks the banner
- **THEN** `pnpm test:contract` fails and names the page

#### Scenario: page rewritten for v3

- **WHEN** the banner test reads `docs/guide/concepts/quality-and-language-rules.md`
- **THEN** it skips the page, which describes the v3 rules and carries no banner
