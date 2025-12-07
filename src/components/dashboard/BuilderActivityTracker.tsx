import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Clock, Package, FileText, MapPin, Download, Calendar } from "lucide-react";
import { toast } from "sonner";

interface Builder {
  id: string;
  full_name: string;
}

interface TimeEntry {
  id: string;
  user_id: string;
  clock_in: string;
  clock_out: string | null;
  project_id: string;
  location_lat: number | null;
  location_lng: number | null;
  projects: { name: string };
  profiles: Builder;
}

interface MaterialLog {
  id: string;
  used_by: string;
  quantity_used: number;
  date: string;
  materials: { name: string; unit: string };
  projects: { name: string };
  profiles: Builder;
}

interface Invoice {
  id: string;
  uploaded_by: string;
  invoice_number: string;
  total_amount: number;
  date: string;
  needs_review: boolean;
  image_url: string | null;
  extracted_data: any;
  projects: { name: string };
  profiles: Builder;
  suppliers: { name: string } | null;
}

const BuilderActivityTracker = () => {
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [materialLogs, setMaterialLogs] = useState<MaterialLog[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [totalHoursLast10Days, setTotalHoursLast10Days] = useState(0);

  useEffect(() => {
    fetchAllActivity();
  }, []);

  const fetchAllActivity = async () => {
    setIsLoading(true);
    
    // Calculate date 30 days ago for data filtering
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoISO = thirtyDaysAgo.toISOString();
    
    // Calculate date 10 days ago for hours calculation
    const tenDaysAgo = new Date();
    tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
    
    // Fetch time entries from last 30 days
    const { data: timeData } = await supabase
      .from("time_tracking")
      .select(`
        *,
        projects (name),
        profiles (full_name)
      `)
      .gte("clock_in", thirtyDaysAgoISO)
      .order("clock_in", { ascending: false });

    if (timeData) {
      setTimeEntries(timeData as any);
      
      // Calculate total hours for last 10 days
      const recentEntries = timeData.filter(entry => 
        new Date(entry.clock_in) >= tenDaysAgo && entry.clock_out
      );
      
      const totalHours = recentEntries.reduce((sum, entry) => {
        if (entry.clock_out) {
          const diff = new Date(entry.clock_out).getTime() - new Date(entry.clock_in).getTime();
          return sum + (diff / 3600000); // Convert to hours
        }
        return sum;
      }, 0);
      
      setTotalHoursLast10Days(totalHours);
    }

    // Fetch material logs from last 30 days
    const { data: materialData } = await supabase
      .from("material_usage")
      .select(`
        *,
        materials (name, unit),
        projects (name),
        profiles (full_name)
      `)
      .gte("date", thirtyDaysAgo.toISOString().split('T')[0])
      .order("date", { ascending: false });

    if (materialData) setMaterialLogs(materialData as any);

    // Fetch invoices from last 30 days with all details
    const { data: invoiceData } = await supabase
      .from("invoices")
      .select(`
        *,
        projects (name),
        profiles (full_name),
        suppliers (name)
      `)
      .gte("date", thirtyDaysAgo.toISOString().split('T')[0])
      .order("date", { ascending: false});

    if (invoiceData) setInvoices(invoiceData as any);

    setIsLoading(false);
  };

  const generateStatement = async (type: 'daily' | 'weekly') => {
    const now = new Date();
    const startDate = new Date();
    
    if (type === 'daily') {
      startDate.setHours(0, 0, 0, 0);
    } else {
      startDate.setDate(now.getDate() - 7);
    }

    try {
      // Fetch data for the period
      const { data: timeData } = await supabase
        .from("time_tracking")
        .select(`*, projects (name), profiles (full_name)`)
        .gte("clock_in", startDate.toISOString())
        .order("clock_in", { ascending: false });

      const { data: materialData } = await supabase
        .from("material_usage")
        .select(`*, materials (name, unit), projects (name), profiles (full_name)`)
        .gte("date", startDate.toISOString().split('T')[0])
        .order("date", { ascending: false });

      const { data: invoiceData } = await supabase
        .from("invoices")
        .select(`*, projects (name), profiles (full_name), suppliers (name)`)
        .gte("date", startDate.toISOString().split('T')[0])
        .order("date", { ascending: false });

      // Calculate totals
      const totalHours = timeData?.reduce((sum, entry) => {
        if (entry.clock_out) {
          const diff = new Date(entry.clock_out).getTime() - new Date(entry.clock_in).getTime();
          return sum + (diff / 3600000);
        }
        return sum;
      }, 0) || 0;

      const totalInvoiceAmount = invoiceData?.reduce((sum, inv) => sum + Number(inv.total_amount), 0) || 0;

      // Generate report text
      const reportLines = [
        `${type.toUpperCase()} STATEMENT - ${now.toLocaleDateString()}`,
        `Period: ${startDate.toLocaleDateString()} - ${now.toLocaleDateString()}`,
        '',
        '=== TIME TRACKING ===',
        `Total Hours: ${totalHours.toFixed(2)}h`,
        `Number of Entries: ${timeData?.length || 0}`,
        '',
        '=== MATERIALS ===',
        `Total Material Logs: ${materialData?.length || 0}`,
        ...(materialData?.map(m => `  - ${m.materials.name}: ${m.quantity_used} ${m.materials.unit} (${m.projects.name})`) || []),
        '',
        '=== INVOICES ===',
        `Total Invoice Amount: £${totalInvoiceAmount.toFixed(2)}`,
        `Number of Invoices: ${invoiceData?.length || 0}`,
        ...(invoiceData?.map(i => `  - Invoice #${i.invoice_number}: £${i.total_amount} (${i.projects.name})`) || []),
      ];

      // Download as text file
      const blob = new Blob([reportLines.join('\n')], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${type}-statement-${now.toISOString().split('T')[0]}.txt`;
      a.click();
      URL.revokeObjectURL(url);

      toast.success(`${type.charAt(0).toUpperCase() + type.slice(1)} statement downloaded successfully`);
    } catch (error) {
      console.error('Error generating statement:', error);
      toast.error('Failed to generate statement');
    }
  };

  const calculateDuration = (clockIn: string, clockOut: string | null) => {
    const start = new Date(clockIn);
    const end = clockOut ? new Date(clockOut) : new Date();
    const diff = end.getTime() - start.getTime();
    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    return `${hours}h ${minutes}m`;
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <Card className="col-span-full">
      <CardHeader className="space-y-4">
        <div className="flex flex-col gap-3">
          <div>
            <CardTitle className="text-base sm:text-lg">Builder Activity Tracker</CardTitle>
            <CardDescription className="text-xs sm:text-sm">Real-time view of all builder activities</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => generateStatement('daily')} variant="outline" size="sm" className="text-xs px-2 py-1 h-8">
              <Calendar className="h-3 w-3 mr-1" />
              Daily
            </Button>
            <Button onClick={() => generateStatement('weekly')} variant="outline" size="sm" className="text-xs px-2 py-1 h-8">
              <Download className="h-3 w-3 mr-1" />
              Weekly
            </Button>
          </div>
        </div>
        <div className="p-3 bg-muted rounded-lg">
          <div className="text-xs font-medium">Total Hours (Last 10 Days)</div>
          <div className="text-lg sm:text-xl font-bold">{totalHoursLast10Days.toFixed(2)}h</div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="time" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="time">Time Tracking</TabsTrigger>
            <TabsTrigger value="materials">Materials</TabsTrigger>
            <TabsTrigger value="invoices">Invoices</TabsTrigger>
          </TabsList>

          <TabsContent value="time">
            <ScrollArea className="h-[500px] pr-4">
              {timeEntries.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  <Clock className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No time entries yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {timeEntries.map((entry) => (
                    <Card key={entry.id} className="p-4">
                      <div className="flex items-start gap-3">
                        <Avatar>
                          <AvatarFallback>{getInitials(entry.profiles.full_name)}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <div className="font-medium">{entry.profiles.full_name}</div>
                            {!entry.clock_out && (
                              <Badge variant="default" className="bg-success">
                                <Clock className="h-3 w-3 mr-1" />
                                Active
                              </Badge>
                            )}
                          </div>
                          <div className="text-sm text-muted-foreground mt-1">
                            <div className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {entry.projects.name}
                            </div>
                            {entry.location_lat && entry.location_lng && (
                              <div className="mt-1 text-xs">
                                📍 Location: {entry.location_lat.toFixed(6)}, {entry.location_lng.toFixed(6)}
                              </div>
                            )}
                            <div className="mt-1">
                              {new Date(entry.clock_in).toLocaleString()} →{" "}
                              {entry.clock_out ? new Date(entry.clock_out).toLocaleString() : "In Progress"}
                            </div>
                            <div className="font-medium mt-1">
                              Duration: {calculateDuration(entry.clock_in, entry.clock_out)}
                            </div>
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="materials">
            <ScrollArea className="h-[500px] pr-4">
              {materialLogs.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No material logs yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {materialLogs.map((log) => (
                    <Card key={log.id} className="p-4">
                      <div className="flex items-start gap-3">
                        <Avatar>
                          <AvatarFallback>{getInitials(log.profiles.full_name)}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <div className="font-medium">{log.profiles.full_name}</div>
                          <div className="text-sm text-muted-foreground mt-1">
                            <div className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {log.projects.name}
                            </div>
                            <div className="mt-1">
                              <span className="font-medium">{log.materials.name}:</span>{" "}
                              {log.quantity_used} {log.materials.unit}
                            </div>
                            <div className="mt-1">{new Date(log.date).toLocaleDateString()}</div>
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="invoices">
            <ScrollArea className="h-[500px] pr-4">
              {invoices.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No invoices yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {invoices.map((invoice) => (
                    <Card key={invoice.id} className="p-4">
                      <div className="flex items-start gap-3">
                        {invoice.image_url ? (
                          <img 
                            src={invoice.image_url} 
                            alt="Invoice" 
                            className="w-16 h-16 object-cover rounded"
                          />
                        ) : (
                          <Avatar>
                            <AvatarFallback>{getInitials(invoice.profiles.full_name)}</AvatarFallback>
                          </Avatar>
                        )}
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <div className="font-medium">{invoice.profiles.full_name}</div>
                            {invoice.needs_review && (
                              <Badge variant="secondary">Needs Review</Badge>
                            )}
                          </div>
                          <div className="text-sm text-muted-foreground mt-1">
                            <div className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {invoice.projects.name}
                            </div>
                            {invoice.suppliers && (
                              <div className="mt-1">
                                <span className="font-medium">Supplier:</span> {invoice.suppliers.name}
                              </div>
                            )}
                            <div className="mt-1">
                              <span className="font-medium">Invoice #:</span> {invoice.invoice_number}
                            </div>
                            <div className="mt-1">
                              <span className="font-medium">Amount:</span> £{invoice.total_amount.toFixed(2)}
                            </div>
                            <div className="mt-1">{new Date(invoice.date).toLocaleDateString()}</div>
                            {invoice.extracted_data && (
                              <div className="mt-2 text-xs bg-secondary/50 p-2 rounded">
                                <div className="font-medium">Extracted Data:</div>
                                <pre className="mt-1 whitespace-pre-wrap">{JSON.stringify(invoice.extracted_data, null, 2)}</pre>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default BuilderActivityTracker;