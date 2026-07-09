import * as React from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import * as D from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";

/**
 * Drop-in replacement for ui/dialog: a centered dialog on desktop, a bottom
 * sheet (vaul) under 768px — the standard for field apps used one-handed on
 * site. Consumers only change the import path.
 */

const Dialog = (props: React.ComponentProps<typeof D.Dialog>) => {
  const isMobile = useIsMobile();
  const Comp = isMobile ? Drawer : D.Dialog;
  return <Comp {...props} />;
};

const DialogTrigger = (props: React.ComponentProps<typeof D.DialogTrigger>) => {
  const Comp = useIsMobile() ? DrawerTrigger : D.DialogTrigger;
  return <Comp {...props} />;
};

const DialogContent = React.forwardRef<HTMLDivElement, React.ComponentProps<typeof D.DialogContent>>(
  ({ className, children, ...props }, ref) => {
    const isMobile = useIsMobile();
    if (!isMobile) {
      return (
        <D.DialogContent ref={ref} className={className} {...props}>
          {children}
        </D.DialogContent>
      );
    }
    return (
      <DrawerContent ref={ref} className="max-h-[92dvh]" {...props}>
        {/* Sheets get the dialog's p-6 via this scroll wrapper; max-w-* from
            desktop-oriented classNames is irrelevant at full width. */}
        <div className={cn("overflow-y-auto p-6 pt-4", className)}>{children}</div>
      </DrawerContent>
    );
  },
);
DialogContent.displayName = "ResponsiveDialogContent";

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => {
  const Comp = useIsMobile() ? DrawerHeader : D.DialogHeader;
  return <Comp className={cn("p-0 text-left", className)} {...props} />;
};

const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => {
  const Comp = useIsMobile() ? DrawerFooter : D.DialogFooter;
  return <Comp className={cn("p-0 pt-4", className)} {...props} />;
};

const DialogTitle = React.forwardRef<HTMLHeadingElement, React.ComponentProps<typeof D.DialogTitle>>(
  (props, ref) => {
    const Comp = useIsMobile() ? DrawerTitle : D.DialogTitle;
    return <Comp ref={ref} {...props} />;
  },
);
DialogTitle.displayName = "ResponsiveDialogTitle";

const DialogDescription = React.forwardRef<HTMLParagraphElement, React.ComponentProps<typeof D.DialogDescription>>(
  (props, ref) => {
    const Comp = useIsMobile() ? DrawerDescription : D.DialogDescription;
    return <Comp ref={ref} {...props} />;
  },
);
DialogDescription.displayName = "ResponsiveDialogDescription";

export { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription };
