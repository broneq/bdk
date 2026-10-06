## ADDED Requirements

### Requirement: Settings page states setup coverage

`reference/configuration.md` SHALL state, in a `Setup` column of its key tables, for every key of the registry whether `/bdk:setup` derives it, asks about it or leaves it on its default (`kernel-settings`, Setup classification), and the `/bdk:setup` section of `reference/skills.md` and `getting-started/setup.md` SHALL say which keys setup sets and that the rest are listed in its closing report. A docs drift guard SHALL fail when a key's class on the settings page differs from the registry's.

#### Scenario: class on the settings page

- **WHEN** the docs drift guards run
- **THEN** the row of every registered key on `reference/configuration.md` carries the key's class (`derived`, `asked` or `default`) in its `Setup` column

#### Scenario: class changed in the registry

- **WHEN** a module changes `policy.gates.design` from `asked` to `default` and the settings page is not updated
- **THEN** the docs drift guard fails naming `policy.gates.design`
