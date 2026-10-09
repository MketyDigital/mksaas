# Mkety Mail — Product & Architecture Plan

## Product positioning

Mkety Mail is a business communication solution for small businesses, teams, solo operators, creators, service businesses, e-commerce businesses, agencies and developers.

It is not positioned as “another Gmail” or a generic mail-hosting provider. The promise is:

> Professional business email, customer updates, shared inboxes and automated business messages — without learning DNS, SMTP or email infrastructure.

Cloudflare remains the infrastructure layer. Mkety owns the customer experience, account model, billing, storage, business workflows, safety controls and integrations.

## Day-one customer promise

A nontechnical business owner should be able to:

1. Connect a domain.
2. Create addresses such as `hello@company.com`, `sales@company.com` and `support@company.com`.
3. Receive and reply to email inside Mkety.
4. Forward incoming business mail to an existing Gmail or another mailbox.
5. Add team members to shared inboxes.
6. Send customer/service updates to hundreds or low-thousands of existing customers.
7. Send automated transactional messages through API/SMTP.
8. See delivery, bounce, failure and complaint status without understanding email infrastructure.
9. Use common mail apps through Mkety mailbox access once the IMAP bridge is enabled for general availability.
10. Manage everything from one simple business dashboard.

Only Marketing Campaigns remain “Coming Soon”.

## Mkety's first-party address split

Mkety's platform mail follows an explicit split while the root domain uses Zoho for inbound MX:

- `hello@mkety.com` remains hosted in Zoho.
- `info@mkety.com`, `support@mkety.com`, and other configured Mkety root mailboxes are stored in the reserved Mkety Mail workspace.
- Cloudflare Email Sending may authenticate the root sender addresses after DNS verification, while root Zoho MX and DMARC stay unchanged.
- Zoho selectively forwards Mkety Mail recipients to exact Cloudflare ingress routes on `mail.mkety.com`; Mkety maps each route back to the root mailbox. No apex Email Routing or catch-all is enabled.

---

## Product scope

| Area | Day-one customer capability |
| --- | --- |
| **Professional Email** | `hello@company.com`, `sales@`, `support@`, aliases and catch-all addresses |
| **Inbox** | Receive, read, reply, forward, sent, drafts, archive, trash and search |
| **Shared Business Inbox** | Support/sales/order inboxes, team assignments, status, internal notes |
| **Customer Updates** | Send service/business updates to 100, 500, 1,000, 3,000 existing customers using queued one-recipient sends |
| **Transactional Email** | Receipts, OTPs, password resets, invoices, confirmations, alerts and business notifications |
| **Templates** | Saved branded messages for invoices, orders, reminders and customer updates |
| **Contacts** | Customers, tags, CSV import/export and segments |
| **Automation** | Auto-replies, routing, forwarding, filters and rules |
| **Developer API** | API keys, REST sending, webhooks and authenticated SMTP |
| **Analytics** | Delivered, deferred, bounced, failed, rejected, complained and suppression status |
| **Domains** | Guided domain setup plus SPF/DKIM/DMARC/MX health |
| **Storage** | R2-backed message bodies, raw messages and attachments |
| **External inboxes** | Forward incoming mail to Gmail or another destination address |
| **Mail apps** | IMAP bridge / authenticated SMTP for Apple Mail, Outlook, Gmail mobile, Thunderbird and other standard clients |
| **Marketing** | **Coming Soon** — newsletters, promotions, campaign automations and promotional broadcasts through a dedicated marketing engine |

---

## Infrastructure model

### Core services

- Cloudflare Email Routing for inbound email.
- Cloudflare Email Sending for transactional/business operational outbound email.
- Cloudflare Workers for inbound processing, APIs, routing and security.
- Cloudflare Queues for customer updates and asynchronous sending.
- R2 for raw message bodies, HTML/text bodies and attachments.
- D1/Postgres for tenant, mailbox, thread, message metadata, contacts, analytics and billing records.
- Cloudflare Event Subscriptions/webhooks for delivery lifecycle events where supported.
- Mkety billing/payment infrastructure for subscriptions and usage billing.

### High-level inbound flow

```
Sender
  ↓
Cloudflare MX / Email Routing
  ↓
Mkety Email Worker
  ↓
tenant + mailbox resolution
  ↓
spam/security checks
  ↓
store metadata in DB
store body/raw message/attachments in R2
  ↓
threading + shared inbox rules
  ↓
Mkety Inbox
  ↓
optional forwarding to Gmail / external destination
```

### High-level outbound flow

```
Mkety Webmail / API / SMTP
  ↓
Mkety authorization + quota + suppression checks
  ↓
Cloudflare Email Sending
  ↓
recipient mail server
  ↓
delivery/bounce/complaint events
  ↓
Mkety analytics + reputation controls
```

---

## Professional email and mailbox model

A tenant can own one or more verified domains.

Example:

```
company.com
├── hello@company.com
├── sales@company.com
├── support@company.com
├── billing@company.com
└── orders@company.com
```

Supported address types:

- Personal mailbox.
- Shared mailbox.
- Alias.
- Catch-all route.
- Forward-only address.
- Transactional sender identity.
- System/no-reply sender identity.

Each address can independently define:

- mailbox destination,
- forwarding destination,
- team access,
- default signature,
- auto-reply,
- routing rules,
- sender permissions.

---

## Inbox experience

Customer-facing folders:

- Inbox
- Starred
- Sent
- Drafts
- Archive
- Spam
- Trash

Core message capabilities:

- threading,
- read/unread,
- reply,
- reply all,
- forward,
- CC/BCC,
- attachments,
- HTML/plain text,
- signatures,
- search,
- labels/tags,
- pagination/infinite scrolling,
- attachment preview,
- save attachment to Mkety Media,
- message download as `.eml`,
- print-friendly view.

The customer should never see Cloudflare-specific implementation terminology.

---

## Shared business inboxes

Designed for:

- `support@`
- `sales@`
- `orders@`
- `billing@`

Capabilities:

- assign conversation to team member,
- status: new / open / pending / resolved,
- internal notes,
- tags,
- priority,
- collision warning when another teammate is replying,
- activity timeline,
- basic SLA/response-time analytics,
- shared signatures,
- role-based access.

This makes Mkety Mail useful as a business workflow tool rather than only a mailbox.

---

## Customer Updates — day one

Customer Updates are service/business communications to existing customers or recipients with a legitimate relationship to the business.

Examples:

- service changes,
- order updates,
- account notices,
- scheduled maintenance,
- event notices,
- membership information,
- invoice reminders,
- operational announcements.

Promotional newsletters, offers and marketing blasts remain under **Marketing — Coming Soon**.

### Sending model

Do not send 50 recipients in one message.

A customer update to 3,000 recipients becomes 3,000 individually queued messages:

```
Customer Update
  ↓
recipient segment
  ↓
Mkety Queue
  ↓
one recipient per message
  ↓
suppression + quota + rate checks
  ↓
Cloudflare Email Sending
```

Benefits:

- no recipient address exposure,
- personalized content,
- per-recipient delivery tracking,
- per-recipient bounce handling,
- complaint tracking,
- retry control,
- clean audit trail,
- safe throttling.

### Broadcast UX

```
Customer Update

Recipients
2,436 customers

Subject
[ Important update about your account ]

Message
[ Rich editor ]

Send
○ Now
○ Schedule

[ Send customer update ]
```

### Safety controls

- existing customers / legitimate contacts only,
- prohibit purchased/scraped lists,
- per-tenant daily quotas,
- per-domain warm-up,
- per-minute/hour throttles,
- bounce-rate monitoring,
- complaint-rate monitoring,
- automatic suppression,
- manual suppression,
- abuse score,
- send pause circuit breaker,
- audit logs,
- optional unsubscribe/opt-out controls where appropriate,
- configurable sender identity requirements.

Cloudflare account-level limits must be respected dynamically. Mkety should queue work according to current provider allowance instead of promising instant delivery of all recipients.

---

## Transactional email

Supported use cases:

- OTP / verification codes,
- password resets,
- payment receipts,
- order confirmations,
- booking confirmations,
- invoices,
- account alerts,
- security notices,
- platform notifications.

### REST API

Example conceptual endpoint:

```
POST /v1/mail/send
Authorization: Bearer mk_live_...
```

Payload:

```json
{
  "from": "orders@company.com",
  "to": ["customer@example.com"],
  "subject": "Your order is ready",
  "html": "<p>...</p>"
}
```

### API keys

- test/live distinction,
- scoped permissions,
- revocation,
- expiry,
- last-used time,
- IP restrictions optional,
- per-key usage analytics.

### Webhooks

Customer webhook events:

- delivered,
- deferred,
- bounced,
- failed,
- complained,
- rejected.

Support signed webhook delivery and retry.

---

## SMTP

Mkety should provide authenticated SMTP for customer applications and mail clients.

Conceptual endpoints:

```
smtp.mkety.com
TLS
authenticated Mkety mailbox/app credential
```

Users should never need Cloudflare credentials.

Mkety validates the user, sender identity, limits, suppressions and tenant policy, then relays through Cloudflare Email Sending.

---

## Mail apps

Mail apps are included as a core product goal, not a future “nice-to-have”.

Supported clients:

- Apple Mail,
- Outlook,
- Gmail mobile third-party account support,
- Thunderbird,
- standard IMAP/SMTP clients.

### IMAP bridge

Because Cloudflare is not a complete IMAP mailbox host, Mkety supplies the mailbox-access layer.

```
Mkety R2 + DB mailbox store
        ↓
imap.mkety.com
        ↓
Apple Mail / Outlook / Gmail mobile / Thunderbird
```

Outbound:

```
Mail app
   ↓
smtp.mkety.com
   ↓
Mkety SMTP gateway
   ↓
Cloudflare Email Sending
```

### Easy setup

Avoid exposing technical settings unless the user explicitly asks.

UI:

```
Use your email in another app

[ Add to iPhone ]
[ Connect Outlook ]
[ Use Gmail app ]
[ Thunderbird ]
[ Show manual settings ]
```

Where possible use:

- mail-client autodiscovery,
- Apple configuration profiles,
- standard autoconfiguration endpoints,
- generated app passwords,
- QR/deep links when supported by the target client.

Manual settings remain an advanced fallback.

---

## Existing Gmail / external inbox mode

For nontechnical customers who simply want business mail to arrive in the Gmail inbox they already use:

```
hello@company.com
     ↓
Cloudflare Email Routing
     ↓
owner@gmail.com
```

Onboarding:

```
Where should your business mail arrive?

[ owner@gmail.com ]

[ Connect inbox ]
```

Mkety creates the route and guides the destination verification.

This is separate from full mailbox mode.

### Modes offered to a customer

1. **Mkety Inbox** — recommended full business mailbox.
2. **Forward to my existing Gmail** — simplest.
3. **Use another mail app** — IMAP/SMTP.
4. **Google Workspace integration** — optional integration for businesses already using Workspace.

Do not design the product around Gmail consumer “Send mail as” because third-party send-as support is being retired by Google for consumer Gmail.

---

## Contacts

Capabilities:

- manual contacts,
- CSV import,
- CSV export,
- deduplication,
- tags,
- custom fields,
- companies,
- contact status,
- suppression state,
- segments,
- last contacted,
- last inbound message,
- source/import history.

Contacts can feed Customer Updates and shared inbox context.

---

## Templates

Template types:

- transactional,
- customer update,
- reply template,
- signature.

Features:

- brand logo,
- colors,
- reusable variables,
- preview desktop/mobile,
- plain-text fallback,
- version history,
- test send.

Examples:

- invoice,
- receipt,
- booking confirmation,
- password reset,
- delivery notice,
- customer update,
- support acknowledgment.

---

## Automation

Day-one simple automation:

- forward mail,
- auto-reply,
- route by recipient,
- route by sender,
- route by subject keyword,
- assign shared-inbox conversation,
- tag conversation,
- business-hours auto-response,
- suppress known invalid addresses,
- webhook on inbound message.

Later automation builder can become visual, but V1 should stay simple.

---

## Analytics and deliverability

Business dashboard:

- sent,
- delivered,
- deferred,
- bounced,
- failed,
- rejected,
- complained,
- delivery rate,
- bounce rate,
- complaint rate,
- top sending addresses,
- recent failures,
- suppressed recipients.

Individual message timeline:

```
Queued
→ Sent
→ Accepted
→ Delivered
```

or:

```
Queued
→ Sent
→ Bounced
→ Suppressed
```

Hide raw SMTP complexity by default, but allow advanced details in an expandable troubleshooting view.

---

## Suppressions

Central suppression types:

- hard bounce,
- complaint,
- manual block,
- customer opt-out,
- invalid address.

Before every outbound send:

```
recipient
  ↓
tenant suppression check
  ↓
platform suppression check
  ↓
provider/reputation check
  ↓
send or block
```

No customer should need to understand provider-specific suppression mechanics.

---

## Domain onboarding

Goal: a nontechnical business owner should see a guided setup, not DNS jargon.

Wizard:

```
Connect your domain

company.com

1. Domain found
2. Mail records connected
3. Sending identity verified
4. Protection enabled
5. Ready
```

Behind the scenes Mkety manages/checks:

- MX,
- SPF,
- DKIM,
- DMARC,
- Email Routing,
- sender verification,
- domain health.

Advanced DNS details can be available under “Technical details”.

For domains not yet using the required Cloudflare setup, present a guided nameserver/domain-connection flow.

---

## Storage architecture

Database metadata:

- tenant,
- domain,
- mailbox,
- aliases,
- users,
- conversations,
- message headers,
- participants,
- delivery state,
- read state,
- assignment,
- labels,
- contacts,
- templates,
- automation rules.

R2:

```
/mail/
  tenant-id/
    raw/
      message-id.eml
    bodies/
      message-id.html
      message-id.txt
    attachments/
      message-id/
        invoice.pdf
        image.jpg
```

Retention and storage quotas should be plan-controlled.

Potential integration:

```
Mail attachment
   ↓
Save to Mkety Media
```

---

## Plans, pricing, usage, limits and overage

Mkety Mail is a separately entitled Mkety product/workspace. It is not automatically included in Starter, AI Workspace, Automation Workspace, Deploy Workspace or Mkety One.

A normal Mkety tenant can subscribe to Mail as a separate workspace/add-on. Enterprise customers can receive Mail through an Enterprise order/contract. Existing Mkety identity, tenant membership, PBAC, Billing and shared payment settlement are reused.

### Public self-service plans

| Plan | Monthly price | Domains | Mailboxes | Team seats | Shared inboxes | Storage | Outbound messages / month | Customer Update deliveries / month | Max recipients per Customer Update |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Mail Starter | $4.99 | 1 | 3 | 3 | 1 | 5 GB | 2,000 | 500 | 500 |
| Mail Growth | $9.99 | 3 | 10 | 10 | 3 | 25 GB | 10,000 | 3,000 | 3,000 |
| Mail Business | $24.99 | 10 | 50 | 25 | 10 | 100 GB | 50,000 | 15,000 | 3,000 |
| Enterprise Mail | Custom | Custom | Custom | Custom | Custom | Custom | Custom | Custom | Contract/safety policy |

Self-service Mail uses the standard Mkety prepaid term ladder:

- 1 month: 0% discount;
- 3 months: 5%;
- 6 months: 10%;
- 12 months: 15%.

The discount applies to the fixed Mail subscription portion. It does not automatically discount prepaid capacity packs or negotiated Enterprise usage.

### Included product capability

All paid self-service Mail plans include the supported core product:

- professional mailboxes;
- aliases and forwarding;
- inbox/sent/drafts/archive/trash/starred;
- shared inbox workflows within plan limits;
- templates;
- contacts;
- Customer Updates within plan quota;
- transactional REST API;
- SMTP/app-password capability where production-certified;
- signed webhooks;
- delivery/bounce/complaint analytics;
- suppressions;
- domain onboarding;
- R2-backed message/attachment storage;
- warm-up/reputation protection.

Marketing campaigns remain Coming Soon and are not part of the current included sending allowance.

### Overage / extra capacity

Self-service Mail does not create surprise postpaid overage. When an included limit is exhausted, the operation fails closed until the tenant upgrades to a higher Mail plan or moves to agreed Enterprise capacity.

Prepaid capacity packs are a planned billing extension, not a launch feature. They must not be sold or advertised until a dedicated purchased-capacity ledger, verified checkout settlement, expiry/renewal policy, and quota reconciliation path are implemented and tested.

No commercial upgrade may bypass domain warm-up, complaint/bounce protection, recipient-source rules, provider/account limits, abuse controls or other safety ceilings.

### Usage visibility

Customer-facing Mail usage shows only commercial/product information relevant to that tenant, such as:

- current plan;
- included quota;
- used amount;
- remaining amount;
- plan renewal/billing term;
- upgrade path when a hard limit is reached;
- hard-limit/warm-up status;
- relevant sending/storage history.

Raw Cloudflare/provider cost, internal platform cost, global account capacity, other tenants, internal reputation scoring and operations-only telemetry are visible only to authorized Mkety platform/admin/ops surfaces.

### Enterprise Mail

Enterprise Mail is request/contract based and can include:

- custom domains/mailboxes/seats/storage;
- higher approved sending allowances;
- additional shared inboxes;
- dedicated or isolated sending arrangements where justified;
- assisted migration;
- custom retention/deletion requirements;
- private integrations;
- custom reporting/audit export;
- regional/dedicated infrastructure where technically appropriate;
- contractual SLA/support terms.

Enterprise Mail still uses Mkety tenant identity, Billing/Enterprise settlement, audited entitlements and the same safety/reputation boundaries unless the customer contract explicitly provisions isolated infrastructure.

Avoid pricing Mail purely by emails sent; the subscription monetizes the complete business communication workflow while usage ceilings protect deliverability and infrastructure.

---

## Abuse and platform protection

Email reputation is shared infrastructure and must be treated as a first-class product boundary.

Controls:

- tenant risk scoring,
- account age limits,
- sender/domain warm-up,
- velocity limits,
- bounce/complaint thresholds,
- automatic send suspension,
- manual review for suspicious volume,
- prohibited purchased lists,
- recipient source audit,
- rate limiting,
- attachment malware scanning where feasible,
- phishing/impersonation checks,
- domain ownership verification,
- API key rotation,
- abuse-report workflow.

A single bad tenant must not be able to damage the reputation of healthy businesses.

Long term, higher-volume or higher-risk tenants can be isolated into separate sending pools/providers.

---

## Customer experience principles

1. No Cloudflare terminology in the ordinary customer flow.
2. No API keys, SMTP hostnames or DNS records unless the customer explicitly opens advanced setup.
3. Always explain business outcomes, not infrastructure.
4. Every error should say what the user can do next.
5. Returning users resume where they stopped.
6. Setup progress is persistent.
7. Mailbox creation should take minutes, not hours.
8. Deliverability safety is automatic.
9. Business users should be able to use the product without technical staff.
10. Developers still get advanced API/SMTP/webhook controls when they need them.

---

## Marketing — Coming Soon

Marketing is the only major customer-facing mail category explicitly marked Coming Soon at launch.

Planned capabilities:

- newsletters,
- promotions,
- offers,
- marketing broadcasts,
- scheduled campaigns,
- campaign automation,
- advanced segmentation,
- A/B tests,
- marketing unsubscribe center,
- marketing engagement analytics.

Until Cloudflare officially supports marketing sending, Mkety should not disguise marketing mail as transactional traffic.

Future architecture:

```
Mkety Mail UI
   ↓
campaign classification
   ↓
dedicated marketing-capable ESP
   ↓
recipient
```

Customers still experience one Mkety product even if a separate provider handles marketing delivery underneath.

---

## Suggested V1 navigation

```
Mkety Mail

Home
Inbox
Shared Inboxes
Customer Updates
Contacts
Templates
Automation
Transactional
  ├── API Keys
  ├── SMTP
  ├── Webhooks
  └── Logs
Domains
Analytics
Settings
Marketing — Coming Soon
```

---

## Implementation order

### Foundation
- tenant/mail data model,
- domain onboarding,
- inbound Worker,
- R2 message storage,
- mailbox/address model,
- basic inbox.

### Core business mail
- compose/reply/forward,
- sent/drafts/archive/trash,
- aliases/catch-all,
- forwarding,
- signatures,
- attachments,
- search.

### Shared inbox
- team access,
- assignment,
- status,
- notes,
- tags.

### Transactional
- REST API,
- API keys,
- SMTP gateway,
- templates,
- delivery events,
- webhooks,
- suppressions.

### Customer Updates
- contacts,
- CSV import,
- segments,
- Queues,
- one-recipient send jobs,
- throttling,
- safety limits,
- progress/analytics.

### External clients
- IMAP bridge,
- app passwords,
- autodiscovery,
- Apple/Outlook/Gmail-mobile setup flows.

### Business polish
- usage/billing,
- operator tools,
- abuse controls,
- reputation dashboard,
- onboarding recovery,
- admin support tooling.

### Marketing
- Coming Soon surface only until a compliant marketing engine is integrated.

---

## Launch definition

Mkety Mail V1 is launch-ready when a small-business owner can, without technical help:

1. Connect a domain.
2. Create a professional address.
3. Receive mail.
4. Reply/send mail.
5. Add a teammate to a shared inbox.
6. Forward mail to an existing Gmail account if desired.
7. Connect a common mail app using a guided flow.
8. Import customers.
9. Send a safe Customer Update to an approved customer list.
10. Send transactional mail through API/SMTP.
11. See delivery/bounce status.
12. Understand usage and billing.

Marketing remains visibly labelled **Coming Soon** and is not routed through Cloudflare transactional sending.
