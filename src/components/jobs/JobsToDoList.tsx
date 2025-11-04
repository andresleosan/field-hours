import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Clock, AlertCircle, CheckCircle2 } from "lucide-react";

interface JobsToDoListProps {
  projectId: string;
}

interface JobItem {
  id: string;
  title: string;
  description: string | null;
  status: string;
  created_at: string;
  created_by: string;
}

export default function JobsToDoList({ projectId }: JobsToDoListProps) {
  const [jobs, setJobs] = useState<JobItem[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchJobs = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("jobs")
      .select("id, title, description, status, created_at, created_by")
      .eq("project_id", projectId)
      .in("status", ["approved", "needs_correction"]) // To-do items for builders
      .order("created_at", { ascending: false });

    if (!error) setJobs((data || []) as JobItem[]);
    setLoading(false);
  };

  useEffect(() => {
    if (!projectId) return;
    fetchJobs();

    // Realtime updates for jobs of this project
    const channel = supabase
      .channel(`jobs-to-do-${projectId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'jobs' },
        (payload) => {
          // Refresh only when it affects this project
          const p = (payload.new as any)?.project_id ?? (payload.old as any)?.project_id;
          if (p === projectId) fetchJobs();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const getStatusBadge = (status: string) => {
    const map: Record<string, { label: string; variant: any; icon: any }> = {
      approved: { label: 'To Do', variant: 'secondary', icon: AlertCircle },
      needs_correction: { label: 'Needs Correction', variant: 'destructive', icon: AlertCircle },
      waiting_review: { label: 'Waiting Review', variant: 'outline', icon: Clock },
      completed: { label: 'Done', variant: 'default', icon: CheckCircle2 },
    };
    const cfg = map[status] || map.approved;
    const Icon = cfg.icon;
    return (
      <Badge variant={cfg.variant} className="flex items-center gap-1">
        <Icon className="h-3 w-3" /> {cfg.label}
      </Badge>
    );
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Jobs To Do</CardTitle>
        <Button variant="outline" size="sm" onClick={() => navigate(`/project/${projectId}`)}>
          View All Jobs
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : jobs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No jobs yet</p>
        ) : (
          <ul className="space-y-3">
            {jobs.slice(0, 6).map((job) => (
              <li key={job.id} className="border rounded-md p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{job.title}</div>
                    {job.description && (
                      <div className="text-sm text-muted-foreground line-clamp-2">{job.description}</div>
                    )}
                    <div className="text-xs text-muted-foreground mt-1">
                      By {job.profiles?.full_name || 'Manager'}
                    </div>
                  </div>
                  {getStatusBadge(job.status)}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
