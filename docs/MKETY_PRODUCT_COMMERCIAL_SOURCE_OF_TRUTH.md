# Mkety Product, Commercial, Domain and Public-Knowledge Source of Truth

**Status:** ACTIVE INTERNAL SOURCE OF TRUTH  
**Updated:** 2026-09-09

> Internal engineering/operations document. Repository names and implementation references in this file are not customer-facing content and must never be surfaced by the public website, public docs, or Public Mkety AI.

## 1. Purpose

This document prevents future Mkety work from drifting back to obsolete plan names, stale Academy/Trading prices, wrong product domains, or private engineering details in public content.

`AGENTS.md` remains the architectural authority. This document records the approved September 2026 commercial/product/domain contract for the public-site production milestone.

## 2. Current Mkety Platform commercial model

There is no Growth, Pro, or Business public Mkety plan. Those names are obsolete/incorrect for the current product and must not be reintroduced by migrations, CMS defaults, documentation, Public AI grounding, pricing pages, or future agents.

Current public commercial entries:

| Product              | Public price   | Commercial boundary                       |
| -------------------- | -------------- | ----------------------------------------- |
| Starter              | $5.99 / month  | Entry Mkety Platform plan                 |
| AI Workspace         | $16.99 / month | Individual self-service Workspace         |
| Automation Workspace | $16.99 / month | Individual self-service Workspace         |
| Deploy Workspace     | $9.99 / month  | Individual self-service Workspace         |
| Mkety One            | $49 / month    | Starter + AI + Automation + Deploy bundle |
| Enterprise           | Custom         | Specialized/custom delivery               |

Legacy current-site evidence also contains a `$490/year` Mkety One annual value. Do not publish or implement annual billing from that evidence alone unless the active billing/product contract explicitly adopts annual Mkety One in the current Platform implementation.

### Product/workspace positioning

- Starter is the entry plan.
- AI Workspace, Automation Workspace, and Deploy Workspace may be presented as individual self-service commercial options.
- Mkety One is the complete self-service bundle: Starter + AI Workspace + Automation Workspace + Deploy Workspace.
- Trading is not an ordinary self-service pricing-card entitlement. It is a specialized Custom / Enterprise product/workspace.
- Enterprise remains custom and may include specialized Trading infrastructure and other dedicated implementations.

## 3. Product domains and internal ownership references

### Mkety Academy

Customer production domain:

```text
https://academy.mkety.com
```

Internal owning repository:

```text
MketyDigital/mklms
```

Where the main Mkety public site needs to hand a visitor into Academy, prefer the Academy production domain. The main public site may provide an Academy overview, but current programmes, enrolment details and Academy pricing are owned by the Academy product.

Required Academy learning hubs for public overview where applicable:

1. Web & App Engineering
2. Trading Masterclass
3. Digital Funnel & Marketing
4. AI & Automation Lab
5. Certified Digital Skills

### Trading

Customer production domain:

```text
https://trade.mkety.com
```

Internal owning repository:

```text
MketyDigital/Trading
```

The spelling `trade.mkey.com` is incorrect. Always use `trade.mkety.com`.

Trading public positioning:

```text
Specialized Enterprise/Custom solution for trading automation, signal workflows,
integrations, execution infrastructure, monitoring, and deployments.
```

Commercial label:

```text
Custom / Enterprise
```

Where appropriate, the main Mkety public site should hand visitors to `https://trade.mkety.com` rather than pretending Trading is a normal self-service subscription card.

## 4. Legacy pricing warning

The legacy main Mkety repository is:

```text
MketyDigital/Mkety
```

It contains multiple generations of pricing content in the same codebase, including obsolete Pro/Business tables and older Workspace/Academy/Trading prices.

Rules:

- Use the current main-platform pricing-card evidence only for the six Platform commercial entries recorded in Section 2.
- Do not treat older Pro, Business, Growth, Academy, or Trading amounts from that repository as current product pricing.
- Academy pricing in the legacy main Mkety repository is outdated and non-authoritative.
- Trading pricing in the legacy main Mkety repository is outdated and non-authoritative.
- Current Academy pricing must come from the Academy product/approved Academy commercial source.
- Current Trading commercial terms must come from the Trading/Enterprise product/approved commercial source.

## 5. Public-content privacy boundary

The following may exist in private engineering documentation but must not be exposed as customer-facing website/docs/Public AI content unless a later approved public policy explicitly requires it:

- GitHub or repository names;
- organization/repository identifiers such as `MketyDigital`, `mksaas`, `mklms`, or private source locations;
- branches, pull requests, commits, internal implementation plans, debug notes, candidate/staging terminology;
- internal provider/runtime architecture or private origin hostnames;
- development-status wording such as `under development`, `WIP`, `candidate`, or `staging`;
- obsolete commercial plans/prices;
- private credentials, secrets, database details, internal account data, or protected operational details.

Public docs should explain customer-relevant products, capabilities, pricing, official product domains, safe usage and trust at an appropriate public level.

Public Mkety AI must ground itself only in approved public CMS/docs/pricing/product knowledge and must refuse to identify private source/repository/engineering systems.

## 6. Enterprise payment production contract

Public production requires both Enterprise payment gateways to be configured and safely verified:

### NOWPayments

Required runtime values:

```text
NOWPAYMENTS_API_KEY
NOWPAYMENTS_IPN_SECRET
```

The public candidate must verify the webhook secret/fail-closed runtime without creating a real invoice solely for CI. Browser return/success never confirms payment. Only a verified final provider event may confirm an Enterprise order.

### Selar

Required runtime value:

```text
SELAR_ENTERPRISE_CHECKOUT_URL
```

It must be HTTPS. Candidate verification may create a hosted checkout URL/order without completing payment and must prove the order remains pending/unconfirmed.

Both gateways are required for public cutover. `NOWPayments OR Selar` is no longer an acceptable promotion condition.

## 7. Cutover rule

No `mkety.com` production cutover until the exact candidate SHA proves all of the following:

- canonical six-entry pricing and Workspace contract in connected published CMS data;
- Academy and Trading product-domain handoffs;
- production-ready public pages and every published docs article;
- no internal engineering/repository/development leakage in public content;
- Public Mkety AI canonical pricing/domain grounding plus private-source refusal;
- Public AI memory and New Chat isolation;
- both NOWPayments and Selar readiness gates;
- Enterprise payments remain non-entitling/non-provisioning until verified payment confirmation;
- routing/DNS guardrails and unrelated Cloudflare resources remain preserved.
