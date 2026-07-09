import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Package, Wrench, ClipboardList, Undo2 } from "lucide-react";
import { useRequireRole } from "@/hooks/useRequireRole";
import { AppShell, PageLoader } from "@/components/layout/AppShell";
import StorageMaterialsTab from "@/components/storage/StorageMaterialsTab";
import StorageToolsTab from "@/components/storage/StorageToolsTab";
import ToolCheckoutsTab from "@/components/storage/ToolCheckoutsTab";
import ToolRequestsManagement from "@/components/storage/ToolRequestsManagement";

const Storage = () => {
  const { userId, fullName, isLoading } = useRequireRole("manager");

  if (isLoading) {
    return <PageLoader />;
  }

  return (
    <AppShell role="manager" fullName={fullName}>
      <section className="space-y-1">
        <h1 className="text-2xl font-bold">Storage</h1>
        <p className="text-sm text-muted-foreground">Materials and tools inventory</p>
      </section>

      <Tabs defaultValue="materials" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 md:inline-grid md:w-fit">
          <TabsTrigger value="materials" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            <span className="hidden sm:inline">Materials</span>
          </TabsTrigger>
          <TabsTrigger value="tools" className="flex items-center gap-2">
            <Wrench className="h-4 w-4" />
            <span className="hidden sm:inline">Tools</span>
          </TabsTrigger>
          <TabsTrigger value="requests" className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4" />
            <span className="hidden sm:inline">Requests</span>
          </TabsTrigger>
          <TabsTrigger value="checkouts" className="flex items-center gap-2">
            <Undo2 className="h-4 w-4" />
            <span className="hidden sm:inline">Checkouts</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="materials">{userId && <StorageMaterialsTab userId={userId} />}</TabsContent>

        <TabsContent value="tools">{userId && <StorageToolsTab userId={userId} />}</TabsContent>

        <TabsContent value="requests">
          <ToolRequestsManagement />
        </TabsContent>

        <TabsContent value="checkouts">
          <ToolCheckoutsTab />
        </TabsContent>
      </Tabs>
    </AppShell>
  );
};

export default Storage;
