## MODIFIED Requirements

### Requirement: Settings JSON Schema

The JSON Schema of the settings files SHALL be generated from the module registry into `schema/settings.json` by every build, tracked by git on no branch except the distribution ref, and referenced from every settings file by a versioned yaml-language-server modeline.

`pnpm build` regenerates `schema/settings.json`; no committed copy exists to drift (`kernel-architecture`, Generated outputs). The schema covers the registered modules only, rejects unknown keys (`additionalProperties: false` at every level) and carries each key's description and default. The modeline is the first line `# yaml-language-server: $schema=https://raw.githubusercontent.com/broneq/bdk/dist-v<version>/schema/settings.json`, where `<version>` is the plugin version the kernel reports and `dist-v<version>` is the tag the release job puts on the `release` commit that holds the generated schema (`kernel-architecture`, Distribution ref); `config set` writes it into a file it creates, `setup` writes it into the file it creates, and `doctor --fix` adds or updates it. The offline copy `.bdk/.machine/schema/settings.json` equals the running kernel's schema after `config check` or `doctor --fix`.

#### Scenario: schema consistent with the registry

- **WHEN** a module's zod schema changes
- **THEN** the next `pnpm build` writes a `schema/settings.json` that carries the change, and no tracked copy can differ from it

#### Scenario: IDE suggestions

- **WHEN** the fixture's `.bdk/settings.yaml` with the modeline is opened in an editor running yaml-language-server
- **THEN** the editor suggests the registered keys and flags an unknown key (confirmed by hand once, recorded in the Change's tasks)

#### Scenario: modeline resolves after a release

- **WHEN** release `v3.1.0` is published and `config set` creates a settings file with the kernel at version 3.1.0
- **THEN** the modeline URL names the tag `dist-v3.1.0`, and that tag holds `schema/settings.json` equal to the schema the kernel prints with `config schema`
