import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import ManagerDashboard from "@/components/dashboard/ManagerDashboard";
import BuilderDashboard from "@/components/dashboard/BuilderDashboard";

const Dashboard = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [userRole, setUserRole] = useState<"manager" | "builder" | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate("/auth");
        return;
      }

      setUserId(session.user.id);

      // Get user role
      const { data: roleData, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (error) {
        console.error("Error fetching role:", error);
        navigate("/auth");
        return;
      }

      if (!roleData) {
        console.error("No role found for user");
        navigate("/auth");
        return;
      }

      setUserRole(roleData.role as "manager" | "builder");
      setIsLoading(false);
    };

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        navigate("/auth");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!userId) return null;

  // Redirect to role-specific routes
  if (userRole === "manager") {
    navigate("/managers");
    return null;
  } else if (userRole === "builder") {
    navigate("/builders");
    return null;
  }

  return null;
};

export default Dashboard;
