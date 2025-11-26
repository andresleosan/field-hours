import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Image, X } from "lucide-react";

interface ManagerReferencePhotosDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobTitle: string;
  photos: Array<{ id: string; photo_url: string }>;
}

export const ManagerReferencePhotosDialog = ({
  open,
  onOpenChange,
  jobTitle,
  photos,
}: ManagerReferencePhotosDialogProps) => {
  if (!photos || photos.length === 0) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Reference Photos - {jobTitle}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <Image className="h-12 w-12 mb-4 opacity-50" />
            <p>No reference photos available for this job</p>
          </div>
          <div className="flex justify-end pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Reference Photos - {jobTitle}</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Photos uploaded by the manager to guide this job
          </p>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {photos.map((photo) => (
              <div key={photo.id} className="relative group">
                <img
                  src={`${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/job-photos/${photo.photo_url}`}
                  alt="Manager reference"
                  className="w-full aspect-square object-cover rounded-lg border-2 border-border shadow-md"
                />
              </div>
            ))}
          </div>
          <div className="flex justify-end pt-4 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              <X className="mr-2 h-4 w-4" />
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
