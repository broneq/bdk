import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export interface SidebarLink {
  text: string;
  link: string;
}

/**
 * Sidebar entries for every Markdown file in `docs/<section>/`, in file-name order, so a new
 * ADR or design appears on the site without a config change. ADR and design file names start
 * with a number or a date, so file-name order is chronological.
 */
export function sidebarItems(docsDir: string, section: string): SidebarLink[] {
  return readdirSync(join(docsDir, section))
    .filter((file) => file.endsWith(".md"))
    .sort()
    .map((file) => {
      const path = join(docsDir, section, file);
      const heading = /^# (.+)$/m.exec(readFileSync(path, "utf8"))?.[1];
      // Headings read "<title> - <summary>"; the sidebar shows the title, as plain text.
      const title = heading?.split(" - ")[0]?.replaceAll("`", "").trim();
      if (!title) {
        throw new Error(`${path} has no "# " heading to title its sidebar entry`);
      }
      return { text: title, link: `/${section}/${file.slice(0, -".md".length)}` };
    });
}
