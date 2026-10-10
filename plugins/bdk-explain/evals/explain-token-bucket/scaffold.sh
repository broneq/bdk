#!/usr/bin/env bash
set -euo pipefail
mkdir -p src
cat > package.json <<'JSON'
{
  "name": "api",
  "private": true,
  "type": "module",
  "scripts": { "test": "node --test" }
}
JSON
printf 'node_modules/\n' > .gitignore
cat > src/rateLimiter.js <<'JS'
// Token bucket per client: holds at most `capacity` tokens, gains `refillPerSecond` tokens each
// second (in fractions, not whole steps), and a request takes one token or is refused.
export function createLimiter({ capacity = 10, refillPerSecond = 2, now = () => Date.now() } = {}) {
  const buckets = new Map();

  return function allow(clientId) {
    const t = now();
    const bucket = buckets.get(clientId) ?? { tokens: capacity, updatedAt: t };
    const elapsedSeconds = (t - bucket.updatedAt) / 1000;
    bucket.tokens = Math.min(capacity, bucket.tokens + elapsedSeconds * refillPerSecond);
    bucket.updatedAt = t;
    buckets.set(clientId, bucket);
    if (bucket.tokens < 1) return false;
    bucket.tokens -= 1;
    return true;
  };
}
JS
cat > src/server.js <<'JS'
import { createLimiter } from "./rateLimiter.js";

const allow = createLimiter({ capacity: 20, refillPerSecond: 5 });

export function handle(request) {
  if (!allow(request.apiKey)) return { status: 429, body: "Too Many Requests" };
  return { status: 200, body: "ok" };
}
JS
git init -q && git add -A && git -c user.name=eval -c user.email=eval@example.com commit -qm "api with rate limit"
