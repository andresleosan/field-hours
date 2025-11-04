import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Plus, Loader2, Clock, CheckCircle2, AlertCircle, PlayCircle } from "lucide-react";
import { CreateJobDialog } from "@/components/jobs/CreateJobDialog";
import { JobSubmissionDialog } from "@/components/jobs/JobSubmissionDialog";
import { JobReviewDialog } from "@/components/jobs/JobReviewDialog";

export default function ProjectDetails() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [project, setProject] = useState<any>(null);
  const [jobs, setJobs] = useState<any[]>([]);
  const [userRole, setUserRole] = useState<"manager" | "builder" | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateJob, setShowCreateJob] = useState(false);
  const [selectedJobForSubmission, setSelectedJobForSubmission] = useState<string | null>(null);
  const [selectedJobForReview, setSelectedJobForReview] = useState<string | null>(null);
  const [activeJobTracking, setActiveJobTracking] = useState<{ [key: string]: boolean }>({});

  useEffect(() => {
    checkAuth();
    fetchProjectData();
  }, [projectId]);

  const checkAuth = async () => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        navigate("/auth");
        return;
      }

      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userData.user.id)
        .single();

      if (roleData) {
        setUserRole(roleData.role as "manager" | "builder");
      }
    } catch (error: any) {
      console.error("Error checking auth:", error);
    }
  };

  const fetchProjectData = async () => {
    try {
      setIsLoading(true);
      const { data: projectData, error: projectError } = await supabase
        .from("projects")
        .select("*")
        .eq("id", projectId)
        .single();

      if (projectError) throw projectError;
      setProject(projectData);

      await fetchJobs();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to load project",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchJobs = async () => {
    try {
      const { data, error } = await supabase
        .from("jobs")
        .select(`
          *,
          job_completions(count),
          profiles:created_by(full_name)
        `)
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setJobs(data || []);

      // Check for active job tracking
      const { data: userData } = await supabase.auth.getUser();
      if (userData.user) {
        const { data: trackingData } = await supabase
          .from("job_time_tracking")
          .select("job_id")
          .eq("user_id", userData.user.id)
          .is("ended_at", null);

        const tracking: { [key: string]: boolean } = {};
        trackingData?.forEach(t => {
          tracking[t.job_id] = true;
        });
        setActiveJobTracking(tracking);
      }
    } catch (error: any) {
      console.error("Error fetching jobs:", error);
    }
  };

  const startJobTracking = async (jobId: string) => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const { error } = await supabase
        .from("job_time_tracking")
        .insert({
          job_id: jobId,
          user_id: userData.user.id,
          project_id: projectId!,
        });

      if (error) throw error;

      setActiveJobTracking(prev => ({ ...prev, [jobId]: true }));
      toast({
        title: "Time tracking started",
        description: "Your time is now being tracked for this job",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to start tracking",
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      approved: { label: "To Do", variant: "secondary" as const, icon: AlertCircle },
      in_progress: { label: "In Progress", variant: "default" as const, icon: PlayCircle },
      waiting_review: { label: "Waiting for Review", variant: "outline" as const, icon: Clock },
      needs_correction: { label: "Needs Correction", variant: "destructive" as const, icon: AlertCircle },
      completed: { label: "Job Done", variant: "default" as const, icon: CheckCircle2 },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.approved;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">
          <p>Project not found</p>
          <Button onClick={() => navigate(-1)} className="mt-4">
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{project.name}</h1>
            <p className="text-muted-foreground">{project.description}</p>
          </div>
        </div>
        {userRole === "manager" && (
          <Button onClick={() => setShowCreateJob(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Job
          </Button>
        )}
      </div>

      <div className="grid gap-4">
        {jobs.length === 0 ? (
          <Card>
            <CardContent className="flex items-center justify-center py-12">
              <div className="text-center">
                <p className="text-muted-foreground">No jobs yet</p>
                {userRole === "manager" && (
                  <Button className="mt-4" onClick={() => setShowCreateJob(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create First Job
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ) : (
          jobs.map((job) => (
            <Card key={job.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="mb-2">{job.title}</CardTitle>
                    {job.description && (
                      <p className="text-sm text-muted-foreground">{job.description}</p>
                    )}
                    <div className="mt-2 text-xs text-muted-foreground">
                      Created by {job.profiles?.full_name || "Unknown"}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 items-end">
                    {getStatusBadge(job.status)}
                    {activeJobTracking[job.id] && (
                      <Badge variant="outline" className="animate-pulse">
                        <Clock className="h-3 w-3 mr-1" />
                        Tracking Time
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  {userRole === "builder" && job.status === "approved" && (
                    <>
                      {!activeJobTracking[job.id] && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => startJobTracking(job.id)}
                        >
                          <PlayCircle className="h-4 w-4 mr-2" />
                          Start Working
                        </Button>
                      )}
                      <Button
                        size="sm"
                        onClick={() => setSelectedJobForSubmission(job.id)}
                      >
                        Submit for Review
                      </Button>
                    </>
                  )}
                  {userRole === "builder" && job.status === "needs_correction" && (
                    <Button
                      size="sm"
                      onClick={() => setSelectedJobForSubmission(job.id)}
                    >
                      Resubmit Job
                    </Button>
                  )}
                  {userRole === "manager" && job.status === "waiting_review" && (
                    <Button
                      size="sm"
                      onClick={() => setSelectedJobForReview(job.id)}
                    >
                      Review Submission
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {userRole === "manager" && (
        <CreateJobDialog
          open={showCreateJob}
          onOpenChange={setShowCreateJob}
          projectId={projectId!}
          onJobCreated={fetchJobs}
        />
      )}

      {selectedJobForSubmission && (
        <JobSubmissionDialog
          open={!!selectedJobForSubmission}
          onOpenChange={(open) => !open && setSelectedJobForSubmission(null)}
          jobId={selectedJobForSubmission}
          projectId={projectId!}
          onSubmitted={fetchJobs}
        />
      )}

      {selectedJobForReview && (
        <JobReviewDialog
          open={!!selectedJobForReview}
          onOpenChange={(open) => !open && setSelectedJobForReview(null)}
          jobId={selectedJobForReview}
          onReviewed={fetchJobs}
        />
      )}
    </div>
  );
}
