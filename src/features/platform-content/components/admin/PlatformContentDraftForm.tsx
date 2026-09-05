'use client';

import { useState, useTransition } from 'react';

import { publishPlatformContent, savePlatformContentDraft } from '@/features/platform-content/server/actions';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Label, Textarea } from '@/shared/components/ui';

type PlatformContentDraftFormProps = {
  tenant: string;
  area: 'public-site' | 'docs' | 'pricing' | 'navigation' | 'settings' | 'app-experience';
  entityType:
    | 'site_settings'
    | 'page'
    | 'page_section'
    | 'navigation_item'
    | 'pricing_plan'
    | 'pricing_feature'
    | 'docs_category'
    | 'docs_article'
    | 'app_experience';
  entityKey: string;
  title: string;
  description: string;
  defaultPayload: Record<string, unknown>;
};

type AdminAction = 'save' | 'publish';

function formatActionStatus(action: AdminAction, result: { mutatedRecords: number; auditRecorded: boolean; entityType: string; entityKey: string }) {
  const verb = action === 'save' ? 'Saved draft' : 'Published draft';
  const audit = result.auditRecorded ? 'Audit recorded' : 'Audit not recorded';
  return `${verb}: ${result.entityType}/${result.entityKey}. Records affected: ${result.mutatedRecords}. ${audit}.`;
}

export function PlatformContentDraftForm({
  tenant,
  area,
  entityType,
  entityKey,
  title,
  description,
  defaultPayload,
}: PlatformContentDraftFormProps) {
  const [payloadText, setPayloadText] = useState(() => JSON.stringify(defaultPayload, null, 2));
  const [status, setStatus] = useState<string | null>(null);
  const [activeAction, setActiveAction] = useState<AdminAction | null>(null);
  const [isPending, startTransition] = useTransition();

  function runAction(action: AdminAction) {
    setActiveAction(action);
    startTransition(async () => {
      try {
        const payload = JSON.parse(payloadText) as Record<string, unknown>;
        const result =
          action === 'save'
            ? await savePlatformContentDraft(tenant, { area, entityType, entityKey, payload })
            : await publishPlatformContent(tenant, { area, entityType, entityKey });

        setStatus(formatActionStatus(action, result));
      } catch (error) {
        setStatus(error instanceof Error ? error.message : 'Unable to process Mkety CMS payload.');
      } finally {
        setActiveAction(null);
      }
    });
  }

  return (
    <Card className="rounded-2xl border-primary/20 shadow-sm">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor={`${entityKey}-payload`}>CMS JSON draft payload</Label>
          <Textarea
            id={`${entityKey}-payload`}
            value={payloadText}
            onChange={(event) => setPayloadText(event.target.value)}
            className="min-h-[260px] font-mono text-xs leading-5"
            spellCheck={false}
          />
          <p className="text-xs text-muted-foreground">
            Save creates or updates draft records. Publish promotes supported draft records to published content, records revisions,
            attempts an audit event, and revalidates Mkety public/docs/admin paths.
          </p>
        </div>

        {status && <p className="rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground">{status}</p>}

        <div className="flex flex-wrap gap-3">
          <Button type="button" disabled={isPending} onClick={() => runAction('save')}>
            {isPending && activeAction === 'save' ? 'Saving…' : 'Save draft'}
          </Button>
          <Button type="button" variant="outline" disabled={isPending} onClick={() => runAction('publish')}>
            {isPending && activeAction === 'publish' ? 'Publishing…' : 'Publish draft'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
