// The settings `evidence` reads (`kernel-settings`, Keys of evidence policy;
// T23-D16, D46, D48): the file-class partition of the tree hash and the size
// limit of a committed evidence file. The two glob lists are the defaults of
// the file-class partition that requirement defines; layers append, never remove.
import * as z from "zod";

import { appendOnly, defineConfigModule } from "../shared/config/index.ts";

const glob = z.string().min(1).meta({ title: "non-empty glob" });

function globs(defaults: readonly string[], description: string) {
  return appendOnly(
    z
      .array(glob)
      .refine((items) => new Set(items).size === items.length, "globs must be unique")
      .meta({ uniqueItems: true, description }),
  ).default([...defaults]);
}

const NON_EXECUTABLE = [
  "**/*.md",
  "**/*.mdx",
  "**/*.txt",
  "**/*.rst",
  "**/*.png",
  "**/*.jpg",
  "**/*.jpeg",
  "**/*.gif",
  "**/*.svg",
  "**/*.webp",
  "docs/**",
  "LICENSE*",
  "CHANGELOG*",
  ".bdk/**",
] as const;

const BUILD_CONFIG = [
  "package.json",
  "pnpm-lock.yaml",
  "package-lock.json",
  "yarn.lock",
  "tsconfig*.json",
  "pyproject.toml",
  "uv.lock",
  "poetry.lock",
  "requirements*.txt",
  "go.mod",
  "go.sum",
  "Cargo.toml",
  "Cargo.lock",
  "Gemfile",
  "Gemfile.lock",
  "pom.xml",
  "build.gradle*",
  "Makefile",
  "CMakeLists.txt",
] as const;

export const evidenceModule = defineConfigModule({
  key: "policy.evidence",
  consumer: "evidence",
  owner: "T23",
  setup: {
    "non-executable": "derived",
    "build-config": "derived",
    "max-committed-bytes": "default",
  },
  description: "Which files the tree hash covers and which evidence files are committed.",
  schema: z
    .strictObject({
      "non-executable": globs(
        NON_EXECUTABLE,
        "Files that never change the tree hash; layers append to the defaults.",
      ),
      "build-config": globs(
        BUILD_CONFIG,
        "Files that always change the tree hash, wherever they are; wins over non-executable.",
      ),
      "max-committed-bytes": z.int().min(0).default(65536).meta({
        description: "The largest UTF-8 text evidence file copied into the Change; 0 commits none.",
      }),
    })
    .prefault({}),
});
