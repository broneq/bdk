## MODIFIED Requirements

### Requirement: The site follows the Broniszewski design system
The site SHALL take its colors, type, spacing, radii and component styles from the Broniszewski design system (https://github.com/broneq/design-system), from an unchanged copy of its tokens in the repository that names the design system commit it came from, in the light and the dark theme. It SHALL self-host its fonts and SHALL NOT load fonts, styles or scripts from another host. The dark theme the site applies SHALL equal the design system's dark theme, and `pnpm check` SHALL fail when they differ. A page's first heading "<title> - <summary>" SHALL show as the title ending with the brand's blue period, followed by the summary as the page's lead, and the browser tab SHALL show the title. A table's strong top rule SHALL be exactly as wide as its rows, whether the table is narrower than the content column or scrolls.

#### Scenario: Dark theme drift
- **WHEN** an update of the copied tokens changes a value of the design system's dark theme and the site's dark theme is left as it was
- **THEN** `pnpm check` fails and names the variable

#### Scenario: Fonts from the site
- **WHEN** a reader opens any page of the site
- **THEN** every font, style and script the page loads comes from the site's own host

#### Scenario: Page header
- **WHEN** a reader opens `docs/guide/install.md` on the site, whose first heading reads "Install - add the BDK marketplace and the plugins you want"
- **THEN** the page shows "Install" ending with the blue period, the summary below it as the lead, and the browser tab reads "Install | BDK"

#### Scenario: Narrow table
- **WHEN** a reader opens the wave table of `docs/concepts/stages.md` ("How a plan is cut"), which is narrower than the content column, in the light or the dark theme
- **THEN** its top rule ends where its row lines end

#### Scenario: Wide table
- **WHEN** a reader opens a table wider than the content column, such as the table of `docs/reference/bdk/rules.md`, and scrolls it
- **THEN** its top rule spans the full width of its rows and scrolls with them
