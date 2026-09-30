import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import { bulletsOf, readBullets } from "./bullets.ts";

describe("bulletsOf", () => {
  it("numbers the bullets of a file and hashes their text", () => {
    const bullets = bulletsOf(
      "rules/languages/react.md",
      "# React\n\nIntro.\n\n- **A.** one\n- **B.** two\n",
    );
    const hash = createHash("sha256").update("**B.** two").digest("hex").slice(0, 8);
    expect(bullets).toEqual([
      expect.objectContaining({ ordinal: 1, text: "**A.** one" }),
      {
        id: `languages/react.02.${hash}`,
        file: "rules/languages/react.md",
        ordinal: 2,
        text: "**B.** two",
      },
    ]);
  });
});

describe("readBullets", () => {
  it("indexes every bullet of the shipped rule files with unique, stable ids", () => {
    const bullets = readBullets();
    expect(bullets).toHaveLength(131);
    expect(new Set(bullets.map((bullet) => bullet.id)).size).toBe(bullets.length);
    expect(readBullets()).toEqual(bullets);
    expect(bullets[0]?.id).toMatch(/^architecture\.01\.[0-9a-f]{8}$/);
    expect(bullets.at(-1)?.id).toMatch(/^languages\/typescript\.22\.[0-9a-f]{8}$/);
  });
});
