import { useEffect, useState, useSyncExternalStore } from "react";
import { Download, Smartphone } from "lucide-react";
import { useI18n } from "@/lib/useI18n";
import {
  getPwaInstallSnapshot,
  requestPwaInstall,
  subscribePwaInstall,
} from "@/lib/pwaInstall";

export function PwaInstallAction() {
  const { t } = useI18n();
  const install = useSyncExternalStore(subscribePwaInstall, getPwaInstallSnapshot, getPwaInstallSnapshot);
  const [guidance, setGuidance] = useState<"" | "unavailable" | "dismissed" | "error">("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (install.canPrompt) setGuidance("");
  }, [install.canPrompt]);

  if (install.installed) return null;

  async function handleInstall() {
    setBusy(true);
    try {
      const outcome = await requestPwaInstall();
      if (outcome === "unavailable") setGuidance("unavailable");
      else if (outcome === "dismissed") setGuidance("dismissed");
    } catch {
      setGuidance("error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => void handleInstall()}
        disabled={busy}
        className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm hover:bg-muted disabled:opacity-60"
      >
        {install.canPrompt ? <Download className="h-4 w-4" /> : <Smartphone className="h-4 w-4" />}
        {t("installApp")}
      </button>
      {guidance && (
        <p role="status" className="px-3 pb-2 text-xs leading-5 text-muted-foreground">
          {guidance === "dismissed"
            ? t("installAppDismissed")
            : guidance === "error"
              ? t("installAppError")
              : t("installAppAndroidHelp")}
        </p>
      )}
    </div>
  );
}
