import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, Play, Square } from "lucide-react";

interface TimeTrackingCardProps {
  isClockedIn: boolean;
  currentTimeEntry: any;
  onClockIn: () => void;
  onClockOut: () => void;
  weekMinutes?: number;
}

const TimeTrackingCard = ({ isClockedIn, currentTimeEntry, onClockIn, onClockOut, weekMinutes = 0 }: TimeTrackingCardProps) => {
  const [elapsedTime, setElapsedTime] = useState("");

  useEffect(() => {
    if (!isClockedIn || !currentTimeEntry) {
      setElapsedTime("");
      return;
    }

    const updateElapsed = () => {
      const start = new Date(currentTimeEntry.clock_in).getTime();
      const now = Date.now();
      const diff = now - start;

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setElapsedTime(`${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`);
    };

    updateElapsed();
    const interval = setInterval(updateElapsed, 1000);

    return () => clearInterval(interval);
  }, [isClockedIn, currentTimeEntry]);

  return (
    <Card className="overflow-hidden">
      {/* The hazard stripe only appears while the clock is running. */}
      {isClockedIn && <div className="hi-vis-rule h-1" aria-hidden="true" />}
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" strokeWidth={1.75} />
          Time tracking
        </CardTitle>
        <CardDescription>
          {isClockedIn ? "You are currently clocked in" : "Clock in to start tracking your time"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {isClockedIn && elapsedTime && (
          <div className="py-6 text-center">
            <div className="tabular font-mono text-5xl font-semibold tracking-tight" aria-live="off">
              {elapsedTime}
            </div>
            <p className="label-eyebrow mt-3">Elapsed this shift</p>
          </div>
        )}

        <Button
          onClick={isClockedIn ? onClockOut : onClockIn}
          variant={isClockedIn ? "destructive" : "brand"}
          className="h-14 w-full text-base"
        >
          {isClockedIn ? (
            <>
              <Square className="!size-5" strokeWidth={1.75} />
              Clock out
            </>
          ) : (
            <>
              <Play className="!size-5" strokeWidth={1.75} />
              Clock in
            </>
          )}
        </Button>

        <p className="text-center font-mono text-xs tabular-nums text-muted-foreground">
          This week: {Math.floor(weekMinutes / 60)}h {weekMinutes % 60}m
        </p>
      </CardContent>
    </Card>
  );
};

export default TimeTrackingCard;
