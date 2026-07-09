import type { CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { HardHat, Clock, Package, Receipt, ShieldCheck, ClipboardCheck, ArrowRight } from "lucide-react";

const capabilities = [
  {
    icon: Clock,
    title: "Time on site",
    body: "Builders clock in against a job, not just a project. Location is stamped at the moment of the punch.",
  },
  {
    icon: Package,
    title: "Materials & tools",
    body: "One inventory across the yard and every site. Requests, deliveries and checkouts stay on the same ledger.",
  },
  {
    icon: Receipt,
    title: "Invoices",
    body: "Photograph a supplier invoice on site. It is read, matched to the project and totalled against the job.",
  },
  {
    icon: ShieldCheck,
    title: "Risk assessments",
    body: "Safety documents live where the crew is. Signatures are captured before the first hour is logged.",
  },
];

const roles = [
  {
    label: "Manager",
    title: "The office view",
    points: ["Create projects and import job lists", "Review submitted work with photos", "Statements, exports and supplier records"],
  },
  {
    label: "Builder",
    title: "The site view",
    points: ["Clock in and out against a job", "Log materials, invoices and day reports", "Request tools, deliveries and collections"],
  },
];

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur-md">
        <nav className="container mx-auto flex items-center justify-between px-4 py-3.5">
          <div className="flex items-center gap-2.5">
            <div className="rounded-md bg-primary p-1.5">
              <HardHat className="h-[18px] w-[18px] text-primary-foreground" strokeWidth={1.75} />
            </div>
            <span className="text-[15px] font-semibold tracking-tight">BuildTrack Pro</span>
          </div>
          <Button onClick={() => navigate("/auth")} size="sm">
            Sign in
          </Button>
        </nav>
      </header>

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden border-b border-border">
          <div className="blueprint-grid pointer-events-none absolute inset-0" aria-hidden="true" />
          <div className="container relative mx-auto px-4 pb-24 pt-20 md:pb-32 md:pt-28">
            <div className="max-w-3xl">
              <p className="reveal label-eyebrow font-mono" style={{ "--i": 0 } as CSSProperties}>
                Construction project management
              </p>
              <h1
                className="reveal mt-5 text-[2.75rem] font-extrabold leading-[1.02] md:text-7xl"
                style={{ "--i": 1 } as CSSProperties}
              >
                Every hour, material and invoice — recorded where the work happens.
              </h1>
              <p
                className="reveal mt-7 max-w-xl text-lg leading-relaxed text-muted-foreground"
                style={{ "--i": 2 } as CSSProperties}
              >
                BuildTrack Pro runs on the phone in a builder's pocket and the screen on a manager's desk. Same
                projects, same jobs, one record of what was done.
              </p>
              <div className="reveal mt-10 flex flex-wrap gap-3" style={{ "--i": 3 } as CSSProperties}>
                <Button onClick={() => navigate("/auth")} size="lg" className="group">
                  Sign in
                  <ArrowRight
                    className="transition-transform duration-200 group-hover:translate-x-0.5"
                    strokeWidth={1.75}
                  />
                </Button>
                <Button onClick={() => navigate("/auth")} size="lg" variant="outline">
                  I have an invitation code
                </Button>
              </div>
            </div>
          </div>
          <div className="hi-vis-rule absolute inset-x-0 bottom-0 h-1" aria-hidden="true" />
        </section>

        {/* Capabilities — asymmetric bento, 1px rules, no shadows */}
        <section className="container mx-auto px-4 py-20 md:py-28">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <h2 className="max-w-md text-3xl font-bold md:text-4xl">What it keeps track of</h2>
            <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
              Four records, captured once, at the point they happen. Nothing gets re-typed into a spreadsheet at the
              end of the week.
            </p>
          </div>

          <div className="mt-14 grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2">
            {capabilities.map(({ icon: Icon, title, body }) => (
              <article key={title} className="group bg-card p-8 transition-colors duration-200 hover:bg-accent/40">
                <div className="w-fit rounded-md border border-border bg-muted p-2.5">
                  <Icon className="h-[18px] w-[18px] text-foreground" strokeWidth={1.75} />
                </div>
                <h3 className="mt-6 text-lg font-semibold">{title}</h3>
                <p className="mt-2.5 max-w-sm text-sm leading-relaxed text-muted-foreground">{body}</p>
              </article>
            ))}
          </div>
        </section>

        {/* Two roles, one record */}
        <section className="border-y border-border bg-muted/40">
          <div className="container mx-auto px-4 py-20 md:py-28">
            <h2 className="max-w-lg text-3xl font-bold md:text-4xl">Two roles, one record</h2>
            <div className="mt-14 grid gap-8 md:grid-cols-2">
              {roles.map(({ label, title, points }) => (
                <div key={label} className="rounded-lg border border-border bg-card p-8">
                  <p className="label-eyebrow font-mono">{label}</p>
                  <h3 className="mt-4 text-2xl font-bold">{title}</h3>
                  <ul className="mt-7 space-y-3.5">
                    {points.map((point) => (
                      <li key={point} className="flex items-start gap-3 text-sm leading-relaxed">
                        <ClipboardCheck
                          className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
                          strokeWidth={1.75}
                          aria-hidden="true"
                        />
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <p className="mt-10 max-w-xl text-sm leading-relaxed text-muted-foreground">
              Accounts are created from a QR invitation issued by a manager. There is no open sign-up.
            </p>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="container mx-auto flex flex-col gap-2 px-4 py-10 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>BuildTrack Pro — construction project management.</p>
          <p className="font-mono text-xs uppercase tracking-[0.09em]">Private deployment</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
