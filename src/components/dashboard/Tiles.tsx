import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const tileBase =
  "group flex flex-col rounded-lg border border-border bg-card p-5 text-left shadow-xs transition-[box-shadow,border-color] duration-200";
const tileInteractive =
  "hover:border-foreground/20 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

interface StatTileProps {
  label: string;
  value: string | number;
  caption: string;
  icon: LucideIcon;
  onClick?: () => void;
  /** Renders a hi-vis dot: this figure is waiting on someone. */
  attention?: boolean;
}

/**
 * One figure, one caption, one icon. The label is a quiet eyebrow so the
 * number is the only thing that reads from across the room.
 */
export function StatTile({ label, value, caption, icon: Icon, onClick, attention = false }: StatTileProps) {
  const Comp = onClick ? "button" : "div";

  return (
    <Comp type={onClick ? "button" : undefined} onClick={onClick} className={cn(tileBase, onClick && tileInteractive)}>
      <div className="flex items-start justify-between gap-2">
        <span className="label-eyebrow flex items-center gap-1.5">
          {attention && (
            <>
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand" aria-hidden="true" />
              <span className="sr-only">Needs attention:</span>
            </>
          )}
          {label}
        </span>
        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.75} aria-hidden="true" />
      </div>
      <div className="mt-4 text-3xl font-semibold tabular leading-none">{value}</div>
      <p className="mt-2 text-xs text-muted-foreground">{caption}</p>
    </Comp>
  );
}
