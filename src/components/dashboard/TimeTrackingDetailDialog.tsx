import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, MapPin } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface TimeEntry {
  id: string;
  clock_in: string;
  clock_out: string | null;
  notes: string | null;
  user_id: string;
  project_id: string;
  location_lat: number | null;
  location_lng: number | null;
  profiles: { full_name: string };
  projects: { name: string };
}

interface DayData {
  day: string;
  date: string;
  totalHours: number;
  entries: TimeEntry[];
}

interface TimeTrackingDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const TimeTrackingDetailDialog = ({ open, onOpenChange }: TimeTrackingDetailDialogProps) => {
  const [weekData, setWeekData] = useState<DayData[]>([]);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (open) {
      fetchTimeData();
    }
  }, [open]);

  const fetchTimeData = async () => {
    setIsLoading(true);
    try {
      // Get data from last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const { data, error } = await supabase
        .from("time_tracking")
        .select(`
          *,
          projects(name)
        `)
        .not("clock_out", "is", null)
        .gte("clock_in", thirtyDaysAgo.toISOString())
        .order("clock_in", { ascending: false });

      if (error) {
        console.error("Error fetching time data:", error);
        setIsLoading(false);
        return;
      }

      if (!data || data.length === 0) {
        setWeekData([]);
        setIsLoading(false);
        return;
      }

      // Fetch all unique user profiles
      const userIds = [...new Set(data.map(entry => entry.user_id))];
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", userIds);

      const profilesMap = new Map(profilesData?.map(p => [p.id, p.full_name]) || []);

      // Group entries by date
      const dateGroups = new Map<string, TimeEntry[]>();
      
      data.forEach(entry => {
        const entryWithProfile = {
          ...entry,
          profiles: { full_name: profilesMap.get(entry.user_id) || "Unknown" }
        };
        const dateKey = new Date(entry.clock_in).toLocaleDateString();
        if (!dateGroups.has(dateKey)) {
          dateGroups.set(dateKey, []);
        }
        dateGroups.get(dateKey)!.push(entryWithProfile);
      });

      // Convert to array and calculate totals
      const weekDataArray: DayData[] = Array.from(dateGroups.entries())
        .map(([dateStr, entries]) => {
          const date = new Date(entries[0].clock_in);
          const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
          
          const totalHours = entries.reduce((sum, entry) => {
            if (entry.clock_out) {
              const hours = (new Date(entry.clock_out).getTime() - new Date(entry.clock_in).getTime()) / (1000 * 60 * 60);
              return sum + hours;
            }
            return sum;
          }, 0);

          return {
            day: `${dayName} ${dateStr}`,
            date: dateStr,
            totalHours,
            entries,
          };
        })
        .sort((a, b) => new Date(b.entries[0].clock_in).getTime() - new Date(a.entries[0].clock_in).getTime());

      setWeekData(weekDataArray);
      if (weekDataArray.length > 0) {
        setSelectedDay(weekDataArray[0].day);
      }
    } catch (err) {
      console.error("Error in fetchTimeData:", err);
    }
    setIsLoading(false);
  };

  const calculateDuration = (clockIn: string, clockOut: string | null) => {
    if (!clockOut) return "In Progress";
    const hours = (new Date(clockOut).getTime() - new Date(clockIn).getTime()) / (1000 * 60 * 60);
    return `${hours.toFixed(2)} hrs`;
  };

  const LocationLink = ({ lat, lng }: { lat: number | null; lng: number | null }) => {
    if (!lat || !lng) return <span className="text-muted-foreground">No location</span>;
    
    const mapsUrl = `https://maps.google.com/?q=${lat},${lng}`;
    
    return (
      <a
        href={mapsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1 text-primary hover:underline"
      >
        <MapPin className="h-3 w-3" />
        View Map
      </a>
    );
  };

  const selectedDayData = weekData.find(d => d.day === selectedDay);

  // Group by builder
  const builderData = selectedDayData?.entries.reduce((acc, entry) => {
    const builderName = entry.profiles.full_name;
    if (!acc[builderName]) {
      acc[builderName] = { entries: [], totalHours: 0 };
    }
    acc[builderName].entries.push(entry);
    if (entry.clock_out) {
      const hours = (new Date(entry.clock_out).getTime() - new Date(entry.clock_in).getTime()) / (1000 * 60 * 60);
      acc[builderName].totalHours += hours;
    }
    return acc;
  }, {} as Record<string, { entries: TimeEntry[], totalHours: number }>);

  // Group by project
  const projectData = selectedDayData?.entries.reduce((acc, entry) => {
    const projectName = entry.projects?.name || "Unknown Project";
    if (!acc[projectName]) {
      acc[projectName] = [];
    }
    acc[projectName].push(entry);
    return acc;
  }, {} as Record<string, TimeEntry[]>);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl max-h-[90vh] w-[95vw]">
        <DialogHeader>
          <DialogTitle>Time Tracking Details</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Day buttons */}
            <ScrollArea className="w-full whitespace-nowrap">
              <div className="flex gap-2 pb-4">
                {weekData.map((day) => (
                  <Button
                    key={day.day}
                    variant={selectedDay === day.day ? "default" : "outline"}
                    onClick={() => setSelectedDay(day.day)}
                    className="min-w-[120px] flex-shrink-0"
                  >
                    <div className="text-center">
                      <div className="font-semibold text-xs sm:text-sm">{day.day}</div>
                      <div className="text-xs">{day.totalHours.toFixed(1)}h</div>
                    </div>
                  </Button>
                ))}
              </div>
            </ScrollArea>

            <ScrollArea className="h-[600px]">
              {selectedDayData && (
                <div className="space-y-6">
                  {/* By Builder Section */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Hours by Builder</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {Object.entries(builderData || {}).map(([builder, data]) => (
                          <div key={builder} className="space-y-2">
                            <div className="flex justify-between items-center font-semibold">
                              <span>{builder}</span>
                              <span>{data.totalHours.toFixed(2)} hrs</span>
                            </div>
                            <div className="overflow-x-auto">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead className="min-w-[100px]">Project</TableHead>
                                    <TableHead className="min-w-[100px]">Clock In</TableHead>
                                    <TableHead className="min-w-[100px]">Location (In)</TableHead>
                                    <TableHead className="min-w-[100px]">Clock Out</TableHead>
                                    <TableHead className="min-w-[100px]">Location (Out)</TableHead>
                                    <TableHead className="min-w-[80px]">Duration</TableHead>
                                    <TableHead className="min-w-[120px]">Notes</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {data.entries.map((entry) => (
                                    <TableRow key={entry.id}>
                                      <TableCell>
                                        {entry.notes?.startsWith("TRAVEL:") ? "Travel" : (entry.projects?.name || "Unknown")}
                                      </TableCell>
                                      <TableCell>{new Date(entry.clock_in).toLocaleTimeString()}</TableCell>
                                      <TableCell className="text-xs">
                                        <LocationLink lat={entry.location_lat} lng={entry.location_lng} />
                                      </TableCell>
                                      <TableCell>
                                        {entry.clock_out ? new Date(entry.clock_out).toLocaleTimeString() : "—"}
                                      </TableCell>
                                      <TableCell className="text-xs">
                                        {entry.clock_out ? (
                                          <LocationLink lat={entry.location_lat} lng={entry.location_lng} />
                                        ) : "—"}
                                      </TableCell>
                                      <TableCell>{calculateDuration(entry.clock_in, entry.clock_out)}</TableCell>
                                      <TableCell>{entry.notes || "—"}</TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  {/* By Project Section */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Hours by Project</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {Object.entries(projectData || {}).map(([project, entries]) => {
                          const projectTotal = entries.reduce((sum, entry) => {
                            if (entry.clock_out) {
                              const hours = (new Date(entry.clock_out).getTime() - new Date(entry.clock_in).getTime()) / (1000 * 60 * 60);
                              return sum + hours;
                            }
                            return sum;
                          }, 0);

                          return (
                            <div key={project} className="space-y-2">
                              <div className="flex justify-between items-center font-semibold">
                                <span>{entries[0]?.notes?.startsWith("TRAVEL:") ? "Travel" : project}</span>
                                <span>{projectTotal.toFixed(2)} hrs</span>
                              </div>
                              <div className="overflow-x-auto">
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead className="min-w-[100px]">Builder</TableHead>
                                      <TableHead className="min-w-[100px]">Clock In</TableHead>
                                      <TableHead className="min-w-[100px]">Location (In)</TableHead>
                                      <TableHead className="min-w-[100px]">Clock Out</TableHead>
                                      <TableHead className="min-w-[100px]">Location (Out)</TableHead>
                                      <TableHead className="min-w-[80px]">Duration</TableHead>
                                      <TableHead className="min-w-[120px]">Notes</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {entries.map((entry) => (
                                      <TableRow key={entry.id}>
                                        <TableCell>{entry.profiles.full_name}</TableCell>
                                        <TableCell>{new Date(entry.clock_in).toLocaleTimeString()}</TableCell>
                                        <TableCell className="text-xs">
                                          <LocationLink lat={entry.location_lat} lng={entry.location_lng} />
                                        </TableCell>
                                        <TableCell>
                                          {entry.clock_out ? new Date(entry.clock_out).toLocaleTimeString() : "—"}
                                        </TableCell>
                                        <TableCell className="text-xs">
                                          {entry.clock_out ? (
                                            <LocationLink lat={entry.location_lat} lng={entry.location_lng} />
                                          ) : "—"}
                                        </TableCell>
                                        <TableCell>{calculateDuration(entry.clock_in, entry.clock_out)}</TableCell>
                                        <TableCell>{entry.notes || "—"}</TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </ScrollArea>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default TimeTrackingDetailDialog;
