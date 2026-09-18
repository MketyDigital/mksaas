import Link from 'next/link';

import { auth } from '@/shared/lib/auth';

export const metadata = {
  title: 'Create Workspace | Mkety',
  description: 'Create your first Mkety workspace.',
  robots: { index: false, follow: false },
};

export default async function CreateWorkspacePage() {
  const session = await auth();

  if (!session?.user) {
    return (
      <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-b from-background via-background to-muted/30 p-6">
        <div className="pointer-events-none absolute -right-36 -top-36 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative w-full max-w-lg rounded-3xl border bg-card/90 p-7 shadow-xl backdrop-blur md:p-9">
          <img src="/mkety-logo.png" alt="Mkety" className="mb-6 h-9 w-auto" />
          <h1 className="text-3xl font-bold tracking-tight">Create your Mkety workspace</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Sign in first, then create the organization where your projects and Mkety Workspaces will live.
          </p>
          <Link
            href="/login"
            className="mt-7 inline-flex rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground"
          >
            Continue to sign in
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-b from-background via-background to-muted/30 p-6">
      <div className="pointer-events-none absolute -right-36 -top-36 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
      <div className="relative w-full max-w-lg rounded-3xl border bg-card/90 p-7 shadow-xl backdrop-blur md:p-9">
        <img src="/mkety-logo.png" alt="Mkety" className="mb-6 h-9 w-auto" />
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">First workspace</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Set up your workspace</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          This becomes your organization in Mkety. You can invite people and create projects after setup.
        </p>

        <form action="/api/workspaces" method="post" className="mt-7 space-y-5">
          <label className="block text-sm font-medium">
            Workspace name
            <input
              name="name"
              required
              maxLength={120}
              placeholder="Your company or team"
              className="mt-2 h-11 w-full rounded-xl border bg-background px-3 text-sm outline-none transition focus:border-primary"
            />
          </label>
          <label className="block text-sm font-medium">
            Workspace address
            <input
              name="slug"
              maxLength={80}
              placeholder="your-team"
              className="mt-2 h-11 w-full rounded-xl border bg-background px-3 text-sm outline-none transition focus:border-primary"
            />
            <span className="mt-2 block text-xs text-muted-foreground">
              Used in your private Mkety workspace address. Lowercase letters, numbers and hyphens work best.
            </span>
          </label>
          <label className="block text-sm font-medium">
            Description <span className="font-normal text-muted-foreground">(optional)</span>
            <textarea
              name="description"
              rows={3}
              maxLength={500}
              placeholder="What will this workspace be used for?"
              className="mt-2 w-full rounded-xl border bg-background p-3 text-sm outline-none transition focus:border-primary"
            />
          </label>
          <button
            type="submit"
            className="w-full rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground transition hover:opacity-95"
          >
            Create workspace
          </button>
        </form>
      </div>
    </main>
  );
}
