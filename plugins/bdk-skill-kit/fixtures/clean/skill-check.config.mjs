// Every generic rule at error, so each seeded violation exits 1.
export default {
  targets: [
    { kind: "skills", dirs: ["skills"] },
    { kind: "agents", dirs: ["agents"] },
    { kind: "skills", dirs: ["craft"], profile: "portable" },
  ],
  rules: {
    "description-front-loaded": "error",
    "require-model": "error",
    layout: ["error", { allowed: ["references", "scripts", "assets", "examples"] }],
  },
};
