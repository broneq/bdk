---
schema: 1
id: "02"
title: Gateway errors
depends-on: []
---

parseApiProblem in src/api/http.ts accepts a JSON body as problem details only when it has a title or a status, so a 5xx with another JSON body is backend-unavailable.
