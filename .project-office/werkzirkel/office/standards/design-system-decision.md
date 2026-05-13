# Design System / UI Language Decision

_(Foundation-phase pillar 4 of 5. PRD §13.)_

> **Skip clause:** If this project has no rendered UI surface (pure
> CLI / pure backend / library), set `bypass-foundation: design-system`
> in the project frontmatter and document the reason here briefly. The
> Foundation-gate accepts the bypass and surfaces it as a low-severity
> note (not a bottleneck).

## Audience and voice

- **Audience:** _(Who uses this? Their context, their device, their
  attention budget.)_
- **Voice:** _(One adjective + one anti-adjective. e.g., "Direct, not
  cute." or "Calm, not corporate.")_
- **Tone in copy:** _(Headline tone, error tone, success tone — short
  examples.)_

## Tokens

| Category | Choice |
|---|---|
| Font family — body | _…_ |
| Font family — heading | _…_ |
| Type scale | _e.g., 12 / 14 / 16 / 20 / 28 / 40_ |
| Color — surface | _…_ |
| Color — ink | _…_ |
| Color — accent | _…_ |
| Color — danger | _…_ |
| Spacing scale | _e.g., 4 / 8 / 12 / 16 / 24 / 40 / 64_ |
| Border radius | _e.g., 4 / 8 / 16_ |
| Shadow scale | _e.g., none, low, mid, high_ |

## Components

- **Button:** _states (default, hover, active, disabled), variants
  (primary, secondary, danger)_
- **Input:** _label position, error state, helper text rule_
- **Modal / dialog:** _sizing rule, dismiss behaviour_
- **Toast / notification:** _placement, persistence rule_
- **Table:** _row hover, sort affordance, empty state_
- _…(extend as needed; keep the list short)_

## Layout grid

- _Container max-width, gutter, breakpoints._

## Decision

_(One paragraph: what's the design philosophy? Reference: minimalist?
Brutalist? Editorial? Material? — and why this fits the project
audience and voice.)_

## Consequences

- _What we will NOT do (e.g., custom illustrations, animation library)._
- _Where we'll need to deviate per surface, and why._

## Review

_(When the design system should be revisited.)_
