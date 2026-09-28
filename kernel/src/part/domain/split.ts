// `part split` on a plan part body (`kernel-state`, Plan part and plan index):
// a task runs from its `## <nn>-<k> <title>` heading to the next level-2
// heading. Moved tasks keep their text and ids; the rest stays in order.

const TASK_HEADING = /^## (\d{2}-[1-9]\d*)(?:\s|$)/;

export interface SplitBody {
  /** The original body without the moved tasks. */
  readonly kept: string;
  /** The moved tasks, in their original order. */
  readonly moved: string;
}

export function splitBody(body: string, moved: ReadonlySet<string>): SplitBody {
  const kept: string[] = [];
  const out: string[] = [];
  let target = kept;
  for (const line of body.split("\n")) {
    if (line.startsWith("## ")) {
      const id = TASK_HEADING.exec(line)?.[1];
      target = id !== undefined && moved.has(id) ? out : kept;
    }
    target.push(line);
  }
  return { kept: tidy(kept), moved: tidy(out) };
}

/** A file-name slug of a title: lowercase words joined by `-`, at most 40 characters. */
export function slugOf(title: string): string {
  const slug = title
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, 40)
    .replace(/^-+|-+$/g, "");
  return slug === "" ? "split" : slug;
}

function tidy(lines: readonly string[]): string {
  const text = lines
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return text === "" ? "" : `${text}\n`;
}
