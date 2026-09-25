import { execFileSync } from "node:child_process";

// Tests that run the committed bundles must see the build of the current
// source. Building once here, before any test file starts, keeps parallel test
// files from racing on dist/.
export default function setup(): void {
  execFileSync("pnpm", ["build"], { cwd: import.meta.dirname, stdio: "inherit" });
}
