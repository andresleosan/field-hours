import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Building2, Clock, DollarSign } from "lucide-react";

interface ProjectListProps {
  onProjectCreated: () => void;
}

interface Project {
  id: string;
  name: string;
  client_name: string;
  status: string;
  created_at: string;
  total_hours?: number;
  total_spent?: number;
}

const ProjectList = ({ onProjectCreated }: ProjectListProps) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchProjects();
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
                const hours = (new Date(record.clock_out).getTime() - new Date(record.clock_in).getTime()) / (1000 * 60 * 60);
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

          return {
            ...project,
            total_hours: Math.round(totalHours),
            total_spent: totalSpent,
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
    <ScrollArea className="h-[400px]">
      <div className="space-y-4">
        {projects.map((project) => (
          <div
            key={project.id}
            className="p-4 border rounded-lg hover:shadow-md transition-shadow bg-card"
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-semibold text-lg">{project.name}</h3>
                <p className="text-sm text-muted-foreground">{project.client_name}</p>
              </div>
              <Badge variant={project.status === "active" ? "default" : "secondary"}>
                {project.status}
              </Badge>
            </div>

            <div className="flex gap-6 text-sm">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{project.total_hours || 0}h</span>
                <span className="text-muted-foreground">logged</span>
              </div>

              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">${project.total_spent?.toFixed(2) || "0.00"}</span>
                <span className="text-muted-foreground">spent</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
};

export default ProjectList;
