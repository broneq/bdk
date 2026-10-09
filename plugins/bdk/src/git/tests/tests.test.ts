import { describe, expect, it } from "vitest";

import { isTestFile } from "../domain/tests.ts";

// The test-file convention of spec `bdk-cli/git`, "Test files of a range".

describe("isTestFile", () => {
  it.each([
    "test/cli.test.js",
    "test/helpers/env.js",
    "tests/test_cli.py",
    "src/__tests__/old.js",
    "src/__mocks__/fs.js",
    "src/__snapshots__/app.test.ts.snap",
    "pkg/testdata/input.csv",
    "plugins/bdk/tests/git.test.ts",
    "src/parse.test.js",
    "src/App.spec.tsx",
    "pkg/parse_test.go",
    "spec/models/user_spec.rb",
    "app/test_models.py",
    "conftest.py",
    "app/src/test/java/LedgerTest.java",
    "src/LedgerTests.cs",
    "Tests/AppTests.swift",
    "lib/ParserTest.php",
    "src/main/kotlin/ReportTest.kt",
  ])("takes %s as a test file", (path) => {
    expect(isTestFile(path)).toBe(true);
  });

  it.each([
    "src/latest.js",
    "src/commands/test.ts",
    "spec/openapi.yaml",
    "src/Latest.java",
    "docs/testing.md",
    "fixtures/seed.json",
    "e2e/smoke.ts",
    "src/testing/setup.ts",
    "src/Test.java",
    "src/test_helpers.js",
    "contest.py",
    "Test/cli.js",
    "README.md",
    "package.json",
  ])("takes %s as no test file", (path) => {
    expect(isTestFile(path)).toBe(false);
  });
});
