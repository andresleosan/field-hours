import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ExternalLink } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Invoice {
  id: string;
  invoice_number: string;
  date: string;
  total_amount: number;
  notes: string | null;
  image_url: string | null;
  project_id: string;
  uploaded_by: string;
  profiles: { full_name: string };
  projects: { name: string };
  suppliers: { name: string } | null;
}

interface ProjectInvoiceData {
  projectName: string;
  invoices: Invoice[];
  totalAmount: number;
}

interface InvoicesDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const InvoicesDetailDialog = ({ open, onOpenChange }: InvoicesDetailDialogProps) => {
  const [projectsData, setProjectsData] = useState<ProjectInvoiceData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      fetchInvoices();
    }
  }, [open]);

  const fetchInvoices = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("invoices")
        .select(`
          *,
          projects(name),
          suppliers(name)
        `)
        .order("date", { ascending: false });

      if (error) {
        console.error("Error fetching invoices:", error);
        setIsLoading(false);
        return;
      }

      if (!data || data.length === 0) {
        setProjectsData([]);
        setIsLoading(false);
        return;
      }

      // Fetch all unique uploader profiles
      const uploaderIds = [...new Set(data.map(inv => inv.uploaded_by))];
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", uploaderIds);

      const profilesMap = new Map(profilesData?.map(p => [p.id, p.full_name]) || []);

      // Group by project
      const grouped = data.reduce((acc, invoice) => {
        const projectName = invoice.projects?.name || "Unknown Project";
        if (!acc[projectName]) {
          acc[projectName] = {
            projectName,
            invoices: [],
            totalAmount: 0,
          };
        }
        acc[projectName].invoices.push({
          ...invoice,
          profiles: { full_name: profilesMap.get(invoice.uploaded_by) || "Unknown" }
        });
        acc[projectName].totalAmount += Number(invoice.total_amount || 0);
        return acc;
      }, {} as Record<string, ProjectInvoiceData>);

      setProjectsData(Object.values(grouped));
    } catch (err) {
      console.error("Error in fetchInvoices:", err);
    }
    setIsLoading(false);
  };

  const getSignedUrl = async (path: string) => {
    const { data } = await supabase.storage.from("invoices").createSignedUrl(path, 3600);
    return data?.signedUrl;
  };

  const handleViewImage = async (imageUrl: string) => {
    const url = await getSignedUrl(imageUrl);
    if (url) {
      setSelectedImage(url);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-7xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Invoices Details</DialogTitle>
          </DialogHeader>

          <ScrollArea className="h-[600px]">
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : (
              <Tabs defaultValue={projectsData[0]?.projectName || "all"}>
                <TabsList className="grid grid-cols-auto">
                  {projectsData.map((project) => (
                    <TabsTrigger key={project.projectName} value={project.projectName}>
                      {project.projectName} (${project.totalAmount.toFixed(2)})
                    </TabsTrigger>
                  ))}
                </TabsList>

                {projectsData.map((project) => (
                  <TabsContent key={project.projectName} value={project.projectName}>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Invoice #</TableHead>
                          <TableHead>Supplier</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>Uploaded By</TableHead>
                          <TableHead>Notes</TableHead>
                          <TableHead>Image</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {project.invoices.map((invoice) => (
                          <TableRow key={invoice.id}>
                            <TableCell className="font-medium">{invoice.invoice_number}</TableCell>
                            <TableCell>{invoice.suppliers?.name || "—"}</TableCell>
                            <TableCell>{new Date(invoice.date).toLocaleDateString()}</TableCell>
                            <TableCell className="font-semibold">
                              ${Number(invoice.total_amount).toFixed(2)}
                            </TableCell>
                            <TableCell>{invoice.profiles.full_name}</TableCell>
                            <TableCell>{invoice.notes || "—"}</TableCell>
                            <TableCell>
                              {invoice.image_url && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleViewImage(invoice.image_url!)}
                                >
                                  <ExternalLink className="h-4 w-4" />
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TabsContent>
                ))}
              </Tabs>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {selectedImage && (
        <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>Invoice Image</DialogTitle>
            </DialogHeader>
            <img src={selectedImage} alt="Invoice" className="w-full h-auto" />
          </DialogContent>
        </Dialog>
      )}
    </>
  );
};

export default InvoicesDetailDialog;
