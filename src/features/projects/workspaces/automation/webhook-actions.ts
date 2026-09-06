'use server';

import { createAutomationWorkflowWebhook, rotateAutomationWorkflowWebhookSecret } from './actions';

export type AutomationWebhookActionState = {
  ok: boolean;
  endpointId?: string;
  secret?: string;
  error?: string;
};

export async function createAutomationWorkflowWebhookState(_previous: AutomationWebhookActionState, formData: FormData): Promise<AutomationWebhookActionState> {
  try {
    const result = await createAutomationWorkflowWebhook(formData);
    return { ok: true, endpointId: result.endpointId, secret: result.secret };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Webhook endpoint could not be created.' };
  }
}

export async function rotateAutomationWorkflowWebhookSecretState(_previous: AutomationWebhookActionState, formData: FormData): Promise<AutomationWebhookActionState> {
  try {
    const result = await rotateAutomationWorkflowWebhookSecret(formData);
    return { ok: true, endpointId: result.endpointId, secret: result.secret };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Webhook secret could not be rotated.' };
  }
}
