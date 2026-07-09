import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/responsive-dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, FolderOpen } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface SelectJobDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  onConfirm: (jobId: string) => Promise<void> | void;
}

interface JobItem {
  id: string;
  title: string;
  description: string | null;
  section: string | null;
}

export default function SelectJobDialog({ open, onOpenChange, projectId, onConfirm }: SelectJobDialogProps) {
  const [jobs, setJobs] = useState<JobItem[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !projectId) return;
    const fetchJobs = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("jobs")
        .select("id, title, description, section")
        .eq("project_id", projectId)
        .in("status", ["approved", "needs_correction"])
        .order("section", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false });
      setJobs((data || []) as JobItem[]);
      setLoading(false);
    };
    fetchJobs();
  }, [open, projectId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg w-[95vw] h-[80vh] max-h-[80vh] p-0 flex flex-col overflow-hidden">
        <DialogHeader className="p-4 pb-3 flex-shrink-0 border-b border-border">
          <DialogTitle>Select a job to start tracking</DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 min-h-0 overflow-hidden px-4">
          {loading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : jobs.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">No available jobs for this project.</p>
          ) : (
            <ScrollArea className="h-full">
              <RadioGroup 
                value={selectedJobId || ""} 
                onValueChange={(v) => setSelectedJobId(v)}
                className="space-y-2 py-3 pr-3"
              >
                {jobs.map((job) => (
                  <div 
                    key={job.id} 
                    className={`flex items-start gap-3 p-3 border rounded-lg transition-colors cursor-pointer ${
                      selectedJobId === job.id 
                        ? "border-primary bg-primary/5" 
                        : "border-border hover:bg-muted/50"
                    }`}
                    onClick={() => setSelectedJobId(job.id)}
                  >
                    <RadioGroupItem value={job.id} id={job.id} className="mt-1 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start gap-2 flex-wrap">
                        <Label htmlFor={job.id} className="font-medium cursor-pointer leading-tight">
                          {job.title}
                        </Label>
                        {job.section && (
                          <Badge variant="outline" className="text-xs flex items-center gap-1 flex-shrink-0">
                            <FolderOpen className="h-3 w-3" />
                            {job.section}
                          </Badge>
                        )}
                      </div>
                      {job.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{job.description}</p>
                      )}
                    </div>
                  </div>
                ))}
              </RadioGroup>
            </ScrollArea>
          )}
        </div>
        
        <div className="flex justify-end gap-2 p-4 pt-3 border-t border-border flex-shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={async () => {
              if (!selectedJobId) return;
              await onConfirm(selectedJobId);
              onOpenChange(false);
            }}
            disabled={!selectedJobId}
          >
            Start
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
