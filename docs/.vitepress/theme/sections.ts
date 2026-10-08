/** The section a page belongs to: the eyebrow above its title, and whether its chapters are numbered. */
export interface Section {
  readonly label: string;
  readonly numbered: boolean;
}

const SECTIONS: Readonly<Record<string, Section>> = {
  guide: { label: "Guide", numbered: true },
  concepts: { label: "Concepts", numbered: true },
  reference: { label: "Reference", numbered: false },
  adr: { label: "Architecture decision", numbered: false },
  design: { label: "Design", numbered: false },
};

/** The section of a route path under the site base, such as `/bdk/guide/install`. */
export function sectionOf(path: string): Section | undefined {
  const dir = /\/(guide|concepts|reference|adr|design)\//.exec(path)?.[1];
  return dir === undefined ? undefined : SECTIONS[dir];
}
