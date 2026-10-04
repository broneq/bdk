// The one escaping helper of the review report templates (`kernel-cli/review`,
// bdk review render): every text from the ledger, the plan, the paths or the
// pull request input goes through it.

const HTML: Readonly<Record<string, string>> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/** Text for an HTML element or a quoted attribute. */
export function html(text: string): string {
  return text.replace(/[&<>"']/g, (char) => HTML[char] ?? char);
}

/** Text for one Markdown line: no raw HTML and no table break, on one line. */
export function markdown(text: string): string {
  return text.replace(/\s*\n\s*/g, " ").replace(/[\\`*_<>|[\]]/g, (char) => `\\${char}`);
}

/** A URL for an `href`: only `http(s):` passes, anything else is no link. */
export function safeUrl(url: string): string | undefined {
  return /^https?:\/\//i.test(url) ? url : undefined;
}
