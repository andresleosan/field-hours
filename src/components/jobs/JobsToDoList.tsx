import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Clock, AlertCircle, CheckCircle2, Image } from "lucide-react";
import { JobSubmissionDialog } from "@/components/jobs/JobSubmissionDialog";
import { ManagerReferencePhotosDialog } from "@/components/jobs/ManagerReferencePhotosDialog";
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
  job_photos?: Array<{
    id: string;
    photo_url: string;
    created_at: string;
  }>;
}
export default function JobsToDoList({
  projectId
}: JobsToDoListProps) {
  const [jobs, setJobs] = useState<JobItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [photosDialogOpen, setPhotosDialogOpen] = useState(false);
  const [selectedJobForPhotos, setSelectedJobForPhotos] = useState<JobItem | null>(null);
  const [navigating, setNavigating] = useState(false);
  const navigate = useNavigate();
  const fetchJobs = async () => {
    setLoading(true);
    const {
      data,
      error
    } = await supabase.from("jobs").select(`
        id, 
        title, 
        description, 
        status, 
        created_at, 
        created_by,
        job_photos(id, photo_url, created_at)
      `).eq("project_id", projectId).in("status", ["approved", "needs_correction", "waiting_review"]).order("created_at", {
      ascending: false
    });
    if (error) {
      console.error("Error fetching jobs:", error);
      setJobs([]);
    } else {
      setJobs((data || []) as JobItem[]);
    }
    setLoading(false);
  };
  useEffect(() => {
    if (!projectId) return;
    fetchJobs();

    // Realtime updates for jobs of this project
    const channel = supabase.channel(`jobs-to-do-${projectId}`).on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'jobs'
    }, payload => {
      // Refresh only when it affects this project
      const p = (payload.new as any)?.project_id ?? (payload.old as any)?.project_id;
      if (p === projectId) fetchJobs();
    }).subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);
  const getStatusBadge = (status: string) => {
    const map: Record<string, {
      label: string;
      variant: any;
      icon: any;
    }> = {
      approved: {
        label: 'To Do',
        variant: 'secondary',
        icon: AlertCircle
      },
      needs_correction: {
        label: 'Needs Correction',
        variant: 'destructive',
        icon: AlertCircle
      },
      waiting_review: {
        label: 'Waiting for Review',
        variant: 'warning',
        icon: Clock
      },
      completed: {
        label: 'Done',
        variant: 'default',
        icon: CheckCircle2
      }
    };
    const cfg = map[status] || map.approved;
    const Icon = cfg.icon;
    return <Badge variant={cfg.variant} className="flex items-center gap-1">
        <Icon className="h-3 w-3" /> {cfg.label}
      </Badge>;
  };
  return <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Jobs To Do</CardTitle>
          <Button variant="outline" size="sm" disabled={navigating} onClick={() => {
          setNavigating(true);
          navigate(`/project/${projectId}`);
        }}>
            {navigating ? <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading...
              </> : "View All Jobs"}
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div> : jobs.length === 0 ? <p className="text-sm text-muted-foreground">No jobs yet</p> : <ul className="space-y-3">
              {jobs.slice(0, 6).map(job => <li key={job.id}>
                  <div className="border rounded-md overflow-hidden">
                    <button type="button" className="w-full text-left p-3 hover:bg-muted/50 transition" onClick={() => {
                setSelectedJobId(job.id);
                setSubmitOpen(true);
              }}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="font-medium truncate">{job.title}</div>
                          {job.description && <div className="text-sm text-muted-foreground line-clamp-2">{job.description}</div>}
                          <div className="text-xs text-muted-foreground mt-1">
                            Assigned by manager
                          </div>
                          {job.job_photos && job.job_photos.length > 0 && <div className="flex gap-1 mt-2 overflow-x-auto">
                              {job.job_photos.slice(0, 3).map(photo => (
                                <div key={photo.id} className="h-12 w-12 rounded border bg-muted flex items-center justify-center">
                                  <Image className="h-4 w-4 text-muted-foreground" />
                                </div>
                              ))}
                              {job.job_photos.length > 3 && <div className="h-12 w-12 rounded border bg-muted flex items-center justify-center text-xs">
                                  +{job.job_photos.length - 3}
                                </div>}
                            </div>}
                        </div>
                        {getStatusBadge(job.status)}
                      </div>
                    </button>
                    {job.job_photos && job.job_photos.length > 0 && <div className="border-t px-3 py-2 bg-muted/30">
                        <Button variant="ghost" size="sm" className="w-full" onClick={e => {
                  e.stopPropagation();
                  setSelectedJobForPhotos(job);
                  setPhotosDialogOpen(true);
                }}>
                          <Image className="mr-2 h-4 w-4" />
                          View Reference Photos ({job.job_photos.length})
                        </Button>
                      </div>}
                  </div>
                </li>)}
            </ul>}
        </CardContent>
      </Card>
      
      {selectedJobId && <JobSubmissionDialog open={submitOpen} onOpenChange={setSubmitOpen} jobId={selectedJobId} projectId={projectId} onSubmitted={fetchJobs} />}

      {selectedJobForPhotos && <ManagerReferencePhotosDialog open={photosDialogOpen} onOpenChange={setPhotosDialogOpen} jobTitle={selectedJobForPhotos.title} photos={selectedJobForPhotos.job_photos || []} />}
    </>;
}