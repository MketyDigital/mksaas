import Link from 'next/link';

import { AppLogo } from '@/shared/components/brand/Logo';

export function LandingFooter() {
  return (
    <footer className="border-t bg-card/50 py-12 px-4">
      <div className="container mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
          <div className="col-span-2 md:col-span-1">
            <AppLogo href="/" size="sm" className="mb-3" />
            <p className="text-sm text-muted-foreground max-w-xs">
              Technology platform for AI, automation, deployment, business solutions, practical learning, and Enterprise delivery.
            </p>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-foreground mb-3">Platform</h4>
            <ul className="space-y-2 text-sm">
              <li><Link href="/platform" className="text-muted-foreground hover:text-foreground transition-colors">Platform</Link></li>
              <li><Link href="/workspaces" className="text-muted-foreground hover:text-foreground transition-colors">Workspaces</Link></li>
              <li><Link href="/solutions" className="text-muted-foreground hover:text-foreground transition-colors">SolutionHub</Link></li>
              <li><Link href="/pricing" className="text-muted-foreground hover:text-foreground transition-colors">Pricing</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-foreground mb-3">Resources</h4>
            <ul className="space-y-2 text-sm">
              <li><Link href="/docs" className="text-muted-foreground hover:text-foreground transition-colors">Documentation</Link></li>
              <li><Link href="/academy" className="text-muted-foreground hover:text-foreground transition-colors">Academy</Link></li>
              <li><Link href="/enterprise" className="text-muted-foreground hover:text-foreground transition-colors">Enterprise</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-foreground mb-3">Company</h4>
            <ul className="space-y-2 text-sm">
              <li><Link href="/about" className="text-muted-foreground hover:text-foreground transition-colors">About</Link></li>
              <li><Link href="/contact" className="text-muted-foreground hover:text-foreground transition-colors">Contact</Link></li>
              <li><Link href="/privacy" className="text-muted-foreground hover:text-foreground transition-colors">Privacy Policy</Link></li>
              <li><Link href="/terms" className="text-muted-foreground hover:text-foreground transition-colors">Terms of Service</Link></li>
            </ul>
          </div>
        </div>

        <div className="flex flex-col md:flex-row items-center justify-between gap-4 pt-8 border-t border-border/60">
          <p className="text-xs text-muted-foreground">
            © {new Date().getUTCFullYear()} Mkety. All rights reserved.
          </p>
          <p className="text-xs text-muted-foreground">support@mkety.com</p>
        </div>
      </div>
    </footer>
  );
}
