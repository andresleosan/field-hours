import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Building2, Clock, DollarSign, Loader2, RotateCcw, AlertTriangle, ChevronDown, ChevronRight, Package, FileText, Users, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

interface Job {
  id: string;
  title: string;
  section: string | null;
  status: string;
  description: string | null;
}

interface Material {
  id: string;
  name: string;
  quantity: number;
  unit: string;
}

interface TimeEntry {
  id: string;
  builder_name: string;
  hours: number;
}

interface Invoice {
  id: string;
  invoice_number: string;
  total_amount: number;
  date: string;
}

interface Project {
  id: string;
  name: string;
  client_name: string;
  status: string;
  created_at: string;
  description: string | null;
  address: string | null;
  finished_at: string | null;
  total_hours?: number;
  total_spent?: number;
  days_remaining?: number;
  jobs?: Job[];
  materials?: Material[];
  time_entries?: TimeEntry[];
  invoices?: Invoice[];
}

const FinishedProjectList = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [projectToReactivate, setProjectToReactivate] = useState<Project | null>(null);
  const [isReactivateDialogOpen, setIsReactivateDialogOpen] = useState(false);

  useEffect(() => {
    fetchFinishedProjects();

    const channel = supabase
      .channel('finished-projects-list')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'projects' },
        () => fetchFinishedProjects()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchFinishedProjects = async () => {
    setIsLoading(true);
    try {
      const { data: projectsData, error } = await supabase
        .from("projects")
        .select("*")
        .eq("status", "finished")
        .order("updated_at", { ascending: false });

      if (error) throw error;

      const enrichedProjects = await Promise.all(
        (projectsData || []).map(async (project) => {
          // Fetch time tracking data
          const { data: timeData } = await supabase
            .from("time_tracking")
            .select("clock_in, clock_out, user_id")
            .eq("project_id", project.id);

          let totalHours = 0;
          const timeByUser: { [key: string]: number } = {};
          if (timeData) {
            for (const record of timeData) {
              if (record.clock_out) {
                const hours =
                  (new Date(record.clock_out).getTime() - new Date(record.clock_in).getTime()) /
                  (1000 * 60 * 60);
                totalHours += hours;
                timeByUser[record.user_id] = (timeByUser[record.user_id] || 0) + hours;
              }
            }
          }

          // Get builder names for time entries
          const timeEntries: TimeEntry[] = [];
          for (const [userId, hours] of Object.entries(timeByUser)) {
            const { data: profile } = await supabase
              .from("profiles")
              .select("full_name")
              .eq("id", userId)
              .maybeSingle();
            timeEntries.push({
              id: userId,
              builder_name: profile?.full_name || "Unknown",
              hours: Math.round(hours * 10) / 10,
            });
          }

          // Fetch invoices
          const { data: invoiceData } = await supabase
            .from("invoices")
            .select("id, invoice_number, total_amount, date")
            .eq("project_id", project.id)
            .order("date", { ascending: false });

          const totalSpent = invoiceData?.reduce((acc, inv) => acc + Number(inv.total_amount), 0) || 0;

          // Fetch jobs
          const { data: jobsData } = await supabase
            .from("jobs")
            .select("id, title, section, status, description")
            .eq("project_id", project.id)
            .order("section", { ascending: true });

          // Fetch material usage
          const { data: materialUsageData } = await supabase
            .from("material_usage")
            .select("id, material_id, quantity_used")
            .eq("project_id", project.id);

          const materials: Material[] = [];
          if (materialUsageData && materialUsageData.length > 0) {
            const materialIds = [...new Set(materialUsageData.map(m => m.material_id))];
            const { data: materialsData } = await supabase
              .from("materials")
              .select("id, name, unit")
              .in("id", materialIds);

            const materialsMap = new Map(materialsData?.map(m => [m.id, m]) || []);
            const aggregated: { [key: string]: { name: string; quantity: number; unit: string } } = {};

            for (const usage of materialUsageData) {
              const material = materialsMap.get(usage.material_id);
              if (material) {
                if (aggregated[material.id]) {
                  aggregated[material.id].quantity += Number(usage.quantity_used);
                } else {
                  aggregated[material.id] = {
                    name: material.name,
                    quantity: Number(usage.quantity_used),
                    unit: material.unit,
                  };
                }
              }
            }

            for (const [id, data] of Object.entries(aggregated)) {
              materials.push({ id, ...data });
            }
          }

          // Calculate days remaining until auto-deletion
          let daysRemaining: number | undefined;
          if (project.finished_at) {
            const finishedDate = new Date(project.finished_at);
            const deletionDate = new Date(finishedDate);
            deletionDate.setMonth(deletionDate.getMonth() + 1);
            const now = new Date();
            daysRemaining = Math.ceil((deletionDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
            if (daysRemaining < 0) daysRemaining = 0;
          }

          return {
            ...project,
            total_hours: Math.round(totalHours),
            total_spent: totalSpent,
            days_remaining: daysRemaining,
            jobs: jobsData || [],
            materials,
            time_entries: timeEntries,
            invoices: invoiceData || [],
          };
        })
      );

      setProjects(enrichedProjects);
    } catch (error) {
      console.error("Error fetching finished projects:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleProjectExpanded = (projectId: string) => {
    setExpandedProjects(prev => {
      const newSet = new Set(prev);
      if (newSet.has(projectId)) {
        newSet.delete(projectId);
      } else {
        newSet.add(projectId);
      }
      return newSet;
    });
  };

  const handleReactivateClick = (e: React.MouseEvent, project: Project) => {
    e.stopPropagation();
    setProjectToReactivate(project);
    setIsReactivateDialogOpen(true);
  };

  const handleConfirmReactivate = async () => {
    if (!projectToReactivate) return;

    try {
      const { error } = await supabase
        .from("projects")
        .update({ status: "active", finished_at: null })
        .eq("id", projectToReactivate.id);

      if (error) throw error;

      toast.success("Project reactivated successfully");
      fetchFinishedProjects();
    } catch (error) {
      console.error("Error reactivating project:", error);
      toast.error("Failed to reactivate project");
    } finally {
      setIsReactivateDialogOpen(false);
      setProjectToReactivate(null);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="h-3 w-3 text-success" />;
      case "needs_correction":
        return <XCircle className="h-3 w-3 text-destructive" />;
      case "waiting_review":
        return <AlertCircle className="h-3 w-3 text-warning" />;
      default:
        return <Clock className="h-3 w-3 text-muted-foreground" />;
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "completed":
        return "default";
      case "needs_correction":
        return "destructive";
      case "waiting_review":
        return "secondary";
      default:
        return "outline";
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Loading finished projects...</span>
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="text-center py-12">
        <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <p className="text-muted-foreground">No finished projects yet.</p>
      </div>
    );
  }

  return (
    <>
      <ScrollArea className="h-[500px]">
        <div className="space-y-4">
          {projects.map((project) => (
            <Collapsible
              key={project.id}
              open={expandedProjects.has(project.id)}
              onOpenChange={() => toggleProjectExpanded(project.id)}
            >
              <div className="border rounded-lg bg-card overflow-hidden">
                <CollapsibleTrigger asChild>
                  <div className="p-4 cursor-pointer hover:bg-accent/50 transition-colors">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        {expandedProjects.has(project.id) ? (
                          <ChevronDown className="h-5 w-5 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-5 w-5 text-muted-foreground" />
                        )}
                        <div>
                          <h3 className="font-semibold text-lg">{project.name}</h3>
                          <p className="text-sm text-muted-foreground">{project.client_name}</p>
                          {project.address && (
                            <p className="text-xs text-muted-foreground mt-1">{project.address}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">finished</Badge>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={(e) => handleReactivateClick(e, project)}
                          title="Reactivate project"
                        >
                          <RotateCcw className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-4 text-sm ml-7">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{project.total_hours || 0}h</span>
                        <span className="text-muted-foreground">logged</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">£{project.total_spent?.toFixed(2) || "0.00"}</span>
                        <span className="text-muted-foreground">spent</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{project.jobs?.length || 0}</span>
                        <span className="text-muted-foreground">jobs</span>
                      </div>

                      {project.days_remaining !== undefined && (
                        <div className="flex items-center gap-2">
                          <AlertTriangle className={`h-4 w-4 ${project.days_remaining <= 7 ? 'text-destructive' : 'text-warning'}`} />
                          <span className={`font-medium ${project.days_remaining <= 7 ? 'text-destructive' : 'text-warning'}`}>
                            {project.days_remaining} days
                          </span>
                          <span className="text-muted-foreground">until auto-delete</span>
                        </div>
                      )}
                    </div>
                  </div>
                </CollapsibleTrigger>

                <CollapsibleContent>
                  <div className="border-t px-4 py-4 space-y-6 bg-muted/30">
                    {/* Jobs Section */}
                    <div>
                      <h4 className="font-medium text-sm mb-3 flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        Jobs ({project.jobs?.length || 0})
                      </h4>
                      {project.jobs && project.jobs.length > 0 ? (
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {project.jobs.map((job) => (
                            <div
                              key={job.id}
                              className="flex items-center justify-between p-2 bg-background rounded border text-sm"
                            >
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                {getStatusIcon(job.status)}
                                <span className="truncate font-medium">{job.title}</span>
                                {job.section && (
                                  <Badge variant="outline" className="text-xs shrink-0">
                                    {job.section}
                                  </Badge>
                                )}
                              </div>
                              <Badge variant={getStatusBadgeVariant(job.status)} className="text-xs ml-2 shrink-0">
                                {job.status.replace("_", " ")}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">No jobs recorded</p>
                      )}
                    </div>

                    {/* Time Tracking Section */}
                    <div>
                      <h4 className="font-medium text-sm mb-3 flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        Time by Builder ({project.time_entries?.length || 0} builders)
                      </h4>
                      {project.time_entries && project.time_entries.length > 0 ? (
                        <div className="space-y-2">
                          {project.time_entries.map((entry) => (
                            <div
                              key={entry.id}
                              className="flex items-center justify-between p-2 bg-background rounded border text-sm"
                            >
                              <span className="font-medium">{entry.builder_name}</span>
                              <span className="text-muted-foreground">{entry.hours}h</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">No time tracked</p>
                      )}
                    </div>

                    {/* Materials Section */}
                    <div>
                      <h4 className="font-medium text-sm mb-3 flex items-center gap-2">
                        <Package className="h-4 w-4" />
                        Materials Used ({project.materials?.length || 0})
                      </h4>
                      {project.materials && project.materials.length > 0 ? (
                        <div className="space-y-2 max-h-32 overflow-y-auto">
                          {project.materials.map((material) => (
                            <div
                              key={material.id}
                              className="flex items-center justify-between p-2 bg-background rounded border text-sm"
                            >
                              <span className="font-medium">{material.name}</span>
                              <span className="text-muted-foreground">
                                {material.quantity} {material.unit}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">No materials logged</p>
                      )}
                    </div>

                    {/* Invoices Section */}
                    <div>
                      <h4 className="font-medium text-sm mb-3 flex items-center gap-2">
                        <DollarSign className="h-4 w-4" />
                        Invoices ({project.invoices?.length || 0})
                      </h4>
                      {project.invoices && project.invoices.length > 0 ? (
                        <div className="space-y-2 max-h-32 overflow-y-auto">
                          {project.invoices.map((invoice) => (
                            <div
                              key={invoice.id}
                              className="flex items-center justify-between p-2 bg-background rounded border text-sm"
                            >
                              <div>
                                <span className="font-medium">{invoice.invoice_number}</span>
                                <span className="text-muted-foreground ml-2 text-xs">
                                  {new Date(invoice.date).toLocaleDateString()}
                                </span>
                              </div>
                              <span className="font-medium">£{Number(invoice.total_amount).toFixed(2)}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">No invoices recorded</p>
                      )}
                    </div>

                    {/* View Full Details Button */}
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => navigate(`/project/${project.id}`)}
                    >
                      View Full Project Details
                    </Button>
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          ))}
        </div>
      </ScrollArea>

      <AlertDialog open={isReactivateDialogOpen} onOpenChange={setIsReactivateDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reactivate Project</AlertDialogTitle>
            <AlertDialogDescription>
              Would you like to reactivate "{projectToReactivate?.name}"? 
              This will move the project back to active projects and cancel the auto-deletion.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmReactivate}>
              Yes, reactivate project
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default FinishedProjectList;