import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Download, CheckCircle, XCircle, Users, Clock, Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface JobReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId: string;
  onReviewed: () => void;
}

export const JobReviewDialog = ({ open, onOpenChange, jobId, onReviewed }: JobReviewDialogProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [jobData, setJobData] = useState<any>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      fetchJobData();
    }
  }, [open, jobId]);

  const fetchJobData = async () => {
    try {
      const { data: job, error: jobError } = await supabase
        .from("jobs")
        .select(`
          *,
          job_completions(
            *,
            job_completion_photos(*),
            job_collaborators(
              user_id,
              profiles(full_name)
            ),
            profiles(full_name)
          ),
          job_materials(
            material_usage(
              *,
              materials(*)
            )
          ),
          job_time_tracking(*)
        `)
        .eq("id", jobId)
        .single();

      if (jobError) throw jobError;
      setJobData(job);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to load job data",
        variant: "destructive",
      });
    }
  };

  const handleApprove = async () => {
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from("jobs")
        .update({ status: "completed" })
        .eq("id", jobId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Job marked as complete",
      });

      onReviewed();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to approve job",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleReject = async () => {
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from("jobs")
        .update({ status: "needs_correction" })
        .eq("id", jobId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Job marked as needing correction",
      });

      onReviewed();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to reject job",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const downloadPhoto = async (photoUrl: string) => {
    try {
      const { data, error } = await supabase.storage
        .from("job-completion-photos")
        .download(photoUrl);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = photoUrl.split("/").pop() || "photo.jpg";
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

  const calculateTotalTime = () => {
    if (!jobData?.job_time_tracking) return 0;
    return jobData.job_time_tracking.reduce((total: number, track: any) => {
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

  if (!jobData) return null;

  const completion = jobData.job_completions?.[0];
  const totalTime = calculateTotalTime();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Review Job Submission</DialogTitle>
        </DialogHeader>
        <div className="space-y-6">
          <div>
            <h3 className="font-semibold text-lg">{jobData.title}</h3>
            {jobData.description && (
              <p className="text-sm text-muted-foreground mt-1">{jobData.description}</p>
            )}
          </div>

          {completion && (
            <>
              <div className="flex items-center gap-4">
                <Badge variant="outline">
                  Submitted by {completion.profiles?.full_name}
                </Badge>
                {totalTime > 0 && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    {formatTime(totalTime)} worked
                  </div>
                )}
              </div>

              {completion.notes && (
                <div className="space-y-2">
                  <Label className="font-semibold">Builder Notes</Label>
                  <p className="text-sm bg-muted p-3 rounded-md">{completion.notes}</p>
                </div>
              )}

              {completion.job_collaborators?.length > 0 && (
                <div className="space-y-2">
                  <Label className="font-semibold flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Collaborators
                  </Label>
                  <div className="flex flex-wrap gap-2">
                    {completion.job_collaborators.map((collab: any) => (
                      <Badge key={collab.user_id} variant="secondary">
                        {collab.profiles?.full_name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {completion.job_completion_photos?.length > 0 && (
                <div className="space-y-2">
                  <Label className="font-semibold">Photos ({completion.job_completion_photos.length})</Label>
                  <div className="grid grid-cols-3 gap-4">
                    {completion.job_completion_photos.map((photo: any) => (
                      <div key={photo.id} className="relative group">
                        <img
                          src={`${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/job-completion-photos/${photo.photo_url}`}
                          alt="Job completion"
                          className="w-full aspect-square object-cover rounded-lg"
                        />
                        <Button
                          variant="secondary"
                          size="sm"
                          className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => downloadPhoto(photo.photo_url)}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {jobData.job_materials?.length > 0 && (
                <div className="space-y-2">
                  <Label className="font-semibold flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    Materials Used
                  </Label>
                  <div className="border rounded-md divide-y">
                    {jobData.job_materials.map((jm: any) => {
                      const usage = jm.material_usage;
                      const material = usage?.materials;
                      return (
                        <div key={jm.id} className="p-3 flex justify-between items-center">
                          <div>
                            <div className="font-medium">{material?.name}</div>
                            <div className="text-sm text-muted-foreground">
                              {usage?.quantity_used} {material?.unit}
                            </div>
                          </div>
                          <div className="font-semibold">
                            £{(usage?.quantity_used * material?.cost_per_unit).toFixed(2)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Close
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <XCircle className="mr-2 h-4 w-4" />
              )}
              Needs Correction
            </Button>
            <Button onClick={handleApprove} disabled={isLoading}>
              {isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle className="mr-2 h-4 w-4" />
              )}
              Job Done
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const Label = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={`text-sm font-medium ${className}`}>{children}</div>
);
