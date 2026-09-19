export function isPublicDegradedMode(): boolean {
  return process.env.MKETY_PUBLIC_DEGRADED_MODE === 'true';
}
