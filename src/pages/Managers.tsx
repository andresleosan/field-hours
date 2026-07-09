import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Clock, PoundSterling, Package, ShieldCheck, Trash2, Truck, Wrench } from "lucide-react";
import { useRequireRole } from "@/hooks/useRequireRole";
import { AppShell, PageLoader } from "@/components/layout/AppShell";
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
import { StatTile } from "@/components/dashboard/Tiles";
interface DashboardStats {
  totalProjects: number;
  activeProjects: number;
  totalHours: number;
  totalSpent: number;
  totalMaterials: number;
  totalRiskAssessments: number;
  pendingRubbishRequests: number;
  pendingMaterialDeliveries: number;
  pendingToolRequests: number;
}
const Managers = () => {
  const { userId, fullName, isLoading } = useRequireRole("manager");
  const [stats, setStats] = useState<DashboardStats>({
    totalProjects: 0,
    activeProjects: 0,
    totalHours: 0,
    totalSpent: 0,
    totalMaterials: 0,
    totalRiskAssessments: 0,
    pendingRubbishRequests: 0,
    pendingMaterialDeliveries: 0,
    pendingToolRequests: 0
  });
  const [isCreateProjectOpen, setIsCreateProjectOpen] = useState(false);
  const [isMaterialsOpen, setIsMaterialsOpen] = useState(false);
  const [isTimeTrackingOpen, setIsTimeTrackingOpen] = useState(false);
  const [isInvoicesOpen, setIsInvoicesOpen] = useState(false);
  const [isRiskAssessmentsOpen, setIsRiskAssessmentsOpen] = useState(false);
  const [isRubbishRequestsOpen, setIsRubbishRequestsOpen] = useState(false);
  const [isMaterialDeliveryOpen, setIsMaterialDeliveryOpen] = useState(false);
  const navigate = useNavigate();
  useEffect(() => {
    if (!isLoading) fetchDashboardStats();
  }, [isLoading]);
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
      const {
        count: pendingToolRequests
      } = await supabase.from("tool_requests").select("*", {
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
        pendingMaterialDeliveries: pendingMaterialDeliveries || 0,
        pendingToolRequests: pendingToolRequests || 0
      });
    } catch (error: any) {
      console.error("Error fetching stats:", error);
    }
  };
  if (isLoading) {
    return <PageLoader />;
  }
  return <AppShell role="manager" fullName={fullName}>
        <section aria-label="Needs attention" className="space-y-3">
          <h2 className="label-eyebrow font-mono">Needs attention</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatTile
              label="Rubbish requests"
              value={stats.pendingRubbishRequests}
              caption="pending collection"
              icon={Trash2}
              attention={stats.pendingRubbishRequests > 0}
              onClick={() => setIsRubbishRequestsOpen(true)}
            />
            <StatTile
              label="Material requests"
              value={stats.pendingMaterialDeliveries}
              caption="pending delivery"
              icon={Truck}
              attention={stats.pendingMaterialDeliveries > 0}
              onClick={() => setIsMaterialDeliveryOpen(true)}
            />
            <StatTile
              label="Requested tools"
              value={stats.pendingToolRequests}
              caption="waiting to be picked up"
              icon={Wrench}
              attention={stats.pendingToolRequests > 0}
              onClick={() => navigate("/storage")}
            />
          </div>
        </section>

        <section aria-label="Business" className="space-y-3">
          <h2 className="label-eyebrow font-mono">Business</h2>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
            <StatTile
              label="Active projects"
              value={stats.activeProjects}
              caption={`of ${stats.totalProjects} total`}
              icon={Package}
            />
            <StatTile
              label="Builder hours"
              value={stats.totalHours.toLocaleString()}
              caption="across all projects"
              icon={Clock}
              onClick={() => setIsTimeTrackingOpen(true)}
            />
            <StatTile
              label="Invoiced"
              value={`£${stats.totalSpent.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}`}
              caption="from invoices"
              icon={PoundSterling}
              onClick={() => setIsInvoicesOpen(true)}
            />
            <StatTile
              label="Materials"
              value={stats.totalMaterials}
              caption="in inventory"
              icon={Package}
              onClick={() => setIsMaterialsOpen(true)}
            />
            <StatTile
              label="Risk assessments"
              value={stats.totalRiskAssessments}
              caption="documents uploaded"
              icon={ShieldCheck}
              onClick={() => setIsRiskAssessmentsOpen(true)}
            />
          </div>
        </section>

        <Tabs defaultValue="projects" className="space-y-4">
          <TabsList className="flex w-full overflow-x-auto md:inline-grid md:w-fit md:grid-cols-3">
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

      <CreateProjectDialog open={isCreateProjectOpen} onOpenChange={setIsCreateProjectOpen} onProjectCreated={fetchDashboardStats} />

      <MaterialsDetailDialog open={isMaterialsOpen} onOpenChange={setIsMaterialsOpen} />

      <TimeTrackingDetailDialog open={isTimeTrackingOpen} onOpenChange={setIsTimeTrackingOpen} />

      <InvoicesDetailDialog open={isInvoicesOpen} onOpenChange={setIsInvoicesOpen} />

      {userId && <ManagerRiskAssessmentDialog open={isRiskAssessmentsOpen} onOpenChange={setIsRiskAssessmentsOpen} userId={userId} />}

      <ManagerRubbishDialog open={isRubbishRequestsOpen} onOpenChange={setIsRubbishRequestsOpen} />

      <ManagerMaterialDeliveryDialog open={isMaterialDeliveryOpen} onOpenChange={setIsMaterialDeliveryOpen} />
    </AppShell>;
};
export default Managers;