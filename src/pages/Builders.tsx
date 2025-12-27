import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { LogOut, Clock, MapPin, Package, FileText, Loader2, FileImage, Repeat, ShieldCheck, Trash2, Truck } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import TimeTrackingCard from "@/components/dashboard/TimeTrackingCard";
import EnhancedMaterialDialog from "@/components/dashboard/EnhancedMaterialDialog";
import EnhancedInvoiceDialog from "@/components/dashboard/EnhancedInvoiceDialog";
import DailyReportDialog from "@/components/dashboard/DailyReportDialog";
import ChangeProjectDialog from "@/components/dashboard/ChangeProjectDialog";
import RiskAssessmentDialog from "@/components/dashboard/RiskAssessmentDialog";
import RubbishCollectionDialog from "@/components/dashboard/RubbishCollectionDialog";
import MaterialDeliveryDialog from "@/components/dashboard/MaterialDeliveryDialog";
import JobsToDoList from "@/components/jobs/JobsToDoList";
import SelectJobDialog from "@/components/jobs/SelectJobDialog";
interface Project {
  id: string;
  name: string;
  client_name: string;
  status: string;
}

const Builders = () => {
  const [userId, setUserId] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<{ full_name: string; role: string } | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [isClockedIn, setIsClockedIn] = useState(false);
  const [currentTimeEntry, setCurrentTimeEntry] = useState<any>(null);
  const [isMaterialDialogOpen, setIsMaterialDialogOpen] = useState(false);
  const [isInvoiceDialogOpen, setIsInvoiceDialogOpen] = useState(false);
  const [isDailyReportDialogOpen, setIsDailyReportDialogOpen] = useState(false);
  const [isChangeProjectDialogOpen, setIsChangeProjectDialogOpen] = useState(false);
  const [isSelectJobOpen, setIsSelectJobOpen] = useState(false);
  const [isRiskAssessmentDialogOpen, setIsRiskAssessmentDialogOpen] = useState(false);
  const [isRubbishDialogOpen, setIsRubbishDialogOpen] = useState(false);
  const [isMaterialDeliveryDialogOpen, setIsMaterialDeliveryDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      navigate("/auth");
      return;
    }

    setUserId(session.user.id);

    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", session.user.id)
      .maybeSingle();

    if (!roleData || roleData.role !== "builder") {
      navigate("/managers");
      return;
    }

    const { data: profileData } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", session.user.id)
      .single();

    if (profileData && roleData) {
      setUserProfile({
        full_name: profileData.full_name,
        role: roleData.role,
      });
    }

    await fetchProjects();
    await checkClockInStatus(session.user.id);
    setIsLoading(false);
  };

  const fetchProjects = async () => {
    const { data } = await supabase
      .from("projects")
      .select("*")
      .eq("status", "active")
      .order("created_at", { ascending: false });

    if (data) {
      setProjects(data);
      if (data.length > 0 && !selectedProjectId) {
        setSelectedProjectId(data[0].id);
      }
    }
  };

  const checkClockInStatus = async (uid: string) => {
    const { data } = await supabase
      .from("time_tracking")
      .select("*")
      .eq("user_id", uid)
      .is("clock_out", null)
      .order("clock_in", { ascending: false })
      .limit(1)
      .maybeSingle();

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
        (error) => reject(error)
      );
    });
  };

  // After the user selects a job, perform clock-in + start job timer
  const confirmClockInWithJob = async (jobId: string) => {
    if (!selectedProjectId || !userId) return;
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

      // Start job-level time tracking
      const { error: jtError } = await supabase
        .from("job_time_tracking")
        .insert({
          job_id: jobId,
          user_id: userId,
          project_id: selectedProjectId,
        });
      if (jtError) throw jtError;

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

  const handleClockIn = async () => {
    if (!selectedProjectId || !userId) {
      toast({
        title: "Select a project",
        description: "Please select a project before clocking in",
        variant: "destructive",
      });
      return;
    }

    // Open job selection dialog; actual inserts occur after selection
    setIsSelectJobOpen(true);
  };

  const handleClockOut = async () => {
    if (!currentTimeEntry || !userId) return;

    try {
      const clockOutTime = new Date().toISOString();
      const clockInTime = currentTimeEntry.clock_in;

      // Update time tracking (project-level)
      const { error } = await supabase
        .from("time_tracking")
        .update({
          clock_out: clockOutTime,
        })
        .eq("id", currentTimeEntry.id);

      if (error) throw error;

      // Also stop any active job time tracking for this user
      await supabase
        .from("job_time_tracking")
        .update({ ended_at: clockOutTime })
        .eq("user_id", userId)
        .is("ended_at", null);

      // Cast to any to avoid TS deep instantiation error
      const sb = supabase as any;

      // Fetch materials logged during this shift
      const { data: materials } = await sb
        .from("material_usage")
        .select("id")
        .eq("user_id", userId)
        .eq("project_id", currentTimeEntry.project_id)
        .gte("created_at", clockInTime)
        .lte("created_at", clockOutTime);

      // Fetch invoices uploaded during this shift
      const { data: invoices } = await sb
        .from("invoices")
        .select("id")
        .eq("uploaded_by", userId)
        .eq("project_id", currentTimeEntry.project_id)
        .gte("created_at", clockInTime)
        .lte("created_at", clockOutTime);

      const materialCount = materials?.length || 0;
      const invoiceCount = invoices?.length || 0;

      setIsClockedIn(false);
      setCurrentTimeEntry(null);

      // Calculate hours worked
      const hoursWorked = ((new Date(clockOutTime).getTime() - new Date(clockInTime).getTime()) / (1000 * 60 * 60)).toFixed(2);

      toast({
        title: "Clocked Out",
        description: `Shift recorded: ${hoursWorked}h worked, ${materialCount} materials logged, ${invoiceCount} invoices submitted`,
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
      await handleClockOut();
      toast({
        title: "Project switched",
        description: "Clock in to start work on the new project",
      });
    }
    setSelectedProjectId(newProjectId);
  };

  const handleProjectChanged = async () => {
    // Refresh the clock-in status after project change
    if (userId) {
      await checkClockInStatus(userId);
    }
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

    // Clear local storage first to ensure clean state
    localStorage.removeItem('sb-lukmmizugpnecispdzsn-auth-token');
    
    try {
      await supabase.auth.signOut({ scope: 'local' });
    } catch (error) {
      // Ignore errors - we're forcing sign out anyway
      console.log('Sign out error (ignored):', error);
    }
    
    toast({
      title: "Signed out",
      description: "Successfully signed out",
    });
    
    // Force hard redirect to clear all state
    window.location.href = "/auth";
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

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
              <h1 className="text-xl font-bold">
                {userProfile?.full_name || "Builder"} - {userProfile?.role || "Builder"}
              </h1>
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

        <TimeTrackingCard
          isClockedIn={isClockedIn}
          currentTimeEntry={currentTimeEntry}
          onClockIn={handleClockIn}
          onClockOut={handleClockOut}
        />

        {selectedProjectId && (
          <JobsToDoList projectId={selectedProjectId} />
        )}

        <SelectJobDialog
          open={isSelectJobOpen}
          onOpenChange={setIsSelectJobOpen}
          projectId={selectedProjectId}
          onConfirm={confirmClockInWithJob}
        />

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

          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setIsDailyReportDialogOpen(true)}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileImage className="h-5 w-5 text-accent" />
                Add Day Report
              </CardTitle>
              <CardDescription>Submit photos and work description</CardDescription>
            </CardHeader>
          </Card>

          <Card 
            className={`transition-shadow ${isClockedIn ? 'cursor-pointer hover:shadow-md' : 'cursor-not-allowed opacity-50'}`}
            onClick={() => isClockedIn && setIsChangeProjectDialogOpen(true)}
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Repeat className="h-5 w-5 text-primary" />
                Change Project
              </CardTitle>
              <CardDescription>
                {isClockedIn ? "Switch to another project" : "Clock in first"}
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setIsRiskAssessmentDialogOpen(true)}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-orange-500" />
                Risk Assessment
              </CardTitle>
              <CardDescription>View and sign safety documents</CardDescription>
            </CardHeader>
          </Card>

          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setIsRubbishDialogOpen(true)}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trash2 className="h-5 w-5 text-amber-600" />
                Request Rubbish Collection
              </CardTitle>
              <CardDescription>Ask manager to collect rubbish</CardDescription>
            </CardHeader>
          </Card>

          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setIsMaterialDeliveryDialogOpen(true)}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Truck className="h-5 w-5 text-indigo-500" />
                Request Material Delivery
              </CardTitle>
              <CardDescription>Ask for materials to be delivered</CardDescription>
            </CardHeader>
          </Card>
        </div>
      </main>

      {userId && (
        <>
          <EnhancedMaterialDialog
            open={isMaterialDialogOpen}
            onOpenChange={setIsMaterialDialogOpen}
            projectId={selectedProjectId}
            userId={userId}
            userRole={userProfile?.role}
          />

          <EnhancedInvoiceDialog
            open={isInvoiceDialogOpen}
            onOpenChange={setIsInvoiceDialogOpen}
            projectId={selectedProjectId}
            userId={userId}
          />

          <DailyReportDialog
            open={isDailyReportDialogOpen}
            onOpenChange={setIsDailyReportDialogOpen}
            projectId={selectedProjectId}
            userId={userId}
          />

          <ChangeProjectDialog
            open={isChangeProjectDialogOpen}
            onOpenChange={setIsChangeProjectDialogOpen}
            currentProjectId={selectedProjectId}
            projects={projects}
            userId={userId}
            currentTimeEntry={currentTimeEntry}
            onProjectChanged={handleProjectChanged}
          />

          <RiskAssessmentDialog
            open={isRiskAssessmentDialogOpen}
            onOpenChange={setIsRiskAssessmentDialogOpen}
            projectId={selectedProjectId}
            userId={userId}
          />

          <RubbishCollectionDialog
            open={isRubbishDialogOpen}
            onOpenChange={setIsRubbishDialogOpen}
            projectId={selectedProjectId}
            userId={userId}
          />

          <MaterialDeliveryDialog
            open={isMaterialDeliveryDialogOpen}
            onOpenChange={setIsMaterialDeliveryDialogOpen}
            projectId={selectedProjectId}
            userId={userId}
          />
        </>
      )}
    </div>
  );
};

export default Builders;
