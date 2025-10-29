import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface MaterialUsageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  userId: string;
  onMaterialsUpdated?: () => void;
}

interface Material {
  id: string;
  name: string;
  unit: string;
  category: string | null;
}

const MaterialUsageDialog = ({ open, onOpenChange, projectId, userId }: MaterialUsageDialogProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [formData, setFormData] = useState({
    material_id: "",
    quantity_used: "",
    notes: "",
  });
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      fetchMaterials();
    }
  }, [open]);

  const fetchMaterials = async () => {
    const { data, error } = await supabase
      .from("materials")
      .select("*")
      .order("name");

    if (error) {
      console.error("Error fetching materials:", error);
      return;
    }

    setMaterials(data || []);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.material_id || !formData.quantity_used) {
      toast({
        title: "Missing information",
        description: "Please select a material and enter quantity",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.from("material_usage").insert({
        project_id: projectId,
        material_id: formData.material_id,
        quantity_used: parseFloat(formData.quantity_used),
        used_by: userId,
        date: new Date().toISOString().split("T")[0],
        notes: formData.notes,
      });

      if (error) throw error;

      toast({
        title: "Material usage logged",
        description: "Successfully recorded material usage",
      });

      setFormData({ material_id: "", quantity_used: "", notes: "" });
      onOpenChange(false);
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Log Material Usage</DialogTitle>
          <DialogDescription>Record materials used on the project today</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="material">Material *</Label>
            <Select
              value={formData.material_id}
              onValueChange={(value) => setFormData({ ...formData, material_id: value })}
              disabled={isLoading}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a material" />
              </SelectTrigger>
              <SelectContent>
                {materials.map((material) => (
                  <SelectItem key={material.id} value={material.id}>
                    {material.name} ({material.unit})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="quantity">Quantity Used *</Label>
            <Input
              id="quantity"
              type="number"
              step="0.01"
              value={formData.quantity_used}
              onChange={(e) => setFormData({ ...formData, quantity_used: e.target.value })}
              placeholder="10.5"
              disabled={isLoading}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Additional notes..."
              disabled={isLoading}
              rows={3}
            />
          </div>

          <div className="flex gap-3 justify-end">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Log Usage
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default MaterialUsageDialog;
