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
              Build, automate, deploy, and manage digital products from one Mkety Platform workspace.
            </p>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-foreground mb-3">Platform</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="#features" className="text-muted-foreground hover:text-foreground transition-colors">
                  Features
                </Link>
              </li>
              <li>
                <Link href="#pricing" className="text-muted-foreground hover:text-foreground transition-colors">
                  Plans & Pricing
                </Link>
              </li>
              <li>
                <Link href="#how-it-works" className="text-muted-foreground hover:text-foreground transition-colors">
                  How It Works
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-foreground mb-3">Resources</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/docs" className="text-muted-foreground hover:text-foreground transition-colors">
                  Documentation
                </Link>
              </li>
              <li>
                <span className="text-muted-foreground/60 cursor-default">Academy</span>
              </li>
              <li>
                <span className="text-muted-foreground/60 cursor-default">SolutionHub</span>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-foreground mb-3">Company</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <span className="text-muted-foreground/60 cursor-default">About</span>
              </li>
              <li>
                <span className="text-muted-foreground/60 cursor-default">Contact</span>
              </li>
              <li>
                <span className="text-muted-foreground/60 cursor-default">Privacy</span>
              </li>
              <li>
                <span className="text-muted-foreground/60 cursor-default">Terms</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="flex flex-col md:flex-row items-center justify-between gap-4 pt-8 border-t border-border/60">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} Mkety. Platform and Academy.
          </p>
          <p className="text-xs text-muted-foreground/70">AI · Automation · Deploy · Workspaces · SolutionHub</p>
        </div>
      </div>
    </footer>
  );
}
