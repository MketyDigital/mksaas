export type UsageLimitIdentity = {
  customerId: string;
  assistantId: string;
  conversationId: string;
};

export interface UsageLimitFollowupRepository {
  ensureOpenHandoff(input: UsageLimitIdentity): Promise<boolean>;
  notifyOwners(input: UsageLimitIdentity): Promise<void>;
}

const TEAM_FOLLOWUP_REPLY = "Sorry about that. I’m tied up right now, but our team will check this conversation and get back to you here as soon as they can.";
const NO_FOLLOWUP_REPLY = "Sorry, I can’t help with that properly right now.";

export async function prepareUsageLimitFollowup(
  input: UsageLimitIdentity,
  repository: UsageLimitFollowupRepository,
): Promise<string> {
  if (!(await repository.ensureOpenHandoff(input))) return NO_FOLLOWUP_REPLY;
  await repository.notifyOwners(input);
  return TEAM_FOLLOWUP_REPLY;
}
