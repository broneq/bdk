---
type: regex
target: { source: file, path: .bdk/tmp/explain/checkout.html }
flags: i
pattern: '^(?![\s\S]*(?:<script[^>]*\ssrc\s*=|<link[^>]*stylesheet|@import|<img[^>]*\ssrc\s*=\s*["'']?https?:|fonts\.googleapis))[\s\S]*</html>'
---

The page loads nothing from outside the file: no script src, no stylesheet link, no @import, no remote image or web font.
