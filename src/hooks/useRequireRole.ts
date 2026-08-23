import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "manager" | "builder";

export const homeOf = (role: AppRole) => (role === "manager" ? "/managers" : "/builders");

/**
 * Session guard shared by every page. Resolves session + role + name, redirects
 * to /auth when signed out (or role-less) and to the user's home when the page
 * requires the other role. Replaces the checkAuth block each page duplicated.
 */
export function useRequireRole(required?: AppRole) {
  const [state, setState] = useState<{ userId: string | null; role: AppRole | null; fullName: string; isLoading: boolean }>({
    userId: null,
    role: null,
    fullName: "",
    isLoading: true,
  });
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return navigate("/auth");

      const [{ data: roleData }, { data: profile }] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", session.user.id).maybeSingle(),
        supabase.from("profiles").select("full_name").eq("id", session.user.id).maybeSingle(),
      ]);

      const role = roleData?.role as AppRole | undefined;
      // No role at all -> /auth. (The old per-page guards bounced role-less
      // users between /managers and /builders forever.)
      if (!role) return navigate("/auth");
      if (required && role !== required) return navigate(homeOf(role));

      if (!cancelled) {
        setState({ userId: session.user.id, role, fullName: profile?.full_name ?? "", isLoading: false });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate, required]);

  return state;
}

/** Forced local sign-out with a hard redirect, ensuring full token cleanup. */
export async function signOutAndRedirect() {
  try {
    await supabase.auth.signOut({ scope: "local" });
  } catch {
    // forcing sign-out anyway
  }
  if (typeof window !== "undefined") {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key && (key.startsWith("sb-") || key.includes("supabase.auth.token"))) {
        localStorage.removeItem(key);
      }
    }
  }
  window.location.href = "/auth";
}
