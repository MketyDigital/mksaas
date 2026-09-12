# Mkety Public App Shell Design

## Goal
Make the public Mkety website feel like part of the Mkety application while preserving the existing public content, AI runtime, payment boundaries, and release safety.

## Global shell
Every public page uses the shared `MketyPublicShell`, which will render:

1. a simplified top header for brand identity plus Sign In / Get Started,
2. page content,
3. the existing public footer,
4. a centered Mkety AI command surface,
5. a persistent bottom app dock.

The shell must reserve bottom space so the dock and AI surface never cover page content or footer links.

## Bottom app dock
The persistent dock appears on desktop and mobile. Primary items are exactly:

- Home -> `/`
- Platform -> `/platform`
- Academy -> `/academy`
- SolutionHub -> `/solutions`
- More -> opens a menu

`More` contains:

- Workspaces -> `/workspaces`
- Pricing -> `/pricing`
- Enterprise -> `/enterprise`
- Docs -> `/docs`
- About -> `/about`
- Contact -> `/contact`

The active route uses the Mkety violet/cyan emphasis. A route inside the More menu makes More visually active. The dock is rounded, elevated, translucent, keyboard accessible, and usable on narrow mobile screens without horizontal overflow.

## Mkety AI command surface
The current bottom-right floating chat widget becomes a centered app-like rectangle positioned immediately above the dock.

Closed state:
- wide rectangular command bar,
- Mkety AI identity and prompt text,
- opens the assistant without navigating away.

Open state:
- centered rectangular panel expanding upward,
- desktop width roughly 620-760px,
- mobile width nearly full viewport,
- existing history, New Chat, clear history, messages, suggestions, privacy copy, API contracts and memory behavior remain unchanged,
- no provider/model selector is exposed.

## Header
The header remains sticky but becomes visually lighter. It keeps the Mkety brand plus Sign In and Get Started. Primary discovery navigation moves to the bottom dock so the header does not duplicate the full public IA.

If header CMS links are rendered, they must be normalized and deduplicated by canonical destination and label before display. Duplicate CMS rows must never produce duplicate visible menu items.

## Navigation normalization
Create a small pure navigation helper that:
- trims labels and hrefs,
- compares internal hrefs without trailing slash duplication,
- deduplicates by canonical href first and label second,
- preserves first enabled item ordering,
- does not alter external URLs beyond whitespace normalization.

Use the helper anywhere the shared public header consumes published navigation.

## Accessibility
- dock uses a navigation landmark and descriptive accessible labels,
- More uses an accessible button/menu interaction,
- AI open/closed state retains `aria-expanded` and dialog semantics,
- all controls remain keyboard reachable,
- active navigation is exposed via `aria-current="page"` where applicable.

## Responsive behavior
Desktop: centered dock with labels and icons; AI panel above it.
Mobile: compact dock with five evenly distributed items; AI bar/panel leaves safe inset and dock clearance.

## Non-goals
No change to Public AI server runtime, memory schema, provider configuration, billing, NOWPayments, authentication, entitlement logic, public content schema, production DNS, or Cloudflare routing.

## Verification
Required checks:
- focused tests for dock route state and More contents,
- focused tests for navigation deduplication,
- existing MketyPublicAssistant tests updated for centered rectangular presentation while preserving functional behavior,
- shared shell test verifies dock and assistant are global,
- full test suite,
- type-check,
- lint,
- production build,
- vinext compatibility / Cloudflare package verification before release promotion.
