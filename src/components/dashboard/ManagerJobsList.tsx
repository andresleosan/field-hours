import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Clock, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { JobReviewDialog } from "@/components/jobs/JobReviewDialog";

export const ManagerJobsList = () => {
  const [jobs, setJobs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedJobForReview, setSelectedJobForReview] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchJobs();
    const channel = supabase.channel('manager-jobs')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'jobs'
      }, () => fetchJobs())
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'job_completions'
      }, () => fetchJobs())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchJobs = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from("jobs")
        .select(`
          *,
          projects(name),
          job_photos(id, photo_url)
        `)
        .neq("status", "completed")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setJobs(data || []);
    } catch (error: any) {
      console.error("Error fetching jobs:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      approved: {
        label: "To Do",
        variant: "secondary" as const,
        icon: AlertCircle
      },
      pending: {
        label: "Waiting for Review",
        variant: "warning" as const,
        icon: Clock
      },
      waiting_review: {
        label: "Waiting for Review",
        variant: "warning" as const,
        icon: Clock
      },
      needs_correction: {
        label: "Needs Correction",
        variant: "destructive" as const,
        icon: AlertCircle
      },
      completed: {
        label: "Completed",
        variant: "default" as const,
        icon: CheckCircle2
      }
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.approved;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="flex items-center gap-1 text-[10px] px-2 py-0.5 whitespace-nowrap">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No active jobs found
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {jobs.map(job => (
          <Card key={job.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              {/* Header: Project name highlighted + badge */}
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-1 rounded truncate">
                  {job.projects?.name}
                </span>
                {getStatusBadge(job.status)}
              </div>
              
              {/* Job title */}
              <h3 className="font-semibold text-sm sm:text-base mb-1 line-clamp-2">{job.title}</h3>
              
              {/* Description */}
              {job.description && (
                <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{job.description}</p>
              )}
              
              {/* Buttons - full width stacked */}
              <div className="flex flex-col gap-2 mt-3">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full text-xs h-8"
                  onClick={() => navigate(`/project/${job.project_id}`)}
                >
                  View Project
                </Button>
                {(job.status === "waiting_review" || job.status === "pending") && (
                  <Button 
                    size="sm" 
                    className="w-full text-xs h-8"
                    onClick={() => setSelectedJobForReview(job.id)}
                  >
                    Review Job
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {selectedJobForReview && (
        <JobReviewDialog 
          open={!!selectedJobForReview} 
          onOpenChange={open => !open && setSelectedJobForReview(null)} 
          jobId={selectedJobForReview} 
          onReviewed={fetchJobs} 
        />
      )}
    </>
  );
};
