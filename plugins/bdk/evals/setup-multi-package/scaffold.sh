#!/usr/bin/env bash
# A repository of two packages with one commit: api/ (FastAPI, uv, pytest, ruff) and web/ (Vite + React, pnpm, vitest, eslint).
set -euo pipefail

cat > README.md <<'MD'
# shelf

A reading list. `api/` serves it, `web/` shows it.
MD

mkdir -p api/app api/tests web/src

cat > api/pyproject.toml <<'TOML'
[project]
name = "shelf-api"
version = "0.1.0"
requires-python = ">=3.12"
dependencies = ["fastapi>=0.115"]

[dependency-groups]
dev = ["pytest>=8.3", "ruff>=0.8"]

[tool.ruff]
line-length = 100
TOML
echo "version = 1" > api/uv.lock
cat > api/app/__init__.py <<'PY'
PY
cat > api/app/books.py <<'PY'
def unread(books: list[dict]) -> list[dict]:
    return [b for b in books if not b["read"]]
PY
cat > api/tests/test_books.py <<'PY'
from app.books import unread


def test_unread_skips_read_books():
    assert unread([{"read": True}, {"read": False}]) == [{"read": False}]
PY

cat > web/package.json <<'JSON'
{
  "name": "shelf-web",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "test": "vitest run",
    "lint": "eslint ."
  },
  "dependencies": { "react": "^19.1.0", "react-dom": "^19.1.0" },
  "devDependencies": { "@vitejs/plugin-react": "^5.0.0", "eslint": "^9.30.0", "vite": "^7.1.0", "vitest": "^3.2.0" }
}
JSON
cat > web/pnpm-lock.yaml <<'YAML'
lockfileVersion: '9.0'
YAML
cat > web/eslint.config.js <<'JS'
export default [{ files: ["src/**/*.{ts,tsx}"], rules: {} }];
JS
cat > web/src/count.ts <<'TS'
export const count = (xs: unknown[]): number => xs.length;
TS
cat > web/src/count.test.ts <<'TS'
import { expect, test } from "vitest";
import { count } from "./count";

test("counts", () => {
  expect(count([1, 2])).toBe(2);
});
TS

git init --quiet --initial-branch=main
git add .
git -c user.name="BDK eval" -c user.email="eval@example.invalid" commit --quiet -m "feat: shelf"
