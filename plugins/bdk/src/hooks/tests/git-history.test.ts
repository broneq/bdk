import { describe, expect, it } from "vitest";

import { historyChange } from "../domain/git-history.ts";

// The table of spec `bdk-cli/hooks`, "Git history changes" (design D5): which git commands the
// subagent-git guard counts as changing history, row by row.

const denied = (command: string) => historyChange(command);

describe("historyChange", () => {
  it.each([
    ["git commit -m x", "git commit"],
    ["git merge topic", "git merge"],
    ["git rebase -i main", "git rebase"],
    ["git cherry-pick abc", "git cherry-pick"],
    ["git revert HEAD", "git revert"],
    ["git reset --hard HEAD~1", "git reset"],
    ["git am < patch", "git am"],
    ["git pull", "git pull"],
    ["git push origin HEAD", "git push"],
    ["git update-ref refs/heads/x HEAD", "git update-ref"],
    ["git replace a b", "git replace"],
    ["git filter-branch --force", "git filter-branch"],
    ["git filter-repo --path x", "git filter-repo"],
  ])("always denies %s", (command, match) => {
    expect(denied(command)).toBe(match);
  });

  it("denies stash except list and show", () => {
    expect(denied("git stash")).toBe("git stash");
    expect(denied("git stash push -m x")).toBe("git stash");
    expect(denied("git stash pop")).toBe("git stash");
    expect(denied("git stash create")).toBe("git stash");
    expect(denied("git stash list")).toBeUndefined();
    expect(denied("git stash show -p stash@{0}")).toBeUndefined();
  });

  it("denies branch forms that create, delete, move, copy or retarget a branch", () => {
    for (const command of [
      "git branch topic",
      "git branch topic main",
      "git branch -d topic",
      "git branch -D topic",
      "git branch --delete topic",
      "git branch -m old new",
      "git branch --move new",
      "git branch -c a b",
      "git branch -C a b",
      "git branch --copy a b",
      "git branch -f topic HEAD",
      "git branch --force topic",
      "git branch -u origin/main",
      "git branch --set-upstream-to=origin/main",
      "git branch --set-upstream-to origin/main",
      "git branch --unset-upstream",
      "git branch --edit-description",
      "git branch -vD topic",
    ]) {
      expect(denied(command), command).toBe("git branch");
    }
  });

  it("allows branch listing forms", () => {
    for (const command of [
      "git branch",
      "git branch -a",
      "git branch -vv",
      "git branch -r --merged",
      "git branch --list 'v3/*'",
      "git branch -l v3",
      "git branch --show-current",
      "git branch --contains abc123",
      "git branch --no-merged main --sort -committerdate",
      "git branch --format '%(refname)'",
      "git branch --points-at=HEAD",
    ]) {
      expect(denied(command), command).toBeUndefined();
    }
  });

  it("denies tag forms that create or delete a tag and allows listing", () => {
    for (const command of [
      "git tag v1",
      "git tag -a v1 -m msg",
      "git tag --annotate v1",
      "git tag -s v1",
      "git tag -d v1",
      "git tag --delete v1",
      "git tag -f v1",
      "git tag -m msg v1",
      "git tag -F notes v1",
      "git tag -u key v1",
    ]) {
      expect(denied(command), command).toBe("git tag");
    }
    for (const command of [
      "git tag",
      "git tag -l",
      "git tag --list 'v*'",
      "git tag -v v1",
      "git tag --verify v1",
      "git tag --contains HEAD",
      "git tag -n5",
      "git tag --sort=-v:refname",
    ]) {
      expect(denied(command), command).toBeUndefined();
    }
  });

  it("denies checkout and switch only when they create a branch", () => {
    for (const command of [
      "git checkout -b topic",
      "git checkout -B topic",
      "git checkout --orphan gh-pages",
      "git switch -c topic",
      "git switch -C topic",
      "git switch --create topic",
      "git switch --force-create topic",
      "git switch --orphan x",
    ]) {
      expect(denied(command), command).toMatch(/^git (checkout|switch)$/);
    }
    for (const command of [
      "git checkout main",
      "git checkout -- file.ts",
      "git checkout .",
      "git switch main",
      "git switch --detach HEAD~1",
    ]) {
      expect(denied(command), command).toBeUndefined();
    }
  });

  it("denies worktree add with a new branch only", () => {
    expect(denied("git worktree add -b topic ../t")).toBe("git worktree");
    expect(denied("git worktree add -B topic ../t main")).toBe("git worktree");
    expect(denied("git worktree add ../t main")).toBeUndefined();
    expect(denied("git worktree list")).toBeUndefined();
  });

  it("denies notes, reflog and symbolic-ref writes and allows their reads", () => {
    expect(denied("git notes add -m x")).toBe("git notes");
    expect(denied("git notes remove HEAD")).toBe("git notes");
    expect(denied("git notes")).toBeUndefined();
    expect(denied("git notes list")).toBeUndefined();
    expect(denied("git notes show HEAD")).toBeUndefined();
    expect(denied("git notes get-ref")).toBeUndefined();
    expect(denied("git reflog expire --all")).toBe("git reflog");
    expect(denied("git reflog delete HEAD@{1}")).toBe("git reflog");
    expect(denied("git reflog")).toBeUndefined();
    expect(denied("git reflog show main")).toBeUndefined();
    expect(denied("git symbolic-ref HEAD refs/heads/x")).toBe("git symbolic-ref");
    expect(denied("git symbolic-ref -d HEAD")).toBe("git symbolic-ref");
    expect(denied("git symbolic-ref --short HEAD")).toBeUndefined();
  });

  it("allows read-only and working-tree git", () => {
    for (const command of [
      "git status && git diff HEAD~1 && git log --oneline",
      "git show HEAD:file && git blame x && git rev-parse HEAD",
      "git add -A && git restore x && git mv a b && git rm c && git apply p",
      "git fetch origin && git ls-files && git grep commit",
      "git",
      "git --version",
    ]) {
      expect(denied(command), command).toBeUndefined();
    }
  });

  it("skips git's global options and their values", () => {
    expect(denied("git -C ../repo -c user.name=a --no-pager commit --amend")).toBe("git commit");
    expect(denied("git --git-dir .git --work-tree . push")).toBe("git push");
    expect(denied("git --git-dir=.git --namespace ns reset")).toBe("git reset");
    expect(denied("git -C commit status")).toBeUndefined();
  });

  it("reads the command words as a shell does (spec scenarios)", () => {
    expect(denied('echo "git commit -m x" && grep -r "git reset" .')).toBeUndefined();
    expect(
      denied("GIT_EDITOR=true env -u X /usr/bin/git -C ../repo -c user.name=a commit --amend"),
    ).toBe("git commit");
    expect(denied("bash -lc 'cd x && git stash'")).toBe("git stash");
    expect(denied("echo $(git stash create)")).toBe("git stash");
    expect(denied("git add -A && git commit -m wip")).toBe("git commit");
    expect(
      denied(
        "git branch -a && git branch --list 'v3/*' && git tag -l && git stash list && git notes show HEAD",
      ),
    ).toBeUndefined();
  });

  it("does not take another program named like git for git", () => {
    expect(denied("gitk --all && git-lfs push")).toBeUndefined();
    expect(denied("ls commit")).toBeUndefined();
  });

  it("denies checkout and switch with --track, which create a local branch", () => {
    expect(denied("git checkout -t origin/topic")).toBe("git checkout");
    expect(denied("git checkout --track origin/topic")).toBe("git checkout");
    expect(denied("git switch --track origin/topic")).toBe("git switch");
  });

  it("denies a fetch into a local ref and allows remote-tracking fetches", () => {
    expect(denied("git fetch origin main:main")).toBe("git fetch");
    expect(denied("git fetch origin +refs/heads/a:refs/heads/b")).toBe("git fetch");
    expect(denied("git fetch origin")).toBeUndefined();
    expect(denied("git fetch origin main")).toBeUndefined();
    expect(denied("git fetch origin main:refs/remotes/origin/main")).toBeUndefined();
  });

  it("allows help and a dry-run push", () => {
    expect(denied("git commit -h")).toBeUndefined();
    expect(denied("git rebase --help")).toBeUndefined();
    expect(denied("git push --dry-run origin HEAD")).toBeUndefined();
    expect(denied("git push -n")).toBeUndefined();
    expect(denied("git commit -mh")).toBe("git commit");
  });

  it("finds git behind the wrappers the review found", () => {
    expect(denied("bash -o pipefail -c 'git commit -m x'")).toBe("git commit");
    expect(denied("timeout 300 git push origin HEAD")).toBe("git push");
    expect(denied("env -S 'git commit -m x'")).toBe("git commit");
    expect(denied("bash <<'EOF'\ngit reset --hard\nEOF")).toBe("git reset");
    expect(denied("function c { git commit -m x; }; c")).toBe("git commit");
  });
});
