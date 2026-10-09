---
type: regex
target: { source: file, path: .bdk/settings.yaml }
pattern: 'id:\s*node-test-changed\s*\n\s*command:\s*["'']?node --test \{files\}["'']?\s*\n(?:\s*paths:[^\n]*\n)?\s*when:\s*\[\s*part\s*\]'
---
