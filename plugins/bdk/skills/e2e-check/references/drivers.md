# Drivers

How to drive a scenario through each `tools.e2e` driver, and how to close what you opened.

## `cli`

- A user runs the CLI in their own directory. Create a fresh directory per scenario with `mktemp -d` and run every command of the scenario there, the CLI called the way `ready` calls it with every path made absolute: `cd /tmp/x && node /abs/project/bin/todo.js list`. State the CLI writes then stays out of the project and out of the next scenario.
- When the WHEN needs files (an input file, a config), create them in that directory first and name them in the steps.
- Record each command with its exit code, and the stdout and stderr lines that matter. Check the exit code when the scenario names one, and the exact text when it quotes one.

## `http`

- Send the request the scenario implies: `curl -sS -i -X <method> <url>`, with `-H 'content-type: application/json' --data '<json>'` for a body.
- Record the status line, the headers that matter, and the body or its relevant part. Compare status and body with the THEN.

## `browser`

The item's `browser` field picks the tool; absent means `chrome-devtools-axi`.

### `chrome-devtools-axi`

Run every call exactly in this form, so the tester gets its own browser session and never drives one the user or another agent has open:

```bash
env CHROME_DEVTOOLS_AXI_SESSION=bdk-e2e npx -y chrome-devtools-axi <command>
```

| Step | Command |
|---|---|
| Open the page | `open <url>` |
| Read the page | `snapshot` (elements carry `@uid` refs) |
| Act | `click @<uid>`, `fill @<uid> <text>`, `press <key>`, `wait <text>` |
| Evidence | `screenshot /abs/project/.bdk/runs/<change>/e2e/<scenario>-<n>.png` |
| Errors | `console` |
| Close | `stop` once, at the end of the run |

Work as snapshot, act, snapshot: find the control in a snapshot, act on its ref, read the new snapshot, and judge the THEN from what that snapshot shows. Take a screenshot at each THEN. Check `console` once per scenario; an error there is a defect even when the scenario passes. When `open` fails because no browser starts, the scenarios are `blocked` and the run is `BLOCKED` with that reason.

### `chrome-devtools-mcp`

Use the Chrome DevTools MCP server's tools (`navigate_page`, `take_snapshot`, `click`, `fill`, `take_screenshot`, `list_console_messages`), the same way: snapshot, act, snapshot. When the session has no such tool, write `chrome-devtools-mcp not available; used chrome-devtools-axi` under `## Steps` of each browser scenario and use `chrome-devtools-axi`.
