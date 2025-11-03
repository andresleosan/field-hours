import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ExternalLink, Download } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";

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
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      fetchInvoices();
    }
  }, [open]);

  const fetchInvoices = async () => {
    setIsLoading(true);
    try {
      // Get invoices from last 60 days
      const sixtyDaysAgo = new Date();
      sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
      
      const { data, error } = await supabase
        .from("invoices")
        .select(`
          *,
          projects(name),
          suppliers(name)
        `)
        .gte("date", sixtyDaysAgo.toISOString().split('T')[0])
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

  const handleDownloadImage = async (imageUrl: string, invoiceNumber: string) => {
    try {
      const url = await getSignedUrl(imageUrl);
      if (!url) return;

      const response = await fetch(url);
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `invoice-${invoiceNumber}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);

      toast({
        title: "Download started",
        description: "Invoice image is being downloaded",
      });
    } catch (error) {
      console.error("Error downloading image:", error);
      toast({
        title: "Download failed",
        description: "Failed to download invoice image",
        variant: "destructive",
      });
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-7xl max-h-[90vh] w-[95vw]">
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
                <ScrollArea className="w-full whitespace-nowrap">
                  <TabsList className="inline-flex mb-4">
                    {projectsData.map((project) => (
                      <TabsTrigger key={project.projectName} value={project.projectName} className="text-xs sm:text-sm">
                        {project.projectName} (£{project.totalAmount.toFixed(2)})
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </ScrollArea>

                {projectsData.map((project) => (
                  <TabsContent key={project.projectName} value={project.projectName}>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="min-w-[100px]">Invoice #</TableHead>
                            <TableHead className="min-w-[100px]">Supplier</TableHead>
                            <TableHead className="min-w-[100px]">Date</TableHead>
                            <TableHead className="min-w-[80px]">Amount</TableHead>
                            <TableHead className="min-w-[100px]">Uploaded By</TableHead>
                            <TableHead className="min-w-[120px]">Notes</TableHead>
                            <TableHead className="min-w-[100px]">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {project.invoices.map((invoice) => (
                            <TableRow key={invoice.id}>
                              <TableCell className="font-medium">{invoice.invoice_number}</TableCell>
                              <TableCell>{invoice.suppliers?.name || "—"}</TableCell>
                              <TableCell>{new Date(invoice.date).toLocaleDateString()}</TableCell>
                              <TableCell className="font-semibold">
                                £{Number(invoice.total_amount).toFixed(2)}
                              </TableCell>
                              <TableCell>{invoice.profiles.full_name}</TableCell>
                              <TableCell>{invoice.notes || "—"}</TableCell>
                              <TableCell>
                                {invoice.image_url && (
                                  <div className="flex gap-1">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleViewImage(invoice.image_url!)}
                                    >
                                      <ExternalLink className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleDownloadImage(invoice.image_url!, invoice.invoice_number)}
                                    >
                                      <Download className="h-4 w-4" />
                                    </Button>
                                  </div>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </TabsContent>
                ))}
              </Tabs>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {selectedImage && (
        <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
          <DialogContent className="max-w-4xl w-[95vw]">
            <DialogHeader>
              <DialogTitle>Invoice Image</DialogTitle>
            </DialogHeader>
            <ScrollArea className="max-h-[70vh]">
              <img src={selectedImage} alt="Invoice" className="w-full h-auto" />
            </ScrollArea>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
};

export default InvoicesDetailDialog;
