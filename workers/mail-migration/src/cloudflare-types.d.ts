declare module 'cloudflare:sockets' {
  export type SocketAddress = { hostname: string; port: number };
  export type Socket = {
    readable: ReadableStream<Uint8Array>;
    writable: WritableStream<Uint8Array>;
    opened: Promise<unknown>;
    closed: Promise<void>;
    close(): Promise<void>;
  };
  export function connect(
    address: SocketAddress,
    options?: { secureTransport?: 'off' | 'on' | 'starttls'; allowHalfOpen?: boolean },
  ): Socket;
}

type Queue<T> = { send(body: T): Promise<void> };
type MessageBatch<T> = {
  messages: Array<{ body: T; attempts: number; ack(): void; retry(options?: { delaySeconds?: number }): void }>;
};
type ExportedHandler<Env = unknown, QueueBody = unknown> = {
  fetch?(request: Request, env: Env): Promise<Response> | Response;
  queue?(batch: MessageBatch<QueueBody>, env: Env): Promise<void> | void;
};
