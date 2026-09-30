/** @jest-environment node */
import { createRequire } from 'node:module';

// Load the exact native image implementation used by the installed Next tree.
type ImagePipeline = {
  resize(width: number, height: number): ImagePipeline;
  toFormat(format: string): ImagePipeline;
  toBuffer(): Promise<Buffer>;
  metadata(): Promise<{ width?: number; height?: number; format?: string }>;
};
const sharp = createRequire(require.resolve('next/package.json'))('sharp') as (input: Buffer | object) => ImagePipeline;

describe('patched native image dependency compatibility', () => {
  it.each(['png', 'webp', 'avif'] as const)(
    'resizes and decodes %s without mismatched native binaries',
    async (format) => {
      const source = sharp({ create: { width: 8, height: 6, channels: 3, background: '#336699' } });
      const encoded = await source.resize(4, 3).toFormat(format).toBuffer();
      const decoded = await sharp(encoded).metadata();
      expect(decoded).toMatchObject({ width: 4, height: 3, format: format === 'avif' ? 'heif' : format });
      expect(encoded.length).toBeGreaterThan(0);
    },
  );
});
