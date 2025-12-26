import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, MapPin, Camera, Trash2, X, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";

interface RubbishRequest {
  id: string;
  location_lat: number | null;
  location_lng: number | null;
  photo_url: string | null;
  description: string | null;
  status: string;
  created_at: string;
  project_name?: string;
}

interface RubbishCollectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  userId: string;
}

const RubbishCollectionDialog = ({ open, onOpenChange, projectId, userId }: RubbishCollectionDialogProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [myRequests, setMyRequests] = useState<RubbishRequest[]>([]);
  const [isLoadingRequests, setIsLoadingRequests] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const fetchMyRequests = async () => {
    setIsLoadingRequests(true);
    try {
      const { data: requests, error } = await supabase
        .from("rubbish_collection_requests")
        .select("*, projects(name)")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) throw error;

      const mapped = requests?.map(r => ({
        ...r,
        project_name: (r.projects as any)?.name || "Unknown"
      })) || [];

      setMyRequests(mapped);
    } catch (error: any) {
      console.error("Error fetching requests:", error);
    } finally {
      setIsLoadingRequests(false);
    }
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      fetchMyRequests();
      getLocation();
    } else {
      resetForm();
    }
    onOpenChange(isOpen);
  };

  const resetForm = () => {
    setLocation(null);
    setPhoto(null);
    setPhotoPreview(null);
    setDescription("");
  };

  const getLocation = async () => {
    setIsLoadingLocation(true);
    try {
      if (!navigator.geolocation) {
        throw new Error("Geolocation not supported");
      }

      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
        });
      });

      setLocation({
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      });

      toast({
        title: "Location captured",
        description: "Your current location has been recorded",
      });
    } catch (error: any) {
      toast({
        title: "Location error",
        description: "Could not get your location. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingLocation(false);
    }
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhoto(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removePhoto = () => {
    setPhoto(null);
    setPhotoPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async () => {
    if (!location) {
      toast({
        title: "Location required",
        description: "Please capture your location before submitting",
        variant: "destructive",
      });
      return;
    }

    if (!photo) {
      toast({
        title: "Photo required",
        description: "Please take a photo of what needs to be collected",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      // Upload photo
      const fileExt = photo.name.split('.').pop();
      const fileName = `${userId}/${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from("rubbish-photos")
        .upload(fileName, photo);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("rubbish-photos")
        .getPublicUrl(fileName);

      // Create request
      const { error } = await supabase
        .from("rubbish_collection_requests")
        .insert({
          user_id: userId,
          project_id: projectId,
          location_lat: location.lat,
          location_lng: location.lng,
          photo_url: publicUrl,
          description: description.trim() || null,
        });

      if (error) throw error;

      toast({
        title: "Request submitted",
        description: "A manager will be notified to collect the rubbish",
      });

      resetForm();
      fetchMyRequests();
      getLocation();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to submit request",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">Pending</span>;
      case "resolved":
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800"><CheckCircle2 className="h-3 w-3" /> Resolved</span>;
      default:
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground">{status}</span>;
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-orange-500" />
            Request Rubbish Collection
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* New Request Form */}
          <div className="space-y-4 p-4 bg-muted/30 rounded-lg border">
            <h3 className="font-medium">New Request</h3>

            {/* Location */}
            <div className="space-y-2">
              <Label>Location</Label>
              <div className="flex items-center gap-2">
                {location ? (
                  <div className="flex-1 flex items-center gap-2 p-2 bg-green-50 border border-green-200 rounded-md">
                    <MapPin className="h-4 w-4 text-green-600" />
                    <span className="text-sm text-green-700">
                      {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
                    </span>
                  </div>
                ) : (
                  <div className="flex-1 flex items-center gap-2 p-2 bg-muted border rounded-md">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">No location captured</span>
                  </div>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={getLocation}
                  disabled={isLoadingLocation}
                >
                  {isLoadingLocation ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Refresh"
                  )}
                </Button>
              </div>
            </div>

            {/* Photo */}
            <div className="space-y-2">
              <Label>Photo *</Label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handlePhotoSelect}
                className="hidden"
              />
              {photoPreview ? (
                <div className="relative">
                  <img
                    src={photoPreview}
                    alt="Preview"
                    className="w-full h-48 object-cover rounded-lg border"
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2 h-8 w-8"
                    onClick={removePhoto}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-32 flex flex-col items-center justify-center gap-2"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Camera className="h-8 w-8 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Take or select a photo</span>
                </Button>
              )}
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label>Description (optional)</Label>
              <Textarea
                placeholder="Describe what needs to be collected..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>

            {/* Submit Button */}
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || !location || !photo}
              className="w-full"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                "Submit Request"
              )}
            </Button>
          </div>

          {/* My Recent Requests */}
          <div className="space-y-3">
            <h3 className="font-medium">My Recent Requests</h3>
            {isLoadingRequests ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : myRequests.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No requests yet
              </p>
            ) : (
              <div className="space-y-2">
                {myRequests.map((request) => (
                  <div
                    key={request.id}
                    className="flex items-start gap-3 p-3 bg-card border rounded-lg"
                  >
                    {request.photo_url && (
                      <img
                        src={request.photo_url}
                        alt="Rubbish"
                        className="w-16 h-16 object-cover rounded-md flex-shrink-0"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {getStatusBadge(request.status)}
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(request.created_at), "dd MMM yyyy, HH:mm")}
                        </span>
                      </div>
                      <p className="text-sm font-medium mt-1">{request.project_name}</p>
                      {request.description && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {request.description}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default RubbishCollectionDialog;
