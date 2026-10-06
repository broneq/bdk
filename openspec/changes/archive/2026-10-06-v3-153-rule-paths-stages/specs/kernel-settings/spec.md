# Spec Delta

## MODIFIED Requirements

### Requirement: Keys of the project toolchain

The settings SHALL declare the project toolchain keys below, owned by T12.

| Key               | Type                              | Default | Owner | Consumer        | v2 origin                           |
| ----------------- | --------------------------------- | ------- | ----- | --------------- | ----------------------------------- |
| `languages`       | array of unique non-empty strings | `[]`    | T12   | `rules`         | `languages`                         |
| `tools.test`      | `none` or array of tool entries   | none    | T12   | `shared/config` | `test-tools` (`type` becomes `id`)  |
| `tools.lint`      | `none` or array of tool entries   | none    | T12   | `shared/config` | `lint-tools` (`type` becomes `id`)  |
| `tools.build`     | array of tool entries             | `[]`    | T12   | `shared/config` | `build-tools` (`type` becomes `id`) |
| `features.lavish` | boolean                           | `true`  | T12   | `ctx`           | `features.lavish`                   |

`languages` is free-form: a name gets rules only when the bundle ships a pack under `rules/languages/<name>/` (`rule-pack`, Pack layout). `languages` switches a pack on; the `paths` of its rules then narrow it to the files of that language, so a file extension decides nothing on its own (a `.tsx` file is not React unless `react` is listed). A project's own language rules are ordinary rule files with `paths` and `stages`. The `rules` slice owns the rule text (`kernel-architecture`, Dependency matrix), and `ctx` reads it through `rules`. `features.lavish: false` makes skills fall back to `AskUserQuestion` (R-11). The `tools` module is declared by `shared/config` (`shared/config/modules.ts`), not by one slice: `ctx` renders the entries into skill context, `dispatch` into a runner's `Checks`, `evidence` reads `tools.test[].coverage` for `bdk evidence coverage` and `graph` for the `tests-full` node, and `evidence` stays a leaf (T42).

#### Scenario: empty project

- **WHEN** no layer file exists and `bdk config show --json` runs
- **THEN** the exit code is 0 and the value holds every registered key with its default; `tools.test` and `tools.lint`, which have none, are absent

#### Scenario: language pack needs both the switch and a matching file

- **WHEN** the work tree holds `web/App.tsx`, and `bdk rules explain web/App.tsx --role reviewer` runs once with `languages: [typescript]` and once with `languages: [typescript, react]`
- **THEN** only the second run lists `BDK-REACT` rules

### Requirement: Removed v2 keys

The kernel SHALL refuse a key that v2 had and v3 dropped or renamed with `policy/unknown-config-key`, and `why` SHALL name the replacement or the reason.

| v2 key                       | Replacement or reason                                                                             |
| ---------------------------- | ------------------------------------------------------------------------------------------------- |
| `test-tools`                 | `tools.test`                                                                                      |
| `lint-tools`                 | `tools.lint`                                                                                      |
| `build-tools`                | `tools.build`                                                                                     |
| `quality`                    | project rules in `.bdk/rules/` (`bdk rules accept`), BDK rules switched off with `rules.disabled` |
| `language-rules`             | the bundle's language packs selected by `languages`, project rules with `paths` and `stages`      |
| `features.caveman`           | no consumer in v3 (#39)                                                                           |
| `features.serena`            | removed with the bundled MCP servers (ADR-0001)                                                   |
| `features.code-review-graph` | removed with the bundled MCP servers (ADR-0001)                                                   |
| `$schema`                    | the yaml-language-server modeline                                                                 |

#### Scenario: removed key named

- **WHEN** `.bdk/settings.yaml` sets `features.serena: true`
- **THEN** `bdk config check` exits 2 with `rule: policy/unknown-config-key` and `why` naming the key, the layer and ADR-0001
