import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { LogOut, Plus, Users, Clock, DollarSign, Package, Loader2, FileText, ShieldCheck, Trash2, Truck, QrCode } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import CreateProjectDialog from "@/components/dashboard/CreateProjectDialog";
import ProjectList from "@/components/dashboard/ProjectList";
import FinishedProjectList from "@/components/dashboard/FinishedProjectList";
import SupplierManagement from "@/components/dashboard/SupplierManagement";
import MaterialsDetailDialog from "@/components/dashboard/MaterialsDetailDialog";
import TimeTrackingDetailDialog from "@/components/dashboard/TimeTrackingDetailDialog";
import InvoicesDetailDialog from "@/components/dashboard/InvoicesDetailDialog";
import ManagerRiskAssessmentDialog from "@/components/dashboard/ManagerRiskAssessmentDialog";
import ManagerRubbishDialog from "@/components/dashboard/ManagerRubbishDialog";
import ManagerMaterialDeliveryDialog from "@/components/dashboard/ManagerMaterialDeliveryDialog";
import { ManagerJobsList } from "@/components/dashboard/ManagerJobsList";
interface DashboardStats {
  totalProjects: number;
  activeProjects: number;
  totalHours: number;
  totalSpent: number;
  totalMaterials: number;
  totalRiskAssessments: number;
  pendingRubbishRequests: number;
  pendingMaterialDeliveries: number;
}
const Managers = () => {
  const [userId, setUserId] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<{
    full_name: string;
    role: string;
  } | null>(null);
  const [stats, setStats] = useState<DashboardStats>({
    totalProjects: 0,
    activeProjects: 0,
    totalHours: 0,
    totalSpent: 0,
    totalMaterials: 0,
    totalRiskAssessments: 0,
    pendingRubbishRequests: 0,
    pendingMaterialDeliveries: 0
  });
  const [isCreateProjectOpen, setIsCreateProjectOpen] = useState(false);
  const [isMaterialsOpen, setIsMaterialsOpen] = useState(false);
  const [isTimeTrackingOpen, setIsTimeTrackingOpen] = useState(false);
  const [isInvoicesOpen, setIsInvoicesOpen] = useState(false);
  const [isRiskAssessmentsOpen, setIsRiskAssessmentsOpen] = useState(false);
  const [isRubbishRequestsOpen, setIsRubbishRequestsOpen] = useState(false);
  const [isMaterialDeliveryOpen, setIsMaterialDeliveryOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const {
    toast
  } = useToast();
  const navigate = useNavigate();
  useEffect(() => {
    checkAuth();
  }, []);
  const checkAuth = async () => {
    const {
      data: {
        session
      }
    } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
      return;
    }
    setUserId(session.user.id);
    const {
      data: roleData
    } = await supabase.from("user_roles").select("role").eq("user_id", session.user.id).maybeSingle();
    if (!roleData || roleData.role !== "manager") {
      navigate("/builders");
      return;
    }
    const {
      data: profileData
    } = await supabase.from("profiles").select("full_name").eq("id", session.user.id).single();
    if (profileData && roleData) {
      setUserProfile({
        full_name: profileData.full_name,
        role: roleData.role
      });
    }
    await fetchDashboardStats();
    setIsLoading(false);
  };
  const fetchDashboardStats = async () => {
    try {
      const {
        count: totalProjects
      } = await supabase.from("projects").select("*", {
        count: "exact",
        head: true
      });
      const {
        count: activeProjects
      } = await supabase.from("projects").select("*", {
        count: "exact",
        head: true
      }).eq("status", "active");
      const {
        data: timeData
      } = await supabase.from("time_tracking").select("clock_in, clock_out");
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
      const {
        data: invoiceData
      } = await supabase.from("invoices").select("total_amount");
      const totalSpent = invoiceData?.reduce((acc, inv) => acc + Number(inv.total_amount), 0) || 0;
      const {
        count: totalMaterials
      } = await supabase.from("materials").select("*", {
        count: "exact",
        head: true
      });
      const {
        count: totalRiskAssessments
      } = await supabase.from("risk_assessments").select("*", {
        count: "exact",
        head: true
      });
      const {
        count: pendingRubbishRequests
      } = await supabase.from("rubbish_collection_requests").select("*", {
        count: "exact",
        head: true
      }).eq("status", "pending");
      const {
        count: pendingMaterialDeliveries
      } = await supabase.from("material_delivery_requests").select("*", {
        count: "exact",
        head: true
      }).eq("status", "pending");
      setStats({
        totalProjects: totalProjects || 0,
        activeProjects: activeProjects || 0,
        totalHours: Math.round(totalHours),
        totalSpent,
        totalMaterials: totalMaterials || 0,
        totalRiskAssessments: totalRiskAssessments || 0,
        pendingRubbishRequests: pendingRubbishRequests || 0,
        pendingMaterialDeliveries: pendingMaterialDeliveries || 0
      });
    } catch (error: any) {
      console.error("Error fetching stats:", error);
    }
  };
  const handleSignOut = async () => {
    // Clear local storage first to ensure clean state
    localStorage.removeItem('sb-lukmmizugpnecispdzsn-auth-token');
    try {
      await supabase.auth.signOut({
        scope: 'local'
      });
    } catch (error) {
      // Ignore errors - we're forcing sign out anyway
      console.log('Sign out error (ignored):', error);
    }
    toast({
      title: "Signed out",
      description: "Successfully signed out"
    });

    // Force hard redirect to clear all state
    window.location.href = "/auth";
  };
  if (isLoading) {
    return <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>;
  }
  return <div className="min-h-screen bg-muted/30">
      <header className="bg-card border-b shadow-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary p-2">
              <Users className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold">
                {userProfile?.full_name || "Manager"} - {userProfile?.role || "Manager"}
              </h1>
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
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
          <Card className="cursor-pointer hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="font-medium text-xl">Active Projects</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{stats.activeProjects}</div>
              <p className="text-xs text-muted-foreground">of {stats.totalProjects} total</p>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setIsTimeTrackingOpen(true)}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-2xl font-medium">Builder Total Hours</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{stats.totalHours}</div>
              <p className="text-xs text-muted-foreground">across all projects</p>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setIsInvoicesOpen(true)}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-2xl font-medium">Note Collections</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">${stats.totalSpent.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">from invoices</p>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setIsMaterialsOpen(true)}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-2xl font-medium">Materials</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{stats.totalMaterials}</div>
              <p className="text-xs text-muted-foreground">in inventory</p>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setIsRiskAssessmentsOpen(true)}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-2xl font-medium">Risk Assessments</CardTitle>
              <ShieldCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{stats.totalRiskAssessments}</div>
              <p className="text-xs text-muted-foreground">documents uploaded</p>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setIsRubbishRequestsOpen(true)}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-2xl font-medium">Rubbish Requests</CardTitle>
              <Trash2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{stats.pendingRubbishRequests}</div>
              <p className="text-xs text-muted-foreground">pending collection</p>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setIsMaterialDeliveryOpen(true)}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-2xl font-medium">Material Requests</CardTitle>
              <Truck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{stats.pendingMaterialDeliveries}</div>
              <p className="text-xs text-muted-foreground">pending delivery</p>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => navigate("/statements")}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-2xl font-medium">Statements</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">View</div>
              <p className="text-xs text-muted-foreground">financial reports</p>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-lg transition-shadow bg-primary/5 border-primary/20" onClick={() => navigate("/storage")}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-2xl font-medium">Storage</CardTitle>
              <Package className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">Manage</div>
              <p className="text-xs text-muted-foreground">materials & tools</p>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-lg transition-shadow bg-green-500/10 border-green-500/30" onClick={() => navigate("/invite")}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-2xl font-medium">Invite Team</CardTitle>
              <QrCode className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">QR Code</div>
              <p className="text-xs text-muted-foreground">invite builders</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="projects" className="space-y-4">
          <TabsList className="flex w-full overflow-x-auto md:grid md:grid-cols-3">
            <TabsTrigger value="projects" className="flex-shrink-0">Projects</TabsTrigger>
            <TabsTrigger value="finished" className="flex-shrink-0">Finished</TabsTrigger>
            <TabsTrigger value="suppliers" className="flex-shrink-0">Suppliers</TabsTrigger>
          </TabsList>


          <TabsContent value="projects" className="space-y-6">
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

            <Card>
              <CardHeader>
                <CardTitle>Jobs Awaiting Review</CardTitle>
                <CardDescription>Review submissions from builders in real time</CardDescription>
              </CardHeader>
              <CardContent>
                <ManagerJobsList />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="finished">
            <Card>
              <CardHeader>
                <CardTitle>Finished Projects</CardTitle>
                <CardDescription>View completed construction projects</CardDescription>
              </CardHeader>
              <CardContent>
                <FinishedProjectList />
              </CardContent>
            </Card>
          </TabsContent>


          <TabsContent value="suppliers">
            <Card>
              <CardHeader>
                <CardTitle>Supplier Management</CardTitle>
                <CardDescription>Manage suppliers and train invoice extraction</CardDescription>
              </CardHeader>
              <CardContent>
                {userId && <SupplierManagement userId={userId} />}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      <CreateProjectDialog open={isCreateProjectOpen} onOpenChange={setIsCreateProjectOpen} onProjectCreated={fetchDashboardStats} />
      
      <MaterialsDetailDialog open={isMaterialsOpen} onOpenChange={setIsMaterialsOpen} />
      
      <TimeTrackingDetailDialog open={isTimeTrackingOpen} onOpenChange={setIsTimeTrackingOpen} />
      
      <InvoicesDetailDialog open={isInvoicesOpen} onOpenChange={setIsInvoicesOpen} />

      {userId && <ManagerRiskAssessmentDialog open={isRiskAssessmentsOpen} onOpenChange={setIsRiskAssessmentsOpen} userId={userId} />}

      <ManagerRubbishDialog open={isRubbishRequestsOpen} onOpenChange={setIsRubbishRequestsOpen} />

      <ManagerMaterialDeliveryDialog open={isMaterialDeliveryOpen} onOpenChange={setIsMaterialDeliveryOpen} />
    </div>;
};
export default Managers;