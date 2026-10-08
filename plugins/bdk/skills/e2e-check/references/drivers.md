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

The item's `browser` field picks the tool; absent means `playwright`.

### `playwright`

You explore the page with small throw-away Node scripts: write one, run it with `node`, read what it prints, then write the next. You do not know the page in advance, so never write the whole scenario before you have seen the page.

**Once per run.** Make the scratch directory from the project root, `mktemp -d .bdk/runs/<change>/e2e-scratch.XXXXXX` (below: `S`, always written as that relative path), and keep every script, `storageState` file and raw video there, never elsewhere in the project. It sits in the ignored run directory, so no write to it asks for permission and nothing of it reaches git. Then find Playwright, from the project root:

1. `node -e "console.log(require.resolve('@playwright/test', {paths: [process.cwd()]}))"`, then the same with `playwright`: the first path printed is `PW`.
2. Neither resolves: `npm install --prefix S --no-save --silent playwright@1.63.0`; `PW` is `./node_modules/playwright`, which the scripts resolve from `S`, where they live. A failed install makes the item's scenarios `blocked`, the run `BLOCKED`, with the npm error as the reason.

The first script launches with `chromium.launch()`. When it fails with `Executable doesn't exist`, launch with `chromium.launch({ channel: 'chrome' })` (the system Chrome) for the rest of the run. When that fails too, the item's scenarios are `blocked` and the run `BLOCKED`, the reason naming `npx -y playwright@1.63.0 install chromium`; add no finding.

**A script.** Write it to `S/<scenario>-<n>.mjs` with Write, run it with `node S/<scenario>-<n>.mjs`:

```js
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("PW");
const browser = await chromium.launch(); // or { channel: "chrome" }
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await context.newPage();
const errors = [];
page.on("console", (m) => m.type() === "error" && errors.push(`console: ${m.text()}`));
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
page.on("response", (r) => r.status() >= 400 && errors.push(`${r.status()} ${r.request().method()} ${r.url()}`));
// Each distinct state of the page over `ms`: catches what shows only for a moment.
async function watch(ms = 3000, root = page.locator("body")) {
  const seen = [];
  for (const end = Date.now() + ms; Date.now() < end; await page.waitForTimeout(150)) {
    const now = await root.ariaSnapshot();
    if (now !== seen.at(-1)) seen.push(now);
  }
  seen.forEach((state, i) => console.log(`--- state ${i + 1}\n${state}`));
}
try {
  await page.goto("http://localhost:5173/");
  console.log(await page.locator("body").ariaSnapshot());
  // act, then read at once: await page.getByRole("button", { name: "Save" }).click({ timeout: 5000 }); await watch();
} finally {
  console.log(errors.join("\n") || "no errors");
  await browser.close();
}
```

Work as a user would:

- Find controls by role and name (`getByRole`, `getByLabel`, `getByText`), as a user finds them by what they say. Never `force: true`, never `page.evaluate` to act: a control a user cannot click is a defect, and the click's error names the element in the way (`<div id="help"> intercepts pointer events`). Give actions `{ timeout: 5000 }`, so a dead control fails fast.
- Read the page in the same script as the action, right after it: `watch()` prints each state the page passes through, so a message that shows for two seconds and goes is seen. Never `waitForTimeout` before you read. A THEN holds only when it holds in the last state and no state on the way shows an error.
- Use what the scenario names: its viewport (`375 px wide` is `{ width: 375, height: 667 }`), its timing (`twice in quick succession` is `dblclick()`, which does not wait between the clicks), its accounts.
- When a scenario moves between accounts, consider one context per actor, kept signed in across scripts with `context.storageState({ path: "S/<actor>.json" })` and `browser.newContext({ storageState: "S/<actor>.json" })`. A scenario with one user needs one.
- A CAPTCHA or other bot protection makes the scenario `blocked`, unless the project's own instructions say how to pass it.
- Every error the script prints at its end is a defect even when the scenario passes; one that no scenario covers is a finding without `--file` (step 5).

**Replay and evidence.** When you know a scenario's steps, write one replay script that repeats them from a fresh context with recording on, `browser.newContext({ viewport, recordVideo: { dir: "S/video" } })`, reads the page at each THEN as above and takes `E2E/<scenario>-<n>.png` there (`page.screenshot({ path })`, absolute paths, `n` from 1). Put the steps in a `try` and the screenshot of the THEN they lead to in its `finally`: a failed action is the evidence of a `fail`, and its screenshot shows what was in the way. At the end, `await context.close()`, then `await page.video().saveAs("<absolute E2E>/<scenario>.webm")`; with several actors, one video per actor's page, `E2E/<scenario>-<actor>.webm`. The replay decides `Result:`: a failure you saw while exploring and see again in the replay is a `fail`; one the replay does not show stays a note under `## Observed` ("not reproduced in the replay"). When `saveAs` or `recordVideo` fails because Playwright's ffmpeg is missing, keep the screenshots, judge from them and the replay's output, and write under `## Evidence`: `no video: ffmpeg missing; npx -y playwright@1.63.0 install chromium`.

List under `## Evidence` of the scenario file every screenshot and the video, by file name.

Each script closes its own browser. Delete `S` at step 6: `rm -rf .bdk/runs/<change>/e2e-scratch.XXXXXX`, the relative path `mktemp` printed.

### `chrome-devtools-mcp`

Use the Chrome DevTools MCP server's tools (`navigate_page`, `take_snapshot`, `click`, `fill`, `take_screenshot`, `list_console_messages`): snapshot, act, snapshot, and judge the THEN from the snapshot after the action. Take a screenshot at each THEN into `E2E/<scenario>-<n>.png`; this tool records no video. When the session has no such tool, write `chrome-devtools-mcp not available; used playwright` under `## Steps` of each browser scenario and use `playwright`.
