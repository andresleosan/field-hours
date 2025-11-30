import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Image, X, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

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
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSignedUrls = async () => {
      if (!photos || photos.length === 0) {
        setLoading(false);
        return;
      }

      setLoading(true);
      const urls: Record<string, string> = {};

      for (const photo of photos) {
        const { data, error } = await supabase.storage
          .from('job-photos')
          .createSignedUrl(photo.photo_url, 3600); // 1 hour expiry

        if (data?.signedUrl && !error) {
          urls[photo.id] = data.signedUrl;
        }
      }

      setSignedUrls(urls);
      setLoading(false);
    };

    if (open) {
      fetchSignedUrls();
    }
  }, [open, photos]);

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
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {photos.map((photo) => (
                <div key={photo.id} className="relative group">
                  {signedUrls[photo.id] ? (
                    <img
                      src={signedUrls[photo.id]}
                      alt="Manager reference"
                      className="w-full aspect-square object-cover rounded-lg border-2 border-border shadow-md"
                    />
                  ) : (
                    <div className="w-full aspect-square flex items-center justify-center bg-muted rounded-lg border-2 border-border">
                      <Image className="h-8 w-8 text-muted-foreground opacity-50" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
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
