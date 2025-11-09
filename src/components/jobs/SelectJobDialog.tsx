import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

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
        .select("id, title, description")
        .eq("project_id", projectId)
        .in("status", ["approved", "needs_correction"]) // builder can start these
        .order("created_at", { ascending: false });
      setJobs((data || []) as JobItem[]);
      setLoading(false);
    };
    fetchJobs();
  }, [open, projectId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Select a job to start tracking</DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : jobs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No available jobs for this project.</p>
        ) : (
          <RadioGroup value={selectedJobId || ""} onValueChange={(v) => setSelectedJobId(v)}>
            {jobs.map((job) => (
              <div key={job.id} className="flex items-start gap-3 p-3 border rounded-md">
                <RadioGroupItem value={job.id} id={job.id} className="mt-1" />
                <div className="min-w-0">
                  <Label htmlFor={job.id} className="font-medium cursor-pointer">
                    {job.title}
                  </Label>
                  {job.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">{job.description}</p>
                  )}
                </div>
              </div>
            ))}
          </RadioGroup>
        )}
        <div className="flex justify-end gap-2 pt-2">
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
