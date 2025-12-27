import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Plus, Trash2, Search, Package, Clock, PlusCircle } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";

interface MaterialDeliveryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  userId: string;
}

interface Material {
  id: string;
  name: string;
  unit: string;
  category: string | null;
}

interface DeliveryItem {
  material: Material;
  quantity: number;
}

interface DeliveryRequest {
  id: string;
  status: string;
  notes: string | null;
  created_at: string;
  project: { name: string } | null;
  items: {
    id: string;
    quantity: number;
    material: { name: string; unit: string } | null;
  }[];
}

const MaterialDeliveryDialog = ({
  open,
  onOpenChange,
  projectId,
  userId,
}: MaterialDeliveryDialogProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredMaterials, setFilteredMaterials] = useState<Material[]>([]);
  const [selectedItems, setSelectedItems] = useState<DeliveryItem[]>([]);
  const [notes, setNotes] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [activeTab, setActiveTab] = useState("request");
  const [myRequests, setMyRequests] = useState<DeliveryRequest[]>([]);
  const [projectName, setProjectName] = useState("");
  const [isCreatingMaterial, setIsCreatingMaterial] = useState(false);
  const [newMaterialUnit, setNewMaterialUnit] = useState("units");
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      fetchMaterials();
      fetchMyRequests();
      fetchProjectName();
    }
  }, [open, projectId]);

  useEffect(() => {
    if (searchTerm.length > 0) {
      const filtered = materials.filter((m) =>
        m.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredMaterials(filtered);
      setShowDropdown(filtered.length > 0);
    } else {
      setFilteredMaterials([]);
      setShowDropdown(false);
    }
  }, [searchTerm, materials]);

  const fetchProjectName = async () => {
    if (!projectId) return;
    const { data } = await supabase
      .from("projects")
      .select("name")
      .eq("id", projectId)
      .maybeSingle();
    if (data) setProjectName(data.name);
  };

  const fetchMaterials = async () => {
    const { data } = await supabase
      .from("materials")
      .select("id, name, unit, category")
      .order("name");
    if (data) setMaterials(data);
  };

  const fetchMyRequests = async () => {
    const { data } = await supabase
      .from("material_delivery_requests")
      .select(`
        id,
        status,
        notes,
        created_at,
        project:projects(name)
      `)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20);

    if (data) {
      // Fetch items for each request
      const requestsWithItems = await Promise.all(
        data.map(async (request) => {
          const { data: items } = await supabase
            .from("material_delivery_items")
            .select(`
              id,
              quantity,
              material:materials(name, unit)
            `)
            .eq("request_id", request.id);
          return { ...request, items: items || [] };
        })
      );
      setMyRequests(requestsWithItems as DeliveryRequest[]);
    }
  };

  const handleSelectMaterial = (material: Material) => {
    const existing = selectedItems.find((i) => i.material.id === material.id);
    if (!existing) {
      setSelectedItems([...selectedItems, { material, quantity: 1 }]);
    }
    setSearchTerm("");
    setShowDropdown(false);
  };

  const handleCreateMaterial = async () => {
    if (!searchTerm.trim()) return;
    
    setIsCreatingMaterial(true);
    try {
      const { data, error } = await supabase
        .from("materials")
        .insert({
          name: searchTerm.trim(),
          unit: newMaterialUnit,
          cost_per_unit: 0,
        })
        .select()
        .single();

      if (error) throw error;

      const newMaterial: Material = {
        id: data.id,
        name: data.name,
        unit: data.unit,
        category: data.category,
      };

      setSelectedItems([...selectedItems, { material: newMaterial, quantity: 1 }]);
      setMaterials([...materials, newMaterial]);
      setSearchTerm("");
      setNewMaterialUnit("units");
      setShowDropdown(false);

      toast({
        title: "Material Created",
        description: `"${newMaterial.name}" has been added to the catalog`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create material",
        variant: "destructive",
      });
    } finally {
      setIsCreatingMaterial(false);
    }
  };

  const handleUpdateQuantity = (materialId: string, quantity: number) => {
    setSelectedItems(
      selectedItems.map((item) =>
        item.material.id === materialId
          ? { ...item, quantity: Math.max(0.1, quantity) }
          : item
      )
    );
  };

  const handleRemoveItem = (materialId: string) => {
    setSelectedItems(selectedItems.filter((i) => i.material.id !== materialId));
  };

  const handleSubmit = async () => {
    if (!projectId || !userId) {
      toast({
        title: "Error",
        description: "Please select a project first",
        variant: "destructive",
      });
      return;
    }

    if (selectedItems.length === 0) {
      toast({
        title: "Error",
        description: "Please add at least one material",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      // Create the delivery request
      const { data: request, error: requestError } = await supabase
        .from("material_delivery_requests")
        .insert({
          project_id: projectId,
          user_id: userId,
          notes: notes || null,
        })
        .select()
        .single();

      if (requestError) throw requestError;

      // Add items to the request
      const items = selectedItems.map((item) => ({
        request_id: request.id,
        material_id: item.material.id,
        quantity: item.quantity,
      }));

      const { error: itemsError } = await supabase
        .from("material_delivery_items")
        .insert(items);

      if (itemsError) throw itemsError;

      toast({
        title: "Request Submitted",
        description: `Material delivery request with ${selectedItems.length} item(s) has been submitted`,
      });

      // Reset form
      setSelectedItems([]);
      setNotes("");
      setSearchTerm("");
      fetchMyRequests();
      setActiveTab("history");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to submit request",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            Request Material Delivery
          </DialogTitle>
          <DialogDescription>
            {projectName && `Project: ${projectName}`}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="request">New Request</TabsTrigger>
            <TabsTrigger value="history">My Requests</TabsTrigger>
          </TabsList>

          <TabsContent value="request" className="flex-1 overflow-hidden flex flex-col space-y-4 mt-4">
            {/* Search Materials */}
            <div className="relative">
              <Label>Search Materials</Label>
              <div className="relative mt-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Start typing material name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              {(showDropdown || (searchTerm.length > 0 && filteredMaterials.length === 0)) && (
                <div className="absolute z-50 w-full mt-1 bg-background border rounded-md shadow-lg max-h-64 overflow-auto">
                  {filteredMaterials.map((material) => (
                    <button
                      key={material.id}
                      className="w-full px-4 py-2 text-left hover:bg-muted flex justify-between items-center"
                      onClick={() => handleSelectMaterial(material)}
                    >
                      <span>{material.name}</span>
                      <span className="text-sm text-muted-foreground">
                        {material.unit}
                      </span>
                    </button>
                  ))}
                  {searchTerm.length > 0 && (
                    <div className="border-t p-3 space-y-2">
                      <p className="text-sm text-muted-foreground">
                        {filteredMaterials.length === 0
                          ? `No materials found for "${searchTerm}"`
                          : "Or create new:"}
                      </p>
                      <div className="flex gap-2">
                        <select
                          value={newMaterialUnit}
                          onChange={(e) => setNewMaterialUnit(e.target.value)}
                          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                        >
                          <option value="units">units</option>
                          <option value="kg">kg</option>
                          <option value="liters">liters</option>
                          <option value="meters">meters</option>
                          <option value="pieces">pieces</option>
                          <option value="bags">bags</option>
                          <option value="boxes">boxes</option>
                          <option value="rolls">rolls</option>
                          <option value="sheets">sheets</option>
                          <option value="sqm">sqm</option>
                        </select>
                        <Button
                          size="sm"
                          onClick={handleCreateMaterial}
                          disabled={isCreatingMaterial}
                          className="flex-1"
                        >
                          {isCreatingMaterial ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-1" />
                          ) : (
                            <PlusCircle className="h-4 w-4 mr-1" />
                          )}
                          Create "{searchTerm}"
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Selected Items */}
            <div className="flex-1 overflow-hidden">
              <Label>Materials to Request ({selectedItems.length})</Label>
              <ScrollArea className="h-[200px] border rounded-md mt-1 p-2">
                {selectedItems.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Search and add materials above
                  </p>
                ) : (
                  <div className="space-y-2">
                    {selectedItems.map((item) => (
                      <div
                        key={item.material.id}
                        className="flex items-center gap-2 p-2 bg-muted rounded-md"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{item.material.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {item.material.unit}
                          </p>
                        </div>
                        <Input
                          type="number"
                          min="0.1"
                          step="0.1"
                          value={item.quantity}
                          onChange={(e) =>
                            handleUpdateQuantity(
                              item.material.id,
                              parseFloat(e.target.value) || 0.1
                            )
                          }
                          className="w-20"
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveItem(item.material.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>

            {/* Notes */}
            <div>
              <Label>Notes (optional)</Label>
              <Textarea
                placeholder="Any additional notes..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="mt-1"
                rows={2}
              />
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={isLoading || selectedItems.length === 0}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Submit Request
              </Button>
            </DialogFooter>
          </TabsContent>

          <TabsContent value="history" className="flex-1 overflow-hidden mt-4">
            <ScrollArea className="h-[400px]">
              {myRequests.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No delivery requests yet
                </p>
              ) : (
                <div className="space-y-3">
                  {myRequests.map((request) => (
                    <div
                      key={request.id}
                      className="border rounded-lg p-3 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">
                            {format(new Date(request.created_at), "PPp")}
                          </span>
                        </div>
                        {getStatusBadge(request.status)}
                      </div>
                      {request.project && (
                        <p className="text-sm text-muted-foreground">
                          Project: {request.project.name}
                        </p>
                      )}
                      <div className="text-sm">
                        <p className="font-medium mb-1">Materials:</p>
                        <ul className="list-disc list-inside space-y-0.5">
                          {request.items.map((item) => (
                            <li key={item.id} className="text-muted-foreground">
                              {item.material?.name} - {item.quantity}{" "}
                              {item.material?.unit}
                            </li>
                          ))}
                        </ul>
                      </div>
                      {request.notes && (
                        <p className="text-sm text-muted-foreground">
                          Notes: {request.notes}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default MaterialDeliveryDialog;
