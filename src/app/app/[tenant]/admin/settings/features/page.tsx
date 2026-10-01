'use client';

import { Sliders } from 'lucide-react';

import { useSettings } from '@/features/admin/components/settings';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Label,
  Switch,
} from '@/shared/components/ui';
import type { TenantSettings } from '@/shared/lib/tenant-settings';

import { SaveStatusBanner } from '../SaveStatusBanner';

type FeatureKey = keyof NonNullable<TenantSettings['features']>;

const FLAGS: Array<{ key: FeatureKey; label: string; description: string }> = [
  { key: 'knowledgeBase', label: 'Knowledge Base', description: 'Enable knowledge document management.' },
  { key: 'allowCustomRoles', label: 'Custom Roles', description: 'Allow admins to create tenant-specific roles in addition to system roles.' },
  { key: 'aiAssistantEnabled', label: 'AI Assistant', description: 'Enable the normal tenant AI assistant for this workspace.' },
  { key: 'webhooks', label: 'Webhooks', description: 'Enable supported outbound webhook capabilities.' },
  { key: 'githubIntegrationEnabled', label: 'GitHub Integration', description: 'Enable supported GitHub integration features.' },
];

export default function FeatureSettingsPage() {
  const { features, settings, setSettings, handleSave, isPending, saveStatus } = useSettings();

  const toggle = async (key: FeatureKey, enabled: boolean) => {
    const next = { ...features, [key]: enabled };
    setSettings({ ...settings, features: next });
    await handleSave('features', { features: next });
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2"><Sliders className="h-6 w-6 text-primary" /><h1 className="text-2xl font-bold">Feature Flags</h1></div>
        <p className="mt-1 text-sm text-muted-foreground">Safe tenant-level product switches. Billing, entitlements and authorization remain authoritative.</p>
      </div>
      <SaveStatusBanner status={saveStatus} />
      <div className="grid gap-4 lg:grid-cols-2">
        {FLAGS.map((flag) => (
          <Card className="rounded-2xl" key={flag.key}>
            <CardHeader>
              <CardTitle className="text-base">{flag.label}</CardTitle>
              <CardDescription>{flag.description}</CardDescription>
            </CardHeader>
            <CardContent className="flex items-center justify-between gap-4">
              <Label htmlFor={flag.key}>{features[flag.key] ? 'Enabled' : 'Disabled'}</Label>
              <Switch
                id={flag.key}
                checked={Boolean(features[flag.key])}
                disabled={isPending}
                onCheckedChange={(checked) => void toggle(flag.key, checked)}
              />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
