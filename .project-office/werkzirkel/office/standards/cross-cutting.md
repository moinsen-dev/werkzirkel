# Cross-cutting Concerns

_(Foundation-phase pillar 5 of 5. PRD §13.)_

Cross-cutting concerns are those that touch every subproject. The
Foundation-phase requires one accepted decision per concern below.
Materialise this pillar as a sub-subproject (`type: subproject`,
`foundation_scope: cross-cutting`) with one `decision`-child per
concern.

## Concerns

### 1. Authentication & Identity

- _Identity provider (own / SSO / OAuth). Token format. Session length._
- _Account-recovery flow._
- _Service-to-service auth (mTLS, signed JWTs, IAM)._
- _Anonymous / guest support._

### 2. Logging & Observability

- _Log format (structured JSON, plain, OpenTelemetry)._
- _Log destination (stdout, file, log aggregator)._
- _Log retention._
- _Tracing (yes/no, vendor)._
- _Metrics (counter / histogram cardinality budget)._
- _Health-check + readiness endpoints._

### 3. Error Handling

- _Public-facing error contract (status codes, error envelope shape)._
- _Internal exception hierarchy._
- _Crash-reporting destination._
- _What gets retried automatically and what surfaces a 500._

### 4. Internationalisation (i18n)

- _Languages supported at launch._
- _String-extraction tool._
- _Locale-fallback rule._
- _RTL support (yes/no)._
- _Date / number / currency formatting library._

## Decision

_(For each concern, link to the corresponding decision-child. Use
`po decide` and tag the decision with `foundation_scope:
cross-cutting` plus a `tag` for the specific concern, e.g.,
`tag: auth` or `tag: i18n`.)_

## Consequences

- _Cross-cutting decisions made here are binding for all subprojects.
  Subprojects deviate only via a logged exception decision._

## Review

_(When the cross-cutting baseline should be revisited.)_
