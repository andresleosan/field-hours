import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Clock, CheckCircle2, AlertCircle, PlayCircle, Download, XCircle, Edit } from "lucide-react";

interface JobCardProps {
  job: any;
  userRole: "manager" | "builder" | null;
  activeWorkers: any[];
  photoUrls: string[];
  managerFeedbackPhotoUrls: string[];
  onEdit: (job: any) => void;
  onStartTracking: (jobId: string) => void;
  onSubmitForReview: (jobId: string) => void;
  onNeedsCorrection: (jobId: string) => void;
  onJobDone: (jobId: string) => void;
  onDownloadPhoto: (photoPath: string, bucket?: string) => void;
  calculateTotalTime: (timeTracking: any[]) => number;
  formatTime: (minutes: number) => string;
  currentUserId?: string;
  // Selection mode props
  selectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (jobId: string) => void;
}

export const JobCard = ({
  job,
  userRole,
  activeWorkers,
  photoUrls,
  managerFeedbackPhotoUrls,
  onEdit,
  onStartTracking,
  onSubmitForReview,
  onNeedsCorrection,
  onJobDone,
  onDownloadPhoto,
  calculateTotalTime,
  formatTime,
  currentUserId,
  selectionMode = false,
  isSelected = false,
  onToggleSelect,
}: JobCardProps) => {
  const completion = job.job_completions?.[0];
  const totalTime = calculateTotalTime(job.job_time_tracking || []);
  const workers = activeWorkers || [];
  const materials = job.job_materials || [];
  const photos = photoUrls || [];
  const materialsCost = materials.reduce((sum: number, m: any) => {
    const usage = m.material_usage;
    return sum + (usage?.quantity_used * usage?.materials?.cost_per_unit || 0);
  }, 0);

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      approved: { label: "To Do", variant: "secondary" as const, icon: AlertCircle },
      in_progress: { label: "In Progress", variant: "default" as const, icon: PlayCircle },
      pending: { label: "Waiting for Review", variant: "warning" as const, icon: Clock },
      waiting_review: { label: "Waiting for Review", variant: "warning" as const, icon: Clock },
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

  return (
    <Card className={`overflow-hidden transition-all ${isSelected ? 'ring-2 ring-primary bg-primary/5' : ''}`}>
      <CardHeader className="bg-muted/30 py-4">
        <div className="flex items-start justify-between gap-4">
          {selectionMode && (
            <div className="flex items-center pt-1">
              <Checkbox
                checked={isSelected}
                onCheckedChange={() => onToggleSelect?.(job.id)}
                className="h-5 w-5"
              />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="mb-1">
              <CardTitle className="text-lg">{job.title}</CardTitle>
            </div>
            {job.description && (
              <CardDescription className="text-sm line-clamp-2">{job.description}</CardDescription>
            )}
            <div className="mt-2 text-xs text-muted-foreground">
              Created by {job.profiles?.full_name || "Unknown"}
            </div>
          </div>
          <div className="flex items-center gap-2 pt-1">
            {userRole === "manager" && (
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => onEdit(job)}
              >
                <Edit className="h-4 w-4" />
              </Button>
            )}
            {getStatusBadge(job.status)}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-4 px-3 sm:px-6">
        <div className="grid gap-4">
          {/* Stats strip */}
          <dl className="grid grid-cols-3 divide-x divide-border overflow-hidden rounded-lg border border-border bg-muted/30 text-center">
            <div className="px-2 py-3">
              <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">Working now</dt>
              <dd className="mt-1 truncate px-1 text-sm font-semibold">
                {workers.length > 0
                  ? workers.map((w: any) => w.profiles?.full_name?.split(" ")[0] ?? "?").join(", ")
                  : "—"}
              </dd>
            </div>
            <div className="px-2 py-3">
              <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">Time</dt>
              <dd className="mt-1 text-sm font-semibold tabular-nums">
                {totalTime > 0 ? formatTime(totalTime) : "0h 0m"}
              </dd>
            </div>
            <div className="px-2 py-3">
              <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">Materials</dt>
              <dd className="mt-1 text-sm font-semibold tabular-nums">
                {materials.length}
                {/* ponytail: sub-£1 costs round to "£0" and read as free — hide them */}
                {materialsCost >= 1 && <span className="text-muted-foreground"> · £{materialsCost.toFixed(0)}</span>}
              </dd>
            </div>
          </dl>

          {/* Submission Details for Waiting Review and Completed */}
          {(job.status === "pending" || job.status === "waiting_review" || job.status === "completed") && completion && (
            <>
              <Separator />
              <div className="space-y-4">
                <h3 className="font-semibold text-base">Submission Details</h3>
                
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
                    <ScrollArea className="w-full whitespace-nowrap">
                      <div className="flex gap-3 pb-4">
                        {photos.map((url, index) => (
                          <div key={index} className="relative group shrink-0">
                            <img
                              src={url}
                              alt={`Job completion ${index + 1}`}
                              className="h-24 w-24 sm:h-32 sm:w-32 object-cover rounded-lg border-2 border-border"
                              loading="lazy"
                            />
                            <Button
                              variant="secondary"
                              size="sm"
                              className="absolute bottom-1 right-1 h-7 w-7 p-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                              onClick={() => {
                                const photo = completion.job_completion_photos[index];
                                if (photo) onDownloadPhoto(photo.photo_url);
                              }}
                            >
                              <Download className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                      <ScrollBar orientation="horizontal" />
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

          {/* Manager Feedback Section for Needs Correction */}
          {job.status === "needs_correction" && (job.manager_feedback || (job.job_photos && job.job_photos.length > 0)) && (
            <>
              <Separator />
              <div className="space-y-4 bg-destructive/5 p-4 rounded-lg border-2 border-destructive/20">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-destructive" />
                  <h3 className="font-semibold text-lg text-destructive">Corrections Required</h3>
                </div>
                
                {/* Manager Feedback Notes */}
                {job.manager_feedback && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Manager Feedback:</p>
                    <p className="text-sm bg-background p-4 rounded-lg border">{job.manager_feedback}</p>
                  </div>
                )}

                {/* Manager Reference Photos */}
                {job.job_photos && job.job_photos.length > 0 && managerFeedbackPhotoUrls && managerFeedbackPhotoUrls.length > 0 && (
                  <div className="space-y-3">
                    <p className="text-sm font-medium">Reference Photos ({job.job_photos.length})</p>
                    <ScrollArea className="w-full whitespace-nowrap">
                      <div className="flex gap-3 pb-4">
                        {managerFeedbackPhotoUrls.map((signedUrl: string, index: number) => (
                          <div key={index} className="relative group shrink-0">
                            <img
                              src={signedUrl}
                              alt={`Manager reference ${index + 1}`}
                              className="h-24 w-24 sm:h-32 sm:w-32 object-cover rounded-lg border-2 border-destructive"
                              loading="lazy"
                            />
                            <Button
                              variant="secondary"
                              size="sm"
                              className="absolute bottom-1 right-1 h-7 w-7 p-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                              onClick={() => onDownloadPhoto(job.job_photos[index]?.photo_url, "job-photos")}
                            >
                              <Download className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                      <ScrollBar orientation="horizontal" />
                    </ScrollArea>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2 border-t pt-4">
            {userRole === "builder" && job.status === "approved" && (
              <>
                {!workers.some((w: any) => w.user_id === currentUserId) && (
                  <Button onClick={() => onStartTracking(job.id)}>
                    <PlayCircle className="mr-2 h-4 w-4" />
                    Start working
                  </Button>
                )}
                <Button variant="outline" onClick={() => onSubmitForReview(job.id)}>
                  Submit for review
                </Button>
              </>
            )}
            {userRole === "builder" && job.status === "needs_correction" && (
              <Button onClick={() => onSubmitForReview(job.id)}>Resubmit job</Button>
            )}
            {userRole === "manager" && (job.status === "pending" || job.status === "waiting_review") && (
              <>
                <Button onClick={() => onJobDone(job.id)}>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Job done
                </Button>
                <Button
                  variant="outline"
                  className="border-destructive/40 text-destructive hover:bg-destructive/10"
                  onClick={() => onNeedsCorrection(job.id)}
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  Needs correction
                </Button>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};