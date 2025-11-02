import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface TimeEntry {
  id: string;
  clock_in: string;
  clock_out: string | null;
  notes: string | null;
  user_id: string;
  project_id: string;
  profiles: { full_name: string };
  projects: { name: string };
}

interface ProjectTimeData {
  projectName: string;
  entries: TimeEntry[];
  totalHours: number;
}

interface TimeTrackingDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const TimeTrackingDetailDialog = ({ open, onOpenChange }: TimeTrackingDetailDialogProps) => {
  const [projectsData, setProjectsData] = useState<ProjectTimeData[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (open) {
      fetchTimeData();
    }
  }, [open]);

  const fetchTimeData = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("time_tracking")
      .select(`
        *,
        projects(name)
      `)
      .order("clock_in", { ascending: false });

    if (!error && data) {
      // Fetch all unique user profiles
      const userIds = [...new Set(data.map(entry => entry.user_id))];
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", userIds);

      const profilesMap = new Map(profilesData?.map(p => [p.id, p.full_name]) || []);

      // Group by project
      const grouped = data.reduce((acc, entry) => {
        const projectName = entry.projects?.name || "Unknown Project";
        if (!acc[projectName]) {
          acc[projectName] = {
            projectName,
            entries: [],
            totalHours: 0,
          };
        }
        acc[projectName].entries.push({
          ...entry,
          profiles: { full_name: profilesMap.get(entry.user_id) || "Unknown" }
        });
        
        // Calculate hours for this entry
        if (entry.clock_out) {
          const hours = (new Date(entry.clock_out).getTime() - new Date(entry.clock_in).getTime()) / (1000 * 60 * 60);
          acc[projectName].totalHours += hours;
        }
        
        return acc;
      }, {} as Record<string, ProjectTimeData>);

      setProjectsData(Object.values(grouped));
    }
    setIsLoading(false);
  };

  const calculateDuration = (clockIn: string, clockOut: string | null) => {
    if (!clockOut) return "In Progress";
    const hours = (new Date(clockOut).getTime() - new Date(clockIn).getTime()) / (1000 * 60 * 60);
    return `${hours.toFixed(2)} hrs`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Time Tracking Details</DialogTitle>
        </DialogHeader>

        <ScrollArea className="h-[600px]">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : (
            <Tabs defaultValue={projectsData[0]?.projectName || "all"}>
              <TabsList className="grid grid-cols-auto">
                {projectsData.map((project) => (
                  <TabsTrigger key={project.projectName} value={project.projectName}>
                    {project.projectName} ({project.totalHours.toFixed(1)}h)
                  </TabsTrigger>
                ))}
              </TabsList>

              {projectsData.map((project) => (
                <TabsContent key={project.projectName} value={project.projectName}>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Builder</TableHead>
                        <TableHead>Clock In</TableHead>
                        <TableHead>Clock Out</TableHead>
                        <TableHead>Duration</TableHead>
                        <TableHead>Notes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {project.entries.map((entry) => (
                        <TableRow key={entry.id}>
                          <TableCell className="font-medium">{entry.profiles.full_name}</TableCell>
                          <TableCell>{new Date(entry.clock_in).toLocaleString()}</TableCell>
                          <TableCell>
                            {entry.clock_out ? new Date(entry.clock_out).toLocaleString() : "—"}
                          </TableCell>
                          <TableCell>{calculateDuration(entry.clock_in, entry.clock_out)}</TableCell>
                          <TableCell>{entry.notes || "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TabsContent>
              ))}
            </Tabs>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default TimeTrackingDetailDialog;
