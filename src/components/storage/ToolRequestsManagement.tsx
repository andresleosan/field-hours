import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Clock, Truck, Package, RotateCcw, Wrench, CheckCircle } from "lucide-react";
import { format } from "date-fns";

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
  rejection_reason: string | null;
  storage_tools?: {
    name: string;
    category: string;
    serial_number: string | null;
  } | null;
  projects?: {
    name: string;
  } | null;
  requester_profile?: {
    full_name: string;
  } | null;
  picker_profile?: {
    full_name: string;
  } | null;
  deliverer_profile?: {
    full_name: string;
  } | null;
}

const ToolRequestsManagement = () => {
  const [requests, setRequests] = useState<ToolRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<string>("active");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserName, setCurrentUserName] = useState<string>("");
  const { toast } = useToast();

  useEffect(() => {
    getCurrentUser();
    fetchRequests();

    // Real-time subscription
    const channel = supabase
      .channel('tool-requests-management')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tool_requests' },
        () => {
          fetchRequests();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [filter]);

  const getCurrentUser = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      setCurrentUserId(session.user.id);
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", session.user.id)
        .single();
      if (profile) {
        setCurrentUserName(profile.full_name || "Manager");
      }
    }
  };

  const fetchRequests = async () => {
    let query = supabase
      .from("tool_requests")
      .select(`
        *,
        storage_tools (name, category, serial_number),
        projects (name)
      `)
      .order("requested_at", { ascending: false });

    if (filter === "active") {
      query = query.in("status", ["pending", "picked_up", "delivered"]);
    } else if (filter !== "all") {
      query = query.eq("status", filter);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching requests:", error);
      toast({ title: "Error", description: "Failed to fetch requests", variant: "destructive" });
    } else {
      // Fetch requester, picker, and deliverer profiles
      const requestsWithProfiles = await Promise.all(
        (data || []).map(async (request) => {
          const [requesterResult, pickerResult, delivererResult] = await Promise.all([
            supabase.from("profiles").select("full_name").eq("id", request.requested_by).single(),
            request.picked_up_by 
              ? supabase.from("profiles").select("full_name").eq("id", request.picked_up_by).single()
              : Promise.resolve({ data: null }),
            request.delivered_by 
              ? supabase.from("profiles").select("full_name").eq("id", request.delivered_by).single()
              : Promise.resolve({ data: null })
          ]);
          return {
            ...request,
            requester_profile: requesterResult.data,
            picker_profile: pickerResult.data,
            deliverer_profile: delivererResult.data
          };
        })
      );
      setRequests(requestsWithProfiles);
    }
    setIsLoading(false);
  };

  const handlePickUp = async (requestId: string, toolId: string) => {
    // Update request status
    const { error: requestError } = await supabase
      .from("tool_requests")
      .update({
        status: "picked_up",
        picked_up_by: currentUserId,
        picked_up_at: new Date().toISOString()
      })
      .eq("id", requestId);

    if (requestError) {
      toast({ title: "Error", description: "Failed to update request", variant: "destructive" });
      return;
    }

    // Update tool status to checked_out
    const { error: toolError } = await supabase
      .from("storage_tools")
      .update({ status: "checked_out" })
      .eq("id", toolId);

    if (toolError) {
      console.error("Error updating tool status:", toolError);
    }

    toast({ title: "Success", description: `Tool picked up by ${currentUserName}` });
  };

  const handleDeliver = async (requestId: string) => {
    const { error } = await supabase
      .from("tool_requests")
      .update({
        status: "delivered",
        delivered_by: currentUserId,
        delivered_at: new Date().toISOString()
      })
      .eq("id", requestId);

    if (error) {
      toast({ title: "Error", description: "Failed to mark as delivered", variant: "destructive" });
    } else {
      toast({ title: "Success", description: `Tool delivered by ${currentUserName}` });
    }
  };

  const handleBackToYard = async (requestId: string, toolId: string) => {
    if (!currentUserId) {
      toast({ title: "Error", description: "User not authenticated", variant: "destructive" });
      return;
    }

    // Update request status to returned with who returned it
    const { error: requestError } = await supabase
      .from("tool_requests")
      .update({
        status: "returned",
        returned_by: currentUserId,
        returned_at: new Date().toISOString()
      } as any)
      .eq("id", requestId);

    if (requestError) {
      console.error("Request update error:", requestError);
      toast({ title: "Error", description: "Failed to update request", variant: "destructive" });
      return;
    }

    // Update tool status back to available
    const { error: toolError } = await supabase
      .from("storage_tools")
      .update({ status: "available" })
      .eq("id", toolId);

    if (toolError) {
      console.error("Tool update error:", toolError);
      toast({ title: "Error", description: "Failed to update tool status", variant: "destructive" });
      return;
    }

    toast({ title: "Success", description: "Tool returned to yard and marked as available" });
    
    // Refresh the list to remove the item from view
    fetchRequests();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      case "picked_up":
        return <Badge variant="warning"><Truck className="h-3 w-3 mr-1" />Picked Up</Badge>;
      case "delivered":
        return <Badge variant="info"><Package className="h-3 w-3 mr-1" />Delivered</Badge>;
      case "returned":
        return <Badge variant="success"><CheckCircle className="h-3 w-3 mr-1" />Returned</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getActionButtons = (request: ToolRequest) => {
    switch (request.status) {
      case "pending":
        return (
          <Button size="sm" onClick={() => handlePickUp(request.id, request.tool_id)}>
            <Truck className="h-4 w-4 mr-1" />
            Picked Up
          </Button>
        );
      case "picked_up":
        return (
          <Button size="sm" onClick={() => handleDeliver(request.id)}>
            <Package className="h-4 w-4 mr-1" />
            Delivered
          </Button>
        );
      case "delivered":
        return (
          <Button size="sm" variant="outline" onClick={() => handleBackToYard(request.id, request.tool_id)}>
            <RotateCcw className="h-4 w-4 mr-1" />
            Back to Yard
          </Button>
        );
      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const pendingCount = requests.filter(r => r.status === "pending").length;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Wrench className="h-5 w-5" />
              Requested Tools
              {pendingCount > 0 && (
                <Badge variant="destructive">{pendingCount} Waiting pickup</Badge>
              )}
            </CardTitle>
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active Requests</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="picked_up">Picked Up</SelectItem>
                <SelectItem value="delivered">Delivered</SelectItem>
                <SelectItem value="returned">Returned</SelectItem>
                <SelectItem value="all">All</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {requests.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No requests found</p>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tool</TableHead>
                    <TableHead>Requested By</TableHead>
                    <TableHead>Project</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Picked Up By</TableHead>
                    <TableHead>Delivered By</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requests.map((request) => (
                    <TableRow key={request.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{request.storage_tools?.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {request.storage_tools?.category}
                            {request.storage_tools?.serial_number && ` • ${request.storage_tools.serial_number}`}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p>{request.requester_profile?.full_name || "Unknown"}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(request.requested_at), "MMM d, h:mm a")}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>{request.projects?.name}</TableCell>
                      <TableCell>{getStatusBadge(request.status)}</TableCell>
                      <TableCell>
                        {request.picker_profile?.full_name ? (
                          <div>
                            <p>{request.picker_profile.full_name}</p>
                            {request.picked_up_at && (
                              <p className="text-xs text-muted-foreground">
                                {format(new Date(request.picked_up_at), "MMM d, h:mm a")}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {request.deliverer_profile?.full_name ? (
                          <div>
                            <p>{request.deliverer_profile.full_name}</p>
                            {request.delivered_at && (
                              <p className="text-xs text-muted-foreground">
                                {format(new Date(request.delivered_at), "MMM d, h:mm a")}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {getActionButtons(request)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ToolRequestsManagement;
