import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Upload, Loader2, FileSpreadsheet, Trash2, Edit2 } from "lucide-react";
import * as XLSX from "xlsx";

interface BulkJobUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  onJobsCreated: () => void;
}

interface ExtractedJob {
  title: string;
  description?: string;
  selected: boolean;
}

export const BulkJobUploadDialog = ({ open, onOpenChange, projectId, onJobsCreated }: BulkJobUploadDialogProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractedJobs, setExtractedJobs] = useState<ExtractedJob[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const { toast } = useToast();

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsExtracting(true);
    setExtractedJobs([]);

    try {
      // Read Excel file
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: "array" });
      
      // Convert all sheets to text
      let content = "";
      for (const sheetName of workbook.SheetNames) {
        const worksheet = workbook.Sheets[sheetName];
        const csv = XLSX.utils.sheet_to_csv(worksheet);
        content += `Sheet: ${sheetName}\n${csv}\n\n`;
      }

      console.log("Excel content extracted, sending to AI...");

      // Send to AI for extraction
      const { data, error } = await supabase.functions.invoke("extract-jobs-from-excel", {
        body: { excelContent: content }
      });

      if (error) throw error;

      if (data.jobs && data.jobs.length > 0) {
        setExtractedJobs(data.jobs.map((job: { title: string; description?: string }) => ({
          ...job,
          selected: true
        })));
        toast({
          title: "Jobs Extracted",
          description: `Found ${data.jobs.length} jobs in the Excel file`,
        });
      } else {
        toast({
          title: "No Jobs Found",
          description: "Could not extract any jobs from the Excel file. Please check the format.",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error("Error processing Excel:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to process Excel file",
        variant: "destructive",
      });
    } finally {
      setIsExtracting(false);
      // Reset the file input
      e.target.value = "";
    }
  };

  const toggleJobSelection = (index: number) => {
    setExtractedJobs(prev => prev.map((job, i) => 
      i === index ? { ...job, selected: !job.selected } : job
    ));
  };

  const toggleSelectAll = () => {
    const allSelected = extractedJobs.every(job => job.selected);
    setExtractedJobs(prev => prev.map(job => ({ ...job, selected: !allSelected })));
  };

  const updateJob = (index: number, field: "title" | "description", value: string) => {
    setExtractedJobs(prev => prev.map((job, i) => 
      i === index ? { ...job, [field]: value } : job
    ));
  };

  const removeJob = (index: number) => {
    setExtractedJobs(prev => prev.filter((_, i) => i !== index));
  };

  const handleCreateJobs = async () => {
    const selectedJobs = extractedJobs.filter(job => job.selected && job.title.trim());
    
    if (selectedJobs.length === 0) {
      toast({
        title: "Error",
        description: "Please select at least one job to create",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Not authenticated");

      // Create all selected jobs
      const jobsToInsert = selectedJobs.map(job => ({
        title: job.title.trim(),
        description: job.description?.trim() || null,
        project_id: projectId,
        created_by: userData.user.id,
        status: "approved",
      }));

      const { error } = await supabase
        .from("jobs")
        .insert(jobsToInsert);

      if (error) throw error;

      toast({
        title: "Success",
        description: `Created ${selectedJobs.length} jobs successfully`,
      });

      setExtractedJobs([]);
      onJobsCreated();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create jobs",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const selectedCount = extractedJobs.filter(job => job.selected).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Bulk Job Creation from Excel
          </DialogTitle>
          <DialogDescription>
            Upload an Excel file and AI will automatically extract job titles and descriptions.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          {/* File Upload */}
          <div className="space-y-2">
            <Label>Upload Excel File</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => document.getElementById("excel-upload")?.click()}
                disabled={isExtracting || isLoading}
                className="flex-1"
              >
                {isExtracting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Extracting Jobs...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Select Excel File (.xlsx, .xls)
                  </>
                )}
              </Button>
              <input
                id="excel-upload"
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={handleFileSelect}
              />
            </div>
          </div>

          {/* Extracted Jobs List */}
          {extractedJobs.length > 0 && (
            <div className="flex-1 overflow-hidden flex flex-col space-y-2">
              <div className="flex items-center justify-between">
                <Label>Extracted Jobs ({selectedCount}/{extractedJobs.length} selected)</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={toggleSelectAll}
                >
                  {extractedJobs.every(job => job.selected) ? "Deselect All" : "Select All"}
                </Button>
              </div>
              
              <ScrollArea className="flex-1 border rounded-md p-2">
                <div className="space-y-2">
                  {extractedJobs.map((job, index) => (
                    <div
                      key={index}
                      className={`p-3 rounded-lg border ${job.selected ? "bg-accent/50" : "bg-muted/30"}`}
                    >
                      <div className="flex items-start gap-3">
                        <Checkbox
                          checked={job.selected}
                          onCheckedChange={() => toggleJobSelection(index)}
                          className="mt-1"
                        />
                        <div className="flex-1 space-y-2">
                          {editingIndex === index ? (
                            <>
                              <Input
                                value={job.title}
                                onChange={(e) => updateJob(index, "title", e.target.value)}
                                placeholder="Job title"
                                className="h-8"
                              />
                              <Input
                                value={job.description || ""}
                                onChange={(e) => updateJob(index, "description", e.target.value)}
                                placeholder="Description (optional)"
                                className="h-8"
                              />
                            </>
                          ) : (
                            <>
                              <p className="font-medium">{job.title}</p>
                              {job.description && (
                                <p className="text-sm text-muted-foreground">{job.description}</p>
                              )}
                            </>
                          )}
                        </div>
                        <div className="flex gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setEditingIndex(editingIndex === index ? null : index)}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            onClick={() => removeJob(index)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button 
            type="button" 
            variant="outline" 
            onClick={() => {
              setExtractedJobs([]);
              onOpenChange(false);
            }} 
            disabled={isLoading}
          >
            Cancel
          </Button>
          {extractedJobs.length > 0 && (
            <Button 
              onClick={handleCreateJobs} 
              disabled={isLoading || selectedCount === 0}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                `Create ${selectedCount} Jobs`
              )}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
