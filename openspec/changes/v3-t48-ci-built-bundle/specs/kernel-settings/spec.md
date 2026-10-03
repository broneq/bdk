## MODIFIED Requirements

### Requirement: Settings JSON Schema

The JSON Schema of the settings files SHALL be generated from the module registry, committed as `schema/settings.json`, and referenced from every settings file by a versioned yaml-language-server modeline.

`pnpm build` regenerates `schema/settings.json` and CI fails on `git diff --exit-code schema/`. The schema covers the registered modules only, rejects unknown keys (`additionalProperties: false` at every level) and carries each key's description and default. The modeline is the first line `# yaml-language-server: $schema=https://raw.githubusercontent.com/broneq/bdk/v<version>/schema/settings.json`, where `<version>` is the plugin version the kernel reports; `config set` writes it into a file it creates, `setup` writes it into the file it creates, and `doctor --fix` adds or updates it. The offline copy `.bdk/.machine/schema/settings.json` equals the running kernel's schema after `config check` or `doctor --fix`.

#### Scenario: schema consistent with the registry

- **WHEN** a module's zod schema changes and `schema/settings.json` is not regenerated
- **THEN** CI fails on `git diff --exit-code schema/`

#### Scenario: IDE suggestions

- **WHEN** the fixture's `.bdk/settings.yaml` with the modeline is opened in an editor running yaml-language-server
- **THEN** the editor suggests the registered keys and flags an unknown key (confirmed by hand once, recorded in the Change's tasks)
