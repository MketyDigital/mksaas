export function mailExternalClientsEnabled() {
  return process.env.MKETY_MAIL_EXTERNAL_CLIENTS_ENABLED === 'true';
}
