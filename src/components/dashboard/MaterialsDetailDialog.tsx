import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Pencil, Trash2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Material {
  id: string;
  name: string;
  unit: string;
  category: string | null;
  cost_per_unit: number;
  created_at: string;
}

interface MaterialsDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const MaterialsDetailDialog = ({ open, onOpenChange }: MaterialsDetailDialogProps) => {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: "", unit: "", category: "", cost_per_unit: "" });
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      fetchMaterials();
    }
  }, [open]);

  const fetchMaterials = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("materials")
      .select("*")
      .order("name");

    if (!error && data) {
      setMaterials(data);
    }
    setIsLoading(false);
  };

  const handleEdit = (material: Material) => {
    setEditingId(material.id);
    setEditForm({
      name: material.name,
      unit: material.unit,
      category: material.category || "",
      cost_per_unit: material.cost_per_unit.toString(),
    });
  };

  const handleSave = async (id: string) => {
    const { error } = await supabase
      .from("materials")
      .update({
        name: editForm.name,
        unit: editForm.unit,
        category: editForm.category,
        cost_per_unit: parseFloat(editForm.cost_per_unit),
      })
      .eq("id", id);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to update material",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Updated",
        description: "Material updated successfully",
      });
      setEditingId(null);
      fetchMaterials();
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this material?")) return;

    const { error } = await supabase.from("materials").delete().eq("id", id);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to delete material",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Deleted",
        description: "Material deleted successfully",
      });
      fetchMaterials();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Materials Inventory</DialogTitle>
        </DialogHeader>

        <ScrollArea className="h-[600px]">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead>Cost per Unit</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {materials.map((material) => (
                  <TableRow key={material.id}>
                    {editingId === material.id ? (
                      <>
                        <TableCell>
                          <Input
                            value={editForm.name}
                            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={editForm.category}
                            onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={editForm.unit}
                            onChange={(e) => setEditForm({ ...editForm, unit: e.target.value })}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            step="0.01"
                            value={editForm.cost_per_unit}
                            onChange={(e) => setEditForm({ ...editForm, cost_per_unit: e.target.value })}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button size="sm" onClick={() => handleSave(material.id)}>
                              Save
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>
                              Cancel
                            </Button>
                          </div>
                        </TableCell>
                      </>
                    ) : (
                      <>
                        <TableCell className="font-medium">{material.name}</TableCell>
                        <TableCell>{material.category || "-"}</TableCell>
                        <TableCell>{material.unit}</TableCell>
                        <TableCell>${material.cost_per_unit.toFixed(2)}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button size="sm" variant="ghost" onClick={() => handleEdit(material)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDelete(material.id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default MaterialsDetailDialog;
