import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, FileText, Upload, Trash2, ExternalLink, Users } from "lucide-react";
import { format } from "date-fns";

interface Project {
  id: string;
  name: string;
}

interface RiskAssessment {
  id: string;
  title: string;
  pdf_url: string;
  created_at: string;
  project_id: string;
  project_name?: string;
  signature_count?: number;
}

interface ManagerRiskAssessmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
}

const ManagerRiskAssessmentDialog = ({ open, onOpenChange, userId }: ManagerRiskAssessmentDialogProps) => {
  const [assessments, setAssessments] = useState<RiskAssessment[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  
  const [title, setTitle] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      fetchData();
    }
  }, [open]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Fetch active projects
      const { data: projectsData, error: projectsError } = await supabase
        .from("projects")
        .select("id, name")
        .eq("status", "active")
        .order("name");

      if (projectsError) throw projectsError;
      setProjects(projectsData || []);

      // Fetch all risk assessments with project names
      const { data: assessmentsData, error: assessmentsError } = await supabase
        .from("risk_assessments")
        .select(`
          *,
          projects:project_id (name)
        `)
        .order("created_at", { ascending: false });

      if (assessmentsError) throw assessmentsError;

      // Fetch signature counts
      const { data: signaturesData, error: signaturesError } = await supabase
        .from("risk_assessment_signatures")
        .select("risk_assessment_id");

      if (signaturesError) throw signaturesError;

      // Count signatures per assessment
      const signatureCounts = new Map<string, number>();
      signaturesData?.forEach(sig => {
        const count = signatureCounts.get(sig.risk_assessment_id) || 0;
        signatureCounts.set(sig.risk_assessment_id, count + 1);
      });

      const mergedAssessments = assessmentsData?.map(assessment => ({
        ...assessment,
        project_name: (assessment.projects as any)?.name || "Unknown",
        signature_count: signatureCounts.get(assessment.id) || 0,
      })) || [];

      setAssessments(mergedAssessments);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to load data",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpload = async () => {
    if (!title.trim() || !selectedProjectId || !file) {
      toast({
        title: "Missing fields",
        description: "Please fill in all fields and select a PDF file",
        variant: "destructive",
      });
      return;
    }

    if (file.type !== "application/pdf") {
      toast({
        title: "Invalid file",
        description: "Please select a PDF file",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    try {
      // Upload file to storage
      const fileExt = "pdf";
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `risk-assessments/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("documents")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("documents")
        .getPublicUrl(filePath);

      // Create risk assessment record
      const { error: insertError } = await supabase
        .from("risk_assessments")
        .insert({
          title: title.trim(),
          project_id: selectedProjectId,
          pdf_url: urlData.publicUrl,
          uploaded_by: userId,
        });

      if (insertError) throw insertError;

      toast({
        title: "Uploaded",
        description: "Risk assessment uploaded successfully",
      });

      // Reset form and refresh
      setTitle("");
      setSelectedProjectId("");
      setFile(null);
      fetchData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to upload risk assessment",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      const { error } = await supabase
        .from("risk_assessments")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Deleted",
        description: "Risk assessment deleted",
      });

      setAssessments(prev => prev.filter(a => a.id !== id));
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete",
        variant: "destructive",
      });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Risk Assessments
          </DialogTitle>
        </DialogHeader>

        {/* Upload Form */}
        <div className="border rounded-lg p-4 space-y-4 bg-muted/30">
          <h3 className="font-medium text-sm">Upload New Assessment</h3>
          
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Site Safety Assessment"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="project">Project</Label>
              <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select project" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="pdf">PDF Document</Label>
            <Input
              id="pdf"
              type="file"
              accept=".pdf"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
          </div>

          <Button onClick={handleUpload} disabled={isUploading} className="w-full sm:w-auto">
            {isUploading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Upload className="h-4 w-4 mr-2" />
            )}
            Upload Assessment
          </Button>
        </div>

        {/* List of Assessments */}
        <div className="space-y-3">
          <h3 className="font-medium text-sm">All Assessments</h3>
          
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : assessments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No risk assessments uploaded yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {assessments.map((assessment) => (
                <div
                  key={assessment.id}
                  className="border rounded-lg p-3 flex items-center justify-between gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-sm truncate">{assessment.title}</h4>
                    <p className="text-xs text-muted-foreground truncate">
                      {assessment.project_name} • {format(new Date(assessment.created_at), "dd MMM yyyy")}
                    </p>
                    <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                      <Users className="h-3 w-3" />
                      <span>{assessment.signature_count} signature(s)</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(assessment.pdf_url, "_blank")}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(assessment.id)}
                      disabled={deletingId === assessment.id}
                      className="text-destructive hover:text-destructive"
                    >
                      {deletingId === assessment.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ManagerRiskAssessmentDialog;
