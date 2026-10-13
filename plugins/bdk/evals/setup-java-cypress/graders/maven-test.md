---
type: regex
target: { source: file, path: .bdk/settings.yaml }
flags: m
pattern: '^\s*command:\s*["'']?(?:\./mvnw|mvn)\b[^\n]*\btest\b'
---
