'use client';

import { useState, useTransition } from 'react';

type DnsRecord = {
  id: string;
  type: string;
  name: string;
  content: string;
  ttl: number;
  proxied?: boolean;
  priority?: number;
};

const recordTypes = ['A', 'AAAA', 'CNAME', 'TXT', 'MX', 'SRV', 'CAA'] as const;

export function DnsRecordsClient({
  tenantSlug,
  domainId,
  domain,
  initialRecords,
}: {
  tenantSlug: string;
  domainId: string;
  domain: string;
  initialRecords: DnsRecord[];
}) {
  const [records, setRecords] = useState(initialRecords);
  const [type, setType] = useState<(typeof recordTypes)[number]>('A');
  const [name, setName] = useState('@');
  const [content, setContent] = useState('');
  const [priority, setPriority] = useState('10');
  const [proxied, setProxied] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const endpoint = `/api/tenants/${tenantSlug}/managed-domains/${domainId}/dns`;

  const createRecord = () => {
    startTransition(async () => {
      setMessage(null);
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          name,
          content,
          ttl: 1,
          proxied,
          ...(type === 'MX' ? { priority: Number(priority) || 0 } : {}),
        }),
      });
      const result = await response.json();
      if (!result.success) {
        setMessage(result.error || 'Unable to create DNS record.');
        return;
      }
      setRecords((current) => [...current, result.data]);
      setContent('');
      setMessage(result.message || 'DNS record created.');
    });
  };

  const saveRecord = (record: DnsRecord) => {
    startTransition(async () => {
      setMessage(null);
      const response = await fetch(endpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: record.id,
          type: record.type,
          name: record.name,
          content: record.content,
          ttl: record.ttl,
          proxied: record.proxied,
          priority: record.priority,
        }),
      });
      const result = await response.json();
      if (!result.success) {
        setMessage(result.error || 'Unable to update DNS record.');
        return;
      }
      setRecords((current) => current.map((item) => item.id === record.id ? result.data : item));
      setMessage(result.message || 'DNS record updated.');
    });
  };

  const removeRecord = (recordId: string) => {
    startTransition(async () => {
      setMessage(null);
      const response = await fetch(endpoint, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recordId }),
      });
      const result = await response.json();
      if (!result.success) {
        setMessage(result.error || 'Unable to remove DNS record.');
        return;
      }
      setRecords((current) => current.filter((item) => item.id !== recordId));
      setMessage(result.message || 'DNS record removed.');
    });
  };

  const setRecord = (id: string, patch: Partial<DnsRecord>) => {
    setRecords((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item));
  };

  return (
    <div className="space-y-5">
      {message ? <div className="rounded-lg border bg-muted/30 px-3 py-2 text-sm">{message}</div> : null}

      <div className="rounded-xl border bg-muted/20 p-4">
        <p className="font-semibold">Add DNS record</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Use @ for {domain}. Short hostnames such as www are automatically scoped to this domain.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-[110px_1fr_2fr_110px_auto]">
          <select
            value={type}
            onChange={(event) => setType(event.target.value as (typeof recordTypes)[number])}
            className="rounded-lg border bg-background px-3 py-2 text-sm"
            disabled={isPending}
          >
            {recordTypes.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="@ or www"
            className="rounded-lg border bg-background px-3 py-2 text-sm"
            disabled={isPending}
          />
          <input
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder="Record value"
            className="rounded-lg border bg-background px-3 py-2 text-sm"
            disabled={isPending}
          />
          {type === 'MX' ? (
            <input
              value={priority}
              onChange={(event) => setPriority(event.target.value)}
              type="number"
              min="0"
              placeholder="Priority"
              className="rounded-lg border bg-background px-3 py-2 text-sm"
              disabled={isPending}
            />
          ) : (
            <label className="flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium">
              <input
                type="checkbox"
                checked={proxied}
                onChange={(event) => setProxied(event.target.checked)}
                disabled={isPending || !['A', 'AAAA', 'CNAME'].includes(type)}
              />
              Proxy
            </label>
          )}
          <button
            type="button"
            onClick={createRecord}
            disabled={isPending || !name.trim() || !content.trim()}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            Add
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {records.length === 0 ? (
          <div className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">
            No editable DNS records yet. Provider-managed nameserver/SOA records are kept out of this list intentionally.
          </div>
        ) : records.map((record) => (
          <div key={record.id} className="grid gap-2 rounded-xl border p-4 lg:grid-cols-[90px_1fr_2fr_100px_auto] lg:items-center">
            <select
              value={record.type}
              onChange={(event) => setRecord(record.id, { type: event.target.value })}
              className="rounded-lg border bg-background px-2 py-2 text-sm"
              disabled={isPending}
            >
              {recordTypes.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
            <input
              value={record.name}
              onChange={(event) => setRecord(record.id, { name: event.target.value })}
              className="min-w-0 rounded-lg border bg-background px-3 py-2 text-sm"
              disabled={isPending}
            />
            <input
              value={record.content}
              onChange={(event) => setRecord(record.id, { content: event.target.value })}
              className="min-w-0 rounded-lg border bg-background px-3 py-2 text-sm"
              disabled={isPending}
            />
            {record.type === 'MX' ? (
              <input
                value={record.priority ?? 0}
                onChange={(event) => setRecord(record.id, { priority: Number(event.target.value) || 0 })}
                type="number"
                min="0"
                className="rounded-lg border bg-background px-2 py-2 text-sm"
                disabled={isPending}
              />
            ) : (
              <label className="flex items-center gap-2 text-xs font-medium">
                <input
                  type="checkbox"
                  checked={record.proxied === true}
                  onChange={(event) => setRecord(record.id, { proxied: event.target.checked })}
                  disabled={isPending || !['A', 'AAAA', 'CNAME'].includes(record.type)}
                />
                Proxy
              </label>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => saveRecord(record)}
                disabled={isPending}
                className="rounded-lg border px-3 py-2 text-xs font-semibold hover:bg-muted disabled:opacity-50"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => removeRecord(record.id)}
                disabled={isPending}
                className="rounded-lg border px-3 py-2 text-xs font-semibold text-destructive hover:bg-destructive/10 disabled:opacity-50"
              >
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
