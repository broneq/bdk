---
type: regex
target: trace
pattern: '"name":"(?:Edit|Write)","input":\{(?:"replace_all":(?:true|false),)?"file_path":"[^"]*\.test\.m?js"|"name":"Bash","input":\{"command":"(?:[^"\\]|\\.)*?(?:>>?|tee)\s*[^\s"\\]*\.test\.m?js'
---

The session wrote a test into a test file, so the reproduction stays as a regression test instead of a one-off script.
