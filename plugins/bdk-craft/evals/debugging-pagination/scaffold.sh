#!/usr/bin/env bash
set -euo pipefail
mkdir -p src
cat > package.json <<'JSON'
{
  "name": "shop",
  "private": true,
  "type": "module",
  "scripts": { "test": "node --test" }
}
JSON
cat > src/paginate.js <<'JS'
// Splits a list into pages for the catalog. Pages are numbered from 1.
export function page(items, n, size = 20) {
  const from = (n - 1) * size;
  return {
    items: items.slice(from, from + size - 1),
    hasMore: from + size <= items.length,
  };
}
JS
cat > src/search.js <<'JS'
// Search results for the header search box.
export function searchResults(products, query, offset = 0, limit = 10) {
  const hits = products.filter((p) => p.name.toLowerCase().includes(query.toLowerCase()));
  return { hits: hits.slice(offset, offset + limit - 1), total: hits.length };
}
JS
cat > src/paginate.test.js <<'JS'
import assert from "node:assert/strict";
import { test } from "node:test";
import { page } from "./paginate.js";

test("a short list fits on the first page", () => {
  const result = page(["a", "b", "c"], 1);
  assert.deepEqual(result.items, ["a", "b", "c"]);
  assert.equal(result.hasMore, false);
});
JS
git init -q && git add -A && git -c user.name=eval -c user.email=eval@example.com commit -qm "catalog, cart and invoices"
