import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useRequireRole, homeOf } from "@/hooks/useRequireRole";
import { PageLoader } from "@/components/layout/AppShell";

/** Post-login landing: reads the role and forwards to the right home. */
const Dashboard = () => {
  const { role, isLoading } = useRequireRole();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && role) navigate(homeOf(role));
  }, [isLoading, role, navigate]);

  return <PageLoader />;
};

export default Dashboard;
