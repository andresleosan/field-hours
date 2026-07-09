import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background p-4">
      <div className="blueprint-grid pointer-events-none absolute inset-0" aria-hidden="true" />
      <div className="reveal relative max-w-md text-center">
        <p className="label-eyebrow font-mono">Error 404</p>
        <h1 className="mt-4 text-5xl font-extrabold tracking-tight">Nothing here</h1>
        <p className="mt-4 text-muted-foreground">
          <span className="font-mono text-sm">{location.pathname}</span> is not a page in BuildTrack Pro.
        </p>
        <Button asChild className="mt-8">
          <Link to="/">Back to the start</Link>
        </Button>
      </div>
    </div>
  );
};

export default NotFound;
