import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Building2, Clock, DollarSign, Loader2, RotateCcw } from "lucide-react";
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

interface Project {
  id: string;
  name: string;
  client_name: string;
  status: string;
  created_at: string;
  description: string | null;
  address: string | null;
  total_hours?: number;
  total_spent?: number;
}

const FinishedProjectList = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [navigatingToProject, setNavigatingToProject] = useState<string | null>(null);
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
          const { data: timeData } = await supabase
            .from("time_tracking")
            .select("clock_in, clock_out")
            .eq("project_id", project.id);

          let totalHours = 0;
          if (timeData) {
            totalHours = timeData.reduce((acc, record) => {
              if (record.clock_out) {
                const hours =
                  (new Date(record.clock_out).getTime() - new Date(record.clock_in).getTime()) /
                  (1000 * 60 * 60);
                return acc + hours;
              }
              return acc;
            }, 0);
          }

          const { data: invoiceData } = await supabase
            .from("invoices")
            .select("total_amount")
            .eq("project_id", project.id);

          const totalSpent = invoiceData?.reduce((acc, inv) => acc + Number(inv.total_amount), 0) || 0;

          return {
            ...project,
            total_hours: Math.round(totalHours),
            total_spent: totalSpent,
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
        .update({ status: "active" })
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

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Loading finished projects...</div>;
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
      <ScrollArea className="h-[400px]">
        <div className="space-y-4">
          {projects.map((project) => (
            <div
              key={project.id}
              className="p-4 border rounded-lg hover:shadow-md transition-shadow bg-card cursor-pointer relative"
              onClick={() => {
                if (!navigatingToProject) {
                  setNavigatingToProject(project.id);
                  navigate(`/project/${project.id}`);
                }
              }}
            >
              {navigatingToProject === project.id && (
                <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center rounded-lg z-10">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span className="text-sm font-medium">Loading project...</span>
                  </div>
                </div>
              )}
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-lg">{project.name}</h3>
                  <p className="text-sm text-muted-foreground">{project.client_name}</p>
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

              <div className="flex flex-wrap gap-6 text-sm">
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
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      <AlertDialog open={isReactivateDialogOpen} onOpenChange={setIsReactivateDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reactivate Project</AlertDialogTitle>
            <AlertDialogDescription>
              Would you like to reactivate "{projectToReactivate?.name}"? 
              This will move the project back to active projects.
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
