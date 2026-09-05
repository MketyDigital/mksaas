'use client';

import { useState, useTransition } from 'react';

import { savePlatformContentDraft } from '@/features/platform-content/server/actions';
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
  const [isPending, startTransition] = useTransition();

  return (
    <Card className="rounded-2xl border-primary/20 shadow-sm">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor={`${entityKey}-payload`}>Validated JSON draft payload</Label>
          <Textarea
            id={`${entityKey}-payload`}
            value={payloadText}
            onChange={(event) => setPayloadText(event.target.value)}
            className="min-h-[260px] font-mono text-xs leading-5"
            spellCheck={false}
          />
          <p className="text-xs text-muted-foreground">
            This form calls the server-side Mkety content action boundary. Database persistence will be switched on after migration reconciliation.
          </p>
        </div>

        {status && <p className="rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground">{status}</p>}

        <Button
          type="button"
          disabled={isPending}
          onClick={() => {
            startTransition(async () => {
              try {
                const payload = JSON.parse(payloadText) as Record<string, unknown>;
                const result = await savePlatformContentDraft(tenant, { area, entityType, entityKey, payload });
                setStatus(`Draft ${result.status}: ${result.entityType}/${result.entityKey}`);
              } catch (error) {
                setStatus(error instanceof Error ? error.message : 'Unable to validate draft payload.');
              }
            });
          }}
        >
          {isPending ? 'Validating…' : 'Validate draft'}
        </Button>
      </CardContent>
    </Card>
  );
}
