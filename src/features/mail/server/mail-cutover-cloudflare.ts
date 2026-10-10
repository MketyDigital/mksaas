type CatchAllRule = { enabled?: boolean; actions?: Array<{ type?: string; value?: string[] }> } | null;

export type MailRoutingCutoverOperations = {
  setWorkerCatchAll(zoneId: string): Promise<unknown>;
  readCatchAll(zoneId: string): Promise<CatchAllRule>;
  enableRecipientResolver(): Promise<void>;
  enableRootEmailRouting(zoneId: string): Promise<unknown>;
};

/** Keeps Cloudflare's one catch-all Worker action verified before apex Email Routing changes DNS. */
export async function enableRootEmailRoutingAfterCatchAll(zoneId: string, operations: MailRoutingCutoverOperations) {
  await operations.setWorkerCatchAll(zoneId);
  const rule = await operations.readCatchAll(zoneId);
  const ready = rule?.enabled === true && rule.actions?.some((action) => action.type === 'worker' && action.value?.includes('mkety-mail-ingress'));
  if (!ready) throw new Error('mail_catch_all_unverified');
  await operations.enableRecipientResolver();
  return operations.enableRootEmailRouting(zoneId);
}
