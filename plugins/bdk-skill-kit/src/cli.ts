import { main } from "./main.ts";

// A reader that stops early (`skill-check | head`) closes the pipe. Nothing is
// left to print to, so exit with the run's code instead of an EPIPE trace.
process.stdout.on("error", (error: NodeJS.ErrnoException) => {
  if (error.code !== "EPIPE") throw error;
  process.exit(process.exitCode ?? 0);
});

process.exitCode = await main(process.argv.slice(2), {
  cwd: process.cwd(),
  env: process.env,
  stdout: (text) => process.stdout.write(text),
  stderr: (text) => process.stderr.write(text),
});
