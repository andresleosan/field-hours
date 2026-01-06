import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Html5Qrcode } from "html5-qrcode";
import { Camera, X } from "lucide-react";

interface QRScannerDialogProps {
  open: boolean;
  onClose: () => void;
  onScan: (code: string) => void;
}

export const QRScannerDialog = ({ open, onClose, onScan }: QRScannerDialogProps) => {
  const [error, setError] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && containerRef.current) {
      const scanner = new Html5Qrcode("qr-reader");
      scannerRef.current = scanner;

      scanner.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        (decodedText) => {
          // Extract code from URL if it's a full URL
          let code = decodedText;
          if (decodedText.includes("code=")) {
            const url = new URL(decodedText);
            code = url.searchParams.get("code") || decodedText;
          }
          onScan(code);
          handleClose();
        },
        () => {
          // Ignore scan errors (no QR found)
        }
      ).catch((err) => {
        setError("Unable to access camera. Please check permissions.");
        console.error("QR Scanner error:", err);
      });
    }

    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, [open, onScan]);

  const handleClose = () => {
    if (scannerRef.current) {
      scannerRef.current.stop().catch(() => {});
    }
    setError(null);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" />
            Scan QR Code
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {error ? (
            <div className="text-center py-8">
              <p className="text-destructive text-sm">{error}</p>
              <Button variant="outline" onClick={handleClose} className="mt-4">
                Close
              </Button>
            </div>
          ) : (
            <>
              <div 
                id="qr-reader" 
                ref={containerRef}
                className="w-full rounded-lg overflow-hidden"
              />
              <p className="text-center text-sm text-muted-foreground">
                Point your camera at the QR code
              </p>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
