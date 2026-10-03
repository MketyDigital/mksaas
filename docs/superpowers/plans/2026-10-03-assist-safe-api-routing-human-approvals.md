# Mkety Assist — Safe Control-Plane Extensions Plan

Date: 2026-10-03  
Status: implementation staged in draft PR #335; changes are additive and remain unmerged/undeployed. This plan document does not change runtime, database, routing, billing, or production behavior.

## Goal

Add three operator/customer capabilities without disturbing the already-live Assist product:

1. safer operator switching of primary and fallback model targets;
2. general-purpose Mkety model API keys that can be used from arbitrary external systems without requiring a stored Assist assistant prompt;
3. durable human verification / approval / reply workflows delivered through the owner's linked Telegram identity, including ordinary Telegram bots that are not Telegram Business / Secretary Mode.

The implementation must preserve all current production invariants: tenant isolation, existing assistant behavior, deterministic model fallback, MKredit reservation/settlement, provider-cost journaling, idempotency, human takeover, current Telegram Business support, ordinary bot support, and existing recovery linking.

---

## Current production primitives we should reuse

The current code already provides most of the hard infrastructure:

- `/v1/chat/completions` is OpenAI-compatible.
- API keys are customer-scoped, hashed at rest, revocable, expirable, rate-limited, and currently carry the `inference` scope.
- Current API calls use the same model router, credit reservation, provider-attempt settlement journal, provider-cost accounting, idempotency handling, and MKredit balance as normal Assist inference.
- Current API requests always resolve an Assist `assistant_id` and inject that assistant's published business instructions.
- Model routes already support ordered targets; position 0 is primary and later positions are fallbacks.
- The Ops UI already edits the ordered target chain, but does not provide a convenient explicit reorder / "make primary" interaction.
- Human handoff already exists and pauses automation for a conversation.
- Owners/admins can already reply to an open handoff from the portal.
- Telegram-linked owners already receive selected owner alerts using the same assistant bot used to establish the recovery link.
- Recovery linking records both the Telegram user identity and, when applicable, the assistant bot through which that identity was linked.
- Existing Telegram delivery code supports both ordinary bot chats and Telegram Business chats by making `business_connection_id` optional.
- Reminder failure and handoff notification plumbing already exists.

These should be extended rather than duplicated.

---


# 0. Hard product boundary — standalone Assist only

This plan is exclusively for the standalone Mkety Assist product.

## Allowed implementation scope

Primary implementation paths:

- `customer-apps/assist/**`
- Assist-specific migrations owned by `customer-apps/assist`
- Assist-specific tests under `customer-apps/assist`
- Assist-specific GitHub workflows such as `.github/workflows/mkety-assist-*.yml`
- Assist-specific documentation, plans and handoffs

## Out of scope

Do **not** mix these features into the main MkSaaS / broader Mkety application, shared customer product flows, or unrelated services.

Do not modify shared/core MkSaaS infrastructure merely for convenience.

If a future implementation appears to require a shared component outside the standalone Assist boundary:

1. stop;
2. document the dependency and why Assist cannot contain it locally;
3. assess impact on the main MkSaaS/Mkety system;
4. require separate review/approval before changing that shared component;
5. keep the Assist feature disabled until that dependency is safely resolved.

A same-repository location does not mean the products should share runtime behavior.

The standalone Assist deployment, data model, feature flags and customer behavior remain independently controlled.

## Live-production protection rule

The existing live Assist product is the baseline that must continue working.

Every new capability in this plan is additive and opt-in.

Existing customers must retain current behavior unless the specific new feature is explicitly enabled.

Implementation must avoid:

- destructive schema migrations;
- renaming/removing current production fields during rollout;
- replacing working routing, billing, Telegram, handoff or recovery paths;
- silently converting existing API keys;
- silently enabling Human Operations or approvals;
- changing existing assistant prompts or customer-visible behavior as a migration side effect;
- direct production experimentation in live customer conversations;
- synthetic approval/handoff messages in real customer threads;
- direct pushes to production for feature work.

Changes should be developed on isolated branches, covered by focused regression tests, reviewed through PRs, and deployed through the existing Assist deployment workflow only after exact-head checks pass.

Rollback should normally be accomplished by feature-disable/revert while preserving historical ledger, settlement, audit and approval records.


# 1. Safe primary / fallback switching in Ops

## Current behavior

Each model alias has an ordered provider target chain:

- position 0 = Primary
- position 1 = Fallback 1
- position 2 = Fallback 2
- etc.

Targets are tried deterministically top-to-bottom. Disabled targets are skipped.

The route editor already publishes the whole ordered target array, so the safest change is UI-only: reorder that array before using the existing publish endpoint.

## Proposed UI additions

Inside **Models & Rates → Edit → Ordered provider chain**, add:

- **Make primary**
- **Move up**
- **Move down**
- existing enable/disable remains
- existing remove fallback remains

Before publish, show a read-only confirmation:

```
Current
Azure / model-A
→ Workers AI / model-B
→ OpenAI / model-C

After publish
Workers AI / model-B
→ Azure / model-A
→ OpenAI / model-C
```

Publish only when the operator explicitly presses **Publish new route order**.

## Safety requirements

Do not add a second route mutation backend.

Use the existing model-route PATCH endpoint and current validation.

Before accepting a publish:

- there must be at least one target;
- an active alias must retain at least one enabled and eligible target;
- connection/model/provider fields must remain valid;
- capability/readiness checks remain authoritative;
- target-specific pricing remains attached to the exact target moved;
- reasoning capability metadata moves with its target;
- customer overrides remain separate from global routes;
- BYOK fallback policy must not be altered by reorder;
- strict reasoning fallback behavior must not be silently weakened;
- route changes must be audit logged with before/after ordered target IDs/providers/models;
- no live target changes occur while the operator is merely rearranging the UI.

This makes primary switching an atomic route publication rather than several partial updates.

---

# 2. General-purpose Mkety API keys

## User problem

A business may want Mkety inference in an unrelated system that already owns its prompts/instructions—for example its own SaaS, workflow engine, CRM, agent framework, automation server, or internal application.

Requiring that call to select an Assist assistant is unnecessary in that case because the external application already supplies its own system/developer/user messages.

The desired experience is similar to obtaining an OpenAI/Anthropic/Gemini key:

- create a key;
- configure one compatible base URL;
- send a normal model request;
- choose an exposed Mkety model alias;
- usage is charged to that customer's MKredit balance.

## Important compatibility decision

Do **not** change existing assistant API keys.

Introduce an explicit key mode:

### A. Assistant API key — existing behavior

- optionally locked to one assistant;
- otherwise caller supplies `assistant_id`;
- Assist injects the assistant's published business instructions;
- assistant reasoning policy remains authoritative;
- existing endpoint/behavior remains unchanged.

### B. Raw model API key — new behavior

- no assistant required;
- no stored assistant prompt is injected;
- caller supplies all application instructions/messages;
- only Mkety platform safety/security envelope is added;
- caller chooses from customer-permitted Mkety aliases such as `mkety-fast`, `mkety-smart`, `mkety-reasoning`, etc.;
- same MKredit ledger, reservation, provider journal, fallback routing and commercial policy apply.

This should be an additive mode, never a reinterpretation of existing keys.

## Proposed key data

Extend the existing API-key record additively, for example:

- `mode TEXT NOT NULL DEFAULT 'assistant'`
  - `assistant`
  - `raw_model`
- optionally `allowed_model_aliases_json TEXT NULL`
- keep existing `assistant_id`, scopes, token hash, expiry, status and rate limit.

Existing rows automatically remain `assistant` keys.

## Proposed portal UI

**API Access → Create API key**

Choose:

**Use an Assist assistant**
- select one assistant, or allow request-time assistant selection.

**Use Mkety as a model API**
- no assistant;
- optionally restrict models;
- show base URL and examples.

Clearly display that a raw-model key permits the external application to control prompts and should be treated as a high-value credential.

## API compatibility

Keep:

`POST /v1/chat/completions`

For raw-model keys:

- `assistant_id` is not required;
- `model` is required and must be an allowed Mkety alias;
- use customer/global route resolution exactly as today;
- do not load `assistant_prompt_versions`;
- do not inherit assistant tools, knowledge, memory or channel behavior;
- do not use an assistant ID as the billing identity.

### Billing identity

The current reservation/settlement helpers are assistant-oriented. Do not fake an assistant.

Introduce a neutral billable workload identity such as:

- `workload_type = 'assistant' | 'api'`
- `workload_id = assistant_id | api_key_id`

or a dedicated API workload record.

All ledger/journal rows must remain customer-scoped.

This prevents a raw API request from being incorrectly attributed to an arbitrary assistant while preserving all commercial accounting.

## Model names

Do not expose provider credentials or force the customer to know whether the current upstream is Azure, Workers AI, OpenAI, etc.

Expose stable Mkety aliases.

That lets Ops change Azure → Workers AI → another provider without breaking customer integrations.

Provider routing remains an internal Mkety control-plane concern.

## OpenAI compatibility

First milestone should preserve the already-working OpenAI-compatible request/response shape.

Later compatibility layers may add additional endpoint dialects if demand exists, but they should translate into the same internal request object rather than maintain separate billing/routing implementations.

Recommended first milestone:

- `POST /v1/chat/completions`
- Bearer `mka_...`
- `model: "mkety-smart"`
- OpenAI-style `messages`
- temperature / max token controls within Mkety limits
- idempotency key
- standard OpenAI-style error envelope

Do not promise unsupported OpenAI endpoints merely because the base URL looks OpenAI-compatible.

## Raw API reasoning control

A raw key should not gain unrestricted ability to force arbitrary provider-specific reasoning parameters.

Use stable Mkety values only, for example:

- `standard`
- `high`
- `maximum`

Then pass through the existing provider reasoning-capability planner.

If a selected route cannot satisfy a requested level:

- obey the key/customer's configured fallback policy;
- never silently weaken a strict request;
- if lower-effort fallback is explicitly allowed, existing fallback planning can continue.

## Security

Raw-model keys must remain:

- hashed at rest;
- shown only once;
- customer scoped;
- independently revocable;
- independently expirable;
- rate limited;
- optional model allowlist;
- audited;
- excluded from portal/session privileges;
- unable to access customer knowledge, conversations, team, billing admin or assistant secrets.

No provider key is ever returned to the customer.

## Billing and failure safety

Raw API calls must use the same proven flow:

1. validate key + tenant + model policy;
2. estimate usage;
3. reserve MKredit;
4. make journaled provider attempt;
5. record successful provider result before unsafe downstream transitions;
6. settle exact served target plus any evidenced provider fallback cost;
7. release unused reservation;
8. never regenerate after an unknown provider outcome until reconciliation determines it is safe.

No alternative "simple API billing" path should be added.

---

# 3. Owner verification / approval / human decision flow

## User problem

Assistants sometimes reach a point that must not be decided by AI alone:

- customer says a payment was made and submits proof;
- customer says they signed up through a partner;
- refund/discount/exception needs owner authorization;
- identity or entitlement needs human verification;
- assistant is unsure and requires a human answer;
- a workflow wants explicit owner approval/rejection before continuing.

The owner should be able to receive the request in Telegram, inspect it, and:

- Approve
- Reject
- Reply
- Open in portal

The same mechanism should work whether the customer-facing assistant uses:

- Telegram Business / Secretary Mode; or
- an ordinary Telegram bot.

## Architectural rule

Telegram is a delivery/action surface, **not the source of truth**.

The approval request must first be persisted in D1.

This prevents duplicate updates, webhook retries, deleted Telegram messages, Telegram outages, or multiple owner devices from creating inconsistent state.

## New durable object: approval request

Add an additive table such as `human_approval_requests`:

- `id`
- `customer_id`
- `assistant_id`
- `conversation_id`
- `requested_by`
- `kind`
  - `verify_payment`
  - `verify_partner_signup`
  - `approve_action`
  - `human_answer`
  - `custom`
- `question`
- `summary`
- `evidence_json`
- `status`
  - `pending`
  - `approved`
  - `rejected`
  - `answered`
  - `expired`
  - `cancelled`
- `decision_text`
- `decided_by_user_id`
- `created_at`
- `decided_at`
- `expires_at`
- `idempotency_key`
- `version`

Every lookup/update must include customer + assistant scope where applicable.

Use conditional status updates so only one terminal decision wins.

## Evidence

For payment proof or screenshots, reuse existing conversation media references rather than copying raw media unnecessarily.

The approval payload should refer to tenant-scoped media/message IDs.

Telegram notifications may include a safe preview or message summary, but the authoritative evidence should remain in the portal.

## How an approval is created

Do not initially let the model execute an arbitrary hidden database write simply because it "feels unsure."

Use a constrained internal tool/action contract, e.g.:

`request_human_decision({ kind, question, evidence_message_ids, proposed_response })`

The tool implementation:

1. validates the conversation/customer/assistant identity;
2. validates allowed approval kind;
3. creates one idempotent pending approval;
4. marks the conversation as awaiting human decision if policy requires it;
5. notifies eligible linked owners/admins;
6. returns a safe status to the assistant such as "human review requested."

The model cannot approve its own request.

## Owner Telegram routing

Reuse the linked recovery identity.

Current linking already proves that a Telegram user belongs to a logged-in portal user.

Extend owner notification preferences with a new kind, e.g. `approval`.

For each pending approval:

- select owner/admin users of the same customer;
- require a securely linked Telegram identity;
- honor notification preference;
- preferably allow per-assistant notification routing;
- send through a bot token that can reach that linked identity.

### Ordinary bots

This does not require Telegram Business.

A normal Telegram bot can send the owner a private approval notification after the owner has linked/started that bot.

Interactive inline buttons can be handled by the normal Telegram Bot API webhook.

### Telegram Business / Secretary Mode

The approval notification is still sent to the owner's private linked Telegram identity.

The customer-facing business conversation can continue to use its existing `business_connection_id` for replies.

The approval control path should not depend on Business Mode existing.

## Source assistant vs notification delivery bot

This distinction is required for "all or any assistants" to notify the same owner safely.

Current owner-alert delivery is intentionally strict: it only selects a linked owner when that user's `telegram_recovery_assistant_id` equals the assistant producing the alert. That should remain unchanged until the new routing model is implemented.

The approval extension should separate:

- **source assistant** — the assistant/conversation that requested verification;
- **decision recipient** — the owner/admin allowed to approve;
- **notification delivery bot** — a Telegram bot that the recipient has already securely linked/started and that can legally send that Telegram user a private message.

An approval created by Assistant B must not require the owner to re-link Telegram through Assistant B when the owner is already securely linked through Assistant A.

Safe delivery selection:

1. load eligible owner/admin recipients for the same customer;
2. use each recipient's verified Telegram user ID;
3. select that recipient's existing `telegram_recovery_assistant_id` as the preferred delivery bot;
4. if product policy later supports multiple verified notification bots, select only from explicitly linked/verified routes;
5. optionally use the central Mkety auth/notification bot only when it is already an established verified delivery route;
6. never borrow an arbitrary customer assistant token merely because it exists.

The Telegram callback authorization still checks the approval's actual `customer_id`, `assistant_id`, recipient membership and role. The delivery bot does not become the authority for the approval.

This makes one verified Telegram link capable of receiving approval requests from all assistants the owner explicitly enables, while ordinary Telegram bot rules are respected.

## Telegram action security

Never encode a decision directly as a trusted plaintext callback.

Buttons should contain a short opaque action token, not customer IDs or authorization claims.

Example:

- Approve
- Reject
- Reply
- Open

When clicked:

1. webhook authenticates using Telegram secret-token validation;
2. resolve the Telegram user ID to a linked Mkety user;
3. load the approval request;
4. verify user belongs to the same customer and has owner/admin permission;
5. verify approval is still pending and token is valid/not expired;
6. atomically write the decision;
7. append an immutable audit record;
8. acknowledge the Telegram callback;
9. enqueue continuation work if required.

A second click must return "already decided" and must not execute a second action.

## Approval vs human handoff

These are related but different:

### Human handoff

"I want a human to take over this conversation."

Existing implementation remains.

### Approval

"The AI may continue, but only after a human verifies/authorizes this specific fact or action."

Do not automatically convert every approval into a full conversation takeover.

Allow policies such as:

- **Pause this conversation until decision**
- **Continue limited conversation, block only protected action**
- **Notify only / informational review**

For payment verification, the safe default should be to block any state-changing "payment verified" action until approval.

## Human reply

For `human_answer`, Telegram can ask the owner to reply.

The response should be attached to the approval request and then delivered into the conversation through the existing channel-specific delivery path.

For Telegram customer conversations:

- ordinary bot → normal `sendMessage`;
- Telegram Business → existing optional `business_connection_id` path.

For future channels, the approval service should call a generic conversation delivery abstraction rather than hard-code Telegram.

## Assistant configuration

In each Assistant editor, add an optional section:

**Human review & approvals**

- Enable human review requests
- Notify:
  - Owner(s)
  - Admin(s)
- Types enabled:
  - Payment proof
  - Partner/signup verification
  - Human answer
  - Sensitive action approval
  - Custom
- Conversation behavior:
  - Pause conversation
  - Block protected action only
- Expiry behavior:
  - remain pending
  - safe reject
  - handoff
- owner Telegram connection status

Default must be off for new approval-triggering capabilities until explicitly configured, so no existing live assistant changes behavior simply because the feature ships.

## Prompt / policy authority

The assistant's business instructions may tell it **when to request** review.

They must not be allowed to override:

- tenant isolation;
- who may approve;
- payment truth;
- approval status;
- timeout behavior;
- protected-action policy;
- callback authentication.

The runtime owns those.

---



# 3A. Human Operations Hub — Telegram group / supergroup control room

## Product idea

In addition to private owner Telegram alerts, a customer can optionally connect one or more private Telegram groups or supergroups as a **Human Operations Hub**.

This becomes the back-office control room for human-only work:

- payment proof verification;
- partner/signup verification;
- approvals/rejections;
- human-answer requests;
- exception handling;
- escalations;
- sensitive-action authorization;
- operational alerts.

The end customer never joins or sees this group.

The customer-facing conversation continues normally through the assistant's existing channel.

The internal group is a separate private operations surface.

## Natural customer experience

The assistant should not announce internal mechanics such as:

- "I am waiting for my owner";
- "A human needs to approve this";
- "I sent this to an admin";
- "The AI cannot handle this."

unless the business owner explicitly wants such wording.

Instead, the assistant follows the owner's prompt/knowledge and remains natural.

For example, if a customer submits payment proof, the assistant can respond with an owner-configured neutral acknowledgement such as:

"Thanks, I have that. I’ll continue from here."

Internally, the protected action enters `awaiting_human_decision`.

The conversation can continue for ordinary questions while only the protected action is blocked.

When approval arrives, the system resumes the protected workflow naturally.

The external user does not need to know whether the decision came from AI policy, a staff member, an external verifier, or another authorized business process.

The runtime must never falsely claim that a specific human personally reviewed something unless that is actually part of the configured customer-facing wording.

## Group registration

A group must never become trusted merely because the bot was added to it.

Use an explicit linking flow.

Recommended sequence:

1. owner/admin signs into the Assist portal;
2. chooses **Human Operations → Connect Telegram group**;
3. Mkety creates a short-lived signed/hashed linking challenge;
4. owner adds the selected Assist notification bot to a private group/supergroup;
5. an authorized owner/admin runs a one-time command or taps a link button in that group;
6. webhook verifies:
   - challenge;
   - Telegram user identity;
   - Mkety customer membership;
   - role authorization;
   - Telegram group/chat ID;
   - bot identity used;
7. persist the group as an approved human-operations destination.

The bot being present in a group is not sufficient authorization.

## Proposed group table

Add an additive table such as `human_ops_destinations`:

- `id`
- `customer_id`
- `name`
- `channel` = `telegram`
- `chat_id`
- `message_thread_id` nullable
- `delivery_assistant_id` nullable
- `destination_type`
  - `private_user`
  - `group`
  - `supergroup`
  - `forum_topic`
- `status`
  - `active`
  - `paused`
  - `revoked`
- `allowed_kinds_json`
- `assistant_scope_json`
- `created_by_user_id`
- `created_at`
- `updated_at`

Unique identity should include customer + Telegram chat + topic where applicable.

## One group or several groups

Support both.

Examples:

### One simple operations group

**Company Human Ops**

Everything requiring people goes there.

Best for small businesses.

### Several specialized groups

- Payments & Verification
- Sales Approvals
- Support Escalations
- Partner Verification

Best for larger teams.

### One supergroup with topics

A Telegram forum-style supergroup can optionally separate work using topics, for example:

- Payments
- Partner Signups
- Human Replies
- Exceptions
- VIP Customers

Persist `message_thread_id` for the configured topic.

This is optional organization only; approval authority still comes from Mkety identity and policy, not from Telegram topic membership alone.

## Who may act inside the group

Group membership alone must **not** grant approval authority.

A button press/reply must resolve the Telegram sender to a verified Mkety identity.

Allowed roles are configured by the owner.

Recommended authority model:

- Owner — full decision authority
- Admin — owner-selectable approval authority
- Member — owner-selectable kinds only, otherwise view/reply only or no action

For example:

- Member A can answer support escalations;
- Finance Admin can approve payment verification;
- Sales Admin can approve partner signup;
- only Owner can authorize refunds.

This can be represented by a scoped table such as `human_ops_actor_permissions`.

A Telegram user who is in the group but has never been linked/approved in Mkety can see whatever the private group itself allows them to see, but Mkety rejects their action callbacks.

For highly sensitive groups, the owner should only add approved staff at the Telegram level as well.

## Group action card

A pending request can appear like:

```
MKETY HUMAN REVIEW
Payment verification

Assistant: Sales Assistant
Customer: John D.
Claim: ₦250,000 payment completed
Conversation: Telegram
Evidence: payment screenshot
AI summary: Customer says payment was made for Package X.

[ Approve ] [ Reject ]
[ Reply ]   [ Open details ]
```

The visible card can be updated after a decision:

```
APPROVED
by Finance Admin
11:42
```

or:

```
REJECTED
by Owner
11:45
Reason: amount does not match
```

Do not expose internal provider/model details, hidden prompts, secrets, pricing or unnecessary customer data in the group.

## Silent inline actions

Approve/Reject should use Telegram inline callback buttons.

The callback must carry only a short opaque token.

It must not trust client-supplied:

- customer ID;
- assistant ID;
- requested outcome;
- user role;
- conversation ID.

Server-side state maps the opaque token to the pending approval.

When pressed:

1. verify Telegram webhook authenticity;
2. identify the Telegram user who pressed it;
3. resolve them to a Mkety user;
4. verify current customer membership;
5. verify current approval permission for this kind;
6. verify destination is still active/authorized;
7. load the pending request;
8. atomically claim the decision;
9. write immutable audit;
10. update the Telegram card;
11. enqueue continuation.

Only the first valid terminal decision wins.

## Reply from the operations group

Human reply should be extremely simple.

Two safe interaction modes:

### Reply button

Staff taps **Reply**.

Mkety enters a short-lived reply-capture state for that Telegram user + approval request.

Their next group reply/message is captured as the human response.

The system then:

- validates authorization again;
- stores the human response against the approval;
- sends it to the customer through the original assistant/channel;
- records it as `role='human'` or an equivalent provenance field internally;
- continues automation according to policy.

### Telegram reply-to-card

Where reliable, staff can reply directly to the approval card.

Mkety maps the replied-to Telegram message ID to the approval request.

This is convenient, but should still use a pending-action mapping and authorization check.

Do not treat arbitrary messages in the group as instructions to customer assistants.

## Natural outbound identity

The customer should receive the response through the same assistant/channel identity they were already chatting with.

Examples:

- normal Telegram bot → same bot;
- Telegram Business/Secretary → same business connection;
- future WhatsApp/web/API channel → original channel adapter.

The customer should not receive a message from the Human Operations group or from an admin's personal Telegram account.

Internally preserve provenance:

- generated by model;
- approved by human;
- authored by human;
- system action.

Externally, presentation follows the business assistant identity.

This creates a seamless assistant experience without losing internal accountability.

## Approval without stopping the conversation

Default architecture should support **protected-action gating**, not mandatory full conversation pause.

Example:

Customer:
"I've paid. Here is the receipt."

Assistant:
"Thanks, I have that. What email should I attach to your order?"

Behind the scenes:

- payment verification request = pending;
- entitlement activation = blocked;
- conversation remains active;
- assistant can collect missing information;
- assistant must not claim payment is verified.

If the group later presses Approve:

- approval becomes terminal;
- protected action resumes;
- assistant can naturally continue with the next owner-configured step.

If Reject:

- assistant follows the configured rejection handling policy, for example asking the customer to re-check the transfer or submit clearer evidence.

## Human answer without customer-visible handoff

If the assistant genuinely needs a person to supply knowledge rather than approve an action:

1. create `human_answer` request;
2. send to configured Human Operations destination;
3. assistant continues only where safe;
4. authorized staff replies in the group;
5. reply is stored;
6. runtime injects the human answer as trusted workflow context;
7. assistant composes the customer-facing response in the business's normal tone, unless policy says send the human wording verbatim.

This is preferable to exposing internal staff conversation.

A setting can choose:

- **Use staff reply verbatim**
- **Let assistant naturally phrase staff answer**

For professional consistency, "assistant naturally phrase staff answer" can be the default for non-sensitive informational replies.

For legal/financial/contractual wording, owner policy may require verbatim delivery.

## Staff notes vs customer replies

The group needs a clear distinction so internal discussion is never accidentally sent to the customer.

Recommended:

- ordinary group messages = internal notes only;
- **Reply** action / reply-capture mode = customer-bound;
- **Approve/Reject** buttons = workflow decisions;
- optional **Add note** action = internal audit/context.

Never infer that a normal group message should be sent externally.

## Multiple simultaneous approvals

Each Human Operations card is independently addressable.

Reply capture must be scoped to:

- Telegram user;
- destination;
- approval ID;
- short expiry.

This prevents a staff member handling several customers at once from sending a response to the wrong conversation.

## Group privacy and evidence

Payment screenshots and sensitive material should be handled carefully.

Configuration options:

- summary only;
- sanitized preview;
- secure portal link;
- full Telegram media copy when the owner explicitly enables it.

Recommended default:

- concise summary in Telegram;
- minimal necessary evidence preview;
- secure portal detail link for sensitive/full evidence.

Do not leak credentials, full payment instrument data, hidden prompts, provider payloads, or unrelated conversation history.

## Group notification routing

Each assistant can be configured:

- no human operations;
- use customer default Human Ops destination;
- use selected group/topic;
- route different request kinds to different destinations.

Examples:

```
Sales Assistant
  payment_verification -> Payments topic
  partner_signup       -> Partner Verification topic
  human_answer         -> Support topic

Support Assistant
  human_answer         -> Support topic
  sensitive_action     -> Owner Approval topic
```

The destination is internal routing only.

## Owners who never use the portal after setup

After initial identity/group setup, day-to-day operation can happen fully in Telegram:

- approve;
- reject;
- reply;
- add internal note;
- open context;
- mark resolved.

The portal remains available for:

- configuration;
- audit/history;
- membership/permissions;
- destination setup;
- policy changes;
- recovery;
- exceptional reconciliation.

Telegram should not become a way to modify high-impact platform configuration such as billing policy, API keys, provider credentials or model routing.

## Bot choice

Do not require every customer-facing assistant bot to join every Human Operations group.

Allow an explicit delivery bot.

Preferred choices, in order:

1. an existing securely linked customer assistant bot that the owner selected for operations;
2. a dedicated customer Human Ops bot if productized later;
3. the central Mkety notification/auth bot where tenancy and branding policy permit.

The source assistant and operations-delivery bot remain separate identities.

This also prevents a customer-facing bot's group membership from accidentally becoming operational authority.

## Bot/group webhook separation

The current customer-facing Telegram webhook processes inbound customer messages and deliberately ignores linked owner/admin senders.

Do not simply let group operations messages fall through the customer-message pipeline.

Add an explicit operations-event classifier before customer conversation handling.

For an authorized Human Ops destination:

- callback query -> Human Ops action handler;
- reply-to-review-card -> Human Ops reply handler;
- ordinary internal group message -> ignore for customer automation / optionally store as internal note only;
- never create a customer conversation from the operations group.

This separation is essential to avoid loops or an internal admin message being interpreted as an end customer.

## Audit and provenance

Every human action records:

- customer;
- source assistant;
- conversation;
- approval/request;
- Telegram destination;
- Telegram actor ID;
- resolved Mkety user ID;
- role/permission used;
- action;
- timestamp;
- prior state;
- resulting state.

Customer-facing transcript does not need to expose this provenance.

Internal audit must preserve it.

## Failure behavior

If Telegram is unavailable:

- pending approval remains pending;
- protected action remains blocked;
- normal conversation can continue if configured;
- delivery retries safely;
- portal remains a fallback.

If the bot is removed from the group:

- destination health becomes degraded;
- approvals remain durable;
- route can fall back to another approved destination if configured;
- never silently treat notification delivery as approval.

If no authorized human responds before expiry:

owner policy determines:

- remain pending;
- reject safely;
- escalate to another group/owner;
- convert to full human handoff.

Do not let the model invent approval after timeout.

## Recommended user-facing name

**Human Operations**

Subsections:

- Destinations
- Permissions
- Review Rules
- Pending
- History

Assistant editor:

**Human Operations & Approvals**

Options:

- Enable
- Default operations destination
- Approval types
- Staff roles allowed
- Continue conversation while awaiting review
- Customer-facing acknowledgement
- Human answer mode: natural rewrite / verbatim
- Timeout/escalation policy

## Safe rollout extension

Add to the earlier phased rollout:

### Phase 4A — destination registration

- additive destination tables;
- portal-only linking;
- no model-triggered messages;
- test group ownership/permissions/health.

### Phase 4B — operations group notifications

- post read-only review cards;
- no buttons initially;
- no customer workflow mutation.

### Phase 4C — Approve/Reject callbacks

- authenticated callback handler;
- atomic decision;
- audit;
- no free-text reply yet.

### Phase 4D — controlled human reply

- reply capture;
- provenance;
- original-channel delivery;
- concurrency tests.

### Phase 4E — assistant-triggered requests

- constrained tool;
- protected-action gating;
- natural customer-facing continuation.

Existing customers remain unchanged until Human Operations is explicitly enabled.

# 4. Safe implementation sequence

Do not ship all behavior in one unreviewable patch.

## Phase 0 — documentation only

This document.

No production change.

## Phase 1 — route reorder UI

Files primarily:

- `customer-apps/assist/src/ui.ts`
- focused route-order UI tests

No schema migration and no routing algorithm change.

Acceptance:

- reordering does nothing until publish;
- before/after preview;
- existing PATCH payload unchanged;
- exact target economics/capabilities preserved;
- active alias cannot be published without an eligible target.

## Phase 2 — raw API key foundation, disabled by default

Add schema columns/table and internal types.

Feature flag default false for all existing customers.

Keep assistant-key code path byte-for-byte behavior equivalent where possible.

Build a separate branch inside `handleApiKeyInference` only after key mode is authenticated.

Acceptance tests must prove:

- old key behavior unchanged;
- raw key does not require assistant;
- raw key does not load assistant prompt;
- raw key cannot access assistant/knowledge/customer admin APIs;
- MKredit reservation/settlement matches existing inference;
- provider fallback costs are billed exactly once;
- idempotent retries do not double bill;
- unknown provider outcome refuses unsafe regeneration;
- one customer's key cannot use another customer's model override/balance.

## Phase 3 — raw API portal UX

Expose "Assistant key" vs "Model API key."

Still leave feature disabled except internal Mkety test tenant.

Use Mkety's own internal workload first.

After production verification, opt in one controlled enterprise tenant.

Do not silently convert existing keys.

## Phase 4 — approval persistence only

Add approval table/service and portal list/detail UI.

No model-triggered creation yet.

Allow manual/internal test creation in non-customer test context.

Prove:

- atomic first-decision-wins;
- tenant scoping;
- audit;
- expiry;
- idempotency.

## Phase 5 — Telegram approval notifications

Extend existing owner notification infrastructure.

Use linked identities; no new owner identity system.

Initially send notification + portal link.

Then add inline buttons after callback auth/idempotency tests pass.

Test both:

- ordinary assistant Telegram bot;
- Telegram Business/Secretary connection.

## Phase 6 — constrained assistant tool

Only after durable approvals and notification decisions are proven.

Introduce `request_human_decision`.

Enable on one Mkety/internal assistant first.

No arbitrary database writes from model output.

## Phase 7 — controlled enterprise opt-in

Customer/assistant feature flags explicitly enabled.

Observe:

- approval creation;
- Telegram delivery;
- owner action;
- continuation;
- billing;
- duplicate webhook behavior;
- timeout behavior.

Rollback is a feature-flag disable, not a database rollback.

---

# 5. Database migration rules

Every migration must be additive.

Do not rename/drop current production tables/columns in the feature rollout.

New columns need production-safe defaults that preserve current behavior.

Examples:

- API key `mode` defaults to `assistant`.
- approval capability defaults disabled.
- new notification preference uses current opt-in/explicit customer configuration semantics.
- no existing assistant automatically begins requesting approvals.

Remote migration is run only through the existing deployment workflow with current backups/validation conventions.

---

# 6. Required tests before any live rollout

At minimum:

### Existing behavior regression

- current assistant API key fixed to assistant;
- current unbound assistant API key requiring `assistant_id`;
- customer portal auth;
- Telegram normal bot;
- Telegram Business;
- human handoff/takeover/reply;
- reminders;
- model fallback;
- reasoning strict vs allow-lower-effort;
- MKredit settlement.

### Raw model API

- valid raw key + valid alias;
- missing model;
- forbidden alias;
- revoked/expired key;
- rate limiting;
- tenant crossing;
- prompt non-injection;
- idempotency;
- insufficient MKredit;
- provider fallback;
- provider-success/D1-failure recovery;
- unresolved provider outcome;
- concurrent duplicate request;
- usage/audit attribution to API workload.

### Approval system

- assistant/customer/conversation scope validation;
- duplicate creation idempotency;
- duplicate Telegram callback;
- two owners clicking opposite decisions concurrently;
- unauthorized Telegram identity;
- linked user removed from customer before decision;
- expired request;
- Telegram delivery failure;
- callback after resolution;
- human reply delivery;
- ordinary Telegram bot path;
- Telegram Business path;
- conversation paused / action-block policy;
- audit event contains no secrets/raw credentials.

---

# 7. Rollback principles

Each addition must be independently disableable.

- Route-order UI can be reverted with no DB change.
- Raw API can be disabled by feature flag while assistant API remains live.
- Approval creation can be disabled while existing human handoff remains live.
- Telegram approval actions can be disabled while portal approval remains live.
- Existing Telegram recovery linkage remains valid throughout.
- No rollback should require removing historical ledger, settlement, audit or approval records.

---

# 8. What must not be changed casually

Do not replace:

- `resolveModelRoute`
- current provider invocation/fallback policy
- settlement journal semantics
- MKredit reservation/settlement invariants
- current assistant prompt authority rules
- existing ordinary Telegram bot delivery
- existing Telegram Business delivery
- human handoff/takeover semantics
- recovery identity ownership checks

The new features should sit on top of those proven boundaries.

---

# Recommended product terminology

To make the UI understandable:

### API key types

**Assistant API**
> Use one of your configured Mkety Assist assistants from another app.

**Model API**
> Use Mkety models from any compatible application. Your application supplies its own prompts and instructions. Usage is billed from your MKredit balance.

### Human workflow

**Human Review & Approvals**

Actions:

- Approve
- Reject
- Reply
- Open conversation

This terminology distinguishes a specific approval from a full "Human Handoff."

---

# Final design position

All three requested capabilities fit the current architecture without replacing working production systems.

The safest approach is additive:

- route switching = UI around the existing ordered route publisher;
- general model API = a new explicit API-key mode using the existing inference/billing pipeline but without assistant prompt injection;
- approvals = a durable customer-scoped workflow extending existing human handoff + Telegram owner identity/notification primitives.

Production behavior for all current customers remains unchanged until an explicit feature is enabled.
