import { useState, useRef, useEffect } from "react";
import { Camera, RefreshCw, Check, SkipForward, AlertCircle } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useI18n } from "@/lib/useI18n";

interface SelfieModalProps {
  onCapture: (photoBase64: string | null) => void;
  onClose: () => void;
}

export function SelfieModal({ onCapture, onClose }: SelfieModalProps) {
  const { t } = useI18n();
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const previouslyFocusedElementRef = useRef<HTMLElement | null>(
    typeof document !== "undefined" && document.activeElement instanceof HTMLElement ? document.activeElement : null,
  );

  useEffect(
    () => () => {
      const previouslyFocusedElement = previouslyFocusedElementRef.current;
      if (previouslyFocusedElement?.isConnected) {
        previouslyFocusedElement.focus({ preventScroll: true });
      }
    },
    [],
  );

  useEffect(() => {
    let activeStream: MediaStream | null = null;

    async function initCamera() {
      setCameraError(null);
      try {
        const ms = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode,
            width: { ideal: 640 },
            height: { ideal: 640 },
          },
          audio: false,
        });
        activeStream = ms;
        setStream(ms);
        if (videoRef.current) {
          videoRef.current.srcObject = ms;
        }
      } catch (err) {
        console.error("Camera access error:", err);
        setCameraError("Camera unavailable or permission denied.");
      }
    }

    if (!capturedImage) {
      void initCamera();
    }

    return () => {
      if (activeStream) {
        activeStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [facingMode, capturedImage]);

  const stopCurrentStream = () => {
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      setStream(null);
    }
  };

  const handleCapture = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;

    // Scale to max 400px width for ultralight storage
    const scale = Math.min(1, 400 / (video.videoWidth || 400));
    const width = Math.round((video.videoWidth || 400) * scale);
    const height = Math.round((video.videoHeight || 400) * scale);

    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (facingMode === "user") {
      // Mirror front camera for natural selfie look
      ctx.translate(width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, width, height);

    const base64 = canvas.toDataURL("image/jpeg", 0.75);
    setCapturedImage(base64);
    stopCurrentStream();
  };

  const handleRetake = () => {
    setCapturedImage(null);
  };

  const handleConfirm = () => {
    stopCurrentStream();
    onCapture(capturedImage);
  };

  const handleSkip = () => {
    stopCurrentStream();
    onCapture(null);
  };

  const handleClose = () => {
    stopCurrentStream();
    onClose();
  };

  const switchCamera = () => {
    stopCurrentStream();
    setFacingMode((prev) => (prev === "user" ? "environment" : "user"));
  };

  return (
    <Dialog
      defaultOpen
      onOpenChange={(open) => {
        if (!open) handleClose();
      }}
    >
      <DialogContent
        closeLabel={t("close")}
        overlayClassName="bg-foreground/50 backdrop-blur-sm"
        className="max-w-sm gap-0 overflow-x-hidden overflow-y-auto rounded-3xl border-border bg-card p-0 shadow-2xl"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          titleRef.current?.focus({ preventScroll: true });
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          const previouslyFocusedElement = previouslyFocusedElementRef.current;
          if (previouslyFocusedElement?.isConnected) {
            previouslyFocusedElement.focus({ preventScroll: true });
          }
        }}
      >
        <div className="flex items-center border-b border-border py-4 pl-5 pr-16">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand/10 text-brand">
              <Camera className="h-4 w-4" aria-hidden="true" />
            </div>
            <div>
              <DialogTitle ref={titleRef} tabIndex={-1} className="text-sm font-bold outline-none">
                {t("takeSelfieTitle")}
              </DialogTitle>
              <DialogDescription className="text-[11px] text-muted-foreground">
                {t("takeSelfiePrompt")}
              </DialogDescription>
            </div>
          </div>
        </div>

        <div className="p-4 space-y-4">
          {capturedImage ? (
            /* Preview of captured image */
            <div className="relative aspect-square w-full overflow-hidden rounded-2xl border border-border bg-black shadow-inner">
              <img src={capturedImage} alt={t("takeSelfiePrompt")} className="h-full w-full object-cover" />
              <div className="absolute top-2 right-2 rounded-lg bg-black/60 px-2 py-1 text-[11px] font-semibold text-white">
                ✓ Ready
              </div>
            </div>
          ) : cameraError ? (
            /* Camera error or permission blocked */
            <div
              className="flex aspect-square w-full flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/40 p-5 text-center"
              role="alert"
            >
              <AlertCircle className="h-10 w-10 text-warning" aria-hidden="true" />
              <p className="mt-2 text-xs font-semibold text-foreground">{cameraError}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">You can still clock in without taking a photo.</p>
              <button
                type="button"
                onClick={handleSkip}
                className="mt-4 flex min-h-11 items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
              >
                <SkipForward className="h-3.5 w-3.5" aria-hidden="true" /> {t("skipPhoto")}
              </button>
            </div>
          ) : (
            /* Live Camera View */
            <div className="relative aspect-square w-full overflow-hidden rounded-2xl border border-border bg-black shadow-inner">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`h-full w-full object-cover ${facingMode === "user" ? "-scale-x-100" : ""}`}
              />
              <canvas ref={canvasRef} className="hidden" />
              
              {/* Switch camera floating button */}
              <button
                type="button"
                onClick={switchCamera}
                title={t("switchCamera")}
                aria-label={t("switchCamera")}
                className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-md hover:bg-black/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
              >
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          )}

          <p className="text-center text-xs text-muted-foreground">{t("takeSelfieSubtitle")}</p>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-1">
            {capturedImage ? (
              <>
                <button
                  type="button"
                  onClick={handleRetake}
                  className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border border-border py-2.5 text-xs font-semibold hover:bg-muted"
                >
                  <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" /> {t("retake")}
                </button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-brand py-2.5 text-xs font-semibold text-brand-foreground hover:brightness-95"
                >
                  <Check className="h-4 w-4" aria-hidden="true" /> {t("confirmPhoto")}
                </button>
              </>
            ) : !cameraError ? (
              <>
                <button
                  type="button"
                  onClick={handleSkip}
                  className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border border-border py-2.5 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <SkipForward className="h-3.5 w-3.5" aria-hidden="true" /> {t("skipPhoto")}
                </button>
                <button
                  type="button"
                  onClick={handleCapture}
                  className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-brand py-2.5 text-xs font-bold text-brand-foreground shadow-sm hover:brightness-95"
                >
                  <Camera className="h-4 w-4" aria-hidden="true" /> {t("capturePhoto")}
                </button>
              </>
            ) : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
