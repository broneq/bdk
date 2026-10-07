---
type: regex
target: trace
pattern: '^(?:(?!"name":"(?:Edit|Write)","input":\{(?:"replace_all":(?:true|false),)?"file_path":"[^"]*src/userLabel\.js"|"name":"Bash","input":\{"command":"(?:[^"\\]|\\.)*?(?:>>?|tee|sed -i[^"]*)\s*src/userLabel\.js)[\s\S])*?(?:"name":"(?:Edit|Write)","input":\{(?:"replace_all":(?:true|false),)?"file_path":"[^"]*\.test\.m?js"|"name":"Bash","input":\{"command":"(?:[^"\\]|\\.)*?(?:>>?|tee)\s*[^\s"\\]*\.test\.m?js)'
---

Tests that pin the current behaviour were written before the first change to the code under refactoring.
