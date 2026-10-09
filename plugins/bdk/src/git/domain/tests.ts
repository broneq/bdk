// The test-file convention of a range (spec `bdk-cli/git`, "Test files of a range"; design D2 of
// the Change v3-264). Conservative on purpose: a product file taken for a test file lets a
// review round skip a needed E2E check, a missed test file only costs one E2E run.

/** Directory segments that hold only tests, in any position. */
const TEST_DIRS = new Set(["test", "tests", "__tests__", "__mocks__", "__snapshots__", "testdata"]);

/** File names that are tests in the common ecosystems. */
const TEST_NAMES = [
  /^.+\.(?:test|spec)\..+$/,
  /^.+_(?:test|spec)\..+$/,
  /^test_.+\.py$/,
  /^conftest\.py$/,
  /^.+Tests?\.(?:java|kt|scala|groovy|cs|php|swift)$/,
];

/** Whether a repository-relative path is a test file, read from the path alone. */
export function isTestFile(path: string): boolean {
  const segments = path.split("/");
  const name = segments.pop() ?? "";
  return segments.some((dir) => TEST_DIRS.has(dir)) || TEST_NAMES.some((re) => re.test(name));
}
