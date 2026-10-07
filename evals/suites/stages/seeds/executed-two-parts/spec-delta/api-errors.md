## Purpose

How an API error reaches the user: which response bodies count as problem details, and which message a load error shows.

## ADDED Requirements

### Requirement: Problem details body

`parseApiProblem` SHALL return a JSON response body as problem details only when it is an object with a string `title` or a numeric `status`, and undefined for any other JSON value.

#### Scenario: gateway body

- **WHEN** a 5xx response carries the JSON body `{"error":"upstream timeout"}`
- **THEN** `parseApiProblem` gives undefined, so the request fails as backend unavailable

#### Scenario: problem body

- **WHEN** a response carries a JSON body with a `title` and a `status`
- **THEN** `parseApiProblem` returns that body as problem details

#### Scenario: body that is not JSON

- **WHEN** a response carries a problem body with a content type that is not JSON
- **THEN** `parseApiProblem` gives undefined

### Requirement: Problem title in load errors

`createLoadError` SHALL use the trimmed problem title of an `ApiRequestError` as the load error message when the title is not blank, whatever the response status, and keep the error's message otherwise.

#### Scenario: title shown

- **WHEN** an `ApiRequestError` carries a problem with the title `' Not allowed '`
- **THEN** the load error message is `Not allowed`

#### Scenario: title of a 5xx problem

- **WHEN** an `ApiRequestError` of status 503 carries a problem with the title `Maintenance`
- **THEN** the load error message is `Maintenance`

#### Scenario: blank title

- **WHEN** an `ApiRequestError` carries a problem with a blank title
- **THEN** the load error keeps the error's message
