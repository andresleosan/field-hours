import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Wrench, Search, Plus, Clock, CheckCircle, Truck, Package } from "lucide-react";
import { format } from "date-fns";

interface ToolRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  userId: string;
  projectName?: string;
}

interface StorageTool {
  id: string;
  name: string;
  category: string;
  status: string;
  condition: string;
  serial_number: string | null;
  section: string | null;
}

interface ToolRequest {
  id: string;
  tool_id: string;
  project_id: string;
  requested_by: string;
  requested_at: string;
  status: string;
  notes: string | null;
  approved_by: string | null;
  approved_at: string | null;
  picked_up_by: string | null;
  picked_up_at: string | null;
  delivered_at: string | null;
  delivered_by: string | null;
  storage_tools?: {
    name: string;
    category: string;
    serial_number: string | null;
  } | null;
  projects?: {
    name: string;
  } | null;
}

const ToolRequestDialog = ({ open, onOpenChange, projectId, userId, projectName }: ToolRequestDialogProps) => {
  const [tools, setTools] = useState<StorageTool[]>([]);
  const [myRequests, setMyRequests] = useState<ToolRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTool, setSelectedTool] = useState<StorageTool | null>(null);
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState("request");
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      fetchTools();
      fetchMyRequests();
    }
  }, [open, projectId]);

  useEffect(() => {
    if (!open) return;

    // Real-time subscription for request updates
    const channel = supabase
      .channel('my-tool-requests')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tool_requests', filter: `requested_by=eq.${userId}` },
        () => {
          fetchMyRequests();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [open, userId]);

  const fetchTools = async () => {
    const { data, error } = await supabase
      .from("storage_tools")
      .select("*")
      .eq("status", "available")
      .order("name");

    if (error) {
      console.error("Error fetching tools:", error);
    } else {
      setTools(data || []);
    }
    setIsLoading(false);
  };

  const fetchMyRequests = async () => {
    const { data, error } = await supabase
      .from("tool_requests")
      .select(`
        *,
        storage_tools (name, category, serial_number),
        projects (name)
      `)
      .eq("requested_by", userId)
      .order("requested_at", { ascending: false });

    if (error) {
      console.error("Error fetching requests:", error);
    } else {
      setMyRequests(data || []);
    }
  };

  const handleRequestTool = async () => {
    if (!selectedTool) return;

    setIsSubmitting(true);
    const { error } = await supabase
      .from("tool_requests")
      .insert({
        tool_id: selectedTool.id,
        project_id: projectId,
        requested_by: userId,
        notes: notes || null,
        status: "pending"
      });

    if (error) {
      console.error("Error requesting tool:", error);
      toast({ title: "Error", description: "Failed to request tool", variant: "destructive" });
    } else {
      toast({ title: "Success", description: `Tool "${selectedTool.name}" requested successfully` });
      setSelectedTool(null);
      setNotes("");
      fetchMyRequests();
      setActiveTab("my-requests");
    }
    setIsSubmitting(false);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      case "approved":
        return <Badge className="bg-blue-500"><CheckCircle className="h-3 w-3 mr-1" />Approved</Badge>;
      case "picked_up":
        return <Badge className="bg-orange-500"><Truck className="h-3 w-3 mr-1" />Picked Up</Badge>;
      case "delivered":
        return <Badge className="bg-green-500"><Package className="h-3 w-3 mr-1" />Delivered</Badge>;
      case "rejected":
        return <Badge variant="destructive">Rejected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const filteredTools = tools.filter(tool =>
    tool.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    tool.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5" />
            Request Tools - {projectName || "Project"}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="request">Request Tool</TabsTrigger>
            <TabsTrigger value="my-requests">
              My Requests
              {myRequests.filter(r => r.status !== "delivered" && r.status !== "rejected").length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {myRequests.filter(r => r.status !== "delivered" && r.status !== "rejected").length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="request" className="flex-1 overflow-auto space-y-4 mt-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search available tools..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>

                {selectedTool ? (
                  <Card className="border-primary">
                    <CardContent className="p-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium">{selectedTool.name}</h4>
                          <p className="text-sm text-muted-foreground">
                            {selectedTool.category}
                            {selectedTool.serial_number && ` • ${selectedTool.serial_number}`}
                          </p>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => setSelectedTool(null)}>
                          Change
                        </Button>
                      </div>

                      <Textarea
                        placeholder="Add notes (optional) - e.g., when you need it, specific requirements..."
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        rows={3}
                      />

                      <Button
                        onClick={handleRequestTool}
                        disabled={isSubmitting}
                        className="w-full"
                      >
                        {isSubmitting ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <Plus className="h-4 w-4 mr-2" />
                        )}
                        Request Tool
                      </Button>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid gap-2 max-h-[400px] overflow-auto">
                    {filteredTools.length === 0 ? (
                      <p className="text-center text-muted-foreground py-8">
                        No available tools found
                      </p>
                    ) : (
                      filteredTools.map((tool) => (
                        <Card
                          key={tool.id}
                          className="cursor-pointer hover:border-primary transition-colors"
                          onClick={() => setSelectedTool(tool)}
                        >
                          <CardContent className="p-3 flex items-center justify-between">
                            <div>
                              <p className="font-medium">{tool.name}</p>
                              <p className="text-sm text-muted-foreground">
                                {tool.category}
                                {tool.section && ` • ${tool.section}`}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-green-600">
                                Available
                              </Badge>
                            </div>
                          </CardContent>
                        </Card>
                      ))
                    )}
                  </div>
                )}
              </>
            )}
          </TabsContent>

          <TabsContent value="my-requests" className="flex-1 overflow-auto space-y-3 mt-4">
            {myRequests.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No tool requests yet
              </p>
            ) : (
              myRequests.map((request) => (
                <Card key={request.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-medium">{request.storage_tools?.name}</h4>
                        <p className="text-sm text-muted-foreground">
                          {request.storage_tools?.category}
                          {request.storage_tools?.serial_number && ` • ${request.storage_tools.serial_number}`}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          For: {request.projects?.name}
                        </p>
                      </div>
                      {getStatusBadge(request.status)}
                    </div>

                    {request.notes && (
                      <p className="text-sm mt-2 bg-muted p-2 rounded">{request.notes}</p>
                    )}

                    <div className="mt-3 text-xs text-muted-foreground space-y-1">
                      <p>Requested: {format(new Date(request.requested_at), "MMM d, yyyy h:mm a")}</p>
                      {request.approved_at && (
                        <p>Approved: {format(new Date(request.approved_at), "MMM d, h:mm a")}</p>
                      )}
                      {request.picked_up_at && (
                        <p>Picked up: {format(new Date(request.picked_up_at), "MMM d, h:mm a")}</p>
                      )}
                      {request.delivered_at && (
                        <p>Delivered: {format(new Date(request.delivered_at), "MMM d, h:mm a")}</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default ToolRequestDialog;
