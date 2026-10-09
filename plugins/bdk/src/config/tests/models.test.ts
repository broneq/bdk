import { describe, expect, it } from "vitest";

import { closest } from "../../shared/cli/index.ts";
import type { Layer } from "../domain/merge.ts";
import { EFFORTS } from "../domain/settings.ts";
import { validate } from "../domain/validate.ts";
import { set } from "../use-cases/set.ts";
import { show } from "../use-cases/show.ts";
import { memory, OPENSPEC, PROJECT, ROOT } from "./memory.ts";

// Model and effort per role, and the escalation effort (spec `bdk-cli/config`, "Settings keys";
// spec `bdk-cli/config`, "Every agent is a models role").

const project = (data: Record<string, unknown>): Layer => ({
  name: "project",
  file: PROJECT,
  data,
});

function messages(data: Record<string, unknown>): string[] {
  return validate([project(data)], closest).problems.map((p) => `${p.key}: ${p.message}`);
}

function configured(text: string) {
  const fs = memory({ [PROJECT]: text, [OPENSPEC]: "" });
  return { fs, deps: { files: fs, cwd: ROOT, home: "/home/me", env: {} } };
}

describe("models.<role>", () => {
  it("accepts model and effort of a role and the escalation effort", () => {
    const { problems, settings } = validate(
      [
        project({
          models: { implementer: { model: "opus", effort: "high" }, reviewer: { effort: "low" } },
          policy: { escalation: { effort: "max" } },
        }),
      ],
      closest,
    );
    expect(problems).toEqual([]);
    expect(settings?.models).toEqual({
      implementer: { model: "opus", effort: "high" },
      reviewer: { effort: "low" },
    });
    expect(settings?.policy.escalation).toEqual({ model: "opus", effort: "max" });
  });

  it("prints each field of a role with its origin", () => {
    const { deps } = configured("models:\n  implementer:\n    model: opus\n    effort: high\n");
    const result = show(deps, "models");
    expect(result.status === "ok" && result.entries).toEqual([
      { key: "models.implementer.model", value: "opus", origin: "project" },
      { key: "models.implementer.effort", value: "high", origin: "project" },
    ]);
  });

  it("rejects an unknown effort, naming the allowed values", () => {
    const [problem] = messages({ models: { planner: { effort: "extreme" } } });
    expect(problem).toMatch(/^models\.planner\.effort: .*"low"\|"medium"\|"high"\|"xhigh"\|"max"/);
    expect(messages({ policy: { escalation: { effort: "huge" } } })[0]).toMatch(
      /^policy\.escalation\.effort: /,
    );
  });

  it("rejects an unknown role, suggesting the closest", () => {
    expect(messages({ models: { implementor: { model: "opus" } } })).toEqual([
      "models.implementor: unknown key; did you mean models.implementer?",
    ]);
  });

  it("rejects a model given as a plain string, naming the mapping form", () => {
    expect(messages({ models: { reviewer: "sonnet" } })).toEqual([
      "models.reviewer: must be a mapping with model and effort (models.reviewer.model: sonnet)",
    ]);
  });

  it("sets the effort of a role with bdk config set", () => {
    const { fs, deps } = configured("");
    set(deps, "models.designer.effort", "xhigh");
    expect(fs.data.get(PROJECT)).toBe("models:\n  designer:\n    effort: xhigh\n");
  });

  it("knows the effort levels of Claude Code", () => {
    expect(EFFORTS).toEqual(["low", "medium", "high", "xhigh", "max"]);
  });
});
