import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus } from "lucide-react";

interface EditJobDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  job: {
    id: string;
    title: string;
    description: string | null;
    section?: string | null;
    project_id: string;
  } | null;
  onJobUpdated: () => void;
}

export const EditJobDialog = ({ open, onOpenChange, job, onJobUpdated }: EditJobDialogProps) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [section, setSection] = useState("");
  const [newSection, setNewSection] = useState("");
  const [showNewSection, setShowNewSection] = useState(false);
  const [existingSections, setExistingSections] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (job) {
      setTitle(job.title);
      setDescription(job.description || "");
      setSection(job.section || "");
      fetchExistingSections();
    }
  }, [job]);

  const fetchExistingSections = async () => {
    if (!job?.project_id) return;
    
    const { data } = await supabase
      .from("jobs")
      .select("section")
      .eq("project_id", job.project_id)
      .not("section", "is", null);
    
    if (data) {
      const uniqueSections = [...new Set(data.map(j => j.section).filter(Boolean))] as string[];
      setExistingSections(uniqueSections.sort());
    }
  };

  const handleAddNewSection = () => {
    if (newSection.trim()) {
      setSection(newSection.trim());
      if (!existingSections.includes(newSection.trim())) {
        setExistingSections(prev => [...prev, newSection.trim()].sort());
      }
      setNewSection("");
      setShowNewSection(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast({
        title: "Error",
        description: "Please enter a job title",
        variant: "destructive",
      });
      return;
    }

    if (!job) return;

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from("jobs")
        .update({
          title,
          description,
          section: section || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", job.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Job updated successfully",
      });

      onJobUpdated();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update job",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit Job</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-title">Job Title *</Label>
            <Input
              id="edit-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Install kitchen cabinets"
              disabled={isLoading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-section">Section</Label>
            {!showNewSection ? (
              <div className="flex gap-2">
                <Select value={section || "__none__"} onValueChange={(val) => setSection(val === "__none__" ? "" : val)}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select or create a section" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">No section</SelectItem>
                    {existingSections.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setShowNewSection(true)}
                  disabled={isLoading}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Input
                  value={newSection}
                  onChange={(e) => setNewSection(e.target.value)}
                  placeholder="Enter new section name"
                  disabled={isLoading}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddNewSection())}
                />
                <Button type="button" variant="outline" onClick={handleAddNewSection} disabled={isLoading}>
                  Add
                </Button>
                <Button type="button" variant="ghost" onClick={() => setShowNewSection(false)} disabled={isLoading}>
                  Cancel
                </Button>
              </div>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-description">Description</Label>
            <Textarea
              id="edit-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what needs to be done..."
              rows={4}
              disabled={isLoading}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};