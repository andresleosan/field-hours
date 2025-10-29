import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { HardHat, Clock, Users, Package, TrendingUp } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-secondary/10">
      {/* Hero Section */}
      <header className="container mx-auto px-4 py-6">
        <nav className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-primary p-2">
              <HardHat className="h-6 w-6 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold">BuildTrack Pro</span>
          </div>
          <Button onClick={() => navigate("/auth")} size="lg">
            Get Started
          </Button>
        </nav>
      </header>

      <main className="container mx-auto px-4">
        {/* Hero Content */}
        <div className="py-20 text-center space-y-6">
          <h1 className="text-5xl md:text-6xl font-bold tracking-tight">
            Construction Project
            <br />
            <span className="text-primary">Management Made Simple</span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Track time, manage materials, monitor costs, and keep your construction projects on schedule and within budget.
          </p>
          <div className="flex gap-4 justify-center pt-4">
            <Button onClick={() => navigate("/auth")} size="lg" className="text-lg px-8">
              Start Free Trial
            </Button>
            <Button onClick={() => navigate("/auth")} variant="outline" size="lg" className="text-lg px-8">
              Sign In
            </Button>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 py-16">
          <div className="bg-card p-6 rounded-lg border shadow-sm">
            <div className="rounded-lg bg-primary/10 p-3 w-fit mb-4">
              <Clock className="h-6 w-6 text-primary" />
            </div>
            <h3 className="font-semibold text-lg mb-2">Time Tracking</h3>
            <p className="text-muted-foreground">
              Clock in/out with GPS location tracking for accurate time and location records.
            </p>
          </div>

          <div className="bg-card p-6 rounded-lg border shadow-sm">
            <div className="rounded-lg bg-secondary/10 p-3 w-fit mb-4">
              <Package className="h-6 w-6 text-secondary" />
            </div>
            <h3 className="font-semibold text-lg mb-2">Material Management</h3>
            <p className="text-muted-foreground">
              Track material usage and maintain accurate inventory across all projects.
            </p>
          </div>

          <div className="bg-card p-6 rounded-lg border shadow-sm">
            <div className="rounded-lg bg-primary/10 p-3 w-fit mb-4">
              <TrendingUp className="h-6 w-6 text-primary" />
            </div>
            <h3 className="font-semibold text-lg mb-2">Cost Monitoring</h3>
            <p className="text-muted-foreground">
              Keep track of invoices and expenses to stay within project budgets.
            </p>
          </div>

          <div className="bg-card p-6 rounded-lg border shadow-sm">
            <div className="rounded-lg bg-secondary/10 p-3 w-fit mb-4">
              <Users className="h-6 w-6 text-secondary" />
            </div>
            <h3 className="font-semibold text-lg mb-2">Team Collaboration</h3>
            <p className="text-muted-foreground">
              Separate interfaces for managers and builders with role-based access.
            </p>
          </div>
        </div>

        {/* CTA Section */}
        <div className="bg-gradient-to-r from-primary to-secondary text-primary-foreground rounded-2xl p-12 text-center my-16">
          <h2 className="text-3xl font-bold mb-4">Ready to streamline your construction projects?</h2>
          <p className="text-lg mb-8 opacity-90">
            Join hundreds of construction teams using BuildTrack Pro to manage their projects efficiently.
          </p>
          <Button onClick={() => navigate("/auth")} size="lg" variant="secondary" className="text-lg px-8">
            Get Started Now
          </Button>
        </div>
      </main>

      <footer className="border-t mt-20">
        <div className="container mx-auto px-4 py-8 text-center text-muted-foreground">
          <p>&copy; 2025 BuildTrack Pro. Professional construction management.</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
