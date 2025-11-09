import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Clock, CheckCircle2, AlertCircle, PlayCircle, Loader2 } from "lucide-react";
import { JobReviewDialog } from "@/components/jobs/JobReviewDialog";

export const ManagerJobsList = () => {
  const [jobs, setJobs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedJobForReview, setSelectedJobForReview] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchJobs();
  }, []);

  const fetchJobs = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from("jobs")
        .select(`
          *,
          projects(name),
          profiles:created_by(full_name)
        `)
        .in("status", ["approved", "waiting_review", "needs_correction"])
        .order("created_at", { ascending: false })
        .limit(20);

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
      approved: { label: "To Do", variant: "secondary" as const, icon: AlertCircle },
      waiting_review: { label: "Waiting Review", variant: "outline" as const, icon: Clock },
      needs_correction: { label: "Needs Correction", variant: "destructive" as const, icon: AlertCircle },
      completed: { label: "Completed", variant: "default" as const, icon: CheckCircle2 },
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
        {jobs.map((job) => (
          <Card key={job.id} className="hover:shadow-md transition-shadow">
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-semibold">{job.title}</h3>
                    {getStatusBadge(job.status)}
                  </div>
                  {job.description && (
                    <p className="text-sm text-muted-foreground mb-2">{job.description}</p>
                  )}
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>Project: {job.projects?.name}</span>
                    <span>Created by: {job.profiles?.full_name}</span>
                  </div>
                </div>
                <div className="flex gap-2 ml-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(`/project/${job.project_id}`)}
                  >
                    View Project
                  </Button>
                  {job.status === "waiting_review" && (
                    <Button
                      size="sm"
                      onClick={() => setSelectedJobForReview(job.id)}
                    >
                      Review
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {selectedJobForReview && (
        <JobReviewDialog
          open={!!selectedJobForReview}
          onOpenChange={(open) => !open && setSelectedJobForReview(null)}
          jobId={selectedJobForReview}
          onReviewed={fetchJobs}
        />
      )}
    </>
  );
};
