import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { LogOut, Clock, MapPin, Package, FileText } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import TimeTrackingCard from "./TimeTrackingCard";
import MaterialUsageDialog from "./MaterialUsageDialog";
import InvoiceDialog from "./InvoiceDialog";

interface BuilderDashboardProps {
  userId: string;
}

interface Project {
  id: string;
  name: string;
  client_name: string;
  status: string;
}

const BuilderDashboard = ({ userId }: BuilderDashboardProps) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [isClockedIn, setIsClockedIn] = useState(false);
  const [currentTimeEntry, setCurrentTimeEntry] = useState<any>(null);
  const [isMaterialDialogOpen, setIsMaterialDialogOpen] = useState(false);
  const [isInvoiceDialogOpen, setIsInvoiceDialogOpen] = useState(false);
  const [userProfile, setUserProfile] = useState<{ full_name: string; role: string } | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    fetchProjects();
    checkClockInStatus();
    fetchUserProfile();
  }, [userId]);

  const fetchUserProfile = async () => {
    const { data: profileData } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", userId)
      .single();

    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .single();

    if (profileData && roleData) {
      setUserProfile({
        full_name: profileData.full_name,
        role: roleData.role,
      });
    }
  };

  const fetchProjects = async () => {
    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .eq("status", "active")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching projects:", error);
      return;
    }

    setProjects(data || []);
    if (data && data.length > 0 && !selectedProjectId) {
      setSelectedProjectId(data[0].id);
    }
  };

  const checkClockInStatus = async () => {
    const { data, error } = await supabase
      .from("time_tracking")
      .select("*")
      .eq("user_id", userId)
      .is("clock_out", null)
      .order("clock_in", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("Error checking clock in status:", error);
      return;
    }

    if (data) {
      setIsClockedIn(true);
      setCurrentTimeEntry(data);
      setSelectedProjectId(data.project_id);
    }
  };

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
        (error) => {
          console.error("Geolocation error:", error);
          reject(error);
        }
      );
    });
  };

  const handleClockIn = async () => {
    if (!selectedProjectId) {
      toast({
        title: "Select a project",
        description: "Please select a project before clocking in",
        variant: "destructive",
      });
      return;
    }

    try {
      const location = await getLocation();

      const { data, error } = await supabase
        .from("time_tracking")
        .insert({
          user_id: userId,
          project_id: selectedProjectId,
          clock_in: new Date().toISOString(),
          location_lat: location.lat,
          location_lng: location.lng,
        })
        .select()
        .single();

      if (error) throw error;

      setIsClockedIn(true);
      setCurrentTimeEntry(data);
      toast({
        title: "Clocked In",
        description: `Started work on ${projects.find(p => p.id === selectedProjectId)?.name}`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to clock in",
        variant: "destructive",
      });
    }
  };

  const handleClockOut = async () => {
    if (!currentTimeEntry) return;

    try {
      const location = await getLocation();

      const { error } = await supabase
        .from("time_tracking")
        .update({
          clock_out: new Date().toISOString(),
        })
        .eq("id", currentTimeEntry.id);

      if (error) throw error;

      setIsClockedIn(false);
      setCurrentTimeEntry(null);
      toast({
        title: "Clocked Out",
        description: "Your time has been recorded",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to clock out",
        variant: "destructive",
      });
    }
  };

  const handleProjectSwitch = async (newProjectId: string) => {
    if (isClockedIn && currentTimeEntry) {
      // Clock out from current project
      await handleClockOut();
      
      // TODO: Show travel time dialog
      toast({
        title: "Project switched",
        description: "Clock in to start work on the new project",
      });
    }
    setSelectedProjectId(newProjectId);
  };

  const handleSignOut = async () => {
    if (isClockedIn) {
      toast({
        title: "Clock out first",
        description: "Please clock out before signing out",
        variant: "destructive",
      });
      return;
    }

    await supabase.auth.signOut();
    toast({
      title: "Signed out",
      description: "Successfully signed out",
    });
    navigate("/auth");
  };

  const selectedProject = projects.find(p => p.id === selectedProjectId);

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="bg-card border-b shadow-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-secondary p-2">
              <Clock className="h-5 w-5 text-secondary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Builder Dashboard</h1>
              <p className="text-sm text-muted-foreground">BuildTrack Pro</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={handleSignOut}>
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        {/* Project Selection */}
        <Card>
          <CardHeader>
            <CardTitle>Current Project</CardTitle>
            <CardDescription>Select the project you're working on</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Select
              value={selectedProjectId}
              onValueChange={handleProjectSwitch}
              disabled={isClockedIn}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a project" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name} - {project.client_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {selectedProject && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4" />
                <span>{selectedProject.client_name}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Time Tracking */}
        <TimeTrackingCard
          isClockedIn={isClockedIn}
          currentTimeEntry={currentTimeEntry}
          onClockIn={handleClockIn}
          onClockOut={handleClockOut}
        />

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setIsMaterialDialogOpen(true)}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5 text-primary" />
                Log Material Usage
              </CardTitle>
              <CardDescription>Record materials used today</CardDescription>
            </CardHeader>
          </Card>

          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setIsInvoiceDialogOpen(true)}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-secondary" />
                Add Invoice
              </CardTitle>
              <CardDescription>Upload a new invoice</CardDescription>
            </CardHeader>
          </Card>
        </div>
      </main>

      <MaterialUsageDialog
        open={isMaterialDialogOpen}
        onOpenChange={setIsMaterialDialogOpen}
        projectId={selectedProjectId}
        userId={userId}
      />

      <InvoiceDialog
        open={isInvoiceDialogOpen}
        onOpenChange={setIsInvoiceDialogOpen}
        projectId={selectedProjectId}
        userId={userId}
      />
    </div>
  );
};

export default BuilderDashboard;
