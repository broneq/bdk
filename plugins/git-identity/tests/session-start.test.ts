import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";

import {
  buildMessage,
  profileNameFrom,
  projectDirFromPayload,
  readBinding,
} from "../hooks/session-start.mjs";

const tmpRoots: string[] = [];

/** Create a throwaway project directory, optionally holding `.claude/settings.local.json`. */
function projectWith(settingsJson?: string): string {
  const root = mkdtempSync(join(tmpdir(), "git-identity-test-"));
  tmpRoots.push(root);
  if (settingsJson !== undefined) {
    mkdirSync(join(root, ".claude"), { recursive: true });
    writeFileSync(join(root, ".claude", "settings.local.json"), settingsJson);
  }
  return root;
}

afterAll(() => {
  for (const root of tmpRoots) rmSync(root, { recursive: true, force: true });
});

describe("projectDirFromPayload", () => {
  it("takes cwd from the hook payload", () => {
    expect(projectDirFromPayload('{"cwd":"/some/project"}')).toBe("/some/project");
  });

  it("returns null for empty, malformed, or cwd-less payloads", () => {
    expect(projectDirFromPayload("")).toBeNull();
    expect(projectDirFromPayload("   ")).toBeNull();
    expect(projectDirFromPayload("not json")).toBeNull();
    expect(projectDirFromPayload("{}")).toBeNull();
    expect(projectDirFromPayload('{"cwd":""}')).toBeNull();
    expect(projectDirFromPayload('{"cwd":42}')).toBeNull();
  });
});

describe("readBinding", () => {
  it("reads GH_CONFIG_DIR and GIT_CONFIG_GLOBAL", () => {
    const dir = projectWith(
      JSON.stringify({
        env: {
          GH_CONFIG_DIR: "/home/me/.config/gh-private",
          GIT_CONFIG_GLOBAL: "/home/me/.config/git-identity/private.gitconfig",
        },
      }),
    );
    expect(readBinding(dir)).toEqual({
      ghConfigDir: "/home/me/.config/gh-private",
      gitConfig: "/home/me/.config/git-identity/private.gitconfig",
    });
  });

  it("omits gitConfig when the profile does not set one", () => {
    const dir = projectWith(JSON.stringify({ env: { GH_CONFIG_DIR: "/gh-private" } }));
    expect(readBinding(dir)).toEqual({ ghConfigDir: "/gh-private" });
  });

  it("treats a missing file as no binding", () => {
    expect(readBinding(projectWith())).toBeNull();
  });

  it("treats malformed JSON as no binding rather than throwing", () => {
    expect(readBinding(projectWith("{ not json"))).toBeNull();
  });

  it("treats a settings file without our env keys as no binding", () => {
    expect(readBinding(projectWith(JSON.stringify({ permissions: { allow: [] } })))).toBeNull();
    expect(readBinding(projectWith(JSON.stringify({ env: {} })))).toBeNull();
    expect(readBinding(projectWith(JSON.stringify({ env: { GH_CONFIG_DIR: "" } })))).toBeNull();
  });
});

describe("profileNameFrom", () => {
  it("strips the gh- prefix", () => {
    expect(profileNameFrom("/home/me/.config/gh-private")).toBe("private");
  });

  it("calls the plain gh directory the default profile", () => {
    expect(profileNameFrom("/home/me/.config/gh")).toBe("default");
  });

  it("tolerates a trailing slash", () => {
    expect(profileNameFrom("/home/me/.config/gh-work/")).toBe("work");
  });

  it("reports an unconventional directory as-is instead of guessing", () => {
    expect(profileNameFrom("/home/me/elsewhere/custom")).toBe("custom");
  });
});

describe("buildMessage", () => {
  const binding = {
    ghConfigDir: "/home/me/.config/gh-private",
    gitConfig: "/home/me/.config/git-identity/private.gitconfig",
  };

  it("stays silent when there is no binding", () => {
    expect(buildMessage(null, {})).toBeNull();
  });

  it("reports the profile when the environment matches", () => {
    const message = buildMessage(binding, {
      GH_CONFIG_DIR: binding.ghConfigDir,
      GIT_CONFIG_GLOBAL: binding.gitConfig,
    });
    expect(message).toBe("[git-identity] profile: private");
  });

  it("warns when the binding has not reached the environment yet", () => {
    const message = buildMessage(binding, {});
    expect(message ?? "").toMatch(/bound but not active/);
    expect(message ?? "").toMatch(/private/);
  });

  it("warns when gh is switched but the git identity is stale", () => {
    const message = buildMessage(binding, {
      GH_CONFIG_DIR: binding.ghConfigDir,
      GIT_CONFIG_GLOBAL: "/home/me/.config/git-identity/work.gitconfig",
    });
    expect(message ?? "").toMatch(/git identity is not/);
  });

  it("does not check the git identity when the profile sets none", () => {
    const message = buildMessage({ ghConfigDir: "/gh-private" }, { GH_CONFIG_DIR: "/gh-private" });
    expect(message).toBe("[git-identity] profile: private");
  });
});
