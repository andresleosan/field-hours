import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface MaterialUsage {
  id: string;
  date: string;
  quantity_used: number;
  notes: string | null;
  materials: { name: string; unit: string; category: string | null };
  profiles: { full_name: string };
  projects: { name: string };
}

interface ProjectMaterialData {
  projectName: string;
  usageLogs: MaterialUsage[];
  totalItems: number;
}

interface MaterialsDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const MaterialsDetailDialog = ({ open, onOpenChange }: MaterialsDetailDialogProps) => {
  const [projectsData, setProjectsData] = useState<ProjectMaterialData[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (open) {
      fetchMaterialUsage();
    }
  }, [open]);

  const fetchMaterialUsage = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("material_usage")
        .select(`
          *,
          materials(name, unit, category),
          projects(name)
        `)
        .order("date", { ascending: false });

      if (error) {
        console.error("Error fetching material usage:", error);
        setIsLoading(false);
        return;
      }

      if (!data || data.length === 0) {
        setProjectsData([]);
        setIsLoading(false);
        return;
      }

      // Fetch all unique user profiles
      const userIds = [...new Set(data.map(usage => usage.used_by))];
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", userIds);

      const profilesMap = new Map(profilesData?.map(p => [p.id, p.full_name]) || []);

      // Group by project
      const grouped = data.reduce((acc, usage) => {
        const projectName = usage.projects?.name || "Unknown Project";
        if (!acc[projectName]) {
          acc[projectName] = {
            projectName,
            usageLogs: [],
            totalItems: 0,
          };
        }
        acc[projectName].usageLogs.push({
          ...usage,
          profiles: { full_name: profilesMap.get(usage.used_by) || "Unknown" }
        } as MaterialUsage);
        acc[projectName].totalItems += 1;
        return acc;
      }, {} as Record<string, ProjectMaterialData>);

      setProjectsData(Object.values(grouped));
    } catch (err) {
      console.error("Error in fetchMaterialUsage:", err);
    }
    setIsLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Material Usage Logs</DialogTitle>
        </DialogHeader>

        <ScrollArea className="h-[600px]">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : projectsData.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No material usage logs found
            </div>
          ) : (
            <Tabs defaultValue={projectsData[0]?.projectName || "all"}>
              <TabsList className="grid grid-cols-auto">
                {projectsData.map((project) => (
                  <TabsTrigger key={project.projectName} value={project.projectName}>
                    {project.projectName} ({project.totalItems} logs)
                  </TabsTrigger>
                ))}
              </TabsList>

              {projectsData.map((project) => (
                <TabsContent key={project.projectName} value={project.projectName}>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Material</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Quantity Used</TableHead>
                        <TableHead>Used By</TableHead>
                        <TableHead>Notes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {project.usageLogs.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell>{new Date(log.date).toLocaleDateString()}</TableCell>
                          <TableCell className="font-medium">{log.materials?.name || "—"}</TableCell>
                          <TableCell>{log.materials?.category || "—"}</TableCell>
                          <TableCell>
                            {Number(log.quantity_used).toFixed(2)} {log.materials?.unit || ""}
                          </TableCell>
                          <TableCell>{log.profiles?.full_name || "Unknown"}</TableCell>
                          <TableCell>{log.notes || "—"}</TableCell>
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

export default MaterialsDetailDialog;
