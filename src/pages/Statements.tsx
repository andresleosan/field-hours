import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Calendar, DollarSign, Clock, Package, Users, Loader2, Download, Briefcase } from "lucide-react";
import { useRequireRole } from "@/hooks/useRequireRole";
import { AppShell, PageLoader } from "@/components/layout/AppShell";
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays, subWeeks, subMonths } from "date-fns";
import * as XLSX from "xlsx";
import { useToast } from "@/hooks/use-toast";

interface TimeEntry {
  id: string;
  user_id: string;
  project_id: string;
  clock_in: string;
  clock_out: string | null;
  projects?: { name: string };
  profiles?: { full_name: string };
}

interface Invoice {
  id: string;
  invoice_number: string;
  date: string;
  total_amount: number;
  project_id: string;
  uploaded_by: string;
  projects?: { name: string };
  profiles?: { full_name: string };
  suppliers?: { name: string } | null;
}

interface MaterialUsage {
  id: string;
  material_id: string;
  quantity_used: number;
  date: string;
  project_id: string;
  used_by: string;
  notes: string | null;
  materials?: { name: string; unit: string; cost_per_unit: number };
  projects?: { name: string };
  profiles?: { full_name: string };
}

interface JobCompletion {
  id: string;
  job_id: string;
  completed_by: string;
  completed_at: string;
  notes: string | null;
  jobs?: { title: string; project_id: string; projects?: { name: string } };
  profiles?: { full_name: string };
}

interface Project {
  id: string;
  name: string;
  client_name: string;
}

interface Builder {
  id: string;
  full_name: string;
}

const Statements = () => {
  const { fullName, isLoading: isAuthLoading } = useRequireRole("manager");
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("daily");
  const { toast } = useToast();

  // Data states
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [materialUsage, setMaterialUsage] = useState<MaterialUsage[]>([]);
  const [jobCompletions, setJobCompletions] = useState<JobCompletion[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [builders, setBuilders] = useState<Builder[]>([]);
  
  // Filter states
  const [selectedProject, setSelectedProject] = useState<string>("all");
  const [selectedBuilder, setSelectedBuilder] = useState<string>("all");
  const [dateRange, setDateRange] = useState<"today" | "yesterday" | "last7">("today");
  const [weekRange, setWeekRange] = useState<"this" | "last" | "2weeksago">("this");
  const [monthRange, setMonthRange] = useState<"this" | "last" | "2monthsago">("this");

  useEffect(() => {
    if (isAuthLoading) return;
    (async () => {
      const [projectsRes, buildersRes] = await Promise.all([
        supabase.from("projects").select("id, name, client_name").order("name"),
        supabase.from("profiles").select("id, full_name").order("full_name")
      ]);
      if (projectsRes.data) setProjects(projectsRes.data);
      if (buildersRes.data) setBuilders(buildersRes.data);
      setIsLoading(false);
    })();
  }, [isAuthLoading]);

  useEffect(() => {
    if (!isLoading) {
      fetchData();
    }
  }, [isLoading, activeTab, dateRange, weekRange, monthRange, selectedProject, selectedBuilder]);

  const getDateRange = () => {
    const now = new Date();
    
    if (activeTab === "daily") {
      if (dateRange === "today") {
        return { start: startOfDay(now), end: endOfDay(now) };
      } else if (dateRange === "yesterday") {
        const yesterday = subDays(now, 1);
        return { start: startOfDay(yesterday), end: endOfDay(yesterday) };
      } else {
        return { start: startOfDay(subDays(now, 7)), end: endOfDay(now) };
      }
    } else if (activeTab === "weekly") {
      if (weekRange === "this") {
        return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) };
      } else if (weekRange === "last") {
        const lastWeek = subWeeks(now, 1);
        return { start: startOfWeek(lastWeek, { weekStartsOn: 1 }), end: endOfWeek(lastWeek, { weekStartsOn: 1 }) };
      } else {
        const twoWeeksAgo = subWeeks(now, 2);
        return { start: startOfWeek(twoWeeksAgo, { weekStartsOn: 1 }), end: endOfWeek(twoWeeksAgo, { weekStartsOn: 1 }) };
      }
    } else if (activeTab === "monthly") {
      if (monthRange === "this") {
        return { start: startOfMonth(now), end: endOfMonth(now) };
      } else if (monthRange === "last") {
        const lastMonth = subMonths(now, 1);
        return { start: startOfMonth(lastMonth), end: endOfMonth(lastMonth) };
      } else {
        const twoMonthsAgo = subMonths(now, 2);
        return { start: startOfMonth(twoMonthsAgo), end: endOfMonth(twoMonthsAgo) };
      }
    }
    
    // For project and builder tabs, fetch all data
    return { start: subMonths(now, 12), end: endOfDay(now) };
  };

  const fetchData = async () => {
    const { start, end } = getDateRange();
    const startISO = start.toISOString();
    const endISO = end.toISOString();

    // Build queries with date filters
    let timeQuery = supabase
      .from("time_tracking")
      .select("*, projects(name)")
      .gte("clock_in", startISO)
      .lte("clock_in", endISO)
      .order("clock_in", { ascending: false });

    let invoiceQuery = supabase
      .from("invoices")
      .select("*, projects(name), suppliers(name)")
      .gte("date", format(start, "yyyy-MM-dd"))
      .lte("date", format(end, "yyyy-MM-dd"))
      .order("date", { ascending: false });

    let materialQuery = supabase
      .from("material_usage")
      .select("*, materials(name, unit, cost_per_unit), projects(name)")
      .gte("date", format(start, "yyyy-MM-dd"))
      .lte("date", format(end, "yyyy-MM-dd"))
      .order("date", { ascending: false });

    let jobQuery = supabase
      .from("job_completions")
      .select("*, jobs(title, project_id, projects(name))")
      .gte("completed_at", startISO)
      .lte("completed_at", endISO)
      .order("completed_at", { ascending: false });

    // Apply project filter
    if (selectedProject !== "all") {
      timeQuery = timeQuery.eq("project_id", selectedProject);
      invoiceQuery = invoiceQuery.eq("project_id", selectedProject);
      materialQuery = materialQuery.eq("project_id", selectedProject);
    }

    // Apply builder filter
    if (selectedBuilder !== "all") {
      timeQuery = timeQuery.eq("user_id", selectedBuilder);
      invoiceQuery = invoiceQuery.eq("uploaded_by", selectedBuilder);
      materialQuery = materialQuery.eq("used_by", selectedBuilder);
      jobQuery = jobQuery.eq("completed_by", selectedBuilder);
    }

    const [timeRes, invoiceRes, materialRes, jobRes] = await Promise.all([
      timeQuery,
      invoiceQuery,
      materialQuery,
      jobQuery
    ]);

    // Fetch profile names for each entry
    const userIds = new Set<string>();
    timeRes.data?.forEach(t => userIds.add(t.user_id));
    invoiceRes.data?.forEach(i => userIds.add(i.uploaded_by));
    materialRes.data?.forEach(m => userIds.add(m.used_by));
    jobRes.data?.forEach(j => userIds.add(j.completed_by));

    const { data: profilesData } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", Array.from(userIds));

    const profileMap = new Map(profilesData?.map(p => [p.id, p]) || []);

    setTimeEntries((timeRes.data || []).map(t => ({ ...t, profiles: profileMap.get(t.user_id) })));
    setInvoices((invoiceRes.data || []).map(i => ({ ...i, profiles: profileMap.get(i.uploaded_by) })));
    setMaterialUsage((materialRes.data || []).map(m => ({ ...m, profiles: profileMap.get(m.used_by) })));
    setJobCompletions((jobRes.data || []).map(j => ({ ...j, profiles: profileMap.get(j.completed_by) })));
  };

  const calculateHours = (clockIn: string, clockOut: string | null): number => {
    if (!clockOut) return 0;
    const diff = new Date(clockOut).getTime() - new Date(clockIn).getTime();
    return Math.round((diff / (1000 * 60 * 60)) * 100) / 100;
  };

  const getTotalHours = () => {
    return timeEntries.reduce((acc, entry) => acc + calculateHours(entry.clock_in, entry.clock_out), 0);
  };

  const getTotalExpenses = () => {
    return invoices.reduce((acc, inv) => acc + Number(inv.total_amount), 0);
  };

  const getTotalMaterialsCost = () => {
    return materialUsage.reduce((acc, m) => {
      const cost = m.materials?.cost_per_unit || 0;
      return acc + (Number(m.quantity_used) * cost);
    }, 0);
  };

  const exportToExcel = (tabName: string) => {
    const wb = XLSX.utils.book_new();
    
    // Time Tracking Sheet
    const timeData = timeEntries.map(t => ({
      "Date": format(new Date(t.clock_in), "yyyy-MM-dd"),
      "Builder": t.profiles?.full_name || "Unknown",
      "Project": t.projects?.name || "Unknown",
      "Clock In": format(new Date(t.clock_in), "HH:mm"),
      "Clock Out": t.clock_out ? format(new Date(t.clock_out), "HH:mm") : "Active",
      "Hours": calculateHours(t.clock_in, t.clock_out)
    }));
    if (timeData.length > 0) {
      const ws1 = XLSX.utils.json_to_sheet(timeData);
      XLSX.utils.book_append_sheet(wb, ws1, "Time Tracking");
    }

    // Invoices Sheet
    const invoiceData = invoices.map(i => ({
      "Date": i.date,
      "Invoice #": i.invoice_number,
      "Supplier": i.suppliers?.name || "N/A",
      "Project": i.projects?.name || "Unknown",
      "Uploaded By": i.profiles?.full_name || "Unknown",
      "Amount": Number(i.total_amount).toFixed(2)
    }));
    if (invoiceData.length > 0) {
      const ws2 = XLSX.utils.json_to_sheet(invoiceData);
      XLSX.utils.book_append_sheet(wb, ws2, "Invoices");
    }

    // Materials Sheet
    const materialData = materialUsage.map(m => ({
      "Date": m.date,
      "Material": m.materials?.name || "Unknown",
      "Quantity": m.quantity_used,
      "Unit": m.materials?.unit || "",
      "Unit Cost": m.materials?.cost_per_unit || 0,
      "Total Cost": (Number(m.quantity_used) * (m.materials?.cost_per_unit || 0)).toFixed(2),
      "Project": m.projects?.name || "Unknown",
      "Used By": m.profiles?.full_name || "Unknown",
      "Notes": m.notes || ""
    }));
    if (materialData.length > 0) {
      const ws3 = XLSX.utils.json_to_sheet(materialData);
      XLSX.utils.book_append_sheet(wb, ws3, "Materials");
    }

    // Job Completions Sheet
    const jobData = jobCompletions.map(j => ({
      "Date": format(new Date(j.completed_at), "yyyy-MM-dd HH:mm"),
      "Job": j.jobs?.title || "Unknown",
      "Project": j.jobs?.projects?.name || "Unknown",
      "Completed By": j.profiles?.full_name || "Unknown",
      "Notes": j.notes || ""
    }));
    if (jobData.length > 0) {
      const ws4 = XLSX.utils.json_to_sheet(jobData);
      XLSX.utils.book_append_sheet(wb, ws4, "Job Completions");
    }

    // Summary Sheet
    const summaryData = [{
      "Total Hours": getTotalHours().toFixed(2),
      "Total Invoices": `$${getTotalExpenses().toFixed(2)}`,
      "Total Materials Cost": `$${getTotalMaterialsCost().toFixed(2)}`,
      "Jobs Completed": jobCompletions.length,
      "Report Generated": format(new Date(), "yyyy-MM-dd HH:mm")
    }];
    const wsSummary = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, wsSummary, "Summary");

    // Download
    const fileName = `Statement_${tabName}_${format(new Date(), "yyyyMMdd_HHmmss")}.xlsx`;
    XLSX.writeFile(wb, fileName);
    
    toast({
      title: "Export Complete",
      description: `${fileName} has been downloaded.`
    });
  };

  // Group data by project
  const getProjectSummaries = () => {
    const summaries = new Map<string, {
      projectName: string;
      hours: number;
      expenses: number;
      materialsCost: number;
      jobsCompleted: number;
    }>();

    projects.forEach(p => {
      summaries.set(p.id, {
        projectName: p.name,
        hours: 0,
        expenses: 0,
        materialsCost: 0,
        jobsCompleted: 0
      });
    });

    timeEntries.forEach(t => {
      const s = summaries.get(t.project_id);
      if (s) s.hours += calculateHours(t.clock_in, t.clock_out);
    });

    invoices.forEach(i => {
      const s = summaries.get(i.project_id);
      if (s) s.expenses += Number(i.total_amount);
    });

    materialUsage.forEach(m => {
      const s = summaries.get(m.project_id);
      if (s) s.materialsCost += Number(m.quantity_used) * (m.materials?.cost_per_unit || 0);
    });

    jobCompletions.forEach(j => {
      const projectId = j.jobs?.project_id;
      if (projectId) {
        const s = summaries.get(projectId);
        if (s) s.jobsCompleted += 1;
      }
    });

    return Array.from(summaries.values()).filter(s => 
      s.hours > 0 || s.expenses > 0 || s.materialsCost > 0 || s.jobsCompleted > 0
    );
  };

  // Group data by builder
  const getBuilderSummaries = () => {
    const summaries = new Map<string, {
      builderName: string;
      hours: number;
      invoicesUploaded: number;
      materialsLogged: number;
      jobsCompleted: number;
    }>();

    builders.forEach(b => {
      summaries.set(b.id, {
        builderName: b.full_name,
        hours: 0,
        invoicesUploaded: 0,
        materialsLogged: 0,
        jobsCompleted: 0
      });
    });

    timeEntries.forEach(t => {
      const s = summaries.get(t.user_id);
      if (s) s.hours += calculateHours(t.clock_in, t.clock_out);
    });

    invoices.forEach(i => {
      const s = summaries.get(i.uploaded_by);
      if (s) s.invoicesUploaded += 1;
    });

    materialUsage.forEach(m => {
      const s = summaries.get(m.used_by);
      if (s) s.materialsLogged += 1;
    });

    jobCompletions.forEach(j => {
      const s = summaries.get(j.completed_by);
      if (s) s.jobsCompleted += 1;
    });

    return Array.from(summaries.values()).filter(s => 
      s.hours > 0 || s.invoicesUploaded > 0 || s.materialsLogged > 0 || s.jobsCompleted > 0
    );
  };

  if (isLoading) {
    return <PageLoader />;
  }

  return (
    <AppShell role="manager" fullName={fullName}>
      <section className="space-y-1">
        <h1 className="text-2xl font-bold">Statements</h1>
        <p className="text-sm text-muted-foreground">Financial reports and summaries</p>
      </section>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-3 gap-1 p-1 md:inline-grid md:w-fit md:grid-cols-5 h-auto">
            <TabsTrigger value="daily" className="text-xs sm:text-sm py-2 px-2">Daily</TabsTrigger>
            <TabsTrigger value="weekly" className="text-xs sm:text-sm py-2 px-2">Weekly</TabsTrigger>
            <TabsTrigger value="monthly" className="text-xs sm:text-sm py-2 px-2">Monthly</TabsTrigger>
            <TabsTrigger value="project" className="text-xs sm:text-sm py-2 px-2">Project</TabsTrigger>
            <TabsTrigger value="builder" className="text-xs sm:text-sm py-2 px-2">Builder</TabsTrigger>
          </TabsList>

          {/* Daily Statement */}
          <TabsContent value="daily" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Calendar className="h-5 w-5" />
                      Daily Statement
                    </CardTitle>
                    <CardDescription>Daily breakdown of hours, materials, and expenses</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select value={dateRange} onValueChange={(v: any) => setDateRange(v)}>
                      <SelectTrigger className="w-[140px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="today">Today</SelectItem>
                        <SelectItem value="yesterday">Yesterday</SelectItem>
                        <SelectItem value="last7">Last 7 Days</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button onClick={() => exportToExcel("Daily")} size="sm">
                      <Download className="h-4 w-4 mr-2" />
                      Export
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card className="bg-muted/50">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        Hours Worked
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-bold text-primary">{getTotalHours().toFixed(1)}</p>
                      <p className="text-xs text-muted-foreground">{timeEntries.length} entries</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-muted/50">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <DollarSign className="h-4 w-4" />
                        Expenses
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-bold text-primary">${getTotalExpenses().toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground">{invoices.length} invoices</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-muted/50">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Package className="h-4 w-4" />
                        Materials Cost
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-bold text-primary">${getTotalMaterialsCost().toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground">{materialUsage.length} items</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Time Entries Table */}
                {timeEntries.length > 0 && (
                  <div>
                    <h3 className="font-semibold mb-2">Time Entries</h3>
                    <div className="rounded-md border overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Builder</TableHead>
                            <TableHead>Project</TableHead>
                            <TableHead>Clock In</TableHead>
                            <TableHead>Clock Out</TableHead>
                            <TableHead>Hours</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {timeEntries.slice(0, 10).map(t => (
                            <TableRow key={t.id}>
                              <TableCell>{t.profiles?.full_name || "Unknown"}</TableCell>
                              <TableCell>{t.projects?.name || "Unknown"}</TableCell>
                              <TableCell>{format(new Date(t.clock_in), "HH:mm")}</TableCell>
                              <TableCell>{t.clock_out ? format(new Date(t.clock_out), "HH:mm") : "Active"}</TableCell>
                              <TableCell>{calculateHours(t.clock_in, t.clock_out).toFixed(2)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}

                {/* Invoices Table */}
                {invoices.length > 0 && (
                  <div>
                    <h3 className="font-semibold mb-2">Invoices</h3>
                    <div className="rounded-md border overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Invoice #</TableHead>
                            <TableHead>Supplier</TableHead>
                            <TableHead>Project</TableHead>
                            <TableHead>Amount</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {invoices.slice(0, 10).map(i => (
                            <TableRow key={i.id}>
                              <TableCell>{i.invoice_number}</TableCell>
                              <TableCell>{i.suppliers?.name || "N/A"}</TableCell>
                              <TableCell>{i.projects?.name || "Unknown"}</TableCell>
                              <TableCell>${Number(i.total_amount).toFixed(2)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Weekly Statement */}
          <TabsContent value="weekly" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Calendar className="h-5 w-5" />
                      Weekly Statement
                    </CardTitle>
                    <CardDescription>Weekly summary of all activities and costs</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select value={weekRange} onValueChange={(v: any) => setWeekRange(v)}>
                      <SelectTrigger className="w-[140px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="this">This Week</SelectItem>
                        <SelectItem value="last">Last Week</SelectItem>
                        <SelectItem value="2weeksago">2 Weeks Ago</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button onClick={() => exportToExcel("Weekly")} size="sm">
                      <Download className="h-4 w-4 mr-2" />
                      Export
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <Card className="bg-muted/50">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        Total Hours
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-bold text-primary">{getTotalHours().toFixed(1)}</p>
                      <p className="text-xs text-muted-foreground">{timeEntries.length} entries</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-muted/50">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <DollarSign className="h-4 w-4" />
                        Total Expenses
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-bold text-primary">${getTotalExpenses().toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground">{invoices.length} invoices</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-muted/50">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Package className="h-4 w-4" />
                        Materials Cost
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-bold text-primary">${getTotalMaterialsCost().toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground">{materialUsage.length} items</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-muted/50">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Briefcase className="h-4 w-4" />
                        Jobs Completed
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-bold text-primary">{jobCompletions.length}</p>
                      <p className="text-xs text-muted-foreground">This week</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Time Entries Table */}
                {timeEntries.length > 0 && (
                  <div>
                    <h3 className="font-semibold mb-2">Time Entries ({timeEntries.length})</h3>
                    <div className="rounded-md border overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Builder</TableHead>
                            <TableHead>Project</TableHead>
                            <TableHead>Hours</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {timeEntries.slice(0, 15).map(t => (
                            <TableRow key={t.id}>
                              <TableCell>{format(new Date(t.clock_in), "EEE, MMM d")}</TableCell>
                              <TableCell>{t.profiles?.full_name || "Unknown"}</TableCell>
                              <TableCell>{t.projects?.name || "Unknown"}</TableCell>
                              <TableCell>{calculateHours(t.clock_in, t.clock_out).toFixed(2)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Monthly Statement */}
          <TabsContent value="monthly" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Calendar className="h-5 w-5" />
                      Monthly Statement
                    </CardTitle>
                    <CardDescription>Monthly overview for accounting purposes</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select value={monthRange} onValueChange={(v: any) => setMonthRange(v)}>
                      <SelectTrigger className="w-[150px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="this">This Month</SelectItem>
                        <SelectItem value="last">Last Month</SelectItem>
                        <SelectItem value="2monthsago">2 Months Ago</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button onClick={() => exportToExcel("Monthly")} size="sm">
                      <Download className="h-4 w-4 mr-2" />
                      Export
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <Card className="bg-muted/50">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        Labor Hours
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-bold text-primary">{getTotalHours().toFixed(1)}</p>
                      <p className="text-xs text-muted-foreground">{timeEntries.length} entries</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-muted/50">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <DollarSign className="h-4 w-4" />
                        Total Invoices
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-bold text-primary">${getTotalExpenses().toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground">{invoices.length} invoices</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-muted/50">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Package className="h-4 w-4" />
                        Materials
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-bold text-primary">${getTotalMaterialsCost().toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground">{materialUsage.length} items</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-muted/50">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        Jobs Completed
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-bold text-primary">{jobCompletions.length}</p>
                      <p className="text-xs text-muted-foreground">This month</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Materials Summary */}
                {materialUsage.length > 0 && (
                  <div>
                    <h3 className="font-semibold mb-2">Materials Used ({materialUsage.length})</h3>
                    <div className="rounded-md border overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Material</TableHead>
                            <TableHead>Qty</TableHead>
                            <TableHead>Project</TableHead>
                            <TableHead>Cost</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {materialUsage.slice(0, 15).map(m => (
                            <TableRow key={m.id}>
                              <TableCell>{m.date}</TableCell>
                              <TableCell>{m.materials?.name || "Unknown"}</TableCell>
                              <TableCell>{m.quantity_used} {m.materials?.unit}</TableCell>
                              <TableCell>{m.projects?.name || "Unknown"}</TableCell>
                              <TableCell>${(Number(m.quantity_used) * (m.materials?.cost_per_unit || 0)).toFixed(2)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Project Statement */}
          <TabsContent value="project" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      Project Statements
                    </CardTitle>
                    <CardDescription>Cost breakdown per project for billing</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select value={selectedProject} onValueChange={setSelectedProject}>
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="All Projects" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Projects</SelectItem>
                        {projects.map(p => (
                          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button onClick={() => exportToExcel("Project")} size="sm">
                      <Download className="h-4 w-4 mr-2" />
                      Export
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {getProjectSummaries().length > 0 ? (
                  <div className="rounded-md border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Project</TableHead>
                          <TableHead>Hours</TableHead>
                          <TableHead>Expenses</TableHead>
                          <TableHead>Materials</TableHead>
                          <TableHead>Jobs</TableHead>
                          <TableHead>Total Cost</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {getProjectSummaries().map((s, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="font-medium">{s.projectName}</TableCell>
                            <TableCell>{s.hours.toFixed(1)}</TableCell>
                            <TableCell>${s.expenses.toFixed(2)}</TableCell>
                            <TableCell>${s.materialsCost.toFixed(2)}</TableCell>
                            <TableCell>{s.jobsCompleted}</TableCell>
                            <TableCell className="font-bold">${(s.expenses + s.materialsCost).toFixed(2)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-8">
                    No project data available for the selected period
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Builder Statement */}
          <TabsContent value="builder" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="h-5 w-5" />
                      Builder Statements
                    </CardTitle>
                    <CardDescription>Hours and activity per builder for payroll</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select value={selectedBuilder} onValueChange={setSelectedBuilder}>
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="All Builders" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Builders</SelectItem>
                        {builders.map(b => (
                          <SelectItem key={b.id} value={b.id}>{b.full_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button onClick={() => exportToExcel("Builder")} size="sm">
                      <Download className="h-4 w-4 mr-2" />
                      Export
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {getBuilderSummaries().length > 0 ? (
                  <div className="rounded-md border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Builder</TableHead>
                          <TableHead>Hours</TableHead>
                          <TableHead>Invoices</TableHead>
                          <TableHead>Materials</TableHead>
                          <TableHead>Jobs Done</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {getBuilderSummaries().map((s, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="font-medium">{s.builderName}</TableCell>
                            <TableCell>{s.hours.toFixed(1)}</TableCell>
                            <TableCell>{s.invoicesUploaded}</TableCell>
                            <TableCell>{s.materialsLogged}</TableCell>
                            <TableCell>{s.jobsCompleted}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-8">
                    No builder data available for the selected period
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
    </AppShell>
  );
};

export default Statements;
