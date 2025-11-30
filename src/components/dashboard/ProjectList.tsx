import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Building2, Clock, DollarSign, Edit, Loader2 } from "lucide-react";
import EditProjectDialog from "./EditProjectDialog";

interface ProjectListProps {
  onProjectCreated: () => void;
}

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
  active_jobs?: number;
  job_status_counts?: { approved: number; waiting_review: number; needs_correction: number };
}

const ProjectList = ({ onProjectCreated }: ProjectListProps) => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [navigatingToProject, setNavigatingToProject] = useState<string | null>(null);

  const handleEditProject = (project: Project) => {
    setSelectedProject(project);
    setIsEditDialogOpen(true);
  };

  useEffect(() => {
    fetchProjects();

    // Realtime: refresh projects when any job changes
    const channel = supabase
      .channel('project-list-jobs')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'jobs' },
        () => fetchProjects()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [onProjectCreated]);

  const fetchProjects = async () => {
    setIsLoading(true);
    try {
      const { data: projectsData, error } = await supabase
        .from("projects")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Fetch hours and costs for each project
      const enrichedProjects = await Promise.all(
        (projectsData || []).map(async (project) => {
          // Get total hours
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

          // Get total spent
          const { data: invoiceData } = await supabase
            .from("invoices")
            .select("total_amount")
            .eq("project_id", project.id);

          const totalSpent = invoiceData?.reduce((acc, inv) => acc + Number(inv.total_amount), 0) || 0;

          // Get job status counts
          const { data: jobsData } = await supabase
            .from("jobs")
            .select("status")
            .eq("project_id", project.id);

          const counts = { approved: 0, waiting_review: 0, needs_correction: 0 };
          (jobsData || []).forEach((j: { status: string }) => {
            if (j.status === "approved") counts.approved++;
            if (j.status === "waiting_review" || j.status === "pending") counts.waiting_review++;
            if (j.status === "needs_correction") counts.needs_correction++;
          });
          const activeJobs = (jobsData || []).filter((j: { status: string }) => j.status !== "completed").length;

          return {
            ...project,
            total_hours: Math.round(totalHours),
            total_spent: totalSpent,
            active_jobs: activeJobs,
            job_status_counts: counts,
          };
        })
      );

      setProjects(enrichedProjects);
    } catch (error) {
      console.error("Error fetching projects:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Loading projects...</div>;
  }

  if (projects.length === 0) {
    return (
      <div className="text-center py-12">
        <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <p className="text-muted-foreground">No projects yet. Create your first project to get started.</p>
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
                  <Badge variant={project.status === "active" ? "default" : "secondary"}>
                    {project.status}
                  </Badge>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEditProject(project);
                    }}
                  >
                    <Edit className="h-4 w-4" />
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

              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                <Badge variant="secondary">Active jobs: {project.active_jobs || 0}</Badge>
                <Badge variant="outline">To Do: {project.job_status_counts?.approved || 0}</Badge>
                <Badge variant="outline">Waiting for Review: {project.job_status_counts?.waiting_review || 0}</Badge>
                <Badge variant="outline">Needs Correction: {project.job_status_counts?.needs_correction || 0}</Badge>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      <EditProjectDialog
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        onProjectUpdated={fetchProjects}
        project={selectedProject}
      />
    </>
  );
};

export default ProjectList;
