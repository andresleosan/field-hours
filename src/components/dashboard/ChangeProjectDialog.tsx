import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Navigation, MapPin } from "lucide-react";

interface Project {
  id: string;
  name: string;
  client_name: string;
}

interface ChangeProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentProjectId: string;
  projects: Project[];
  userId: string;
  currentTimeEntry: any;
  onProjectChanged: () => void;
}

const ChangeProjectDialog = ({
  open,
  onOpenChange,
  currentProjectId,
  projects,
  userId,
  currentTimeEntry,
  onProjectChanged,
}: ChangeProjectDialogProps) => {
  const [newProjectId, setNewProjectId] = useState("");
  const [isTraveling, setIsTraveling] = useState(false);
  const [travelTimeEntry, setTravelTimeEntry] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const getLocation = (): Promise<{ lat: number; lng: number }> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Geolocation not supported"));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => reject(error)
      );
    });
  };

  const handleStartTrip = async () => {
    if (!newProjectId) {
      toast({
        title: "Select a project",
        description: "Please select the project you're traveling to",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);

    try {
      const location = await getLocation();
      const now = new Date().toISOString();

      // Clock out from current project
      if (currentTimeEntry) {
        const { error: clockOutError } = await supabase
          .from("time_tracking")
          .update({ clock_out: now })
          .eq("id", currentTimeEntry.id);

        if (clockOutError) throw clockOutError;
      }

      // Create travel time entry with special notes
      const fromProject = projects.find(p => p.id === currentProjectId);
      const toProject = projects.find(p => p.id === newProjectId);
      
      const { data: travelEntry, error: travelError } = await supabase
        .from("time_tracking")
        .insert({
          user_id: userId,
          project_id: currentProjectId, // Keep as from project for tracking
          clock_in: now,
          location_lat: location.lat,
          location_lng: location.lng,
          notes: `TRAVEL: ${fromProject?.name} → ${toProject?.name}`,
        })
        .select()
        .single();

      if (travelError) throw travelError;

      // Record the project switch
      const { error: switchError } = await supabase
        .from("project_switches")
        .insert({
          user_id: userId,
          from_project_id: currentProjectId,
          to_project_id: newProjectId,
          travel_time_minutes: 0,
          switched_at: now,
        });

      if (switchError) throw switchError;

      setTravelTimeEntry(travelEntry);
      setIsTraveling(true);

      toast({
        title: "Trip started",
        description: `Traveling from ${fromProject?.name} to ${toProject?.name}`,
      });
    } catch (error: any) {
      console.error("Error starting trip:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to start trip",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleArrived = async () => {
    setIsProcessing(true);

    try {
      const location = await getLocation();
      const now = new Date().toISOString();

      // Clock out from travel
      if (travelTimeEntry) {
        const { error: travelClockOutError } = await supabase
          .from("time_tracking")
          .update({ 
            clock_out: now,
            location_lat: location.lat,
            location_lng: location.lng,
          })
          .eq("id", travelTimeEntry.id);

        if (travelClockOutError) throw travelClockOutError;

        // Calculate travel time
        const travelStartTime = new Date(travelTimeEntry.clock_in);
        const travelEndTime = new Date(now);
        const travelMinutes = Math.round((travelEndTime.getTime() - travelStartTime.getTime()) / 60000);

        // Update project switch with travel time
        const { error: updateSwitchError } = await supabase
          .from("project_switches")
          .update({ travel_time_minutes: travelMinutes })
          .eq("user_id", userId)
          .eq("to_project_id", newProjectId)
          .eq("from_project_id", currentProjectId)
          .order("switched_at", { ascending: false })
          .limit(1);

        if (updateSwitchError) console.error("Error updating travel time:", updateSwitchError);
      }

      // Clock in to new project
      const { error: clockInError } = await supabase
        .from("time_tracking")
        .insert({
          user_id: userId,
          project_id: newProjectId,
          clock_in: now,
          location_lat: location.lat,
          location_lng: location.lng,
        });

      if (clockInError) throw clockInError;

      const toProject = projects.find(p => p.id === newProjectId);

      toast({
        title: "Arrived",
        description: `Clocked in to ${toProject?.name}`,
      });

      // Reset state and close dialog
      setNewProjectId("");
      setIsTraveling(false);
      setTravelTimeEntry(null);
      onOpenChange(false);
      onProjectChanged();
    } catch (error: any) {
      console.error("Error arriving:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to clock in to new project",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const availableProjects = projects.filter(p => p.id !== currentProjectId);

  return (
    <Dialog open={open} onOpenChange={(open) => {
      if (!isTraveling) {
        onOpenChange(open);
      }
    }}>
      <DialogContent className="max-w-md w-[95vw]">
        <DialogHeader>
          <DialogTitle>
            {isTraveling ? "Traveling to Project" : "Change Project"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {!isTraveling ? (
            <>
              <div>
                <Label htmlFor="new-project">Select New Project</Label>
                <Select value={newProjectId} onValueChange={setNewProjectId}>
                  <SelectTrigger id="new-project" className="mt-2">
                    <SelectValue placeholder="Choose a project" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableProjects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name} - {project.client_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-2 pt-4">
                <Button
                  onClick={handleStartTrip}
                  disabled={isProcessing || !newProjectId}
                  className="flex-1"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Starting...
                    </>
                  ) : (
                    <>
                      <Navigation className="h-4 w-4 mr-2" />
                      Start Trip
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={isProcessing}
                >
                  Cancel
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="text-center space-y-4 py-6">
                <div className="flex justify-center">
                  <div className="rounded-full bg-primary/10 p-4 animate-pulse">
                    <Navigation className="h-8 w-8 text-primary" />
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold text-lg">Traveling...</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Press "Arrived" when you reach the destination
                  </p>
                </div>
              </div>

              <Button
                onClick={handleArrived}
                disabled={isProcessing}
                className="w-full"
                size="lg"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <MapPin className="h-4 w-4 mr-2" />
                    Arrived
                  </>
                )}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ChangeProjectDialog;
