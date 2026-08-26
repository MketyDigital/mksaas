import Link from 'next/link';
import { auth } from '@/shared/lib/auth';

export default async function CreateWorkspacePage() {
  const session = await auth();
  if (!session?.user) {
    return <main className="mx-auto flex min-h-screen max-w-lg items-center justify-center p-6"><div className="w-full rounded-xl border bg-card p-6 shadow-sm"><h1 className="text-2xl font-bold">Create a workspace</h1><p className="mt-2 text-sm text-muted-foreground">Sign in first.</p><Link href="/login" className="mt-6 inline-flex rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Continue to login</Link></div></main>;
  }

  return <main className="mx-auto flex min-h-screen max-w-lg items-center justify-center p-6"><div className="w-full rounded-xl border bg-card p-6 shadow-sm"><h1 className="text-2xl font-bold">Create a workspace</h1><p className="mt-2 text-sm text-muted-foreground">Create an organization and become its first administrator.</p><form action="/api/workspaces" method="post" className="mt-6 space-y-4"><label className="block text-sm font-medium">Workspace name<input name="name" required placeholder="Acme" className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm" /></label><label className="block text-sm font-medium">Workspace slug<input name="slug" placeholder="acme" className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm" /><span className="mt-1 block text-xs text-muted-foreground">Used in URLs such as /t/acme.</span></label><label className="block text-sm font-medium">Description<textarea name="description" rows={3} className="mt-1 w-full rounded-md border bg-background p-3 text-sm" /></label><button type="submit" className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Create workspace</button></form></div></main>;
}
