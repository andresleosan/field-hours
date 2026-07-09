import { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ArrowLeft, Plus, Loader2, Clock, XCircle, FileSpreadsheet, ChevronDown, ChevronRight, Trash2, CheckSquare, Square } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useRequireRole, homeOf } from "@/hooks/useRequireRole";
import { AppShell, PageLoader } from "@/components/layout/AppShell";
import { CreateJobDialog } from "@/components/jobs/CreateJobDialog";
import { EditJobDialog } from "@/components/jobs/EditJobDialog";
import { JobSubmissionDialog } from "@/components/jobs/JobSubmissionDialog";
import { ManagerFeedbackDialog } from "@/components/jobs/ManagerFeedbackDialog";
import { BulkJobUploadDialog } from "@/components/jobs/BulkJobUploadDialog";
import { JobCard } from "@/components/jobs/JobCard";
import { getThumbnailPath } from "@/lib/imageUtils";

export default function ProjectDetails() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { userId, role: userRole, fullName, isLoading: isAuthLoading } = useRequireRole();
  const [project, setProject] = useState<any>(null);
  const [jobs, setJobs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateJob, setShowCreateJob] = useState(false);
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [selectedJobForSubmission, setSelectedJobForSubmission] = useState<string | null>(null);
  const [selectedJobForFeedback, setSelectedJobForFeedback] = useState<string | null>(null);
  const [selectedJobForEdit, setSelectedJobForEdit] = useState<any | null>(null);
  const [activeWorkers, setActiveWorkers] = useState<{ [key: string]: any[] }>({});
  const [photoUrls, setPhotoUrls] = useState<{ [key: string]: string[] }>({});
  const [managerFeedbackPhotoUrls, setManagerFeedbackPhotoUrls] = useState<{ [key: string]: string[] }>({});
  const [openSections, setOpenSections] = useState<Set<string>>(new Set());
  
  // Selection mode state for bulk delete
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedJobs, setSelectedJobs] = useState<Set<string>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Group jobs by section
  const groupedJobs = useMemo(() => {
    const groups: { [key: string]: any[] } = {};
    const unsectioned: any[] = [];
    
    jobs.forEach(job => {
      if (job.section) {
        if (!groups[job.section]) {
          groups[job.section] = [];
        }
        groups[job.section].push(job);
      } else {
        unsectioned.push(job);
      }
    });
    
    // Sort sections alphabetically
    const sortedGroups = Object.keys(groups).sort().reduce((acc, key) => {
      acc[key] = groups[key];
      return acc;
    }, {} as { [key: string]: any[] });
    
    return { sections: sortedGroups, unsectioned };
  }, [jobs]);

  const isPending = (j: any) => j.status === "pending" || j.status === "waiting_review";
  const unsectionedDone = groupedJobs.unsectioned.filter((j: any) => j.status === "completed").length;
  const unsectionedPending = groupedJobs.unsectioned.filter(isPending).length;

  // Sections start collapsed by default - no initialization needed

  const toggleSection = (section: string) => {
    setOpenSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(section)) {
        newSet.delete(section);
      } else {
        newSet.add(section);
      }
      return newSet;
    });
  };

  // Selection mode functions
  const toggleJobSelection = (jobId: string) => {
    setSelectedJobs(prev => {
      const newSet = new Set(prev);
      if (newSet.has(jobId)) {
        newSet.delete(jobId);
      } else {
        newSet.add(jobId);
      }
      return newSet;
    });
  };

  const selectAllJobs = () => {
    const allJobIds = jobs.map(j => j.id);
    setSelectedJobs(new Set(allJobIds));
  };

  const deselectAllJobs = () => {
    setSelectedJobs(new Set());
  };

  const toggleSelectionMode = () => {
    if (selectionMode) {
      setSelectionMode(false);
      setSelectedJobs(new Set());
    } else {
      setSelectionMode(true);
    }
  };

  const handleDeleteSelectedJobs = async () => {
    if (selectedJobs.size === 0) return;
    
    setIsDeleting(true);
    try {
      // Delete jobs one by one (Supabase doesn't have bulk delete with .in() for managers)
      for (const jobId of selectedJobs) {
        // First delete related records
        await supabase.from("job_photos").delete().eq("job_id", jobId);
        await supabase.from("job_time_tracking").delete().eq("job_id", jobId);
        await supabase.from("job_materials").delete().eq("job_id", jobId);
        
        // Delete job completions and their photos
        const { data: completions } = await supabase
          .from("job_completions")
          .select("id")
          .eq("job_id", jobId);
        
        if (completions) {
          for (const completion of completions) {
            await supabase.from("job_completion_photos").delete().eq("completion_id", completion.id);
            await supabase.from("job_collaborators").delete().eq("job_completion_id", completion.id);
          }
        }
        await supabase.from("job_completions").delete().eq("job_id", jobId);
        
        // Finally delete the job
        const { error } = await supabase.from("jobs").delete().eq("id", jobId);
        if (error) throw error;
      }

      toast({
        title: "Success",
        description: `${selectedJobs.size} job(s) deleted successfully`,
      });

      setSelectedJobs(new Set());
      setSelectionMode(false);
      setShowDeleteConfirm(false);
      fetchJobs();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete jobs",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  useEffect(() => {
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
      const { data: jobsData, error: jobsError } = await supabase
        .from("jobs")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });
      if (jobsError) throw jobsError;
      const baseJobs = jobsData || [];
      if (baseJobs.length === 0) {
        setJobs([]);
        setActiveWorkers({});
        setPhotoUrls({});
        return;
      }
      const jobIds = baseJobs.map((j) => j.id);

      const [tt, jm, comps, managerPhotos] = await Promise.all([
        supabase.from("job_time_tracking").select("*").in("job_id", jobIds),
        supabase.from("job_materials").select("id, job_id, material_usage_id").in("job_id", jobIds),
        supabase.from("job_completions").select("*").in("job_id", jobIds).order("completed_at", { ascending: false }),
        supabase.from("job_photos").select("*").in("job_id", jobIds),
      ]);

      const usageIds = (jm.data || []).map((l: any) => l.material_usage_id).filter(Boolean);
      const compIds = (comps.data || []).map((c: any) => c.id);
      const [usages, compPhotos, collabs] = await Promise.all([
        usageIds.length
          ? supabase.from("material_usage").select("*").in("id", usageIds)
          : Promise.resolve({ data: [] as any[] }),
        compIds.length
          ? supabase.from("job_completion_photos").select("*").in("completion_id", compIds)
          : Promise.resolve({ data: [] as any[] }),
        compIds.length
          ? supabase.from("job_collaborators").select("*").in("job_completion_id", compIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);

      const materialIds = [...new Set((usages.data || []).map((u: any) => u.material_id).filter(Boolean))];
      const profileIds = [
        ...new Set(
          [
            ...baseJobs.map((j) => j.created_by),
            ...(tt.data || []).map((t: any) => t.user_id),
            ...(comps.data || []).map((c: any) => c.completed_by),
            ...(collabs.data || []).map((c: any) => c.user_id),
          ].filter(Boolean),
        ),
      ];
      const [mats, profs] = await Promise.all([
        materialIds.length
          ? supabase.from("materials").select("*").in("id", materialIds)
          : Promise.resolve({ data: [] as any[] }),
        profileIds.length
          ? supabase.from("profiles").select("id, full_name").in("id", profileIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);

      const profileOf = (id: string) => (profs.data || []).find((p: any) => p.id === id) || null;
      const usageById = new Map((usages.data || []).map((u: any) => [u.id, u]));
      const matById = new Map((mats.data || []).map((m: any) => [m.id, m]));

      // Signed URLs en lote (thumbnail con fallback al original)
      const cleanPath = (p: string, bucket: string) => {
        if (!p.includes("/storage/v1/object/")) return p;
        const parts = p.split(`/${bucket}/`);
        return parts[1] ? decodeURIComponent(parts[1]) : p;
      };
      const signBatch = async (bucket: string, paths: string[]) => {
        const map = new Map<string, string>();
        if (!paths.length) return map;
        const thumbs = paths.map(getThumbnailPath);
        const [t, o] = await Promise.all([
          supabase.storage.from(bucket).createSignedUrls(thumbs, 3600),
          supabase.storage.from(bucket).createSignedUrls(paths, 3600),
        ]);
        paths.forEach((p, i) => {
          const url = t.data?.[i]?.signedUrl || o.data?.[i]?.signedUrl;
          if (url) map.set(p, url);
        });
        return map;
      };
      const compPhotoRows = compPhotos.data || [];
      const mgrPhotoRows = managerPhotos.data || [];
      const [compUrlMap, mgrUrlMap] = await Promise.all([
        signBatch("job-completion-photos", compPhotoRows.map((p: any) => p.photo_url)),
        signBatch("job-photos", mgrPhotoRows.map((p: any) => cleanPath(p.photo_url, "job-photos"))),
      ]);

      const workersMap: { [key: string]: any[] } = {};
      const urlsMap: { [key: string]: string[] } = {};
      const mgrUrls: { [key: string]: string[] } = {};

      const enrichedJobs = baseJobs.map((job) => {
        const jobTT = (tt.data || []).filter((t: any) => t.job_id === job.id);
        const active = jobTT
          .filter((t: any) => !t.ended_at)
          .map((t: any) => ({ ...t, profiles: profileOf(t.user_id) }));
        if (active.length) workersMap[job.id] = active;

        const jobJM = (jm.data || [])
          .filter((l: any) => l.job_id === job.id)
          .map((l: any) => {
            const mu: any = usageById.get(l.material_usage_id);
            return {
              id: l.id,
              material_usage: mu ? { ...mu, materials: matById.get(mu.material_id) || null } : null,
            };
          });

        const jobComps = (comps.data || [])
          .filter((c: any) => c.job_id === job.id)
          .map((c: any) => {
            const submitter = profileOf(c.completed_by);
            return {
              ...c,
              job_completion_photos: compPhotoRows.filter((p: any) => p.completion_id === c.id),
              job_collaborators: (collabs.data || [])
                .filter((x: any) => x.job_completion_id === c.id)
                .map((x: any) => ({ ...x, profiles: profileOf(x.user_id) })),
              profiles: submitter ? { full_name: submitter.full_name } : null,
            };
          });
        const latestPhotos =
          jobComps.find((c: any) => c.job_completion_photos.length)?.job_completion_photos || [];
        const photoLinks = latestPhotos
          .map((p: any) => compUrlMap.get(p.photo_url))
          .filter(Boolean) as string[];
        if (photoLinks.length) urlsMap[job.id] = photoLinks;

        const jobMgrPhotos = mgrPhotoRows.filter((p: any) => p.job_id === job.id);
        const jobMgrUrls = jobMgrPhotos
          .map((p: any) => mgrUrlMap.get(cleanPath(p.photo_url, "job-photos")))
          .filter(Boolean) as string[];
        if (jobMgrUrls.length) mgrUrls[job.id] = jobMgrUrls;

        const creator = profileOf(job.created_by);
        return {
          ...job,
          profiles: creator ? { full_name: creator.full_name } : null,
          job_time_tracking: jobTT,
          job_materials: jobJM,
          job_completions: jobComps,
          job_photos: jobMgrPhotos,
        };
      });

      setJobs(enrichedJobs);
      setActiveWorkers(workersMap);
      setPhotoUrls(urlsMap);
      setManagerFeedbackPhotoUrls(mgrUrls);
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
    // If needs correction, open the feedback dialog instead
    if (status === "needs_correction") {
      setSelectedJobForFeedback(jobId);
      return;
    }

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

  const downloadPhoto = async (photoPath: string, bucket: string = "job-completion-photos") => {
    try {
      // Extract just the path if it's a full URL
      let cleanPath = photoPath;
      if (photoPath.includes('/storage/v1/object/')) {
        const bucketName = bucket === "job-photos" ? "job-photos" : "job-completion-photos";
        const parts = photoPath.split(`/${bucketName}/`);
        if (parts[1]) {
          cleanPath = decodeURIComponent(parts[1]);
        }
      }

      const { data, error } = await supabase.storage
        .from(bucket)
        .download(cleanPath);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = cleanPath.split("/").pop() || "photo.jpg";
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

  if (isAuthLoading || isLoading) {
    return <PageLoader />;
  }

  const homeRoute = homeOf(userRole ?? "builder");

  if (!project) {
    return (
      <AppShell role={userRole ?? "builder"} fullName={fullName}>
        <div className="py-16 text-center">
          <p className="text-muted-foreground">Project not found</p>
          <Button onClick={() => navigate(homeRoute)} className="mt-4">
            Go back
          </Button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell role={userRole ?? "builder"} fullName={fullName}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(homeRoute)} className="mt-1 shrink-0" aria-label="Back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-0">
            <h1 className="break-words text-2xl font-bold">{project.name}</h1>
            {project.description && <p className="text-sm text-muted-foreground">{project.description}</p>}
          </div>
        </div>
        {userRole === "manager" && (
          <div className="flex flex-wrap gap-2">
            <Button variant={selectionMode ? "default" : "outline"} onClick={toggleSelectionMode} size="sm">
              {selectionMode ? (
                <>
                  <XCircle className="mr-2 h-4 w-4" />
                  Cancel
                </>
              ) : (
                <>
                  <CheckSquare className="mr-2 h-4 w-4" />
                  Select
                </>
              )}
            </Button>
            {!selectionMode && (
              <>
                <Button variant="outline" onClick={() => setShowBulkUpload(true)} size="sm">
                  <FileSpreadsheet className="mr-2 h-4 w-4" />
                  Import
                </Button>
                <Button variant="brand" onClick={() => setShowCreateJob(true)} size="sm">
                  <Plus className="mr-2 h-4 w-4" />
                  Create Job
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Selection toolbar */}
      {selectionMode && userRole === "manager" && jobs.length > 0 && (
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="py-3 px-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                <span className="text-sm font-medium">
                  {selectedJobs.size} of {jobs.length} selected
                </span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={selectAllJobs} className="text-xs">
                    <CheckSquare className="h-4 w-4 mr-1" />
                    All
                  </Button>
                  <Button variant="outline" size="sm" onClick={deselectAllJobs} className="text-xs">
                    <Square className="h-4 w-4 mr-1" />
                    None
                  </Button>
                </div>
              </div>
              <Button 
                variant="destructive" 
                size="sm"
                disabled={selectedJobs.size === 0}
                onClick={() => setShowDeleteConfirm(true)}
                className="text-xs"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Delete ({selectedJobs.size})
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
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
          <>
            {/* Section-based job organization */}
            {Object.entries(groupedJobs.sections).map(([sectionName, sectionJobs]) => {
              const isOpen = openSections.has(sectionName);
              const completedCount = sectionJobs.filter((j: any) => j.status === "completed").length;
              const pendingCount = sectionJobs.filter((j: any) => j.status === "pending" || j.status === "waiting_review").length;
              
              return (
                <Collapsible key={sectionName} open={isOpen} onOpenChange={() => toggleSection(sectionName)}>
                  <CollapsibleTrigger asChild>
                    <button
                      type="button"
                      className="flex w-full items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 text-left shadow-xs transition-colors hover:bg-muted/50"
                    >
                      {isOpen ? (
                        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                      )}
                      <span className="min-w-0 truncate font-semibold">{sectionName}</span>
                      <span className="ml-auto flex shrink-0 items-center gap-2">
                        {pendingCount > 0 && (
                          <Badge variant="warning" className="text-xs">
                            <Clock className="mr-1 h-3 w-3" />
                            {pendingCount} to review
                          </Badge>
                        )}
                        <span className="font-mono text-xs tabular-nums text-muted-foreground">
                          {completedCount}/{sectionJobs.length} done
                        </span>
                      </span>
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="ml-2 mt-2 space-y-3 border-l-2 border-border pl-4">
                    {sectionJobs.map((job: any) => (
                      <JobCard
                        key={job.id}
                        job={job}
                        userRole={userRole}
                        activeWorkers={activeWorkers[job.id] || []}
                        photoUrls={photoUrls[job.id] || []}
                        managerFeedbackPhotoUrls={managerFeedbackPhotoUrls[job.id] || []}
                        onEdit={setSelectedJobForEdit}
                        onStartTracking={startJobTracking}
                        onSubmitForReview={setSelectedJobForSubmission}
                        onNeedsCorrection={(jobId) => handleJobStatusChange(jobId, "needs_correction")}
                        onJobDone={(jobId) => handleJobStatusChange(jobId, "completed")}
                        onDownloadPhoto={downloadPhoto}
                        calculateTotalTime={calculateTotalTime}
                        formatTime={formatTime}
                        currentUserId={userId ?? undefined}
                        selectionMode={selectionMode}
                        isSelected={selectedJobs.has(job.id)}
                        onToggleSelect={toggleJobSelection}
                      />
                    ))}
                  </CollapsibleContent>
                </Collapsible>
              );
            })}

            {/* Unsectioned jobs */}
            {groupedJobs.unsectioned.length > 0 && (
              <Collapsible 
                open={openSections.has("__unsectioned__")} 
                onOpenChange={() => toggleSection("__unsectioned__")}
              >
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 text-left shadow-xs transition-colors hover:bg-muted/50"
                  >
                    {openSections.has("__unsectioned__") ? (
                      <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    )}
                    <span className="min-w-0 truncate font-semibold text-muted-foreground">Unsectioned</span>
                    <span className="ml-auto flex shrink-0 items-center gap-2">
                      {unsectionedPending > 0 && (
                        <Badge variant="warning" className="text-xs">
                          <Clock className="mr-1 h-3 w-3" />
                          {unsectionedPending} to review
                        </Badge>
                      )}
                      <span className="font-mono text-xs tabular-nums text-muted-foreground">
                        {unsectionedDone}/{groupedJobs.unsectioned.length} done
                      </span>
                    </span>
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent className="ml-2 mt-2 space-y-3 border-l-2 border-border pl-4">
                  {groupedJobs.unsectioned.map((job: any) => (
                    <JobCard
                      key={job.id}
                      job={job}
                      userRole={userRole}
                      activeWorkers={activeWorkers[job.id] || []}
                      photoUrls={photoUrls[job.id] || []}
                      managerFeedbackPhotoUrls={managerFeedbackPhotoUrls[job.id] || []}
                      onEdit={setSelectedJobForEdit}
                      onStartTracking={startJobTracking}
                      onSubmitForReview={setSelectedJobForSubmission}
                      onNeedsCorrection={(jobId) => handleJobStatusChange(jobId, "needs_correction")}
                      onJobDone={(jobId) => handleJobStatusChange(jobId, "completed")}
                      onDownloadPhoto={downloadPhoto}
                      calculateTotalTime={calculateTotalTime}
                      formatTime={formatTime}
                      currentUserId={userId ?? undefined}
                      selectionMode={selectionMode}
                      isSelected={selectedJobs.has(job.id)}
                      onToggleSelect={toggleJobSelection}
                    />
                  ))}
                </CollapsibleContent>
              </Collapsible>
            )}

            {/* If no sections exist yet, show jobs in a simple list */}
            {Object.keys(groupedJobs.sections).length === 0 && groupedJobs.unsectioned.length === 0 && (
              <div className="text-center text-muted-foreground py-8">
                No jobs to display
              </div>
            )}
          </>
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

      {showBulkUpload && (
        <BulkJobUploadDialog
          open={showBulkUpload}
          onOpenChange={setShowBulkUpload}
          projectId={projectId!}
          onJobsCreated={fetchJobs}
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

      {selectedJobForFeedback && (
        <ManagerFeedbackDialog
          open={!!selectedJobForFeedback}
          onOpenChange={(open) => !open && setSelectedJobForFeedback(null)}
          jobId={selectedJobForFeedback}
          onSubmitted={fetchJobs}
        />
      )}

      {selectedJobForEdit && (
        <EditJobDialog
          open={!!selectedJobForEdit}
          onOpenChange={(open) => !open && setSelectedJobForEdit(null)}
          job={selectedJobForEdit}
          onJobUpdated={fetchJobs}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedJobs.size} Job(s)?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the selected jobs 
              and all associated data including time tracking, materials, photos, and submissions.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteSelectedJobs}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Jobs
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
