## MODIFIED Requirements

### Requirement: Removed v2 keys

The kernel SHALL refuse a key that v2 had and v3 dropped or renamed with `policy/unknown-config-key`, and `why` SHALL name the replacement or the reason.

| v2 key                       | Replacement or reason                                                                             |
| ---------------------------- | ------------------------------------------------------------------------------------------------- |
| `test-tools`                 | `tools.test`                                                                                      |
| `lint-tools`                 | `tools.lint`                                                                                      |
| `build-tools`                | `tools.build`                                                                                     |
| `quality`                    | project rules in `.bdk/rules/` (`bdk rules accept`), BDK rules switched off with `rules.disabled` |
| `language-rules`             | the bundle's language packs selected by `languages`, project rules with `applies`                 |
| `features.caveman`           | no consumer in v3 (#39)                                                                           |
| `features.serena`            | removed with the bundled MCP servers (ADR-0001)                                                   |
| `features.code-review-graph` | removed with the bundled MCP servers (ADR-0001)                                                   |
| `$schema`                    | the yaml-language-server modeline                                                                 |

#### Scenario: removed key named

- **WHEN** `.bdk/settings.yaml` sets `features.serena: true`
- **THEN** `bdk config check` exits 2 with `rule: policy/unknown-config-key` and `why` naming the key, the layer and ADR-0001
