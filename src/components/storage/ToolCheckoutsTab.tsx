import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Loader2, RotateCcw, Clock, CheckCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

interface ToolCheckout {
  id: string;
  tool_id: string;
  project_id: string;
  checked_out_by: string;
  checked_out_at: string;
  expected_return_date: string | null;
  returned_at: string | null;
  returned_by: string | null;
  condition_on_return: string | null;
  notes: string | null;
  storage_tools?: {
    name: string;
    category: string;
    serial_number: string | null;
  } | null;
  projects?: {
    name: string;
  } | null;
}
const ToolCheckoutsTab = () => {
  const [checkouts, setCheckouts] = useState<ToolCheckout[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<string>("active");
  const { toast } = useToast();

  useEffect(() => {
    fetchCheckouts();

    // Real-time subscription for checkout updates
    const channel = supabase
      .channel('tool-checkouts-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tool_checkouts' },
        () => {
          fetchCheckouts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [filter]);

  const fetchCheckouts = async () => {
    let query = supabase
      .from("tool_checkouts")
      .select(`
        *,
        storage_tools (name, category, serial_number),
        projects (name)
      `)
      .order("checked_out_at", { ascending: false });

    if (filter === "active") {
      query = query.is("returned_at", null);
    } else if (filter === "returned") {
      query = query.not("returned_at", "is", null);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching checkouts:", error);
      toast({ title: "Error", description: "Failed to fetch checkouts", variant: "destructive" });
    } else {
      setCheckouts(data || []);
    }
    setIsLoading(false);
  };

  const handleReturn = async (checkout: ToolCheckout) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    // Update checkout record
    const { error: checkoutError } = await supabase
      .from("tool_checkouts")
      .update({
        returned_at: new Date().toISOString(),
        returned_by: session.user.id,
        condition_on_return: "good",
      })
      .eq("id", checkout.id);

    if (checkoutError) {
      toast({ title: "Error", description: "Failed to return tool", variant: "destructive" });
      return;
    }

    // Update tool status back to available
    const { error: toolError } = await supabase
      .from("storage_tools")
      .update({ status: "available" })
      .eq("id", checkout.tool_id);

    if (toolError) {
      toast({ title: "Warning", description: "Tool returned but status not updated", variant: "destructive" });
    } else {
      toast({ title: "Success", description: "Tool returned to storage" });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const activeCount = checkouts.filter(c => !c.returned_at).length;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Tool Checkouts
              {activeCount > 0 && (
                <Badge variant="destructive">{activeCount} Active</Badge>
              )}
            </CardTitle>
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="returned">Returned</SelectItem>
                <SelectItem value="all">All</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {checkouts.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No checkouts found</p>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tool</TableHead>
                    <TableHead>Project</TableHead>
                    <TableHead>Checked Out By</TableHead>
                    <TableHead>Checked Out</TableHead>
                    <TableHead>Expected Return</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {checkouts.map((checkout) => (
                    <TableRow key={checkout.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{checkout.storage_tools?.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {checkout.storage_tools?.category}
                            {checkout.storage_tools?.serial_number && ` • ${checkout.storage_tools.serial_number}`}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>{checkout.projects?.name}</TableCell>
                      <TableCell>-</TableCell>
                      <TableCell>
                        {format(new Date(checkout.checked_out_at), "MMM d, yyyy h:mm a")}
                      </TableCell>
                      <TableCell>
                        {checkout.expected_return_date
                          ? format(new Date(checkout.expected_return_date), "MMM d, yyyy")
                          : "-"}
                      </TableCell>
                      <TableCell>
                        {checkout.returned_at ? (
                          <Badge className="bg-green-500">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Returned
                          </Badge>
                        ) : (
                          <Badge variant="destructive">
                            <Clock className="h-3 w-3 mr-1" />
                            Checked Out
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {!checkout.returned_at && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleReturn(checkout)}
                          >
                            <RotateCcw className="h-4 w-4 mr-1" />
                            Return
                          </Button>
                        )}
                        {checkout.returned_at && (
                          <span className="text-sm text-muted-foreground">
                            {format(new Date(checkout.returned_at), "MMM d, h:mm a")}
                          </span>
                        )}
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

export default ToolCheckoutsTab;
