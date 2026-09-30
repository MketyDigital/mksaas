import { CheckCircle2, ExternalLink, MessageSquareMore } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { ENTERPRISE_AI_CHANNELS } from '@/features/ai-runtime/channels/registry';
import {
  disableEnterpriseAiChannelConnection,
  listEnterpriseAiChannelConnections,
  saveEnterpriseAiChannelConnection,
} from '@/features/ai-runtime/channels/server/connections';
import { hasEnterpriseAiAccess } from '@/features/ai-runtime/server/access';
import { listEnterpriseAiSolutionInstances } from '@/features/ai-runtime/server/business-solutions';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
} from '@/shared/components/ui';
import { requirePermission } from '@/shared/lib/permissions';
import { getTenantBySlug } from '@/shared/lib/tenant';

export const dynamic = 'force-dynamic';

function channelKey(providerKey: string) {
  return providerKey.startsWith('channel:') ? providerKey.slice('channel:'.length) : providerKey;
}

export default async function EnterpriseAiChannelsPage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant: tenantSlug } = await params;
  await requirePermission(tenantSlug, 'ai:channels:manage');
  const tenant = await getTenantBySlug(tenantSlug);
  if (!tenant) redirect('/select-tenant');
  if (!(await hasEnterpriseAiAccess(tenant.id))) redirect(`/t/${tenantSlug}/enterprise-ai`);

  const [connections, solutions] = await Promise.all([
    listEnterpriseAiChannelConnections(tenant.id),
    listEnterpriseAiSolutionInstances(tenant.id),
  ]);
  const connectionByChannel = new Map(connections.map((item) => [channelKey(item.providerKey), item]));

  return (
    <div className="mx-auto max-w-6xl space-y-6 py-4">
      <div>
        <Link href={`/t/${tenantSlug}/enterprise-ai`} className="text-sm text-muted-foreground">← Enterprise AI</Link>
        <div className="mt-2 flex items-center gap-3"><MessageSquareMore className="h-7 w-7 text-primary" /><h1 className="text-3xl font-bold">Channels</h1></div>
        <p className="mt-2 max-w-3xl text-muted-foreground">
          Connect the same approved AI solution to the places your customers and team already use. Credentials are encrypted server-side and each installation stays inside this workspace.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {ENTERPRISE_AI_CHANNELS.map((channel) => {
          const connection = connectionByChannel.get(channel.key);
          const metadata = connection?.metadata ?? {};
          const value = (key: string) => typeof metadata[key] === 'string' ? metadata[key] as string : '';

          return (
            <Card className="rounded-2xl" key={channel.key}>
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle>{channel.label}</CardTitle>
                    <CardDescription className="mt-2">{channel.customerSetup.join(' → ')}</CardDescription>
                  </div>
                  <span className="rounded-full border px-2.5 py-1 text-xs font-semibold">
                    {connection?.status === 'active' ? 'Connected' : 'Available'}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div className="flex flex-wrap gap-2">
                  {channel.supportsInbound ? <span className="rounded-full bg-muted px-2.5 py-1">Inbound</span> : null}
                  {channel.supportsOutbound ? <span className="rounded-full bg-muted px-2.5 py-1">Outbound</span> : null}
                  {channel.supportsHumanHandoff ? <span className="rounded-full bg-muted px-2.5 py-1">Human handoff</span> : null}
                  {channel.supportsImageInput ? <span className="rounded-full bg-muted px-2.5 py-1">Image input</span> : null}
                  {channel.supportsAudioInput ? <span className="rounded-full bg-muted px-2.5 py-1">Voice/audio input</span> : null}
                </div>

                <p className="flex items-center gap-2 text-muted-foreground">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  {connection?.secretConfigured ? 'Credentials are securely configured.' : 'No raw provider secret is shown after saving.'}
                </p>

                <details className="rounded-xl border p-4" open={!connection}>
                  <summary className="cursor-pointer font-semibold">{connection ? 'Update connection' : 'Connect channel'}</summary>
                  <form action={saveEnterpriseAiChannelConnection.bind(null, tenantSlug)} className="mt-4 grid gap-3">
                    <input type="hidden" name="channel" value={channel.key} />

                    <div>
                      <Label htmlFor={`${channel.key}-solution`}>AI solution</Label>
                      <select
                        className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
                        defaultValue={value('solutionInstanceId')}
                        id={`${channel.key}-solution`}
                        name="solutionInstanceId"
                      >
                        <option value="">Choose a solution</option>
                        {solutions.filter((item) => item.status !== 'disabled').map((item) => (
                          <option key={item.id} value={item.id}>{item.name}</option>
                        ))}
                      </select>
                      <p className="mt-1 text-xs text-muted-foreground">
                        This channel uses that solution&apos;s instructions, approved knowledge, model and pause state.
                      </p>
                    </div>

                    {channel.key === 'telegram' ? (
                      <>
                        <div><Label htmlFor={`${channel.key}-botToken`}>Bot token</Label><Input id={`${channel.key}-botToken`} name="botToken" type="password" autoComplete="off" className="mt-1" placeholder={connection?.secretConfigured ? 'Leave blank to keep existing token' : 'Telegram bot token'} /></div>
                        <div><Label htmlFor={`${channel.key}-webhookSecret`}>Webhook secret</Label><Input id={`${channel.key}-webhookSecret`} name="webhookSecret" type="password" autoComplete="off" className="mt-1" placeholder="Webhook verification secret" /></div>
                        <div><Label htmlFor={`${channel.key}-channelId`}>Default chat/channel ID</Label><Input id={`${channel.key}-channelId`} name="channelId" defaultValue={value('channelId')} className="mt-1" /></div>
                        <p className="text-xs text-muted-foreground">Telegram photo/image messages and voice/audio notes are understood when they pass Mkety media safety limits. Media is processed server-side; raw bot credentials are never exposed to the customer browser.</p>
                      </>
                    ) : null}

                    {channel.key === 'whatsapp' ? (
                      <>
                        <div><Label htmlFor={`${channel.key}-accessToken`}>Access token</Label><Input id={`${channel.key}-accessToken`} name="accessToken" type="password" autoComplete="off" className="mt-1" placeholder={connection?.secretConfigured ? 'Leave blank to keep existing token' : 'Meta access token'} /></div>
                        <div><Label htmlFor={`${channel.key}-appSecret`}>App secret</Label><Input id={`${channel.key}-appSecret`} name="appSecret" type="password" autoComplete="off" className="mt-1" /></div>
                        <div><Label htmlFor={`${channel.key}-verificationToken`}>Webhook verification token</Label><Input id={`${channel.key}-verificationToken`} name="verificationToken" type="password" autoComplete="off" className="mt-1" /></div>
                        <div><Label htmlFor={`${channel.key}-phoneNumberId`}>Phone number ID</Label><Input id={`${channel.key}-phoneNumberId`} name="phoneNumberId" defaultValue={value('phoneNumberId')} className="mt-1" /></div>
                        <div><Label htmlFor={`${channel.key}-endpoint`}>Messaging endpoint</Label><Input id={`${channel.key}-endpoint`} name="endpointUrl" defaultValue={connection?.endpointUrl ?? ''} className="mt-1" placeholder="https://graph.facebook.com/.../messages" /></div>
                      </>
                    ) : null}

                    {(channel.key === 'instagram' || channel.key === 'facebook_messenger') ? (
                      <>
                        <div><Label htmlFor={`${channel.key}-accessToken`}>Page/account access token</Label><Input id={`${channel.key}-accessToken`} name="accessToken" type="password" autoComplete="off" className="mt-1" placeholder={connection?.secretConfigured ? 'Leave blank to keep existing token' : 'Meta access token'} /></div>
                        <div><Label htmlFor={`${channel.key}-appSecret`}>App secret</Label><Input id={`${channel.key}-appSecret`} name="appSecret" type="password" autoComplete="off" className="mt-1" /></div>
                        <div><Label htmlFor={`${channel.key}-verificationToken`}>Webhook verification token</Label><Input id={`${channel.key}-verificationToken`} name="verificationToken" type="password" autoComplete="off" className="mt-1" /></div>
                        <div><Label htmlFor={`${channel.key}-pageId`}>Page/account ID</Label><Input id={`${channel.key}-pageId`} name="pageId" defaultValue={value('pageId')} className="mt-1" /></div>
                        <div><Label htmlFor={`${channel.key}-endpoint`}>Messaging endpoint</Label><Input id={`${channel.key}-endpoint`} name="endpointUrl" defaultValue={connection?.endpointUrl ?? ''} className="mt-1" /></div>
                      </>
                    ) : null}

                    {channel.key === 'slack' ? (
                      <>
                        <div><Label htmlFor={`${channel.key}-accessToken`}>Bot access token</Label><Input id={`${channel.key}-accessToken`} name="accessToken" type="password" autoComplete="off" className="mt-1" placeholder={connection?.secretConfigured ? 'Leave blank to keep existing token' : 'xoxb-...'} /></div>
                        <div><Label htmlFor={`${channel.key}-signingSecret`}>Signing secret</Label><Input id={`${channel.key}-signingSecret`} name="signingSecret" type="password" autoComplete="off" className="mt-1" /></div>
                        <div><Label htmlFor={`${channel.key}-channelId`}>Default channel ID</Label><Input id={`${channel.key}-channelId`} name="channelId" defaultValue={value('channelId')} className="mt-1" /></div>
                      </>
                    ) : null}

                    {channel.key === 'discord' ? (
                      <>
                        <div><Label htmlFor={`${channel.key}-botToken`}>Bot token</Label><Input id={`${channel.key}-botToken`} name="botToken" type="password" autoComplete="off" className="mt-1" placeholder={connection?.secretConfigured ? 'Leave blank to keep existing token' : 'Discord bot token'} /></div>
                        <div><Label htmlFor={`${channel.key}-publicKey`}>Application public key</Label><Input id={`${channel.key}-publicKey`} name="publicKey" type="password" autoComplete="off" className="mt-1" placeholder="64-character Discord public key" /></div>
                        <div><Label htmlFor={`${channel.key}-applicationId`}>Application ID</Label><Input id={`${channel.key}-applicationId`} name="applicationId" defaultValue={value('applicationId')} className="mt-1" /></div>
                        <div><Label htmlFor={`${channel.key}-guildId`}>Server / guild ID</Label><Input id={`${channel.key}-guildId`} name="guildId" defaultValue={value('guildId')} className="mt-1" /></div>
                        <div><Label htmlFor={`${channel.key}-channelId`}>Default channel ID</Label><Input id={`${channel.key}-channelId`} name="channelId" defaultValue={value('channelId')} className="mt-1" /></div>
                        <p className="text-xs text-muted-foreground">Set the Discord Interactions Endpoint URL to this connection&apos;s Mkety inbound webhook. Use a slash command with one required string option for the user question.</p>
                      </>
                    ) : null}

                    {channel.key === 'linkedin_page' ? (
                      <>
                        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-muted-foreground">
                          LinkedIn Page Community requires a LinkedIn developer app approved for Community Management. This connector handles Page comments/mentions; it does not claim unrestricted LinkedIn inbox/DM API access.
                        </div>
                        <div><Label htmlFor={`${channel.key}-accessToken`}>Organization admin access token</Label><Input id={`${channel.key}-accessToken`} name="accessToken" type="password" autoComplete="off" className="mt-1" placeholder={connection?.secretConfigured ? 'Leave blank to keep existing token' : 'LinkedIn OAuth access token'} /></div>
                        <div><Label htmlFor={`${channel.key}-clientSecret`}>LinkedIn app client secret</Label><Input id={`${channel.key}-clientSecret`} name="clientSecret" type="password" autoComplete="off" className="mt-1" /></div>
                        <div><Label htmlFor={`${channel.key}-applicationId`}>Developer application ID</Label><Input id={`${channel.key}-applicationId`} name="applicationId" defaultValue={value('applicationId')} className="mt-1" /></div>
                        <div><Label htmlFor={`${channel.key}-organizationId`}>Organization ID</Label><Input id={`${channel.key}-organizationId`} name="organizationId" defaultValue={value('organizationId')} className="mt-1" /></div>
                        <div><Label htmlFor={`${channel.key}-memberId`}>Admin member ID</Label><Input id={`${channel.key}-memberId`} name="memberId" defaultValue={value('memberId')} className="mt-1" /></div>
                        <div><Label htmlFor={`${channel.key}-linkedinVersion`}>LinkedIn API version</Label><Input id={`${channel.key}-linkedinVersion`} name="linkedinVersion" defaultValue={value('linkedinVersion') || '202609'} className="mt-1" /></div>
                        <p className="text-xs text-muted-foreground">Register the Mkety inbound URL in LinkedIn Webhooks, complete the challenge validation, then subscribe the organization to social-action notifications.</p>
                      </>
                    ) : null}

                    {(channel.key === 'microsoft_teams' || channel.key === 'custom_webhook') ? (
                      <>
                        <div><Label htmlFor={`${channel.key}-endpoint`}>{channel.key === 'microsoft_teams' ? 'Teams workflow/webhook URL' : 'Webhook URL'}</Label><Input id={`${channel.key}-endpoint`} name="endpointUrl" defaultValue={connection?.endpointUrl ?? ''} className="mt-1" /></div>
                        {channel.key === 'custom_webhook' ? <div><Label htmlFor={`${channel.key}-webhookSecret`}>Signing secret</Label><Input id={`${channel.key}-webhookSecret`} name="webhookSecret" type="password" autoComplete="off" className="mt-1" /></div> : null}
                      </>
                    ) : null}

                    {channel.key === 'website' ? (
                      <div><Label htmlFor={`${channel.key}-displayName`}>Widget name</Label><Input id={`${channel.key}-displayName`} name="displayName" defaultValue={value('displayName')} className="mt-1" placeholder="Customer Support" /></div>
                    ) : null}

                    <Button type="submit">{connection ? 'Save changes' : 'Connect'}</Button>
                  </form>
                </details>

                {connection ? (
                  <form action={disableEnterpriseAiChannelConnection.bind(null, tenantSlug)}>
                    <input type="hidden" name="connectionId" value={connection.id} />
                    <Button variant="outline" type="submit">Disable connection</Button>
                  </form>
                ) : null}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="rounded-2xl">
        <CardHeader><CardTitle>Add another channel later</CardTitle><CardDescription>The channel layer is adapter-based. A new provider plugs into the same message, security, usage, human-handoff and audit contracts instead of requiring another AI runtime.</CardDescription></CardHeader>
        <CardContent><Link className="inline-flex items-center gap-2 font-semibold text-primary" href="https://mkety.com/enterprise">Request a custom integration <ExternalLink className="h-4 w-4" /></Link></CardContent>
      </Card>
    </div>
  );
}
