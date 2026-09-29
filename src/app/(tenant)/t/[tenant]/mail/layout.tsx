import {
  Activity,
  AppWindow,
  AtSign,
  BookUser,
  Code2,
  ContactRound,
  Globe2,
  Inbox,
  LayoutDashboard,
  Mail,
  Megaphone,
  MoveRight,
  Network,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';

const items = [
  { href: '', label: 'Overview', icon: LayoutDashboard },
  { href: '/inbox', label: 'Inbox', icon: Inbox },
  { href: '/shared', label: 'Shared inboxes', icon: Users },
  { href: '/domains', label: 'Domains', icon: Globe2 },
  { href: '/mailboxes', label: 'Mailboxes', icon: AtSign },
  { href: '/contacts', label: 'Contacts', icon: ContactRound },
  { href: '/templates', label: 'Templates', icon: BookUser },
  { href: '/customer-updates', label: 'Customer Updates', icon: Megaphone },
  { href: '/developer', label: 'Developer', icon: Code2 },
  { href: '/analytics', label: 'Analytics', icon: Activity },
  { href: '/apps', label: 'Mail apps', icon: AppWindow },
  { href: '/migration', label: 'Migration', icon: MoveRight },
  { href: '/automation', label: 'Automation', icon: Network },
] as const;

export default async function MailLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ tenant: string }>;
}) {
  const { tenant } = await params;
  const base = `/t/${tenant}/mail`;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border bg-card p-3">
        <div className="flex items-center gap-3 border-b px-2 pb-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Mail className="h-4 w-4" />
          </div>
          <div>
            <p className="font-semibold">Mkety Mail</p>
            <p className="text-xs text-muted-foreground">Business email & customer communication</p>
          </div>
        </div>
        <nav className="mt-3 flex gap-2 overflow-x-auto pb-1" aria-label="Mkety Mail">
          {items.map(({ href, label, icon: Icon }) => (
            <Link
              className="inline-flex shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition hover:border-primary/40 hover:bg-primary/5"
              href={base + href}
              key={href || 'overview'}
            >
              <Icon className="h-4 w-4 text-primary" />
              {label}
            </Link>
          ))}
        </nav>
      </div>
      {children}
    </div>
  );
}
