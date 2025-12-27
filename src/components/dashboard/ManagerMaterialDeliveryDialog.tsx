import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Package, Clock, CheckCircle, Trash2, User } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";

interface ManagerMaterialDeliveryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface DeliveryRequest {
  id: string;
  status: string;
  notes: string | null;
  created_at: string;
  user_id: string;
  project: { name: string } | null;
  profile: { full_name: string } | null;
  items: {
    id: string;
    quantity: number;
    material: { name: string; unit: string } | null;
  }[];
}

const ManagerMaterialDeliveryDialog = ({
  open,
  onOpenChange,
}: ManagerMaterialDeliveryDialogProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [requests, setRequests] = useState<DeliveryRequest[]>([]);
  const [activeTab, setActiveTab] = useState("pending");
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      fetchRequests();
    }
  }, [open]);

  const fetchRequests = async () => {
    setIsLoading(true);
    try {
      const { data } = await supabase
        .from("material_delivery_requests")
        .select(`
          id,
          status,
          notes,
          created_at,
          user_id,
          project:projects(name)
        `)
        .order("created_at", { ascending: false });

      if (data) {
        // Fetch items and profiles for each request
        const requestsWithDetails = await Promise.all(
          data.map(async (request) => {
            const [itemsResult, profileResult] = await Promise.all([
              supabase
                .from("material_delivery_items")
                .select(`
                  id,
                  quantity,
                  material:materials(name, unit)
                `)
                .eq("request_id", request.id),
              supabase
                .from("profiles")
                .select("full_name")
                .eq("id", request.user_id)
                .maybeSingle(),
            ]);
            return {
              ...request,
              items: itemsResult.data || [],
              profile: profileResult.data,
            };
          })
        );
        setRequests(requestsWithDetails as DeliveryRequest[]);
      }
    } catch (error) {
      console.error("Error fetching requests:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMarkDelivered = async (requestId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("material_delivery_requests")
        .update({
          status: "delivered",
          resolved_at: new Date().toISOString(),
          resolved_by: user?.id,
        })
        .eq("id", requestId);

      if (error) throw error;

      toast({
        title: "Marked as Delivered",
        description: "The delivery request has been marked as delivered",
      });
      fetchRequests();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update request",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (requestId: string) => {
    try {
      const { error } = await supabase
        .from("material_delivery_requests")
        .delete()
        .eq("id", requestId);

      if (error) throw error;

      toast({
        title: "Deleted",
        description: "The delivery request has been deleted",
      });
      fetchRequests();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete request",
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="secondary">Pending</Badge>;
      case "in_progress":
        return <Badge className="bg-blue-500">In Progress</Badge>;
      case "delivered":
        return <Badge className="bg-green-500">Delivered</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const filteredRequests = requests.filter((r) => {
    if (activeTab === "pending") return r.status === "pending";
    if (activeTab === "delivered") return r.status === "delivered";
    return true;
  });

  const pendingCount = requests.filter((r) => r.status === "pending").length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            Material Delivery Requests
          </DialogTitle>
          <DialogDescription>
            {pendingCount} pending request{pendingCount !== 1 ? "s" : ""}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="pending">
              Pending {pendingCount > 0 && `(${pendingCount})`}
            </TabsTrigger>
            <TabsTrigger value="delivered">Delivered</TabsTrigger>
            <TabsTrigger value="all">All</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="flex-1 overflow-hidden mt-4">
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : (
              <ScrollArea className="h-[500px]">
                {filteredRequests.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No requests found
                  </p>
                ) : (
                  <div className="space-y-4 pr-4">
                    {filteredRequests.map((request) => (
                      <div
                        key={request.id}
                        className="border rounded-lg p-4 space-y-3"
                      >
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">
                                {request.profile?.full_name || "Unknown"}
                              </span>
                            </div>
                            {request.project && (
                              <p className="text-sm text-muted-foreground">
                                Project: {request.project.name}
                              </p>
                            )}
                          </div>
                          {getStatusBadge(request.status)}
                        </div>

                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Clock className="h-4 w-4" />
                          <span>
                            Requested: {format(new Date(request.created_at), "PPp")}
                          </span>
                        </div>

                        <div className="bg-muted rounded-md p-3">
                          <p className="font-medium text-sm mb-2">Materials Requested:</p>
                          <ul className="space-y-1">
                            {request.items.map((item) => (
                              <li
                                key={item.id}
                                className="text-sm flex justify-between"
                              >
                                <span>{item.material?.name}</span>
                                <span className="text-muted-foreground">
                                  {item.quantity} {item.material?.unit}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        {request.notes && (
                          <p className="text-sm">
                            <span className="font-medium">Notes:</span>{" "}
                            {request.notes}
                          </p>
                        )}

                        <div className="flex gap-2 pt-2">
                          {request.status === "pending" && (
                            <Button
                              size="sm"
                              onClick={() => handleMarkDelivered(request.id)}
                            >
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Mark Delivered
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleDelete(request.id)}
                          >
                            <Trash2 className="h-4 w-4 mr-1" />
                            Delete
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default ManagerMaterialDeliveryDialog;
