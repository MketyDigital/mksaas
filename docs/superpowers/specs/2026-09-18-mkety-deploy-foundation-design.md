# Mkety Deploy Foundation Design

**Status:** APPROVED FOR IMPLEMENTATION  
**Date:** 2026-09-18

## Objective

Turn the existing Deploy Workspace placeholder into the first real backend-backed Deploy surface without enabling infrastructure mutation prematurely.

## First slice

The foundation owns three tenant/project-scoped records:

1. Deploy applications — logical web apps, APIs, and services inside a project.
2. Environments — development, preview, staging, and protected production metadata.
3. Deployment history — release/provider metadata and lifecycle status records.

## Safety boundary

This slice must not:

- call Cloudflare, OCI, Coolify, or another deployment provider;
- create DNS records or custom hostnames;
- expose provider credentials;
- create public preview or production URLs;
- trigger a deployment;
- mutate production infrastructure;
- permit non-manager members to create application/environment metadata.

Production environments are metadata-only and marked protected.

## Authorization

All reads inherit `requireProjectAccess`, which validates authentication, tenant membership, and project ownership.

Application/environment creation is limited to project members whose existing access result has `canManage = true` (admin or manager).

Every persisted record carries tenant and project identity. Environment creation additionally validates that its application belongs to the same tenant/project.

## Persistence

Migration `0014_deploy_foundation.sql` adds:

- `saas_template.deploy_applications`;
- `saas_template.deploy_environments`;
- `saas_template.deployments`.

No domain table, secret table, credential table, provider queue, or infrastructure job runner belongs in this slice.

## UI

The existing Deploy Workspace remains explicit about protected infrastructure. It gains:

- manager-only forms for application/environment metadata;
- application list;
- environment list;
- read-only deployment-history list.

Apps, Environments, and Deployments are labelled Foundation. Domains and Production remain Protected.

## Next slice

After this foundation is verified and merged, add deployment-provider execution only through a separate design covering credentials, approvals, audit events, bounded jobs, failure handling, and rollback. Domain ownership/routing remains a separate later slice.
