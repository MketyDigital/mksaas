# Mkety Platform — Brand Guidelines

> This document defines active Mkety Platform visual defaults. Tenant customization may layer on top of these defaults where explicitly supported. For implementation tokens and component patterns, see [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) and [COMPONENTS_AND_STYLING.md](./COMPONENTS_AND_STYLING.md).

---

## 1. Brand Mark and Wordmark

Mkety branding must come from the shared brand components/assets used by the application. Do not substitute starter-template logos, generic initials, or third-party marks in Mkety-owned product surfaces.

The shared `AppLogo`/brand implementation is the product-facing source for the Mkety mark and wordmark treatment. If a surface needs a new logo presentation, extend the shared brand component rather than recreating the mark independently.

### 1.1 Logo Sizes

| Size | Typical usage |
| ---- | ------------- |
| Small (`sm`) | Collapsed navigation and compact product chrome |
| Medium (`md`) | Default header and navigation |
| Large (`lg`) | Landing, marketing, and prominent brand moments |

### 1.2 Clear Space and Integrity

- Keep sufficient clear space around the mark and wordmark.
- Do not stretch, rotate, skew, or recolor the official mark outside approved tokenized variants.
- Do not place the mark on visually noisy backgrounds without a readable backdrop.
- Do not mix Mkety marks with retired starter-template branding.

### 1.3 Tenant Custom Logos

Where tenant branding explicitly supports `logoUrl`, tenant-provided branding is scoped to that tenant experience and does not replace Mkety's platform identity globally.

Tenant logos should:

- be square or near-square where a compact mark is required;
- use transparent PNG/SVG when possible;
- be large enough for high-density displays;
- remain readable in supported light/dark surfaces.

---

## 2. Color System

Mkety UI should use semantic design tokens rather than component-local hard-coded brand colors.

### 2.1 Brand Roles

| Role | Usage |
| ---- | ----- |
| **Primary** | Main actions, links, focus treatment, selected states |
| **Secondary** | Supporting emphasis and secondary brand moments |
| **Accent** | Limited tertiary emphasis and differentiation |

Where tenant customization is supported, tenant values must flow through the same token system rather than bypassing it with arbitrary component-level styles.

### 2.2 Status Colors

| Status | Usage |
| ------ | ----- |
| Success | Completed, approved, positive |
| Warning | Needs attention, pending |
| Destructive | Errors, deletion, critical actions |
| Info | Informational and neutral guidance |

Status colors must preserve contrast and must not be repurposed as decorative brand colors.

---

## 3. Typography

### 3.1 Font

**DM Sans** is the current application typeface. Body and headings use the same family with hierarchy created through size, weight, spacing, and layout.

Weights used: Regular (400), Medium (500), Semibold (600), Bold (700).

### 3.2 Heading Style

Headings use semibold/bold weight with controlled negative letter spacing for a compact product feel.

### 3.3 Body Text

Body text uses regular/medium weights with readable line-height and standard tracking. Muted text must still satisfy accessibility contrast requirements.

---

## 4. Brand Emphasis

Use strong brand treatments sparingly. Primary actions should remain clear and solid rather than turning every surface into a marketing treatment.

### Appropriate emphasis

- official mark/wordmark;
- landing or hero moments;
- selected product/navigation states;
- small controlled accents that improve hierarchy.

### Avoid

- gradients on every card/button/icon;
- competing decorative effects;
- hard-coded brand colors inside feature components;
- unrelated third-party visual styles that weaken Mkety identity.

---

## 5. Visual Signature

| Element | Principle |
| ------- | --------- |
| Product navigation | Clear hierarchy and consistent workspace identity |
| Cards/panels | Structured elevation and restrained emphasis |
| Primary actions | Solid semantic primary treatment |
| Brand moments | Intentional, limited, recognizable Mkety presentation |
| Page canvas | Neutral enough for dense product work |

---

## 6. Do / Don't

### Do

- use shared Mkety brand components;
- use semantic tokens (`bg-primary`, `text-muted-foreground`, etc.);
- preserve hierarchy and sufficient whitespace;
- check WCAG contrast for text and interactive UI;
- keep tenant branding scoped to supported tenant surfaces;
- update shared brand primitives when a platform-wide change is intended.

### Don't

- restore starter-template logos/copy;
- hard-code one-off brand colors in feature components;
- apply gradients/effects indiscriminately;
- stretch, distort, or rebuild the brand mark ad hoc;
- let tenant branding override Mkety's global platform identity;
- mix deprecated design-system instructions with the current token system.

---

For implementation details, see [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) and [COMPONENTS_AND_STYLING.md](./COMPONENTS_AND_STYLING.md).
