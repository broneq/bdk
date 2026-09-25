import type { Rule } from "../index.ts";
import { cliFront } from "./cli-front.ts";
import { absolutePaths, argumentsTypo, body, lineLimit, modelNames } from "./content.ts";
import {
  description,
  descriptionFrontLoaded,
  fieldValues,
  fields,
  frontmatter,
  invocation,
  nameFormat,
  nameMatchesDir,
  requireModel,
  skillFileName,
} from "./frontmatter.ts";
import { layout, referencesRule, uniqueNames, unusedFiles } from "./structure.ts";

/** The generic rule catalogue (spec `skill-kit`, Generic rule catalogue), in catalogue order. */
export const genericRules: Rule<object>[] = [
  frontmatter,
  nameFormat,
  nameMatchesDir,
  skillFileName,
  description,
  descriptionFrontLoaded,
  fields,
  fieldValues,
  invocation,
  requireModel,
  body,
  lineLimit,
  absolutePaths,
  modelNames,
  argumentsTypo,
  referencesRule,
  unusedFiles,
  layout,
  uniqueNames,
  cliFront,
];
