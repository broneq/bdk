// The stdin boundary of the bdk CLI (spec `bdk-cli`, "No waiting on input" and "OS boundary";
// design D2 of v3-182-hooks-sessionstart-git-guard): a command reads stdin only for an explicit
// `-` argument, through this function, which `main.ts` injects. It reads the stream to its end
// instead of `readFileSync(0)`, which throws EAGAIN when the host hands over a non-blocking pipe.

/** All of stdin as UTF-8 text, read to its end. */
export async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}
