import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { MapPin, Package, FileText, FileImage, Repeat, ShieldCheck, Trash2, Truck, Wrench } from "lucide-react";
import { useRequireRole, signOutAndRedirect } from "@/hooks/useRequireRole";
import { AppShell, PageLoader } from "@/components/layout/AppShell";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import TimeTrackingCard from "@/components/dashboard/TimeTrackingCard";
import EnhancedMaterialDialog from "@/components/dashboard/EnhancedMaterialDialog";
import EnhancedInvoiceDialog from "@/components/dashboard/EnhancedInvoiceDialog";
import DailyReportDialog from "@/components/dashboard/DailyReportDialog";
import ChangeProjectDialog from "@/components/dashboard/ChangeProjectDialog";
import RiskAssessmentDialog from "@/components/dashboard/RiskAssessmentDialog";
import RubbishCollectionDialog from "@/components/dashboard/RubbishCollectionDialog";
import MaterialDeliveryDialog from "@/components/dashboard/MaterialDeliveryDialog";
import ToolRequestDialog from "@/components/builders/ToolRequestDialog";
import JobsToDoList from "@/components/jobs/JobsToDoList";
import SelectJobDialog from "@/components/jobs/SelectJobDialog";
import { useI18n } from "@/lib/useI18n";
interface Project {
  id: string;
  name: string;
  client_name: string;
  status: string;
}

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
};

const Builders = () => {
  const { t } = useI18n();
  const { userId, fullName, isLoading } = useRequireRole("builder");
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
  const [isToolRequestDialogOpen, setIsToolRequestDialogOpen] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [weekMinutes, setWeekMinutes] = useState(0);
  const { toast } = useToast();

  useEffect(() => {
    if (isLoading || !userId) return;
    (async () => {
      await fetchProjects();
      await checkClockInStatus(userId);
      await fetchWeekMinutes(userId);
      setIsReady(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, userId]);

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

  const fetchWeekMinutes = async (uid: string) => {
    const monday = new Date();
    monday.setHours(0, 0, 0, 0);
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
    const { data } = await supabase
      .from("time_tracking")
      .select("clock_in, clock_out")
      .eq("user_id", uid)
      .gte("clock_in", monday.toISOString());
    const mins = (data || []).reduce((sum, e: any) => {
      const end = e.clock_out ? new Date(e.clock_out) : new Date();
      return sum + Math.max(0, (end.getTime() - new Date(e.clock_in).getTime()) / 60000);
    }, 0);
    setWeekMinutes(Math.round(mins));
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
      await fetchWeekMinutes(userId);

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

  const handleSignOut = () => {
    if (isClockedIn) {
      toast({
        title: "Clock out first",
        description: "Please clock out before signing out",
        variant: "destructive",
      });
      return;
    }
    signOutAndRedirect();
  };

  if (isLoading || !isReady) {
    return <PageLoader />;
  }

  const selectedProject = projects.find(p => p.id === selectedProjectId);

  return (
    <AppShell
      role="builder"
      fullName={fullName}
      eyebrow={isClockedIn ? t("onTheClock") : undefined}
      live={isClockedIn}
      onSignOut={handleSignOut}
    >
        <section>
          <p className="text-sm text-muted-foreground">
            {new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long" }).format(new Date())}
          </p>
          <h1 className="text-2xl font-bold">
            {greeting()}
            {fullName ? `, ${fullName.split(" ")[0]}` : ""}
          </h1>
        </section>

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
          weekMinutes={weekMinutes}
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

        <section aria-label="Site actions" className="space-y-4">
          <h2 className="label-eyebrow font-mono">On site</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {[
              {
                icon: Package,
                title: "Log material usage",
                description: "Record materials used today",
                onClick: () => setIsMaterialDialogOpen(true),
              },
              {
                icon: FileImage,
                title: "Add day report",
                description: "Submit photos and work description",
                onClick: () => setIsDailyReportDialogOpen(true),
              },
              {
                icon: Truck,
                title: "Request material delivery",
                description: "Ask for materials to be delivered",
                onClick: () => setIsMaterialDeliveryDialogOpen(true),
              },
              {
                icon: Wrench,
                title: "Request tools",
                description: "Request tools from the yard",
                onClick: () => setIsToolRequestDialogOpen(true),
              },
              {
                icon: Trash2,
                title: "Request rubbish collection",
                description: "Ask manager to collect rubbish",
                onClick: () => setIsRubbishDialogOpen(true),
              },
              {
                icon: FileText,
                title: "Add invoice",
                description: "Upload a new invoice",
                onClick: () => setIsInvoiceDialogOpen(true),
              },
              {
                icon: ShieldCheck,
                title: "Risk assessment",
                description: "View and sign safety documents",
                onClick: () => setIsRiskAssessmentDialogOpen(true),
              },
              {
                icon: Repeat,
                title: "Change project",
                description: isClockedIn ? "Switch to another project" : "Clock in first",
                onClick: () => setIsChangeProjectDialogOpen(true),
                disabled: !isClockedIn,
              },
            ].map(({ icon: Icon, title, description, onClick, disabled }) => (
              <button
                key={title}
                type="button"
                onClick={onClick}
                disabled={disabled}
                className="group flex items-start gap-4 rounded-lg border border-border bg-card p-5 text-left shadow-xs transition-[box-shadow,border-color] duration-200 hover:border-foreground/20 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-45"
              >
                <span className="shrink-0 rounded-md border border-border bg-muted p-2.5 transition-colors group-hover:bg-accent">
                  <Icon className="h-5 w-5 text-foreground" strokeWidth={1.75} aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block text-base font-semibold leading-tight">{title}</span>
                  <span className="mt-1 block text-sm text-muted-foreground">{description}</span>
                </span>
              </button>
            ))}
          </div>
        </section>

      {userId && (
        <>
          <EnhancedMaterialDialog
            open={isMaterialDialogOpen}
            onOpenChange={setIsMaterialDialogOpen}
            projectId={selectedProjectId}
            userId={userId}
            userRole="builder"
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

          <ToolRequestDialog
            open={isToolRequestDialogOpen}
            onOpenChange={setIsToolRequestDialogOpen}
            projectId={selectedProjectId}
            userId={userId}
            projectName={selectedProject?.name}
          />
        </>
      )}
    </AppShell>
  );
};

export default Builders;
