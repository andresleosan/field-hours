import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Plus, Loader2, Clock, CheckCircle2, AlertCircle, PlayCircle, Users, Package, Download, XCircle } from "lucide-react";
import { CreateJobDialog } from "@/components/jobs/CreateJobDialog";
import { JobSubmissionDialog } from "@/components/jobs/JobSubmissionDialog";

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
  const [activeWorkers, setActiveWorkers] = useState<{ [key: string]: any[] }>({});
  const [photoUrls, setPhotoUrls] = useState<{ [key: string]: string[] }>({});

  useEffect(() => {
    checkAuth();
    fetchProjectData();
    
    // Set up realtime subscription
    const channel = supabase
      .channel('job-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jobs', filter: `project_id=eq.${projectId}` }, () => fetchJobs())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'job_time_tracking' }, () => fetchJobs())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'job_materials' }, () => fetchJobs())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'material_usage' }, () => fetchJobs())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'job_completions' }, () => fetchJobs())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'job_completion_photos' }, () => fetchJobs())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'job_collaborators' }, () => fetchJobs())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
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
      // Fetch base jobs for this project
      const { data: jobsData, error: jobsError } = await supabase
        .from("jobs")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });

      if (jobsError) throw jobsError;

      const enrichedJobs: any[] = [];
      const workersMap: { [key: string]: any[] } = {};
      const urlsMap: { [key: string]: string[] } = {};

      for (const job of jobsData || []) {
        const jobCopy: any = { ...job };

        // Creator profile
        const { data: creator } = await supabase
          .from("profiles")
          .select("id, full_name")
          .eq("id", job.created_by)
          .maybeSingle();
        jobCopy.profiles = creator ? { full_name: creator.full_name } : null;

        // Time tracking entries
        const { data: tt } = await supabase
          .from("job_time_tracking")
          .select("*")
          .eq("job_id", job.id);
        jobCopy.job_time_tracking = tt || [];

        // Active workers (ended_at IS NULL) + names
        const { data: activeTracking } = await supabase
          .from("job_time_tracking")
          .select("id, user_id")
          .eq("job_id", job.id)
          .is("ended_at", null);
        if (activeTracking && activeTracking.length > 0) {
          const userIds = activeTracking.map((t: any) => t.user_id);
          const { data: profs } = await supabase
            .from("profiles")
            .select("id, full_name")
            .in("id", userIds);
          const merged = (activeTracking || []).map((t: any) => ({
            ...t,
            profiles: profs?.find((p: any) => p.id === t.user_id),
          }));
          workersMap[job.id] = merged;
        }

        // Materials used on this job
        const { data: jm } = await supabase
          .from("job_materials")
          .select("id, material_usage_id")
          .eq("job_id", job.id);
        const jmDetailed: any[] = [];
        for (const link of jm || []) {
          const { data: mu } = await supabase
            .from("material_usage")
            .select("*")
            .eq("id", link.material_usage_id)
            .maybeSingle();
          let material: any = null;
          if (mu?.material_id) {
            const { data: mat } = await supabase
              .from("materials")
              .select("*")
              .eq("id", mu.material_id)
              .maybeSingle();
            material = mat || null;
          }
          jmDetailed.push({ id: link.id, material_usage: { ...mu, materials: material } });
        }
        jobCopy.job_materials = jmDetailed;

        // Job completions (most recent first) with photos and collaborators
        const { data: completions } = await supabase
          .from("job_completions")
          .select("*")
          .eq("job_id", job.id)
          .order("completed_at", { ascending: false });
        const compsDetailed: any[] = [];
        for (const comp of completions || []) {
          const { data: photos } = await supabase
            .from("job_completion_photos")
            .select("*")
            .eq("completion_id", comp.id);

          const { data: collabs } = await supabase
            .from("job_collaborators")
            .select("*")
            .eq("job_completion_id", comp.id);

          const { data: submitter } = await supabase
            .from("profiles")
            .select("id, full_name")
            .eq("id", comp.completed_by)
            .maybeSingle();

          let collabWithProfiles: any[] = [];
          if (collabs && collabs.length > 0) {
            const collabIds = collabs.map((c: any) => c.user_id);
            const { data: collabProfs } = await supabase
              .from("profiles")
              .select("id, full_name")
              .in("id", collabIds);
            collabWithProfiles = (collabs || []).map((c: any) => ({
              ...c,
              profiles: collabProfs?.find((p: any) => p.id === c.user_id),
            }));
          }

          const compDetail = {
            ...comp,
            job_completion_photos: photos || [],
            job_collaborators: collabWithProfiles,
            profiles: submitter ? { full_name: submitter.full_name } : null,
          };
          compsDetailed.push(compDetail);

          // Prepare signed URLs for the first completion's photos
          if (!urlsMap[job.id] && (photos?.length || 0) > 0) {
            const urls: string[] = [];
            for (const photo of photos || []) {
              const { data: signedData } = await supabase
                .storage
                .from("job-completion-photos")
                .createSignedUrl(photo.photo_url, 3600);
              if (signedData?.signedUrl) urls.push(signedData.signedUrl);
            }
            if (urls.length > 0) urlsMap[job.id] = urls;
          }
        }
        jobCopy.job_completions = compsDetailed;

        enrichedJobs.push(jobCopy);
      }

      setJobs(enrichedJobs);
      setActiveWorkers(workersMap);
      setPhotoUrls(urlsMap);
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

      toast({
        title: "Time tracking started",
        description: "Your time is now being tracked for this job",
      });
      
      fetchJobs();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to start tracking",
        variant: "destructive",
      });
    }
  };

  const handleJobStatusChange = async (jobId: string, status: "completed" | "needs_correction") => {
    try {
      const { error } = await supabase
        .from("jobs")
        .update({ status })
        .eq("id", jobId);

      if (error) throw error;

      toast({
        title: "Success",
        description: status === "completed" ? "Job marked as complete" : "Job needs correction",
      });
      
      fetchJobs();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update job status",
        variant: "destructive",
      });
    }
  };

  const calculateTotalTime = (timeTracking: any[]) => {
    return timeTracking.reduce((total: number, track: any) => {
      if (track.ended_at) {
        const minutes = Math.round(
          (new Date(track.ended_at).getTime() - new Date(track.started_at).getTime()) / 60000
        );
        return total + minutes;
      }
      return total;
    }, 0);
  };

  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const downloadPhoto = async (photoPath: string) => {
    try {
      const { data, error } = await supabase.storage
        .from("job-completion-photos")
        .download(photoPath);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = photoPath.split("/").pop() || "photo.jpg";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to download photo",
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

      <div className="grid gap-6">
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
          jobs.map((job) => {
            const completion = job.job_completions?.[0];
            const totalTime = calculateTotalTime(job.job_time_tracking || []);
            const workers = activeWorkers[job.id] || [];
            const materials = job.job_materials || [];
            const photos = photoUrls[job.id] || [];

            return (
              <Card key={job.id} className="overflow-hidden">
                <CardHeader className="bg-muted/30">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="mb-2">
                        <CardTitle className="text-xl">{job.title}</CardTitle>
                      </div>
                      {job.description && (
                        <CardDescription className="text-sm">{job.description}</CardDescription>
                      )}
                      <div className="mt-3 text-xs text-muted-foreground">
                        Created by {job.profiles?.full_name || "Unknown"}
                      </div>
                    </div>
                    <div className="pt-1">{getStatusBadge(job.status)}</div>
                  </div>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="grid gap-6">
                    {/* Quick Stats Row */}
                    <div className="grid grid-cols-3 gap-4">
                      {/* Currently Working */}
                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-sm flex items-center gap-2">
                            <Users className="h-4 w-4 text-primary" />
                            Currently Working
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          {workers.length > 0 ? (
                            <div className="space-y-2">
                              {workers.map((worker: any) => (
                                <Badge key={worker.id} variant="secondary" className="animate-pulse">
                                  {worker.profiles?.full_name}
                                </Badge>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-muted-foreground">No one working</p>
                          )}
                        </CardContent>
                      </Card>

                      {/* Time Worked */}
                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-sm flex items-center gap-2">
                            <Clock className="h-4 w-4 text-primary" />
                            Time Worked
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold">
                            {totalTime > 0 ? formatTime(totalTime) : "0h 0m"}
                          </div>
                          {job.job_time_tracking && job.job_time_tracking.length > 0 && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {job.job_time_tracking.length} session(s)
                            </p>
                          )}
                        </CardContent>
                      </Card>

                      {/* Materials */}
                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-sm flex items-center gap-2">
                            <Package className="h-4 w-4 text-primary" />
                            Materials Used
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold">{materials.length}</div>
                          {materials.length > 0 && (
                            <p className="text-xs text-muted-foreground mt-1">
                              £{materials.reduce((sum: number, m: any) => {
                                const usage = m.material_usage;
                                const material = usage?.materials;
                                return sum + (usage?.quantity_used * material?.cost_per_unit || 0);
                              }, 0).toFixed(2)} total
                            </p>
                          )}
                        </CardContent>
                      </Card>
                    </div>

                    {/* Submission Details for Waiting Review and Completed */}
                    {(job.status === "waiting_review" || job.status === "completed") && completion && (
                      <>
                        <Separator />
                        <div className="space-y-4">
                          <h3 className="font-semibold text-lg">Submission Details</h3>
                          
                          {/* Submitted by & Collaborators */}
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline">
                              Submitted by {completion.profiles?.full_name}
                            </Badge>
                            {completion.job_collaborators?.length > 0 && (
                              <>
                                <span className="text-sm text-muted-foreground">with</span>
                                {completion.job_collaborators.map((collab: any) => (
                                  <Badge key={collab.user_id} variant="secondary">
                                    {collab.profiles?.full_name}
                                  </Badge>
                                ))}
                              </>
                            )}
                          </div>

                          {/* Builder Notes */}
                          {completion.notes && (
                            <div className="space-y-2">
                              <p className="text-sm font-medium">Builder Notes:</p>
                              <p className="text-sm bg-muted p-4 rounded-lg">{completion.notes}</p>
                            </div>
                          )}

                          {/* Photos */}
                          {photos.length > 0 && (
                            <div className="space-y-3">
                              <p className="text-sm font-medium">Photos ({photos.length})</p>
                              <ScrollArea className="w-full">
                                <div className="flex gap-4 pb-4">
                                  {photos.map((url, index) => (
                                    <div key={index} className="relative group shrink-0">
                                      <img
                                        src={url}
                                        alt={`Job completion ${index + 1}`}
                                        className="h-48 w-48 object-cover rounded-lg border-2 border-border"
                                      />
                                      <Button
                                        variant="secondary"
                                        size="sm"
                                        className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                                        onClick={() => {
                                          const photo = completion.job_completion_photos[index];
                                          if (photo) downloadPhoto(photo.photo_url);
                                        }}
                                      >
                                        <Download className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  ))}
                                </div>
                              </ScrollArea>
                            </div>
                          )}

                          {/* Materials Details */}
                          {materials.length > 0 && (
                            <div className="space-y-3">
                              <p className="text-sm font-medium">Materials Breakdown</p>
                              <div className="border rounded-lg divide-y">
                                {materials.map((jm: any) => {
                                  const usage = jm.material_usage;
                                  const material = usage?.materials;
                                  return (
                                    <div key={jm.id} className="p-3 flex justify-between items-center">
                                      <div>
                                        <div className="font-medium text-sm">{material?.name}</div>
                                        <div className="text-xs text-muted-foreground">
                                          {usage?.quantity_used} {material?.unit}
                                        </div>
                                      </div>
                                      <div className="font-semibold text-sm">
                                        £{(usage?.quantity_used * material?.cost_per_unit).toFixed(2)}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      </>
                    )}

                    {/* Action Buttons */}
                    <div className="flex gap-2 pt-4 border-t">
                      {userRole === "builder" && job.status === "approved" && (
                        <>
                          {!workers.some(w => w.user_id === userRole) && (
                            <Button
                              variant="outline"
                              onClick={() => startJobTracking(job.id)}
                            >
                              <PlayCircle className="h-4 w-4 mr-2" />
                              Start Working
                            </Button>
                          )}
                          <Button onClick={() => setSelectedJobForSubmission(job.id)}>
                            Submit for Review
                          </Button>
                        </>
                      )}
                      {userRole === "builder" && job.status === "needs_correction" && (
                        <Button onClick={() => setSelectedJobForSubmission(job.id)}>
                          Resubmit Job
                        </Button>
                      )}
                      {userRole === "manager" && job.status === "waiting_review" && (
                        <>
                          <Button
                            variant="destructive"
                            onClick={() => handleJobStatusChange(job.id, "needs_correction")}
                          >
                            <XCircle className="h-4 w-4 mr-2" />
                            Needs Correction
                          </Button>
                          <Button onClick={() => handleJobStatusChange(job.id, "completed")}>
                            <CheckCircle2 className="h-4 w-4 mr-2" />
                            Job Done
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
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
    </div>
  );
}
