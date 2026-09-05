# Mkety Automation Data Model Foundation Design

## Goal

Add the first safe backend-facing Automation Workspace foundation on top of the existing workflow tables without enabling live workflow execution.

## Context

PR #6 established the Mkety project workspace shell and Automation Workspace presentation. PR #7 and PR #8 deepened AI Workspace presentation and Agent Builder polish. Automation already has repository schema exports for `workflows`, `workflow_runs`, and `webhooks`, plus migration `0008_workflows.sql` for workflow and run records.

Because those tables already exist, this phase must not duplicate the database model. It should read from the existing model and expose safe project-scoped summaries only.

## Architecture

The Automation route remains tenant-scoped and project-scoped through `requireProjectAccess`. A small automation model helper computes read-only metrics from workflow and run records. A server-side snapshot loader fetches recent workflow and run rows for the current project, then the existing Automation overview renders counts and recent workflow records.

## In scope

- Pure automation metrics helper.
- Server-side read-only automation workspace snapshot loader.
- Route wiring for `/t/[tenant]/projects/[project]/automation`.
- Overview metrics for workflows, draft workflows, active workflow records, webhook triggers, run records, and failed runs.
- Recent workflow records display.
- Tests for metrics and read-only UI boundaries.
- Focused smoke workflow coverage.

## Out of scope

- New workflow execution engine.
- Trigger scheduling.
- Webhook endpoint activation.
- Retry execution.
- Action execution.
- New billing, wallet, credits, or usage deductions.
- New deployment automation.
- Trading runtime, broker, signal, copy-trading, or execution records.

## Safety boundaries

- `executionEnabled` remains `false` in this phase.
- The Automation overview must not expose Run buttons, webhook activation links, or execution controls.
- Workflow rows may be displayed as read-only records.
- Run rows may be counted, but not replayed or retried.
- Existing schema is reused instead of adding duplicate tables.
