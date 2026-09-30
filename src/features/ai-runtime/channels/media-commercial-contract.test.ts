import fs from 'node:fs';
import path from 'node:path';

describe('Enterprise AI channel media commercial boundary', () => {
  it('admits credits/budgets and the managed-cost envelope before media AI processing', () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), 'src/features/ai-runtime/channels/server/runtime.ts'),
      'utf8',
    );

    const admission = source.indexOf('await admitAiCommercialRequest(');
    const envelope = source.indexOf('await assertEnterpriseAiManagedCostEnvelope(');
    const media = source.indexOf('await resolveEnterpriseAiMediaContext(');

    expect(admission).toBeGreaterThan(-1);
    expect(envelope).toBeGreaterThan(admission);
    expect(media).toBeGreaterThan(envelope);
  });

  it('keeps Telegram bot credentials server-side and raw media out of the conversation ledger', () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), 'src/features/ai-runtime/channels/media.ts'),
      'utf8',
    );
    const runtime = fs.readFileSync(
      path.join(process.cwd(), 'src/features/ai-runtime/channels/server/runtime.ts'),
      'utf8',
    );

    expect(source).toContain('revealChannelCredentials(connection.secretRef)');
    expect(source).toContain('MAX_MEDIA_BYTES');
    expect(source).toContain('MAX_AUDIO_SECONDS');
    expect(runtime).not.toContain('content: mediaContext.text,');
  });
});
