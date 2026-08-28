import { useState, useRef, useEffect } from "react";
import { Camera, X, RefreshCw, Check, SkipForward, AlertCircle } from "lucide-react";
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50 p-4 backdrop-blur-sm" onClick={handleClose}>
      <section
        role="dialog"
        aria-modal="true"
        className="w-full max-w-sm overflow-hidden rounded-3xl border border-border bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand/10 text-brand">
              <Camera className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold">{t("takeSelfieTitle")}</h3>
              <p className="text-[11px] text-muted-foreground">{t("takeSelfiePrompt")}</p>
            </div>
          </div>
          <button type="button" onClick={handleClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {capturedImage ? (
            /* Preview of captured image */
            <div className="relative aspect-square w-full overflow-hidden rounded-2xl border border-border bg-black shadow-inner">
              <img src={capturedImage} alt="Captured selfie" className="h-full w-full object-cover" />
              <div className="absolute top-2 right-2 rounded-lg bg-black/60 px-2 py-1 text-[11px] font-semibold text-white">
                ✓ Ready
              </div>
            </div>
          ) : cameraError ? (
            /* Camera error or permission blocked */
            <div className="flex aspect-square w-full flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/40 p-5 text-center">
              <AlertCircle className="h-10 w-10 text-warning" />
              <p className="mt-2 text-xs font-semibold text-foreground">{cameraError}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">You can still clock in without taking a photo.</p>
              <button
                type="button"
                onClick={handleSkip}
                className="mt-4 flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
              >
                <SkipForward className="h-3.5 w-3.5" /> {t("skipPhoto")}
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
                className="absolute top-3 right-3 flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-md hover:bg-black/80"
              >
                <RefreshCw className="h-4 w-4" />
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
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-border py-2.5 text-xs font-semibold hover:bg-muted"
                >
                  <RefreshCw className="h-3.5 w-3.5" /> {t("retake")}
                </button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-brand py-2.5 text-xs font-semibold text-brand-foreground hover:brightness-95"
                >
                  <Check className="h-4 w-4" /> {t("confirmPhoto")}
                </button>
              </>
            ) : !cameraError ? (
              <>
                <button
                  type="button"
                  onClick={handleSkip}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-border py-2.5 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <SkipForward className="h-3.5 w-3.5" /> {t("skipPhoto")}
                </button>
                <button
                  type="button"
                  onClick={handleCapture}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-brand py-2.5 text-xs font-bold text-brand-foreground shadow-sm hover:brightness-95"
                >
                  <Camera className="h-4 w-4" /> {t("capturePhoto")}
                </button>
              </>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}
