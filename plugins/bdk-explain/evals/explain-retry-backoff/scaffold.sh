#!/usr/bin/env bash
set -euo pipefail
mkdir -p src
cat > package.json <<'JSON'
{
  "name": "sync",
  "private": true,
  "type": "module",
  "scripts": { "test": "node --test" }
}
JSON
printf 'node_modules/\n' > .gitignore
cat > src/retry.js <<'JS'
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Retries `fn` up to `attempts` times. The wait before retry n (1-based) is a random value
// between 0 and min(maxDelayMs, baseDelayMs * 2^(n-1)) ("full jitter"). A 4xx error is not
// retried.
export async function withRetry(fn, { attempts = 5, baseDelayMs = 200, maxDelayMs = 5000, random = Math.random } = {}) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn(attempt);
    } catch (error) {
      lastError = error;
      if (error.status >= 400 && error.status < 500) throw error;
      if (attempt === attempts) break;
      const cap = Math.min(maxDelayMs, baseDelayMs * 2 ** (attempt - 1));
      await sleep(Math.floor(random() * cap));
    }
  }
  throw lastError;
}
JS
cat > src/sync.js <<'JS'
import { withRetry } from "./retry.js";

export function pushChanges(client, changes) {
  return withRetry(() => client.post("/sync", changes), { attempts: 6, baseDelayMs: 250 });
}
JS
git init -q && git add -A && git -c user.name=eval -c user.email=eval@example.com commit -qm "sync with retries"
