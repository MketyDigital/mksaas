'use client';

import { useRouter } from 'next/navigation';
import { type FormEvent, useState } from 'react';

import { Button } from '@/shared/components/ui';

import { formatArchiveChunkFailure } from './archive-upload-error';

const CHUNK_BYTES = 256_000;

export function ArchiveUploadForm({
  tenantSlug,
  mailboxOptions,
}: {
  tenantSlug: string;
  mailboxOptions: Array<{ id: string; address: string }>;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const mailboxId = String(new FormData(form).get('mailboxId') || '');
    const input = form.elements.namedItem('files') as HTMLInputElement | null;
    const files = Array.from(input?.files || []);
    if (!mailboxId || !files.length) return;
    if (
      files.length > 20 ||
      files.some((file) => file.size <= 0 || file.size > 10_000_000) ||
      files.reduce((sum, file) => sum + file.size, 0) > 25_000_000
    ) {
      setError('Choose up to 20 non-empty files, each no larger than 10 MB and 25 MB total.');
      return;
    }

    setBusy(true);
    setError('');
    const uploadId = crypto.randomUUID();
    const manifest: Array<{ name: string; size: number; chunks: number }> = [];
    try {
      let completedChunks = 0;
      const totalChunks = files.reduce((sum, file) => sum + Math.ceil(file.size / CHUNK_BYTES), 0);
      for (const [fileIndex, file] of files.entries()) {
        const chunks = Math.ceil(file.size / CHUNK_BYTES);
        manifest.push({ name: file.name, size: file.size, chunks });
        for (let chunkIndex = 0; chunkIndex < chunks; chunkIndex += 1) {
          const start = chunkIndex * CHUNK_BYTES;
          let response: Response;
          try {
            response = await fetch(
              `/api/mail/migration/archive/chunk?tenant=${encodeURIComponent(tenantSlug)}&uploadId=${uploadId}&fileIndex=${fileIndex}&chunkIndex=${chunkIndex}`,
              {
                method: 'POST',
                headers: { 'content-type': 'application/octet-stream' },
                body: file.slice(start, start + CHUNK_BYTES),
              },
            );
          } catch {
            throw new Error(formatArchiveChunkFailure({ fileName: file.name, chunkIndex, chunkCount: chunks }));
          }
          if (!response.ok) {
            throw new Error(
              formatArchiveChunkFailure({
                fileName: file.name,
                chunkIndex,
                chunkCount: chunks,
                status: response.status,
                rayId: response.headers.get('cf-ray'),
              }),
            );
          }
          completedChunks += 1;
          setProgress(`Uploading ${completedChunks} of ${totalChunks} pieces`);
        }
      }

      setProgress('Checking files and starting the import…');
      const response = await fetch(`/api/mail/migration/archive/complete?tenant=${encodeURIComponent(tenantSlug)}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ mailboxId, uploadId, files: manifest }),
      });
      const result = (await response.json().catch(() => null)) as {
        runId?: string;
        total?: number;
        error?: string;
      } | null;
      if (!response.ok || !result?.runId) {
        throw new Error(
          result?.error === 'size'
            ? 'One or more files exceed the allowed size.'
            : result?.error === 'type'
              ? 'Choose EML, MBOX or ZIP files.'
              : result?.error === 'active'
                ? 'An archive import is already running. Wait for it to finish before starting another.'
                : 'The server could not validate the uploaded files. No import was started.',
        );
      }
      router.push(
        `/app/${encodeURIComponent(tenantSlug)}/mail/migration?queued=${encodeURIComponent(result.runId)}&total=${result.total || 0}`,
      );
      router.refresh();
    } catch (cause) {
      if (manifest.length) {
        await fetch(`/api/mail/migration/archive/abort?tenant=${encodeURIComponent(tenantSlug)}`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ uploadId, files: manifest }),
        }).catch(() => undefined);
      }
      setError(cause instanceof Error ? cause.message : 'The archive upload could not be completed.');
      setProgress('');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-3">
      <label className="grid gap-2 text-sm font-medium">
        Destination mailbox
        <select className="rounded-xl border bg-background px-3 py-2.5" name="mailboxId" required>
          <option value="">Choose mailbox</option>
          {mailboxOptions.map((mailbox) => (
            <option key={mailbox.id} value={mailbox.id}>
              {mailbox.address}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-2 text-sm font-medium">
        EML, MBOX or ZIP files
        <input
          accept=".eml,.mbox,.zip,message/rfc822,application/zip"
          className="rounded-xl border p-3"
          multiple
          name="files"
          required
          type="file"
        />
      </label>
      <p className="text-xs text-muted-foreground">
        Select multiple ZIP parts together for one import. Up to 20 files per batch, 10 MB per file, 25 MB total, and
        2,000 messages. Files upload in small pieces and the import continues in the background.
      </p>
      {progress ? (
        <p aria-live="polite" className="text-sm text-muted-foreground">
          {progress}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <Button className="w-fit" disabled={busy} type="submit">
        {busy ? 'Uploading…' : 'Import messages'}
      </Button>
    </form>
  );
}
