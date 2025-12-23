import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { Download, FileText, DollarSign, Clock, Package, TrendingUp, Calendar } from "lucide-react";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, subMonths } from "date-fns";

interface StatementsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ProjectCostSummary {
  projectId: string;
  projectName: string;
  clientName: string;
  totalInvoices: number;
  totalMaterialCost: number;
  totalHours: number;
  laborCost: number;
}

interface MaterialBreakdown {
  materialName: string;
  totalQuantity: number;
  unit: string;
  totalCost: number;
}

interface LaborSummary {
  builderName: string;
  totalHours: number;
  projectsWorked: number;
}

const StatementsDialog = ({ open, onOpenChange }: StatementsDialogProps) => {
  const [period, setPeriod] = useState<string>("this-month");
  const [projectCosts, setProjectCosts] = useState<ProjectCostSummary[]>([]);
  const [materialBreakdown, setMaterialBreakdown] = useState<MaterialBreakdown[]>([]);
  const [laborSummary, setLaborSummary] = useState<LaborSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [totals, setTotals] = useState({
    totalRevenue: 0,
    totalMaterialCost: 0,
    totalLaborHours: 0,
    totalLaborCost: 0,
    grossProfit: 0,
  });

  const HOURLY_RATE = 45; // Default hourly rate for labor cost calculation

  const getDateRange = () => {
    const now = new Date();
    switch (period) {
      case "this-week":
        return { start: startOfWeek(now), end: endOfWeek(now) };
      case "this-month":
        return { start: startOfMonth(now), end: endOfMonth(now) };
      case "last-month":
        const lastMonth = subMonths(now, 1);
        return { start: startOfMonth(lastMonth), end: endOfMonth(lastMonth) };
      case "last-3-months":
        return { start: startOfMonth(subMonths(now, 2)), end: endOfMonth(now) };
      case "all-time":
      default:
        return { start: new Date(2020, 0, 1), end: now };
    }
  };

  useEffect(() => {
    if (open) {
      fetchStatements();
    }
  }, [open, period]);

  const fetchStatements = async () => {
    setIsLoading(true);
    const { start, end } = getDateRange();

    try {
      // Fetch projects
      const { data: projects } = await supabase
        .from("projects")
        .select("id, name, client_name");

      // Fetch invoices within date range
      const { data: invoices } = await supabase
        .from("invoices")
        .select("project_id, total_amount, date")
        .gte("date", format(start, "yyyy-MM-dd"))
        .lte("date", format(end, "yyyy-MM-dd"));

      // Fetch material usage within date range
      const { data: materialUsage } = await supabase
        .from("material_usage")
        .select(`
          project_id,
          quantity_used,
          material_id,
          materials (name, unit, cost_per_unit)
        `)
        .gte("date", format(start, "yyyy-MM-dd"))
        .lte("date", format(end, "yyyy-MM-dd"));

      // Fetch time tracking within date range
      const { data: timeTracking } = await supabase
        .from("time_tracking")
        .select(`
          project_id,
          user_id,
          clock_in,
          clock_out
        `)
        .gte("clock_in", start.toISOString())
        .lte("clock_in", end.toISOString());

      // Fetch profiles for builder names
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name");

      // Calculate project cost summaries
      const projectCostMap = new Map<string, ProjectCostSummary>();
      
      projects?.forEach(project => {
        projectCostMap.set(project.id, {
          projectId: project.id,
          projectName: project.name,
          clientName: project.client_name,
          totalInvoices: 0,
          totalMaterialCost: 0,
          totalHours: 0,
          laborCost: 0,
        });
      });

      // Add invoice totals
      invoices?.forEach(invoice => {
        const project = projectCostMap.get(invoice.project_id);
        if (project) {
          project.totalInvoices += Number(invoice.total_amount);
        }
      });

      // Add material costs
      materialUsage?.forEach(usage => {
        const project = projectCostMap.get(usage.project_id);
        const material = usage.materials as any;
        if (project && material) {
          project.totalMaterialCost += Number(usage.quantity_used) * Number(material.cost_per_unit || 0);
        }
      });

      // Add labor hours
      timeTracking?.forEach(record => {
        const project = projectCostMap.get(record.project_id);
        if (project && record.clock_out) {
          const hours = (new Date(record.clock_out).getTime() - new Date(record.clock_in).getTime()) / (1000 * 60 * 60);
          project.totalHours += hours;
          project.laborCost += hours * HOURLY_RATE;
        }
      });

      setProjectCosts(Array.from(projectCostMap.values()).filter(p => 
        p.totalInvoices > 0 || p.totalMaterialCost > 0 || p.totalHours > 0
      ));

      // Calculate material breakdown
      const materialMap = new Map<string, MaterialBreakdown>();
      materialUsage?.forEach(usage => {
        const material = usage.materials as any;
        if (material) {
          const existing = materialMap.get(material.name) || {
            materialName: material.name,
            totalQuantity: 0,
            unit: material.unit,
            totalCost: 0,
          };
          existing.totalQuantity += Number(usage.quantity_used);
          existing.totalCost += Number(usage.quantity_used) * Number(material.cost_per_unit || 0);
          materialMap.set(material.name, existing);
        }
      });
      setMaterialBreakdown(Array.from(materialMap.values()));

      // Calculate labor summary by builder
      const laborMap = new Map<string, LaborSummary>();
      const builderProjects = new Map<string, Set<string>>();
      
      timeTracking?.forEach(record => {
        if (record.clock_out) {
          const profile = profiles?.find(p => p.id === record.user_id);
          const builderName = profile?.full_name || "Unknown Builder";
          
          const existing = laborMap.get(record.user_id) || {
            builderName,
            totalHours: 0,
            projectsWorked: 0,
          };
          
          const hours = (new Date(record.clock_out).getTime() - new Date(record.clock_in).getTime()) / (1000 * 60 * 60);
          existing.totalHours += hours;
          
          if (!builderProjects.has(record.user_id)) {
            builderProjects.set(record.user_id, new Set());
          }
          builderProjects.get(record.user_id)?.add(record.project_id);
          
          laborMap.set(record.user_id, existing);
        }
      });
      
      laborMap.forEach((summary, userId) => {
        summary.projectsWorked = builderProjects.get(userId)?.size || 0;
      });
      
      setLaborSummary(Array.from(laborMap.values()));

      // Calculate totals
      const totalRevenue = invoices?.reduce((acc, inv) => acc + Number(inv.total_amount), 0) || 0;
      const totalMaterialCost = Array.from(materialMap.values()).reduce((acc, m) => acc + m.totalCost, 0);
      const totalLaborHours = Array.from(laborMap.values()).reduce((acc, l) => acc + l.totalHours, 0);
      const totalLaborCost = totalLaborHours * HOURLY_RATE;
      
      setTotals({
        totalRevenue,
        totalMaterialCost,
        totalLaborHours,
        totalLaborCost,
        grossProfit: totalRevenue - totalMaterialCost - totalLaborCost,
      });

    } catch (error) {
      console.error("Error fetching statements:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Financial Statements
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-center justify-between mb-4">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="this-week">This Week</SelectItem>
              <SelectItem value="this-month">This Month</SelectItem>
              <SelectItem value="last-month">Last Month</SelectItem>
              <SelectItem value="last-3-months">Last 3 Months</SelectItem>
              <SelectItem value="all-time">All Time</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="projects">By Project</TabsTrigger>
            <TabsTrigger value="materials">Materials</TabsTrigger>
            <TabsTrigger value="labor">Labor</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-green-500" />
                    Total Revenue
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-green-600">${totals.totalRevenue.toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground">From invoices</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Package className="h-4 w-4 text-orange-500" />
                    Material Costs
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-orange-600">${totals.totalMaterialCost.toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground">Total material expenses</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Clock className="h-4 w-4 text-blue-500" />
                    Labor Costs
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-blue-600">${totals.totalLaborCost.toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground">{totals.totalLaborHours.toFixed(1)} hours @ ${HOURLY_RATE}/hr</p>
                </CardContent>
              </Card>

              <Card className="md:col-span-2 lg:col-span-3">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-primary" />
                    Gross Profit/Loss
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className={`text-3xl font-bold ${totals.grossProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    ${totals.grossProfit.toFixed(2)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Revenue - Material Costs - Labor Costs
                  </p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="projects" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Project Cost Summary</CardTitle>
                <CardDescription>Breakdown by project</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <p className="text-muted-foreground">Loading...</p>
                ) : projectCosts.length === 0 ? (
                  <p className="text-muted-foreground">No data for selected period</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2">Project</th>
                          <th className="text-left py-2">Client</th>
                          <th className="text-right py-2">Invoices</th>
                          <th className="text-right py-2">Materials</th>
                          <th className="text-right py-2">Labor (hrs)</th>
                          <th className="text-right py-2">Labor Cost</th>
                        </tr>
                      </thead>
                      <tbody>
                        {projectCosts.map((project) => (
                          <tr key={project.projectId} className="border-b">
                            <td className="py-2">{project.projectName}</td>
                            <td className="py-2">{project.clientName}</td>
                            <td className="text-right py-2">${project.totalInvoices.toFixed(2)}</td>
                            <td className="text-right py-2">${project.totalMaterialCost.toFixed(2)}</td>
                            <td className="text-right py-2">{project.totalHours.toFixed(1)}</td>
                            <td className="text-right py-2">${project.laborCost.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="materials" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Material Usage Breakdown</CardTitle>
                <CardDescription>All materials used in the period</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <p className="text-muted-foreground">Loading...</p>
                ) : materialBreakdown.length === 0 ? (
                  <p className="text-muted-foreground">No material usage for selected period</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2">Material</th>
                          <th className="text-right py-2">Quantity</th>
                          <th className="text-left py-2">Unit</th>
                          <th className="text-right py-2">Total Cost</th>
                        </tr>
                      </thead>
                      <tbody>
                        {materialBreakdown.map((material, index) => (
                          <tr key={index} className="border-b">
                            <td className="py-2">{material.materialName}</td>
                            <td className="text-right py-2">{material.totalQuantity.toFixed(2)}</td>
                            <td className="py-2">{material.unit}</td>
                            <td className="text-right py-2">${material.totalCost.toFixed(2)}</td>
                          </tr>
                        ))}
                        <tr className="font-bold">
                          <td className="py-2" colSpan={3}>Total</td>
                          <td className="text-right py-2">
                            ${materialBreakdown.reduce((acc, m) => acc + m.totalCost, 0).toFixed(2)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="labor" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Labor Hours Summary</CardTitle>
                <CardDescription>Hours worked by each builder</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <p className="text-muted-foreground">Loading...</p>
                ) : laborSummary.length === 0 ? (
                  <p className="text-muted-foreground">No labor data for selected period</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2">Builder</th>
                          <th className="text-right py-2">Hours</th>
                          <th className="text-right py-2">Projects</th>
                          <th className="text-right py-2">Labor Cost</th>
                        </tr>
                      </thead>
                      <tbody>
                        {laborSummary.map((labor, index) => (
                          <tr key={index} className="border-b">
                            <td className="py-2">{labor.builderName}</td>
                            <td className="text-right py-2">{labor.totalHours.toFixed(1)}</td>
                            <td className="text-right py-2">{labor.projectsWorked}</td>
                            <td className="text-right py-2">${(labor.totalHours * HOURLY_RATE).toFixed(2)}</td>
                          </tr>
                        ))}
                        <tr className="font-bold">
                          <td className="py-2">Total</td>
                          <td className="text-right py-2">
                            {laborSummary.reduce((acc, l) => acc + l.totalHours, 0).toFixed(1)}
                          </td>
                          <td className="text-right py-2">-</td>
                          <td className="text-right py-2">
                            ${(laborSummary.reduce((acc, l) => acc + l.totalHours, 0) * HOURLY_RATE).toFixed(2)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default StatementsDialog;
