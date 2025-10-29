import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { Clock, Package, FileText, MapPin } from "lucide-react";

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
  projects: { name: string };
  profiles: Builder;
}

const BuilderActivityTracker = () => {
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [materialLogs, setMaterialLogs] = useState<MaterialLog[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchAllActivity();
  }, []);

  const fetchAllActivity = async () => {
    setIsLoading(true);
    
    // Fetch time entries
    const { data: timeData } = await supabase
      .from("time_tracking")
      .select(`
        *,
        projects (name),
        profiles (full_name)
      `)
      .order("clock_in", { ascending: false })
      .limit(50);

    if (timeData) setTimeEntries(timeData as any);

    // Fetch material logs
    const { data: materialData } = await supabase
      .from("material_usage")
      .select(`
        *,
        materials (name, unit),
        projects (name),
        profiles (full_name)
      `)
      .order("date", { ascending: false })
      .limit(50);

    if (materialData) setMaterialLogs(materialData as any);

    // Fetch invoices
    const { data: invoiceData } = await supabase
      .from("invoices")
      .select(`
        *,
        projects (name),
        profiles (full_name)
      `)
      .order("date", { ascending: false })
      .limit(50);

    if (invoiceData) setInvoices(invoiceData as any);

    setIsLoading(false);
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
      <CardHeader>
        <CardTitle>Builder Activity Tracker</CardTitle>
        <CardDescription>Real-time view of all builder activities across projects</CardDescription>
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
                        <Avatar>
                          <AvatarFallback>{getInitials(invoice.profiles.full_name)}</AvatarFallback>
                        </Avatar>
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
                            <div className="mt-1">
                              <span className="font-medium">Invoice #:</span> {invoice.invoice_number}
                            </div>
                            <div className="mt-1">
                              <span className="font-medium">Amount:</span> ${invoice.total_amount.toFixed(2)}
                            </div>
                            <div className="mt-1">{new Date(invoice.date).toLocaleDateString()}</div>
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