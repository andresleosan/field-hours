import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Building2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface SupplierManagementProps {
  userId: string;
}

interface Supplier {
  id: string;
  name: string;
  created_at: string;
}

const SupplierManagement = ({ userId }: SupplierManagementProps) => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [newSupplierName, setNewSupplierName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const fetchSuppliers = async () => {
    const { data, error } = await supabase
      .from("suppliers")
      .select("*")
      .order("name");

    if (!error && data) {
      setSuppliers(data);
    }
  };

  const handleAddSupplier = async () => {
    if (!newSupplierName.trim()) {
      toast({
        title: "Enter supplier name",
        description: "Please enter a supplier name",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from("suppliers")
        .insert({
          name: newSupplierName.trim(),
          created_by: userId,
        });

      if (error) throw error;

      toast({
        title: "Supplier added",
        description: `${newSupplierName} has been added successfully`,
      });

      setNewSupplierName("");
      await fetchSuppliers();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to add supplier",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteSupplier = async (supplierId: string, supplierName: string) => {
    try {
      const { error } = await supabase
        .from("suppliers")
        .delete()
        .eq("id", supplierId);

      if (error) throw error;

      toast({
        title: "Supplier deleted",
        description: `${supplierName} has been removed`,
      });

      await fetchSuppliers();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete supplier",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <Label htmlFor="supplier_name">Add New Supplier</Label>
        <div className="flex gap-2">
          <Input
            id="supplier_name"
            value={newSupplierName}
            onChange={(e) => setNewSupplierName(e.target.value)}
            placeholder="Enter supplier name"
            disabled={isLoading}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleAddSupplier();
              }
            }}
          />
          <Button onClick={handleAddSupplier} disabled={isLoading}>
            <Plus className="h-4 w-4 mr-2" />
            Add
          </Button>
        </div>
      </div>

      <div>
        <Label className="mb-3 block">Existing Suppliers</Label>
        <ScrollArea className="h-[300px] border rounded-md p-4">
          {suppliers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Building2 className="h-12 w-12 text-muted-foreground mb-2" />
              <p className="text-muted-foreground">No suppliers yet</p>
              <p className="text-sm text-muted-foreground">Add your first supplier above</p>
            </div>
          ) : (
            <div className="space-y-2">
              {suppliers.map((supplier) => (
                <div
                  key={supplier.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{supplier.name}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteSupplier(supplier.id, supplier.name)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      <div className="p-4 bg-muted rounded-lg">
        <p className="text-sm text-muted-foreground">
          <strong>Note:</strong> Suppliers are used when uploading invoices. The AI will learn to extract
          data from invoices based on the supplier selected. Add all your suppliers here to improve
          invoice processing accuracy.
        </p>
      </div>
    </div>
  );
};

export default SupplierManagement;
