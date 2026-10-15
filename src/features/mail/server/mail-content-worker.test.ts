/** @jest-environment node */

import worker from '../../../../workers/mail-content/src/index';

describe('mail content Worker uploads', () => {
  it('streams uploads directly to R2 without buffering the request body', async () => {
    let stored = new Uint8Array();
    const put = jest.fn(async (_key: string, body: ReadableStream<Uint8Array>) => {
      const reader = body.getReader();
      const chunks: Uint8Array[] = [];
      let size = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        size += value.byteLength;
      }
      stored = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) {
        stored.set(chunk, offset);
        offset += chunk.byteLength;
      }
    });
    const env = {
      MAIL_STORAGE: { put, get: jest.fn(), delete: jest.fn().mockResolvedValue(undefined) },
      MKETY_MAIL_INTERNAL_SECRET: 'test-secret',
    };
    const payload = new Uint8Array([1, 2, 3, 4]);
    const request = new Request('https://mail-content.mkety.com/', {
      method: 'POST',
      headers: {
        authorization: 'Bearer test-secret',
        'content-type': 'application/octet-stream',
        'content-length': String(payload.byteLength),
        'x-mkety-operation': 'put',
        'x-mkety-key': 'mail/test/object',
      },
      body: payload,
    });

    const response = await worker.fetch(request, env);

    expect(response.status).toBe(200);
    expect(put).toHaveBeenCalledWith('mail/test/object', expect.any(ReadableStream), {
      httpMetadata: { contentType: 'application/octet-stream' },
    });
    expect(stored).toEqual(payload);
    await expect(response.json()).resolves.toEqual({ ok: true, key: 'mail/test/object', size: 4 });
  });
});
