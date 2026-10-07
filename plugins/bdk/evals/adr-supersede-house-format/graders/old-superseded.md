---
type: regex
target: trace
pattern: '"name":"(?:Edit|Write)","input":\{(?:"replace_all":(?:true|false),)?"file_path":"[^"]*doc/decisions/0004-[^"]*"(?:[^}]|\\})*?[Ss]uperseded(?:[^"\\]|\\.)*?(?:0008|\b8\b)'
---

Record 4, which accepted polling, was changed to say it is superseded by record 8.
