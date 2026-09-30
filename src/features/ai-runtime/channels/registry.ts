export type EnterpriseAiChannelKey =
  | 'website'
  | 'telegram'
  | 'whatsapp'
  | 'instagram'
  | 'facebook_messenger'
  | 'slack'
  | 'discord'
  | 'linkedin_page'
  | 'microsoft_teams'
  | 'custom_webhook';

export type EnterpriseAiChannelDescriptor = {
  key: EnterpriseAiChannelKey;
  label: string;
  entitlement: string;
  customerSetup: string[];
  credentialMode: 'none' | 'oauth' | 'token' | 'webhook';
  supportsInbound: boolean;
  supportsOutbound: boolean;
  supportsHumanHandoff: boolean;
  supportsCommitmentReminders: boolean;
  supportsImages: boolean;
  supportsVoiceNotes: boolean;
  supportsDocuments: boolean;
};

export const ENTERPRISE_AI_CHANNELS: readonly EnterpriseAiChannelDescriptor[] = [
  {
    key: 'website',
    label: 'Website chat',
    entitlement: 'ai.channel.website',
    customerSetup: ['Choose the assistant', 'Choose branding', 'Copy the embed snippet or use your connected domain'],
    credentialMode: 'none',
    supportsInbound: true,
    supportsOutbound: true,
    supportsHumanHandoff: true,
    supportsCommitmentReminders: false,
    supportsImages: false,
    supportsVoiceNotes: false,
    supportsDocuments: false,
  },
  {
    key: 'whatsapp',
    label: 'WhatsApp Business',
    entitlement: 'ai.channel.whatsapp',
    customerSetup: ['Connect Meta Business', 'Choose the WhatsApp number', 'Approve the webhook connection'],
    credentialMode: 'oauth',
    supportsInbound: true,
    supportsOutbound: true,
    supportsHumanHandoff: true,
    supportsCommitmentReminders: false,
    supportsImages: false,
    supportsVoiceNotes: false,
    supportsDocuments: false,
  },
  {
    key: 'telegram',
    label: 'Telegram',
    entitlement: 'ai.channel.telegram',
    customerSetup: ['Create or choose a bot', 'Paste the bot token once', 'Choose the assistant'],
    credentialMode: 'token',
    supportsInbound: true,
    supportsOutbound: true,
    supportsHumanHandoff: true,
    supportsCommitmentReminders: true,
    supportsImages: true,
    supportsVoiceNotes: true,
    supportsDocuments: true,
  },
  {
    key: 'instagram',
    label: 'Instagram Direct',
    entitlement: 'ai.channel.instagram',
    customerSetup: ['Connect Meta Business', 'Choose the Instagram account', 'Approve messaging permissions'],
    credentialMode: 'oauth',
    supportsInbound: true,
    supportsOutbound: true,
    supportsHumanHandoff: true,
    supportsCommitmentReminders: false,
    supportsImages: false,
    supportsVoiceNotes: false,
    supportsDocuments: false,
  },
  {
    key: 'facebook_messenger',
    label: 'Facebook Messenger',
    entitlement: 'ai.channel.facebook_messenger',
    customerSetup: ['Connect Meta Business', 'Choose the Facebook Page', 'Approve messaging permissions'],
    credentialMode: 'oauth',
    supportsInbound: true,
    supportsOutbound: true,
    supportsHumanHandoff: true,
    supportsCommitmentReminders: false,
    supportsImages: false,
    supportsVoiceNotes: false,
    supportsDocuments: false,
  },
  {
    key: 'slack',
    label: 'Slack',
    entitlement: 'ai.channel.slack',
    customerSetup: ['Install the Mkety Enterprise AI app', 'Choose channels', 'Choose the assistant'],
    credentialMode: 'oauth',
    supportsInbound: true,
    supportsOutbound: true,
    supportsHumanHandoff: true,
    supportsCommitmentReminders: true,
    supportsImages: false,
    supportsVoiceNotes: false,
    supportsDocuments: false,
  },
  {
    key: 'discord',
    label: 'Discord',
    entitlement: 'ai.channel.discord',
    customerSetup: ['Create or choose a Discord app/bot', 'Add the bot to the server', 'Configure the interactions endpoint'],
    credentialMode: 'token',
    supportsInbound: true,
    supportsOutbound: true,
    supportsHumanHandoff: true,
    supportsCommitmentReminders: true,
    supportsImages: false,
    supportsVoiceNotes: false,
    supportsDocuments: false,
  },
  {
    key: 'linkedin_page',
    label: 'LinkedIn Page Community',
    entitlement: 'ai.channel.linkedin_page',
    customerSetup: ['Use a LinkedIn developer app with approved Community Management access', 'Connect an organization admin token', 'Validate and subscribe the webhook'],
    credentialMode: 'oauth',
    supportsInbound: true,
    supportsOutbound: true,
    supportsHumanHandoff: false,
    supportsCommitmentReminders: false,
    supportsImages: false,
    supportsVoiceNotes: false,
    supportsDocuments: false,
  },
  {
    key: 'microsoft_teams',
    label: 'Microsoft Teams',
    entitlement: 'ai.channel.microsoft_teams',
    customerSetup: ['Connect a Teams workflow/webhook', 'Choose the team/channel', 'Choose the assistant'],
    credentialMode: 'webhook',
    supportsInbound: false,
    supportsOutbound: true,
    supportsHumanHandoff: true,
    supportsCommitmentReminders: false,
    supportsImages: false,
    supportsVoiceNotes: false,
    supportsDocuments: false,
  },
  {
    key: 'custom_webhook',
    label: 'Custom API / webhook',
    entitlement: 'ai.channel.custom_webhook',
    customerSetup: ['Create a signed webhook endpoint', 'Choose inbound/outbound mode', 'Test delivery'],
    credentialMode: 'webhook',
    supportsInbound: true,
    supportsOutbound: true,
    supportsHumanHandoff: false,
    supportsCommitmentReminders: true,
    supportsImages: false,
    supportsVoiceNotes: false,
    supportsDocuments: false,
  },
] as const;

export function getEnterpriseAiChannel(key: string) {
  return ENTERPRISE_AI_CHANNELS.find((channel) => channel.key === key) ?? null;
}
