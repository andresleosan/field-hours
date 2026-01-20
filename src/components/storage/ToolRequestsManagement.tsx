import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Clock, CheckCircle, Truck, Package, X, Wrench } from "lucide-react";
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
}

const ToolRequestsManagement = () => {
  const [requests, setRequests] = useState<ToolRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<string>("pending");
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

    if (filter !== "all") {
      query = query.eq("status", filter);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching requests:", error);
      toast({ title: "Error", description: "Failed to fetch requests", variant: "destructive" });
    } else {
      // Fetch requester and picker profiles
      const requestsWithProfiles = await Promise.all(
        (data || []).map(async (request) => {
          const [requesterResult, pickerResult] = await Promise.all([
            supabase.from("profiles").select("full_name").eq("id", request.requested_by).single(),
            request.picked_up_by 
              ? supabase.from("profiles").select("full_name").eq("id", request.picked_up_by).single()
              : Promise.resolve({ data: null })
          ]);
          return {
            ...request,
            requester_profile: requesterResult.data,
            picker_profile: pickerResult.data
          };
        })
      );
      setRequests(requestsWithProfiles);
    }
    setIsLoading(false);
  };

  const handleApprove = async (requestId: string) => {
    const { error } = await supabase
      .from("tool_requests")
      .update({
        status: "approved",
        approved_by: currentUserId,
        approved_at: new Date().toISOString()
      })
      .eq("id", requestId);

    if (error) {
      toast({ title: "Error", description: "Failed to approve request", variant: "destructive" });
    } else {
      toast({ title: "Success", description: "Request approved" });
    }
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
      toast({ title: "Success", description: "Tool marked as delivered" });
    }
  };

  const handleReject = async (requestId: string) => {
    const reason = prompt("Enter rejection reason:");
    if (!reason) return;

    const { error } = await supabase
      .from("tool_requests")
      .update({
        status: "rejected",
        rejection_reason: reason
      })
      .eq("id", requestId);

    if (error) {
      toast({ title: "Error", description: "Failed to reject request", variant: "destructive" });
    } else {
      toast({ title: "Request rejected", description: "The builder has been notified" });
    }
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
        return <Badge variant="destructive"><X className="h-3 w-3 mr-1" />Rejected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getActionButtons = (request: ToolRequest) => {
    switch (request.status) {
      case "pending":
        return (
          <div className="flex gap-2">
            <Button size="sm" onClick={() => handleApprove(request.id)}>
              Approve
            </Button>
            <Button size="sm" variant="destructive" onClick={() => handleReject(request.id)}>
              Reject
            </Button>
          </div>
        );
      case "approved":
        return (
          <Button size="sm" onClick={() => handlePickUp(request.id, request.tool_id)}>
            <Truck className="h-4 w-4 mr-1" />
            Pick Up
          </Button>
        );
      case "picked_up":
        return (
          <Button size="sm" onClick={() => handleDeliver(request.id)}>
            <Package className="h-4 w-4 mr-1" />
            Mark Delivered
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
              Tool Requests
              {pendingCount > 0 && (
                <Badge variant="destructive">{pendingCount} Pending</Badge>
              )}
            </CardTitle>
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="picked_up">Picked Up</SelectItem>
                <SelectItem value="delivered">Delivered</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
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
                    <TableHead>Requested</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Picked Up By</TableHead>
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
                      <TableCell>{request.requester_profile?.full_name || "Unknown"}</TableCell>
                      <TableCell>{request.projects?.name}</TableCell>
                      <TableCell>
                        {format(new Date(request.requested_at), "MMM d, h:mm a")}
                      </TableCell>
                      <TableCell>{getStatusBadge(request.status)}</TableCell>
                      <TableCell>
                        {request.picker_profile?.full_name || "-"}
                        {request.picked_up_at && (
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(request.picked_up_at), "MMM d, h:mm a")}
                          </p>
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
