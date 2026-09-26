## ADDED Requirements

### Requirement: Magic link login

The system SHALL log a user in with a single-use link valid for 15 minutes.

#### Scenario: reused link

- **WHEN** a link that was already used is opened
- **THEN** login is refused
