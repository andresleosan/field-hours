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
    const { data, error } = await supabase
      .from("time_tracking")
      .select(`
        *,
        projects(name)
      `)
      .order("clock_in", { ascending: false });

    if (!error && data) {
      // Fetch all unique user profiles
      const userIds = [...new Set(data.map(entry => entry.user_id))];
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", userIds);

      const profilesMap = new Map(profilesData?.map(p => [p.id, p.full_name]) || []);

      // Get the current week (Thursday to Wednesday)
      const now = new Date();
      const currentDay = now.getDay();
      // Calculate days until last Thursday (0 = Sunday, 4 = Thursday)
      const daysToThursday = (currentDay + 3) % 7;
      const lastThursday = new Date(now);
      lastThursday.setDate(now.getDate() - daysToThursday);
      lastThursday.setHours(0, 0, 0, 0);

      const weekDays = ['Thursday', 'Friday', 'Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday'];
      const weekDataArray: DayData[] = [];

      for (let i = 0; i < 7; i++) {
        const dayDate = new Date(lastThursday);
        dayDate.setDate(lastThursday.getDate() + i);
        const dayEnd = new Date(dayDate);
        dayEnd.setHours(23, 59, 59, 999);

        const dayEntries = data
          .filter(entry => {
            const entryDate = new Date(entry.clock_in);
            return entryDate >= dayDate && entryDate <= dayEnd;
          })
          .map(entry => ({
            ...entry,
            profiles: { full_name: profilesMap.get(entry.user_id) || "Unknown" }
          }));

        const totalHours = dayEntries.reduce((sum, entry) => {
          if (entry.clock_out) {
            const hours = (new Date(entry.clock_out).getTime() - new Date(entry.clock_in).getTime()) / (1000 * 60 * 60);
            return sum + hours;
          }
          return sum;
        }, 0);

        weekDataArray.push({
          day: weekDays[i],
          date: dayDate.toLocaleDateString(),
          totalHours,
          entries: dayEntries,
        });
      }

      setWeekData(weekDataArray);
      if (weekDataArray.length > 0) {
        setSelectedDay(weekDataArray[0].day);
      }
    }
    setIsLoading(false);
  };

  const calculateDuration = (clockIn: string, clockOut: string | null) => {
    if (!clockOut) return "In Progress";
    const hours = (new Date(clockOut).getTime() - new Date(clockIn).getTime()) / (1000 * 60 * 60);
    return `${hours.toFixed(2)} hrs`;
  };

  const formatLocation = (lat: number | null, lng: number | null) => {
    if (!lat || !lng) return "No location";
    return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
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
      <DialogContent className="max-w-7xl max-h-[90vh]">
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
            <div className="flex gap-2 flex-wrap">
              {weekData.map((day) => (
                <Button
                  key={day.day}
                  variant={selectedDay === day.day ? "default" : "outline"}
                  onClick={() => setSelectedDay(day.day)}
                  className="flex-1 min-w-[120px]"
                >
                  <div className="text-center">
                    <div className="font-semibold">{day.day}</div>
                    <div className="text-xs">{day.totalHours.toFixed(1)}h</div>
                  </div>
                </Button>
              ))}
            </div>

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
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Project</TableHead>
                                  <TableHead>Clock In</TableHead>
                                  <TableHead>Location (In)</TableHead>
                                  <TableHead>Clock Out</TableHead>
                                  <TableHead>Location (Out)</TableHead>
                                  <TableHead>Duration</TableHead>
                                  <TableHead>Notes</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {data.entries.map((entry) => (
                                  <TableRow key={entry.id}>
                                    <TableCell>{entry.projects?.name || "Unknown"}</TableCell>
                                    <TableCell>{new Date(entry.clock_in).toLocaleTimeString()}</TableCell>
                                    <TableCell className="text-xs">
                                      <div className="flex items-center gap-1">
                                        <MapPin className="h-3 w-3" />
                                        {formatLocation(entry.location_lat, entry.location_lng)}
                                      </div>
                                    </TableCell>
                                    <TableCell>
                                      {entry.clock_out ? new Date(entry.clock_out).toLocaleTimeString() : "—"}
                                    </TableCell>
                                    <TableCell className="text-xs">
                                      {entry.clock_out ? (
                                        <div className="flex items-center gap-1">
                                          <MapPin className="h-3 w-3" />
                                          {formatLocation(entry.location_lat, entry.location_lng)}
                                        </div>
                                      ) : "—"}
                                    </TableCell>
                                    <TableCell>{calculateDuration(entry.clock_in, entry.clock_out)}</TableCell>
                                    <TableCell>{entry.notes || "—"}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
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
                                <span>{project}</span>
                                <span>{projectTotal.toFixed(2)} hrs</span>
                              </div>
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>Builder</TableHead>
                                    <TableHead>Clock In</TableHead>
                                    <TableHead>Location (In)</TableHead>
                                    <TableHead>Clock Out</TableHead>
                                    <TableHead>Location (Out)</TableHead>
                                    <TableHead>Duration</TableHead>
                                    <TableHead>Notes</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {entries.map((entry) => (
                                    <TableRow key={entry.id}>
                                      <TableCell>{entry.profiles.full_name}</TableCell>
                                      <TableCell>{new Date(entry.clock_in).toLocaleTimeString()}</TableCell>
                                      <TableCell className="text-xs">
                                        <div className="flex items-center gap-1">
                                          <MapPin className="h-3 w-3" />
                                          {formatLocation(entry.location_lat, entry.location_lng)}
                                        </div>
                                      </TableCell>
                                      <TableCell>
                                        {entry.clock_out ? new Date(entry.clock_out).toLocaleTimeString() : "—"}
                                      </TableCell>
                                      <TableCell className="text-xs">
                                        {entry.clock_out ? (
                                          <div className="flex items-center gap-1">
                                            <MapPin className="h-3 w-3" />
                                            {formatLocation(entry.location_lat, entry.location_lng)}
                                          </div>
                                        ) : "—"}
                                      </TableCell>
                                      <TableCell>{calculateDuration(entry.clock_in, entry.clock_out)}</TableCell>
                                      <TableCell>{entry.notes || "—"}</TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
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
