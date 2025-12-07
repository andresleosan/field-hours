import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Search, Trash2, Eye } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { z } from "zod";

interface EnhancedMaterialDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  userId: string;
  userRole?: string;
}

interface Material {
  id: string;
  name: string;
  unit: string;
  category: string | null;
  cost_per_unit: number;
}

interface MaterialUsageLog {
  id: string;
  material_id: string;
  quantity_used: number;
  date: string;
  notes: string | null;
  materials: Material;
}

const EnhancedMaterialDialog = ({ open, onOpenChange, projectId, userId, userRole }: EnhancedMaterialDialogProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredMaterials, setFilteredMaterials] = useState<Material[]>([]);
  const [materialLogs, setMaterialLogs] = useState<MaterialUsageLog[]>([]);
  const [activeTab, setActiveTab] = useState("log");
  
  const [logFormData, setLogFormData] = useState({
    material_id: "",
    quantity_used: "",
    notes: "",
  });

  const [createFormData, setCreateFormData] = useState({
    name: "",
    category: "",
    unit: "",
    cost_per_unit: "",
  });

  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      fetchMaterials();
      fetchMaterialLogs();
    }
  }, [open, projectId]);

  useEffect(() => {
    if (searchTerm) {
      const filtered = materials.filter(m =>
        m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (m.category && m.category.toLowerCase().includes(searchTerm.toLowerCase()))
      );
      setFilteredMaterials(filtered);
    } else {
      setFilteredMaterials(materials);
    }
  }, [searchTerm, materials]);

  const fetchMaterials = async () => {
    const { data, error } = await supabase
      .from("materials")
      .select("*")
      .order("name");

    if (!error && data) {
      setMaterials(data);
      setFilteredMaterials(data);
    }
  };

  const fetchMaterialLogs = async () => {
    // Only fetch materials that haven't been linked to a job yet (job_id is NULL)
    // Once materials are submitted with a job, they won't appear here anymore
    const { data, error } = await supabase
      .from("material_usage")
      .select(`
        *,
        materials (*)
      `)
      .eq("project_id", projectId)
      .eq("used_by", userId)
      .is("job_id", null)
      .order("date", { ascending: false });

    if (!error && data) {
      setMaterialLogs(data as any);
    }
  };

  const handleLogMaterial = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate usage input
    const usageSchema = z.object({
      material_id: z.string().uuid("Please select a material"),
      quantity_used: z.string().refine((val) => {
        const num = parseFloat(val);
        return !isNaN(num) && num > 0 && num <= 999999;
      }, "Quantity must be a positive number"),
      notes: z.string().max(500, "Notes too long").optional().or(z.literal("")),
    });

    try {
      usageSchema.parse(logFormData);
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({
          title: "Validation Error",
          description: error.errors[0].message,
          variant: "destructive",
        });
        return;
      }
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.from("material_usage").insert({
        project_id: projectId,
        material_id: logFormData.material_id,
        quantity_used: parseFloat(logFormData.quantity_used),
        notes: logFormData.notes,
        used_by: userId,
        date: new Date().toISOString().split("T")[0],
      });

      if (error) throw error;

      toast({
        title: "Material logged",
        description: "Material usage has been recorded successfully",
      });

      setLogFormData({
        material_id: "",
        quantity_used: "",
        notes: "",
      });
      setSearchTerm("");
      fetchMaterialLogs();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to log material usage",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateMaterial = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate material creation input
    const materialSchema = z.object({
      name: z.string().trim().min(1, "Name is required").max(100, "Name too long"),
      category: z.string().trim().max(50, "Category too long").optional().or(z.literal("")),
      unit: z.string().trim().min(1, "Unit is required").max(20, "Unit too long"),
      cost_per_unit: z.string().refine((val) => {
        if (!val) return true; // Optional field
        const num = parseFloat(val);
        return !isNaN(num) && num >= 0 && num <= 999999.99;
      }, "Cost must be a valid positive number"),
    });

    try {
      materialSchema.parse(createFormData);
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({
          title: "Validation Error",
          description: error.errors[0].message,
          variant: "destructive",
        });
        return;
      }
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.from("materials").insert({
        name: createFormData.name,
        category: createFormData.category,
        unit: createFormData.unit,
        cost_per_unit: parseFloat(createFormData.cost_per_unit) || 0,
      });

      if (error) throw error;

      toast({
        title: "Material created",
        description: "New material has been added successfully",
      });

      setCreateFormData({
        name: "",
        category: "",
        unit: "",
        cost_per_unit: "",
      });
      fetchMaterials();
      setActiveTab("log");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create material",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteLog = async (logId: string) => {
    const { error } = await supabase
      .from("material_usage")
      .delete()
      .eq("id", logId);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to delete material log",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Deleted",
        description: "Material log has been removed",
      });
      fetchMaterialLogs();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] h-[85vh] max-h-[85vh] flex flex-col p-0">
        <div className="px-6 pt-6 flex-shrink-0">
          <DialogHeader>
            <DialogTitle>Material Management</DialogTitle>
            <DialogDescription>Log material usage, create new materials, or review logs</DialogDescription>
          </DialogHeader>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
          <div className="px-6 flex-shrink-0">
            <TabsList className="grid w-full grid-cols-3 mt-4">
              <TabsTrigger value="log">Log Material</TabsTrigger>
              <TabsTrigger value="create">Create New</TabsTrigger>
              <TabsTrigger value="view">View Logs</TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 overflow-y-auto px-6 pb-6">
            <TabsContent value="log" className="space-y-4 mt-4 m-0">
              <form onSubmit={handleLogMaterial} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="search">Search Material</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="search"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Type to search materials..."
                      className="pl-10"
                      disabled={isLoading}
                    />
                  </div>
                </div>

                <div className="h-[180px] border rounded-md overflow-y-auto p-2">
                  {filteredMaterials.length === 0 ? (
                    <div className="text-center text-muted-foreground py-8">
                      <p>No materials found</p>
                    </div>
                  ) : (
                    filteredMaterials.map((material) => (
                      <Card
                        key={material.id}
                        className={`p-3 mb-2 cursor-pointer hover:bg-accent ${
                          logFormData.material_id === material.id ? "bg-accent" : ""
                        }`}
                        onClick={() => setLogFormData({ ...logFormData, material_id: material.id })}
                      >
                        <div className="font-medium">{material.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {material.category && `${material.category} • `}Unit: {material.unit}
                        </div>
                      </Card>
                    ))
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="quantity">Quantity Used *</Label>
                  <Input
                    id="quantity"
                    type="number"
                    step="0.01"
                    value={logFormData.quantity_used}
                    onChange={(e) => setLogFormData({ ...logFormData, quantity_used: e.target.value })}
                    placeholder="0.00"
                    disabled={isLoading}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    value={logFormData.notes}
                    onChange={(e) => setLogFormData({ ...logFormData, notes: e.target.value })}
                    placeholder="Optional notes..."
                    disabled={isLoading}
                    rows={2}
                  />
                </div>

                <DialogFooter className="pt-4">
                  <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isLoading || !logFormData.material_id}>
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Log Material
                  </Button>
                </DialogFooter>
              </form>
            </TabsContent>

            <TabsContent value="create" className="space-y-4 mt-4 m-0">
              <form onSubmit={handleCreateMaterial} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="material_name">Material Name *</Label>
                  <Input
                    id="material_name"
                    value={createFormData.name}
                    onChange={(e) => setCreateFormData({ ...createFormData, name: e.target.value })}
                    placeholder="e.g., 2x4 Lumber"
                    disabled={isLoading}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Input
                    id="category"
                    value={createFormData.category}
                    onChange={(e) => setCreateFormData({ ...createFormData, category: e.target.value })}
                    placeholder="e.g., Wood, Hardware, Concrete"
                    disabled={isLoading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="unit">Unit *</Label>
                  <Input
                    id="unit"
                    value={createFormData.unit}
                    onChange={(e) => setCreateFormData({ ...createFormData, unit: e.target.value })}
                    placeholder="e.g., pcs, ft, lbs"
                    disabled={isLoading}
                    required
                  />
                </div>

                {userRole === 'manager' && (
                  <div className="space-y-2">
                    <Label htmlFor="cost_per_unit">Cost per Unit (£)</Label>
                    <Input
                      id="cost_per_unit"
                      type="number"
                      step="0.01"
                      value={createFormData.cost_per_unit}
                      onChange={(e) => setCreateFormData({ ...createFormData, cost_per_unit: e.target.value })}
                      placeholder="0.00"
                      disabled={isLoading}
                    />
                  </div>
                )}

                <DialogFooter className="pt-4">
                  <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isLoading}>
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    <Plus className="mr-2 h-4 w-4" />
                    Create Material
                  </Button>
                </DialogFooter>
              </form>
            </TabsContent>

            <TabsContent value="view" className="space-y-4 mt-4 m-0 pb-6">
              {materialLogs.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  <Eye className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No materials logged yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {materialLogs.map((log) => (
                    <Card key={log.id} className="p-4">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="font-medium">{log.materials.name}</div>
                          <div className="text-sm text-muted-foreground">
                            Quantity: {log.quantity_used} {log.materials.unit}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Date: {new Date(log.date).toLocaleDateString()}
                          </div>
                          {log.notes && (
                            <div className="text-sm text-muted-foreground mt-1">
                              Note: {log.notes}
                            </div>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteLog(log.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default EnhancedMaterialDialog;
