import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { I18nProvider } from "@/lib/i18n";
import ShiftClock from "./pages/ShiftClock";

// Lazy load additional management modules on demand
const Index = lazy(() => import("./pages/Index"));
const Auth = lazy(() => import("./pages/Auth"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Builders = lazy(() => import("./pages/Builders"));
const Managers = lazy(() => import("./pages/Managers"));
const ProjectDetails = lazy(() => import("./pages/ProjectDetails"));
const Statements = lazy(() => import("./pages/Statements"));
const Storage = lazy(() => import("./pages/Storage"));
const Invite = lazy(() => import("./pages/Invite"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      refetchOnWindowFocus: false,
    },
  },
});

const RouteFallback = () => (
  <div className="flex min-h-screen items-center justify-center bg-background">
    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-label="Loading" />
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <I18nProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              {/* Primary Field Hours App (Cloudflare D1 Workforce Time Clock) */}
              <Route path="/" element={<ShiftClock />} />
              <Route path="/join" element={<ShiftClock />} />
              <Route path="/clock" element={<ShiftClock />} />

              {/* Construction Management & Reports Subsystems */}
              <Route path="/buildtrack" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/builders" element={<Builders />} />
              <Route path="/managers" element={<Managers />} />
              <Route path="/project/:projectId" element={<ProjectDetails />} />
              <Route path="/statements" element={<Statements />} />
              <Route path="/storage" element={<Storage />} />
              <Route path="/invite" element={<Invite />} />

              {/* Catch-all */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </I18nProvider>
  </QueryClientProvider>
);

export default App;
