---
type: regex
target: trace
pattern: '^(?:(?!"name":"(?:Edit|Write)","input":\{(?:"replace_all":(?:true|false),)?"file_path":"[^"]*src/paginate\.js"|"name":"Bash","input":\{"command":"(?:[^"\\]|\\.)*?(?:>>?|tee|sed -i[^"]*)\s*src/paginate\.js)[\s\S])*?(?:ℹ fail [1-9]|AssertionError)'
---

A failing check (a test run or an assertion) was observed before the first change to the source file that holds the bug.
