---
name: api-design
description: HTTP API design choices - resource naming, the status code per outcome, problem+json errors, cursor pagination, idempotency keys and additive versioning. Use when designing or reviewing a REST endpoint, an OpenAPI document or an API contract.
license: MIT
---

# HTTP API design

An API is a contract that outlives its first client. These choices make every endpoint of an API behave the same way, so a client learns the rules once. Apply them to every endpoint you design or review, then check the result against the checklist at the end.

## Resources and paths

- Name collections with plural nouns: `/orders`, `/orders/{orderId}/lines`. No verbs in paths: `POST /orders`, not `/createOrder`.
- Nest one level at most, and only for ownership. `/orders/{orderId}/lines` is fine; `/customers/{id}/orders/{id}/lines/{id}` is not, so give lines their own top-level path when clients address them directly.
- An action that is not create, read, update or delete becomes a sub-resource with `POST`: `POST /orders/{orderId}/cancellation`.
- Path segments are `kebab-case`; JSON fields use one casing across the whole API, `camelCase` unless the API already uses another.
- Ids are opaque strings to the client. Never expose a sequential database id that leaks volume or invites guessing.

## Methods and status codes

| Outcome                                                                        | Method                                      | Status                      | Body and headers                               |
| ------------------------------------------------------------------------------ | ------------------------------------------- | --------------------------- | ---------------------------------------------- |
| Created                                                                        | `POST`                                      | `201 Created`               | the resource; `Location: /orders/{id}`         |
| Accepted for later processing                                                  | `POST`                                      | `202 Accepted`              | a status resource; `Location` of that resource |
| Read                                                                           | `GET`                                       | `200 OK`                    | the resource                                   |
| Full replace                                                                   | `PUT`                                       | `200 OK`                    | the resource                                   |
| Partial update                                                                 | `PATCH` with `application/merge-patch+json` | `200 OK`                    | the resource                                   |
| Deleted                                                                        | `DELETE`                                    | `204 No Content`            | none                                           |
| Malformed request: bad JSON, wrong type                                        | any                                         | `400 Bad Request`           | problem                                        |
| Not authenticated                                                              | any                                         | `401 Unauthorized`          | problem; `WWW-Authenticate`                    |
| Authenticated but not allowed                                                  | any                                         | `403 Forbidden`             | problem                                        |
| Unknown resource, or one the caller may not know exists                        | any                                         | `404 Not Found`             | problem                                        |
| Conflicts with the current state: duplicate, wrong version, invalid transition | any                                         | `409 Conflict`              | problem                                        |
| Well-formed but fails a business rule or field validation                      | any                                         | `422 Unprocessable Content` | problem with `errors`                          |
| Precondition failed: stale `If-Match`                                          | `PUT`, `PATCH`, `DELETE`                    | `412 Precondition Failed`   | problem                                        |
| Rate limited                                                                   | any                                         | `429 Too Many Requests`     | problem; `Retry-After`                         |

Never answer an error with `200` and an error flag in the body. Never use `500` for a client mistake.

## Errors: problem details

Every error body is `application/problem+json` (RFC 9457):

```json
{
  "type": "https://api.example.com/problems/insufficient-stock",
  "title": "Insufficient stock",
  "status": 422,
  "detail": "Only 2 units of SKU-123 are available.",
  "instance": "/orders/req-7f3a",
  "errors": [{ "pointer": "/lines/0/quantity", "detail": "must be at most 2" }]
}
```

- `type` is a stable URI per error kind; clients branch on it, never on `title` or `detail`.
- Field-level problems go in `errors`, each with a JSON Pointer to the field.
- No stack traces, SQL or internal names in any field.

## Pagination

Use cursor pagination for every collection:

- Request: `GET /orders?limit=50&cursor=<opaque>`. `limit` has a default and a maximum.
- Response: `{ "items": [...], "nextCursor": "<opaque>" }`; `nextCursor` is absent or `null` on the last page.
- The cursor is opaque to the client: an encoded position, never a page number.
- Order by a stable unique key (creation time plus id), so inserts during paging neither skip nor repeat items.

Offset pagination (`?page=3`) is acceptable only for small, rarely changing collections that need "jump to page N".

## Safe retries

- `GET`, `PUT` and `DELETE` are idempotent by definition; keep them so.
- Every `POST` that creates something or moves money accepts an `Idempotency-Key` request header. The server stores the key with the response for at least 24 hours and returns the stored response for a repeated key. The same key with a different body is `422`.
- Use optimistic concurrency for updates: `ETag` on reads, `If-Match` required on `PUT` and `PATCH`, `412` on a mismatch.

## Evolution

- Additive changes only within a version: new optional request fields, new response fields, new endpoints, new enum values that clients were told to tolerate.
- Removing or renaming a field, making an optional field required, or changing a type or a status code is a breaking change.
- Mark what will go with the `Deprecation` and `Sunset` headers and in the description, and keep it for an announced period.
- Put the major version in the path (`/v1/`) only once, and bump it only for breaking changes that cannot be avoided.

## Checklist

- [ ] Plural nouns, no verbs in paths, one nesting level at most
- [ ] Every operation lists each status from the table it can return
- [ ] `201` with `Location` for creation, `204` for deletion
- [ ] Every error is `application/problem+json` with a stable `type`
- [ ] Every collection is cursor-paginated with `limit` and `nextCursor`
- [ ] Every creating `POST` accepts `Idempotency-Key`
- [ ] Updates use `ETag` and `If-Match`
- [ ] No breaking change inside a version
