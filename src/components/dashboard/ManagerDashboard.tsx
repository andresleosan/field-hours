import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { LogOut, Plus, Users, Clock, DollarSign, Package } from "lucide-react";
import { useNavigate } from "react-router-dom";
import CreateProjectDialog from "./CreateProjectDialog";
import ProjectList from "./ProjectList";

interface ManagerDashboardProps {
  userId: string;
}

interface DashboardStats {
  totalProjects: number;
  activeProjects: number;
  totalHours: number;
  totalSpent: number;
  totalMaterials: number;
}

const ManagerDashboard = ({ userId }: ManagerDashboardProps) => {
  const [stats, setStats] = useState<DashboardStats>({
    totalProjects: 0,
    activeProjects: 0,
    totalHours: 0,
    totalSpent: 0,
    totalMaterials: 0,
  });
  const [isCreateProjectOpen, setIsCreateProjectOpen] = useState(false);
  const [userProfile, setUserProfile] = useState<{ full_name: string; role: string } | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    fetchDashboardStats();
    fetchUserProfile();
  }, []);

  const fetchUserProfile = async () => {
    const { data: profileData } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", userId)
      .single();

    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .single();

    if (profileData && roleData) {
      setUserProfile({
        full_name: profileData.full_name,
        role: roleData.role,
      });
    }
  };

  const fetchDashboardStats = async () => {
    try {
      // Fetch projects count
      const { count: totalProjects } = await supabase
        .from("projects")
        .select("*", { count: "exact", head: true });

      const { count: activeProjects } = await supabase
        .from("projects")
        .select("*", { count: "exact", head: true })
        .eq("status", "active");

      // Fetch total hours from time tracking
      const { data: timeData } = await supabase
        .from("time_tracking")
        .select("clock_in, clock_out");

      let totalHours = 0;
      if (timeData) {
        totalHours = timeData.reduce((acc, record) => {
          if (record.clock_out) {
            const hours = (new Date(record.clock_out).getTime() - new Date(record.clock_in).getTime()) / (1000 * 60 * 60);
            return acc + hours;
          }
          return acc;
        }, 0);
      }

      // Fetch total spent from invoices
      const { data: invoiceData } = await supabase
        .from("invoices")
        .select("total_amount");

      const totalSpent = invoiceData?.reduce((acc, inv) => acc + Number(inv.total_amount), 0) || 0;

      // Fetch materials count
      const { count: totalMaterials } = await supabase
        .from("materials")
        .select("*", { count: "exact", head: true });

      setStats({
        totalProjects: totalProjects || 0,
        activeProjects: activeProjects || 0,
        totalHours: Math.round(totalHours),
        totalSpent,
        totalMaterials: totalMaterials || 0,
      });
    } catch (error: any) {
      console.error("Error fetching stats:", error);
    }
  };

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      toast({
        title: "Signed out",
        description: "Successfully signed out",
      });
      navigate("/auth");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to sign out",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="bg-card border-b shadow-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary p-2">
              <Users className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Manager Dashboard</h1>
              <p className="text-sm text-muted-foreground">BuildTrack Pro</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={handleSignOut}>
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Projects</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{stats.activeProjects}</div>
              <p className="text-xs text-muted-foreground">of {stats.totalProjects} total</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Hours</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{stats.totalHours}</div>
              <p className="text-xs text-muted-foreground">across all projects</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Spent</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">£{stats.totalSpent.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">from invoices</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Materials</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{stats.totalMaterials}</div>
              <p className="text-xs text-muted-foreground">in inventory</p>
            </CardContent>
          </Card>
        </div>

        {/* Projects Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Projects</CardTitle>
                <CardDescription>Manage your construction projects</CardDescription>
              </div>
              <Button onClick={() => setIsCreateProjectOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                New Project
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <ProjectList onProjectCreated={fetchDashboardStats} />
          </CardContent>
        </Card>
      </main>

      <CreateProjectDialog
        open={isCreateProjectOpen}
        onOpenChange={setIsCreateProjectOpen}
        onProjectCreated={fetchDashboardStats}
      />
    </div>
  );
};

export default ManagerDashboard;
