import type { ReactNode } from "react";
import { NavLink, Link } from "react-router-dom";
import { HardHat, LogOut, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { homeOf, signOutAndRedirect, type AppRole } from "@/hooks/useRequireRole";

const MANAGER_NAV = [
  { to: "/managers", label: "Overview" },
  { to: "/statements", label: "Statements" },
  { to: "/storage", label: "Storage" },
  { to: "/invite", label: "Invite" },
];

interface AppShellProps {
  role: AppRole;
  fullName?: string;
  /** Overrides the role eyebrow, e.g. "On the clock". */
  eyebrow?: string;
  /** Tints the brand mark hi-vis while something is live (builder clocked in). */
  live?: boolean;
  /** Intercept sign-out (builders must clock out first). Default signs out. */
  onSignOut?: () => void;
  children: ReactNode;
}

/**
 * The one page chrome: brand + identity + persistent nav + sign out.
 * Managers get section tabs; builders get a single-screen shell.
 */
export function AppShell({ role, fullName, eyebrow, live = false, onSignOut, children }: AppShellProps) {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="container mx-auto flex items-center justify-between gap-4 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              to={homeOf(role)}
              className={cn("rounded-md p-1.5 transition-colors", live ? "bg-brand" : "bg-primary")}
              aria-label="Home"
            >
              <HardHat className={cn("h-[18px] w-[18px]", live ? "text-brand-foreground" : "text-primary-foreground")} strokeWidth={1.75} />
            </Link>
            <div className="min-w-0">
              <p className="label-eyebrow font-mono">{eyebrow ?? role}</p>
              <p className="truncate text-[15px] font-semibold leading-tight">{fullName || "BuildTrack Pro"}</p>
            </div>
          </div>

          {role === "manager" && (
            <nav aria-label="Sections" className="hidden md:flex items-center gap-1">
              {MANAGER_NAV.map(({ to, label }) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) =>
                    cn(
                      "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                      isActive ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground",
                    )
                  }
                >
                  {label}
                </NavLink>
              ))}
            </nav>
          )}

          <Button variant="outline" size="sm" onClick={onSignOut ?? signOutAndRedirect}>
            <LogOut strokeWidth={1.75} />
            <span className="hidden sm:inline">Sign out</span>
          </Button>
        </div>

        {/* Same nav as a scrollable row on small screens */}
        {role === "manager" && (
          <nav aria-label="Sections" className="container mx-auto flex gap-1 overflow-x-auto px-4 pb-2 md:hidden">
            {MANAGER_NAV.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  cn(
                    "shrink-0 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                    isActive ? "bg-accent text-foreground" : "text-muted-foreground",
                  )
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>
        )}
      </header>

      <main className="container mx-auto space-y-8 px-4 py-8">{children}</main>
    </div>
  );
}

/** Full-screen spinner used while the session guard resolves. */
export function PageLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-label="Loading" />
    </div>
  );
}
