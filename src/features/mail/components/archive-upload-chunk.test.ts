import { postArchiveChunkWithRetry } from './archive-upload-chunk';

describe('postArchiveChunkWithRetry', () => {
  const wait = jest.fn().mockResolvedValue(undefined);
  const mockResponse = (status: number) => ({ ok: status >= 200 && status < 300, status }) as Response;

  beforeEach(() => {
    wait.mockClear();
  });

  it('retries a transient server failure and returns the successful response', async () => {
    const send = jest
      .fn<Promise<Response>, []>()
      .mockResolvedValueOnce(mockResponse(500))
      .mockResolvedValueOnce(mockResponse(201));

    const response = await postArchiveChunkWithRetry(send, wait);

    expect(response.status).toBe(201);
    expect(send).toHaveBeenCalledTimes(2);
    expect(wait).toHaveBeenCalledTimes(1);
  });

  it('does not retry permanent client errors', async () => {
    const send = jest.fn<Promise<Response>, []>().mockResolvedValue(mockResponse(413));

    const response = await postArchiveChunkWithRetry(send, wait);

    expect(response.status).toBe(413);
    expect(send).toHaveBeenCalledTimes(1);
    expect(wait).not.toHaveBeenCalled();
  });

  it('stops after three attempts and returns the final server response for diagnostics', async () => {
    const send = jest.fn<Promise<Response>, []>().mockResolvedValue(mockResponse(500));

    const response = await postArchiveChunkWithRetry(send, wait);

    expect(response.status).toBe(500);
    expect(send).toHaveBeenCalledTimes(3);
    expect(wait).toHaveBeenCalledTimes(2);
  });

  it('retries a network failure because the chunk key is idempotent', async () => {
    const send = jest
      .fn<Promise<Response>, []>()
      .mockRejectedValueOnce(new Error('connection reset'))
      .mockResolvedValueOnce(mockResponse(201));

    const response = await postArchiveChunkWithRetry(send, wait);

    expect(response.status).toBe(201);
    expect(send).toHaveBeenCalledTimes(2);
    expect(wait).toHaveBeenCalledTimes(1);
  });
});
