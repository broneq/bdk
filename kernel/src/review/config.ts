// The settings `review` reads (`kernel-settings`, Keys of review policy): the
// size above which `bdk review plan` splits a group by module (T42-R1), the
// risky areas of this project (T42-K), and the tracker a finding the human
// chooses to track is filed in (T42-J). `dispatch` lists the risks in the
// integration reviewer's package; the report draws its change map from their
// `paths`.
import * as z from "zod";

import { defineConfigModule } from "../shared/config/index.ts";

export const reviewGroupModule = defineConfigModule({
  key: "review.group",
  consumer: "review",
  owner: "T42",
  setup: "default",
  description: "How bdk review plan sizes the reviewer groups.",
  schema: z
    .strictObject({
      "max-files": z.int().min(5).max(200).default(30).meta({
        description:
          "The target size of a reviewer group. Small modules are packed together up to it; a module or plan part is kept whole up to a third above it, and only a larger one is cut, by directory.",
      }),
    })
    .prefault({}),
});

const RISKS = [
  {
    id: "auth",
    instruction:
      "Changes to authentication, authorisation, permissions, roles or session handling, including who may call a changed endpoint.",
    paths: [
      "**/*auth*/**",
      "**/*auth*",
      "**/*permission*",
      "**/*acl*",
      "**/*role*",
      "**/*session*",
    ],
  },
  {
    id: "migration",
    instruction:
      "Changes to a persistent data model: schema migrations, stored formats, data backfills, anything hard to roll back.",
    paths: [
      "**/migrations/**",
      "**/migrate/**",
      "**/*migration*",
      "**/*.sql",
      "**/*.prisma",
      "**/models/**",
      "**/entities/**",
    ],
  },
  {
    id: "secrets",
    instruction:
      "Code or configuration that reads, stores, logs or transmits secrets, tokens, keys or personal data.",
    paths: ["**/.env*", "**/*secret*", "**/*credential*", "**/*token*", "**/*.pem", "**/*.key"],
  },
  {
    id: "public-api",
    instruction:
      "Changes to a public or cross-service interface: endpoints, exported functions, CLI flags, events, file formats others consume.",
    paths: [
      "**/api/**",
      "**/routes/**",
      "**/controllers/**",
      "**/handlers/**",
      "**/*.proto",
      "**/*.graphql",
      "**/openapi*",
      "**/swagger*",
    ],
  },
  {
    id: "dependencies",
    instruction: "Added, removed or upgraded third-party dependencies and changes to the build.",
    paths: [
      "**/package.json",
      "**/pnpm-lock.yaml",
      "**/package-lock.json",
      "**/yarn.lock",
      "**/pyproject.toml",
      "**/uv.lock",
      "**/poetry.lock",
      "**/requirements*.txt",
      "**/go.mod",
      "**/go.sum",
      "**/Cargo.toml",
      "**/Cargo.lock",
      "**/Gemfile*",
      "**/pom.xml",
      "**/build.gradle*",
      "**/Makefile",
      "**/Dockerfile*",
    ],
  },
  {
    id: "configuration",
    instruction:
      "Changes to runtime or deployment configuration: settings files, environment variables, feature flags, CI and infrastructure.",
    paths: [
      "**/config/**",
      "**/*config.*",
      "**/settings*.*",
      "**/*.ini",
      "**/.env*",
      ".github/workflows/**",
      "**/helm/**",
      "**/k8s/**",
      "**/*.tf",
    ],
  },
] as const;

const glob = z.string().min(1).meta({ title: "non-empty glob" });

const risk = z
  .strictObject({
    id: z
      .string()
      .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "must be kebab-case")
      .meta({
        description: "The merge key.",
      }),
    instruction: z.string().min(1).max(500).meta({
      description: "What a reviewer must call out, written for a model.",
    }),
    paths: z
      .array(glob)
      .refine((items) => new Set(items).size === items.length, "globs must be unique")
      .optional()
      .meta({
        uniqueItems: true,
        description: "The files of the area, for the report's change map.",
      }),
    enabled: z.boolean().default(true).meta({ description: "false leaves the item out." }),
  })
  .meta({ title: "risk" });

export const risksModule = defineConfigModule({
  key: "review.risks",
  consumer: "review",
  owner: "T42",
  setup: "asked",
  description: "Risky areas of this project the review calls out, merged by id.",
  schema: z
    .array(risk)
    .default(RISKS.map((item) => ({ ...item, paths: [...item.paths], enabled: true })))
    .meta({
      description: "Items {id, instruction, paths, enabled}, merged by id with the defaults.",
    }),
});

const tracker = z
  .discriminatedUnion("kind", [
    z.strictObject({
      kind: z.literal("github").meta({
        description: "File with gh issue create in the repository of origin.",
      }),
    }),
    z.strictObject({
      kind: z.literal("instruction"),
      instruction: z.string().min(1).max(1000).meta({
        description: "How the model files the issue with the user's own CLI or MCP server.",
      }),
    }),
  ])
  .meta({ title: "tracker object" });

export const trackerModule = defineConfigModule({
  key: "tracker",
  consumer: "review",
  owner: "T42",
  setup: "asked",
  description: "Where a finding goes when the human chooses track; unset offers no track.",
  schema: tracker.optional(),
});
