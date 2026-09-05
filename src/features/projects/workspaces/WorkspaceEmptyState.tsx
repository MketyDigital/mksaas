import Link from 'next/link';

export function WorkspaceEmptyState({
  actions = [],
  description,
  title,
}: {
  title: string;
  description: string;
  actions?: { href: string; label: string }[];
}) {
  return (
    <div className="rounded-2xl border border-dashed bg-card/60 p-8">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>
      {actions.length > 0 && (
        <div className="mt-5 flex flex-wrap gap-3">
          {actions.map((action) => (
            <Link key={action.href} href={action.href} className="rounded-md border px-4 py-2 text-sm font-medium transition hover:bg-muted/70">
              {action.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
