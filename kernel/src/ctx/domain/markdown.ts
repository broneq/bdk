// Markdown that is embedded under a heading of its own: a dispatch package's
// role body and task text, a craft skill under `## Craft: <name>`.

/** Every heading outside a fenced block `levels` levels down, never below `######`. */
export function demoteHeadings(markdown: string, levels = 1): string {
  let fence: string | undefined;
  return markdown
    .split("\n")
    .map((line) => {
      const marker = /^ {0,3}(`{3,}|~{3,})/.exec(line)?.[1];
      if (marker !== undefined) {
        if (fence === undefined) fence = marker;
        else if (marker.startsWith(fence)) fence = undefined;
        return line;
      }
      const hashes = fence === undefined ? /^(#{1,6}) /.exec(line)?.[1] : undefined;
      if (hashes === undefined) return line;
      const level = Math.min(6, hashes.length + levels);
      return "#".repeat(level) + line.slice(hashes.length);
    })
    .join("\n");
}
