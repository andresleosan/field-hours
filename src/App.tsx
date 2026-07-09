import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Loader2 } from "lucide-react";
import Index from "./pages/Index";

// Index stays eager (it is the entry point). Everything else loads on demand so
// the first paint does not carry xlsx, html5-qrcode and the whole dialog tree.
const Auth = lazy(() => import("./pages/Auth"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Builders = lazy(() => import("./pages/Builders"));
const Managers = lazy(() => import("./pages/Managers"));
const ProjectDetails = lazy(() => import("./pages/ProjectDetails"));
const Statements = lazy(() => import("./pages/Statements"));
const Storage = lazy(() => import("./pages/Storage"));
const Invite = lazy(() => import("./pages/Invite"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

const RouteFallback = () => (
  <div className="flex min-h-screen items-center justify-center bg-background">
    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-label="Loading" />
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/builders" element={<Builders />} />
            <Route path="/managers" element={<Managers />} />
            <Route path="/project/:projectId" element={<ProjectDetails />} />
            <Route path="/statements" element={<Statements />} />
            <Route path="/storage" element={<Storage />} />
            <Route path="/invite" element={<Invite />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
