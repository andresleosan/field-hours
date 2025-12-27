import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Loader2, Search, Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface StorageMaterial {
  id: string;
  name: string;
  category: string;
  section: string | null;
  quantity: number;
  unit: string;
  min_stock_level: number;
  notes: string | null;
  created_at: string;
}

interface StorageMaterialsTabProps {
  userId: string;
}

const CATEGORIES = ["Building Materials", "Electrical", "Plumbing", "Hardware", "Finishing", "Safety", "Other"];
const SECTIONS = ["Section A", "Section B", "Section C", "Section D", "Section E", "Outdoor Storage"];
const UNITS = ["units", "kg", "liters", "meters", "pieces", "bags", "boxes", "rolls", "sheets", "sqm", "pallets"];

const StorageMaterialsTab = ({ userId }: StorageMaterialsTabProps) => {
  const [materials, setMaterials] = useState<StorageMaterial[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<StorageMaterial | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [sectionFilter, setSectionFilter] = useState<string>("all");
  
  const [formData, setFormData] = useState({
    name: "",
    category: "Building Materials",
    section: "",
    quantity: 0,
    unit: "units",
    min_stock_level: 0,
    notes: "",
  });
  
  const { toast } = useToast();

  useEffect(() => {
    fetchMaterials();
  }, []);

  const fetchMaterials = async () => {
    const { data, error } = await supabase
      .from("storage_materials")
      .select("*")
      .order("category", { ascending: true })
      .order("name", { ascending: true });

    if (error) {
      toast({ title: "Error", description: "Failed to fetch materials", variant: "destructive" });
    } else {
      setMaterials(data || []);
    }
    setIsLoading(false);
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      toast({ title: "Error", description: "Material name is required", variant: "destructive" });
      return;
    }

    if (editingMaterial) {
      const { error } = await supabase
        .from("storage_materials")
        .update({
          name: formData.name,
          category: formData.category,
          section: formData.section || null,
          quantity: formData.quantity,
          unit: formData.unit,
          min_stock_level: formData.min_stock_level,
          notes: formData.notes || null,
        })
        .eq("id", editingMaterial.id);

      if (error) {
        toast({ title: "Error", description: "Failed to update material", variant: "destructive" });
      } else {
        toast({ title: "Success", description: "Material updated" });
        fetchMaterials();
        resetForm();
      }
    } else {
      const { error } = await supabase
        .from("storage_materials")
        .insert({
          name: formData.name,
          category: formData.category,
          section: formData.section || null,
          quantity: formData.quantity,
          unit: formData.unit,
          min_stock_level: formData.min_stock_level,
          notes: formData.notes || null,
          created_by: userId,
        });

      if (error) {
        toast({ title: "Error", description: "Failed to add material", variant: "destructive" });
      } else {
        toast({ title: "Success", description: "Material added to storage" });
        fetchMaterials();
        resetForm();
      }
    }
  };

  const handleEdit = (material: StorageMaterial) => {
    setEditingMaterial(material);
    setFormData({
      name: material.name,
      category: material.category,
      section: material.section || "",
      quantity: material.quantity,
      unit: material.unit,
      min_stock_level: material.min_stock_level,
      notes: material.notes || "",
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("storage_materials").delete().eq("id", id);
    if (error) {
      toast({ title: "Error", description: "Failed to delete material", variant: "destructive" });
    } else {
      toast({ title: "Success", description: "Material deleted" });
      fetchMaterials();
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      category: "Building Materials",
      section: "",
      quantity: 0,
      unit: "units",
      min_stock_level: 0,
      notes: "",
    });
    setEditingMaterial(null);
    setIsDialogOpen(false);
  };

  const filteredMaterials = materials.filter((m) => {
    const matchesSearch = m.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === "all" || m.category === categoryFilter;
    const matchesSection = sectionFilter === "all" || m.section === sectionFilter;
    return matchesSearch && matchesCategory && matchesSection;
  });

  const groupedMaterials = filteredMaterials.reduce((acc, material) => {
    const section = material.section || "Unassigned";
    if (!acc[section]) acc[section] = [];
    acc[section].push(material);
    return acc;
  }, {} as Record<string, StorageMaterial[]>);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Storage Materials
            </CardTitle>
            <Dialog open={isDialogOpen} onOpenChange={(open) => { if (!open) resetForm(); setIsDialogOpen(open); }}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Material
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>{editingMaterial ? "Edit Material" : "Add New Material"}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label>Name *</Label>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Material name"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Category</Label>
                      <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {CATEGORIES.map((c) => (
                            <SelectItem key={c} value={c}>{c}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Section</Label>
                      <Select value={formData.section} onValueChange={(v) => setFormData({ ...formData, section: v })}>
                        <SelectTrigger><SelectValue placeholder="Select section" /></SelectTrigger>
                        <SelectContent>
                          {SECTIONS.map((s) => (
                            <SelectItem key={s} value={s}>{s}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Quantity</Label>
                      <Input
                        type="number"
                        value={formData.quantity}
                        onChange={(e) => setFormData({ ...formData, quantity: Number(e.target.value) })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Unit</Label>
                      <Select value={formData.unit} onValueChange={(v) => setFormData({ ...formData, unit: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {UNITS.map((u) => (
                            <SelectItem key={u} value={u}>{u}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Min Stock</Label>
                      <Input
                        type="number"
                        value={formData.min_stock_level}
                        onChange={(e) => setFormData({ ...formData, min_stock_level: Number(e.target.value) })}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Notes</Label>
                    <Input
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      placeholder="Optional notes"
                    />
                  </div>
                  <div className="flex gap-2 pt-4">
                    <Button variant="outline" onClick={resetForm} className="flex-1">Cancel</Button>
                    <Button onClick={handleSubmit} className="flex-1">
                      {editingMaterial ? "Update" : "Add Material"}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search materials..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sectionFilter} onValueChange={setSectionFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Sections" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sections</SelectItem>
                {SECTIONS.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {Object.keys(groupedMaterials).length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No materials found</p>
          ) : (
            <div className="space-y-6">
              {Object.entries(groupedMaterials).map(([section, sectionMaterials]) => (
                <div key={section}>
                  <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                    <Badge variant="outline">{section}</Badge>
                    <span className="text-sm text-muted-foreground">({sectionMaterials.length} items)</span>
                  </h3>
                  <div className="rounded-lg border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Category</TableHead>
                          <TableHead className="text-right">Quantity</TableHead>
                          <TableHead className="text-right">Min Stock</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sectionMaterials.map((material) => (
                          <TableRow key={material.id}>
                            <TableCell className="font-medium">{material.name}</TableCell>
                            <TableCell>{material.category}</TableCell>
                            <TableCell className="text-right">
                              {material.quantity} {material.unit}
                            </TableCell>
                            <TableCell className="text-right">
                              {material.min_stock_level} {material.unit}
                            </TableCell>
                            <TableCell>
                              {material.quantity <= material.min_stock_level ? (
                                <Badge variant="destructive">Low Stock</Badge>
                              ) : (
                                <Badge variant="secondary">In Stock</Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button variant="ghost" size="icon" onClick={() => handleEdit(material)}>
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => handleDelete(material.id)}>
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default StorageMaterialsTab;
