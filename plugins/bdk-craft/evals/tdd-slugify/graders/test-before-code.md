---
type: regex
target: trace
pattern: '^(?:(?!"name":"(?:Edit|Write)","input":\{(?:"replace_all":(?:true|false),)?"file_path":"[^"]*src/slugify\.m?js"|"name":"Bash","input":\{"command":"(?:[^"\\]|\\.)*?(?:>>?|tee|sed -i[^"]*)\s*src/slugify\.m?js)[\s\S])*?(?:"name":"(?:Edit|Write)","input":\{(?:"replace_all":(?:true|false),)?"file_path":"[^"]*\.test\.m?js"|"name":"Bash","input":\{"command":"(?:[^"\\]|\\.)*?(?:>>?|tee)\s*[^\s"\\]*\.test\.m?js)'
---

A test file was written before the implementation file.
