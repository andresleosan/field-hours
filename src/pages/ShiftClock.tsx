import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useSearchParams } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import * as XLSX from "xlsx";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Briefcase,
  Building2,
  Calendar,
  Camera,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Copy,
  Crosshair,
  Download,
  Edit3,
  FileText,
  Filter,
  History,
  Info,
  Loader2,
  LogOut,
  MapPin,
  Menu,
  Navigation,
  Pause,
  Play,
  Plus,
  QrCode,
  RefreshCw,
  ShieldCheck,
  Users,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import { ApiClientError, type SessionUser } from "@/lib/safeClient";
import { useI18n } from "@/lib/useI18n";
import type { Translations } from "@/lib/i18n.constants";
import { PwaInstallAction } from "@/components/PwaInstallAction";
import { SalaryAdviceWorkspace } from "@/components/payroll/SalaryAdviceWorkspace";
import {
  actionLabel,
  adjustShift,
  calculateDistanceMeters,
  changePassword,
  createAdminShift,
  createInvitation,
  createWorkerProject,
  formatMinutes,
  formatCalendarDate,
  formatRecordedDateTime,
  formatRecordedTime,
  formatWorkedDuration,
  loadAdminHistory,
  loadAdminToday,
  loadProjects,
  loadSession,
  loadWorkerPayrollProfile,
  loadWorkerHistory,
  loadWorkerPayrollSummary,
  loadWorkerShift,
  nextState,
  registerWorker,
  requestLocation,
  runShiftAction,
  saveProject,
  signIn,
  signOut,
  loadGoogleAuthRequests,
  loadPasswordResetRequests,
  loadRequestHistory,
  issuePasswordReset,
  reviewGoogleAuthRequest,
  requestPasswordReset,
  rejectPasswordReset,
  saveWorkerPayrollProfile,
  completePasswordReset,
  startGoogleSignIn,
  type AdminSnapshot,
  type GoogleAuthRequest,
  type PasswordResetRequest,
  type RequestHistoryItem,
  type LocationEvidence,
  type WorkerPayrollProfile,
  type WorkerPayrollSummary,
  type Project,
  type ShiftAction,
  type ShiftEvent,
  type ShiftHistoryRecord,
  type ShiftSnapshot,
  type ShiftState,
} from "@/lib/timeClock";
import {
  getOfflineQueue,
  queueOfflineAction,
  syncOfflineQueue,
} from "@/lib/offlineQueue";

type Person = {
  id: string;
  name: string;
  role: string;
  state: ShiftState;
  clockInAt: string | null;
  clockOutAt: string | null;
  projectId?: string | null;
  projectName?: string | null;
  lastEvent: string;
  events: ShiftEvent[];
};

const emptyShift: ShiftSnapshot = {
  id: "new-shift",
  state: "off_shift",
  clockInAt: null,
  breakStartedAt: null,
  breakEndedAt: null,
  clockOutAt: null,
  projectId: null,
  projectName: null,
  events: [],
};

function invitationFromLocation(): string {
  const fragment = window.location.hash.startsWith("#")
    ? window.location.hash.slice(1)
    : window.location.hash;
  return new URLSearchParams(fragment).get("invite") ?? "";
}

type Translate = (key: keyof Translations) => string;

function stateCopy(state: ShiftState, t: Translate): { label: string; detail: string; tone: string } {
  return {
    off_shift: {
      label: t("stateOffShift"),
      detail: t("stateOffShiftDetail"),
      tone: "neutral",
    },
    working: {
      label: t("stateWorking"),
      detail: t("stateWorkingDetail"),
      tone: "live",
    },
    on_break: {
      label: t("stateOnBreak"),
      detail: t("stateOnBreakDetail"),
      tone: "break",
    },
    complete: {
      label: t("stateComplete"),
      detail: t("stateCompleteDetail"),
      tone: "complete",
    },
  }[state];
}

function getActionLabel(action: ShiftAction, t: Translate): string {
  switch (action) {
    case "clock_in": return t("clockIn");
    case "start_break": return t("startBreak");
    case "end_break": return t("endBreak");
    case "clock_out": return t("finishShift");
    default: return action;
  }
}

function locationLink(location: LocationEvidence): string {
  return `https://www.openstreetmap.org/?mlat=${location.latitude}&mlon=${location.longitude}#map=16/${location.latitude}/${location.longitude}`;
}

function messageFrom(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function LanguageSwitcher() {
  const { lang, setLang } = useI18n();

  return (
    <div className="inline-flex items-center rounded-xl border border-border bg-muted/60 p-1 text-xs font-semibold" aria-label="Language">
      <button
        type="button"
        onClick={() => setLang("es")}
        aria-pressed={lang === "es"}
        className={`flex min-h-11 min-w-11 items-center justify-center rounded-lg px-2.5 text-xs font-semibold transition ${
          lang === "es"
            ? "bg-background text-foreground shadow-xs font-bold"
            : "text-muted-foreground hover:text-foreground"
        }`}
        title="Español"
      >
        ES
      </button>
      <button
        type="button"
        onClick={() => setLang("en")}
        aria-pressed={lang === "en"}
        className={`flex min-h-11 min-w-11 items-center justify-center rounded-lg px-2.5 text-xs font-semibold transition ${
          lang === "en"
            ? "bg-background text-foreground shadow-xs font-bold"
            : "text-muted-foreground hover:text-foreground"
        }`}
        title="English"
      >
        EN
      </button>
      <button
        type="button"
        onClick={() => setLang("pt")}
        aria-pressed={lang === "pt"}
        className={`flex min-h-11 min-w-11 items-center justify-center rounded-lg px-2.5 text-xs font-semibold transition ${
          lang === "pt"
            ? "bg-background text-foreground shadow-xs font-bold"
            : "text-muted-foreground hover:text-foreground"
        }`}
        title="Português"
      >
        PT
      </button>
    </div>
  );
}

type WorkerSection = "today" | "history" | "pay";
type AdminSection = "today" | "history" | "salary" | "projects" | "access";

const WORKER_SECTIONS: readonly WorkerSection[] = ["today", "history", "pay"];
const ADMIN_SECTIONS: readonly AdminSection[] = ["today", "history", "salary", "projects", "access"];
const LIST_PAGE_SIZE = 8;

function useSectionParam<T extends string>(allowed: readonly T[], fallback: T) {
  const [searchParams, setSearchParams] = useSearchParams();
  const rawSection = searchParams.get("section");
  const section = allowed.includes(rawSection as T) ? rawSection as T : fallback;
  const previousSectionRef = useRef(section);

  useEffect(() => {
    const previousScrollRestoration = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";
    return () => {
      window.history.scrollRestoration = previousScrollRestoration;
    };
  }, []);

  useEffect(() => {
    if (previousSectionRef.current === section) return;
    previousSectionRef.current = section;
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [section]);

  const selectSection = useCallback((nextSection: T) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("section", nextSection);
    setSearchParams(nextParams);
  }, [searchParams, setSearchParams]);

  return [section, selectSection] as const;
}

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() => typeof window !== "undefined" && window.matchMedia(query).matches);

  useEffect(() => {
    const mediaQuery = window.matchMedia(query);
    const update = () => setMatches(mediaQuery.matches);
    update();
    mediaQuery.addEventListener("change", update);
    return () => mediaQuery.removeEventListener("change", update);
  }, [query]);

  return matches;
}

function ShowMoreButton({ visible, total, onClick, label }: { visible: number; total: number; onClick: () => void; label: string }) {
  if (visible >= total) return null;
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-11 w-full items-center justify-center rounded-xl border border-border bg-background px-4 text-sm font-semibold hover:bg-muted"
      aria-label={`${label} (${visible}/${total})`}
    >
      {label} ({visible}/{total})
    </button>
  );
}

function SectionNavigation<T extends string>({
  label,
  items,
  value,
  onChange,
}: {
  label: string;
  items: Array<{ id: T; label: string; mobileLabel?: string; icon: React.ReactNode }>;
  value: T;
  onChange: (value: T) => void;
}) {
  const renderItem = (item: { id: T; label: string; mobileLabel?: string; icon: React.ReactNode }, mobile: boolean) => {
    const selected = value === item.id;
    return (
      <button
        key={item.id}
        type="button"
        onClick={() => onChange(item.id)}
        aria-label={item.label}
        aria-current={selected ? "page" : undefined}
        title={item.label}
        className={mobile
          ? `flex min-h-14 min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[11px] font-semibold transition ${selected ? "bg-foreground text-background shadow-sm" : "text-foreground/75 hover:bg-muted hover:text-foreground"}`
          : `flex min-h-11 items-center gap-2 rounded-xl px-4 text-sm font-semibold transition ${selected ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:bg-background/70 hover:text-foreground"}`}
      >
        {item.icon}
        <span className={mobile ? "w-full truncate text-center" : ""}>{mobile ? (item.mobileLabel ?? item.label) : item.label}</span>
      </button>
    );
  };

  return (
    <>
      <nav aria-label={label} className="hidden w-fit items-center gap-1 rounded-2xl border border-border bg-muted/60 p-1.5 shadow-xs md:flex">
        {items.map((item) => renderItem(item, false))}
      </nav>
      <nav
        aria-label={label}
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 px-2 pt-2 shadow-[0_-8px_30px_rgba(0,0,0,0.08)] backdrop-blur md:hidden"
        style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
      >
        <div className="mx-auto flex max-w-lg gap-1">
          {items.map((item) => renderItem(item, true))}
        </div>
      </nav>
    </>
  );
}

function useModalFocus(onClose: () => void, open = true) {
  const dialogRef = useRef<HTMLElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return undefined;
    const dialog = dialogRef.current;
    if (!dialog) return undefined;

    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const getFocusable = () => Array.from(dialog.querySelectorAll<HTMLElement>(
      'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    )).filter((element) => element.getClientRects().length > 0 && element.getAttribute("aria-hidden") !== "true");

    const focusFrame = window.requestAnimationFrame(() => {
      const initialFocus = dialog.querySelector<HTMLElement>("[data-dialog-initial-focus]") ?? getFocusable()[0] ?? dialog;
      initialFocus.focus();
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      const visibleDialogs = Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"][aria-modal="true"]'))
        .filter((candidate) => candidate.getClientRects().length > 0);
      if (visibleDialogs.at(-1) !== dialog) return;

      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = getFocusable();
      if (focusable.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      window.requestAnimationFrame(() => previousFocus?.focus());
    };
  }, [open]);

  return dialogRef;
}

function PhotoEvidenceModal({
  photo,
  title,
  subtitle,
  onClose,
}: {
  photo: string;
  title: string;
  subtitle: string;
  onClose: () => void;
}) {
  const dialogRef = useModalFocus(onClose);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50 p-4 backdrop-blur-sm" onClick={onClose}>
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="photo-evidence-title"
        tabIndex={-1}
        className="max-h-[calc(100dvh-2rem)] w-full max-w-sm overflow-y-auto overscroll-contain rounded-3xl border border-border bg-card shadow-2xl outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <h3 id="photo-evidence-title" data-dialog-initial-focus tabIndex={-1} className="text-sm font-bold outline-none">{title}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
          </div>
          <button type="button" onClick={onClose} className="flex min-h-11 min-w-11 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted" aria-label="Close photo evidence">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-4">
          <div className="relative aspect-square w-full overflow-hidden rounded-2xl border border-border bg-black shadow-inner">
            <img src={photo} alt="Clock-in evidence" className="h-full w-full object-cover" />
          </div>
        </div>
      </section>
    </div>
  );
}

function LoginScreen({ onLogin }: { onLogin: (user: SessionUser) => void }) {
  const { t } = useI18n();
  const initialToken = invitationFromLocation();
  const googleStatus = new URLSearchParams(window.location.search).get("google");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [inviteToken, setInviteToken] = useState(initialToken);
  const [showResetRequest, setShowResetRequest] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetMessage, setResetMessage] = useState("");
  const [resetBusy, setResetBusy] = useState(false);
  const [error, setError] = useState(
    googleStatus === "pending"
      ? "Your Google request is waiting for administrator approval. Try again after it is approved."
      : googleStatus === "error"
        ? "Google sign-in could not be completed. Please try again."
        : "",
  );
  const [busy, setBusy] = useState(false);
  const [registration, setRegistration] = useState(Boolean(initialToken) || window.location.pathname === "/join");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const user = registration
        ? await registerWorker({
          invitationToken: inviteToken.trim(),
          email,
          password,
          displayName,
        })
        : await signIn(email, password);
      window.history.replaceState({}, "", "/");
      onLogin(user);
    } catch (caught) {
      setError(messageFrom(caught, "We could not sign you in. Check your credentials."));
    } finally {
      setBusy(false);
    }
  }

  async function submitResetRequest(event: FormEvent) {
    event.preventDefault();
    setResetBusy(true);
    setResetMessage("");
    try {
      await requestPasswordReset(resetEmail);
      setResetMessage("Solicitud enviada. Un administrador debe generar y compartir contigo un enlace de restablecimiento.");
    } catch (caught) {
      setResetMessage(messageFrom(caught, "No se pudo solicitar el restablecimiento."));
    } finally {
      setResetBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-5xl overflow-hidden rounded-3xl border border-border bg-card shadow-xl">
        <section className="grid lg:grid-cols-[1.1fr_1fr]">
          <div className="hidden flex-col justify-between bg-primary p-10 text-primary-foreground lg:flex">
            <div>
              <div className="flex items-center gap-3 text-sm font-semibold tracking-[0.16em] uppercase">
                <Crosshair className="h-5 w-5 text-brand" /> {t("appTitle")}
              </div>
              <p className="mt-8 max-w-md text-4xl font-semibold leading-[1.05]">Time that follows the workday.</p>
              <p className="mt-6 max-w-sm text-sm leading-6 text-primary-foreground/70">
                One clear action at a time, with project geofences and fresh location checks.
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs text-primary-foreground/60">
              <ShieldCheck className="h-4 w-4" /> {t("locationFooterNotice")}
            </div>
          </div>
          <div className="p-6 sm:p-10">
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-3 text-sm font-semibold tracking-[0.16em] uppercase lg:hidden">
                <Crosshair className="h-5 w-5 text-brand" /> {t("appTitle")}
              </div>
              <div className="ml-auto">
                <LanguageSwitcher />
              </div>
            </div>
            <div className="mb-8">
              <p className="label-eyebrow">{t("secureAccess")}</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight">
                {registration ? t("joinTeam") : t("welcomeBack")}
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {registration
                  ? t("joinTeamSubtitle")
                  : t("welcomeBackSubtitle")}
              </p>
            </div>
            <form onSubmit={submit} className="space-y-5">
              {registration && (
                <>
                  <label className="block text-sm font-medium">
                    {t("fullName")}
                    <input
                      required
                      minLength={2}
                      maxLength={120}
                      value={displayName}
                      onChange={(event) => setDisplayName(event.target.value)}
                      className="mt-2 h-12 w-full rounded-xl border border-input bg-background px-3 outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
                      autoComplete="name"
                    />
                  </label>
                  <label className="block text-sm font-medium">
                    {t("invitationCode")}
                    <input
                      required
                      pattern="[a-fA-F0-9]{64}"
                      value={inviteToken}
                      onChange={(event) => setInviteToken(event.target.value)}
                      className="mt-2 h-12 w-full rounded-xl border border-input bg-background px-3 font-mono text-xs outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
                      autoComplete="off"
                    />
                  </label>
                </>
              )}
              <label className="block text-sm font-medium">
                {t("email")}
                <input
                  required
                  type="email"
                  maxLength={254}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="mt-2 h-12 w-full rounded-xl border border-input bg-background px-3 outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
                  autoComplete="email"
                />
              </label>
              <label className="block text-sm font-medium">
                {t("password")}
                <input
                  required
                  minLength={8}
                  maxLength={128}
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="mt-2 h-12 w-full rounded-xl border border-input bg-background px-3 outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
                  autoComplete={registration ? "new-password" : "current-password"}
                />
              </label>
              {error && (
                <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-3 text-sm text-destructive">
                  {error}
                </p>
              )}
              <button
                disabled={busy}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-wait disabled:opacity-60"
              >
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                {registration ? t("createWorkerAccount") : t("signIn")}
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>
            <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
              <span className="h-px flex-1 bg-border" />
              <span>or</span>
              <span className="h-px flex-1 bg-border" />
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setBusy(true);
                startGoogleSignIn("signin");
              }}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 text-sm font-semibold transition hover:bg-muted disabled:cursor-wait disabled:opacity-60"
            >
              <span className="flex h-5 w-5 items-center justify-center rounded-full border border-border text-xs font-bold">G</span>
              Continue with Google
            </button>
            <p className="mt-3 text-center text-xs leading-5 text-muted-foreground">
              New Google accounts and account migrations need administrator approval.
            </p>
            <button
              type="button"
              onClick={() => {
                setRegistration((current) => !current);
                setError("");
              }}
              className="mt-5 w-full text-center text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              {registration ? t("backToSignIn") : t("haveInvitation")}
            </button>
            {!registration && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setShowResetRequest((current) => !current);
                    setResetEmail(email);
                    setResetMessage("");
                  }}
                  className="mt-3 w-full text-center text-sm font-medium text-foreground underline-offset-4 hover:underline"
                >
                  {showResetRequest ? "Cancelar restablecimiento" : "¿Olvidaste tu contraseña?"}
                </button>
                {showResetRequest && (
                  <form onSubmit={submitResetRequest} className="mt-5 space-y-3 rounded-2xl border border-border bg-muted/40 p-4">
                    <p className="text-xs leading-5 text-muted-foreground">
                      Escribe tu correo. Por seguridad, la respuesta será la misma exista o no una cuenta.
                    </p>
                    <input
                      required
                      type="email"
                      maxLength={254}
                      value={resetEmail}
                      onChange={(event) => setResetEmail(event.target.value)}
                      className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      placeholder="Correo de la cuenta"
                      autoComplete="email"
                    />
                    <button
                      type="submit"
                      disabled={resetBusy}
                      className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 text-sm font-semibold hover:bg-muted disabled:opacity-60"
                    >
                      {resetBusy && <Loader2 className="h-4 w-4 animate-spin" />}
                      Solicitar restablecimiento
                    </button>
                    {resetMessage && <p role="status" className="text-xs leading-5 text-muted-foreground">{resetMessage}</p>}
                  </form>
                )}
              </>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function PasswordChangeScreen({
  user,
  onChanged,
  onCancel,
  onSignOut,
}: {
  user: SessionUser;
  onChanged: (user: SessionUser) => void;
  onCancel: () => void;
  onSignOut: () => void;
}) {
  const { t } = useI18n();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (password !== confirmation) {
      setError(t("passwordsDoNotMatch"));
      return;
    }
    setBusy(true);
    try {
      onChanged(await changePassword(password));
    } catch (caught) {
      setError(messageFrom(caught, "The password could not be changed."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-5 py-8">
      <section className="w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-lg sm:p-8">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-success/15 text-success">
          <ShieldCheck className="h-6 w-6" />
        </div>
        <p className="label-eyebrow mt-7">{t("firstSignIn")}</p>
        <h1 className="mt-2 text-2xl font-semibold">{t("choosePermanentPassword")}</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {t("changePasswordDetail")}
        </p>
        <form onSubmit={submit} className="mt-7 space-y-5">
          <label className="block text-sm font-medium">
            {t("newPassword")}
            <input
              required
              minLength={12}
              maxLength={128}
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-2 h-12 w-full rounded-xl border border-input bg-background px-3 outline-none focus-visible:ring-2 focus-visible:ring-ring"
              autoComplete="new-password"
            />
          </label>
          <label className="block text-sm font-medium">
            {t("confirmPassword")}
            <input
              required
              minLength={12}
              maxLength={128}
              type="password"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              className="mt-2 h-12 w-full rounded-xl border border-input bg-background px-3 outline-none focus-visible:ring-2 focus-visible:ring-ring"
              autoComplete="new-password"
            />
          </label>
          {error && (
            <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-3 text-sm text-destructive">
              {error}
            </p>
          )}
          <button
            disabled={busy}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-wait disabled:opacity-60"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {t("savePassword")}
          </button>
        </form>
        <button type="button" onClick={onCancel} className="mt-4 w-full rounded-xl border border-border px-4 py-3 text-sm font-semibold hover:bg-muted">
          Continuar sin cambiar la contraseÃ±a
        </button>
        <p className="mt-3 text-center text-xs leading-5 text-muted-foreground">
          PodrÃ¡s seguir usando el sistema y cambiarla mÃ¡s adelante.
        </p>
        <button type="button" onClick={onSignOut} className="mt-4 w-full text-sm text-muted-foreground hover:text-foreground">
          {t("signOut")} ({user.email})
        </button>
      </section>
    </main>
  );
}

function PasswordResetScreen({ token, onDone }: { token: string; onDone: () => void }) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (password !== confirmation) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    setBusy(true);
    try {
      await completePasswordReset(token, password);
      onDone();
    } catch (caught) {
      setError(messageFrom(caught, "El enlace no es válido o ya expiró."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-5 py-8">
      <section className="w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-lg sm:p-8">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand/15 text-brand">
          <ShieldCheck className="h-6 w-6" />
        </div>
        <p className="label-eyebrow mt-7">Field Hours</p>
        <h1 className="mt-2 text-2xl font-semibold">Restablecer contraseña</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Define una contraseña nueva de al menos 12 caracteres. Este enlace solo puede usarse una vez.
        </p>
        <form onSubmit={submit} className="mt-7 space-y-5">
          <label className="block text-sm font-medium">
            Nueva contraseña
            <input
              required
              minLength={12}
              maxLength={128}
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-2 h-12 w-full rounded-xl border border-input bg-background px-3 outline-none focus-visible:ring-2 focus-visible:ring-ring"
              autoComplete="new-password"
            />
          </label>
          <label className="block text-sm font-medium">
            Confirmar contraseña
            <input
              required
              minLength={12}
              maxLength={128}
              type="password"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              className="mt-2 h-12 w-full rounded-xl border border-input bg-background px-3 outline-none focus-visible:ring-2 focus-visible:ring-ring"
              autoComplete="new-password"
            />
          </label>
          {error && <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-3 text-sm text-destructive">{error}</p>}
          <button
            disabled={busy}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Guardar contraseña
          </button>
        </form>
      </section>
    </main>
  );
}

function WorkerView({ user, onSignOut }: { user: SessionUser; onSignOut: () => void }) {
  const { t } = useI18n();
  const [workerSection, setWorkerSectionParam] = useSectionParam(WORKER_SECTIONS, "today");
  const shortMobileViewport = useMediaQuery("(max-width: 767px) and (max-height: 650px)");
  const [shift, setShift] = useState<ShiftSnapshot>(emptyShift);
  const [payrollSummary, setPayrollSummary] = useState<WorkerPayrollSummary | null>(null);
  const [payrollProfile, setPayrollProfile] = useState<WorkerPayrollProfile | null>(null);
  const [payrollProfileLoading, setPayrollProfileLoading] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [history, setHistory] = useState<ShiftHistoryRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [visibleWorkerHistory, setVisibleWorkerHistory] = useState(LIST_PAGE_SIZE);
  const [busy, setBusy] = useState<ShiftAction | null>(null);
  const [message, setMessage] = useState("");
  const [online, setOnline] = useState(() => navigator.onLine);
  const [pendingQueueCount, setPendingQueueCount] = useState(() => getOfflineQueue().length);
  const [finishRequested, setFinishRequested] = useState(false);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());
  const [workerProjectDialogOpen, setWorkerProjectDialogOpen] = useState(false);
  const [photoModal, setPhotoModal] = useState<{ photo: string; title: string; subtitle: string } | null>(null);
  const syncInFlight = useRef(false);

  const selectWorkerSection = (nextSection: WorkerSection) => {
    setMessage("");
    if (nextSection === "history" && workerSection !== "history") setVisibleWorkerHistory(LIST_PAGE_SIZE);
    setWorkerSectionParam(nextSection);
  };

  const loadData = useCallback(async () => {
    try {
      const currentShift = await loadWorkerShift();
      setShift(currentShift);
      if (currentShift.projectId) {
        setSelectedProjectId(currentShift.projectId);
      }
    } catch (caught) {
      setMessage(messageFrom(caught, "We could not load your shift."));
    } finally {
      setLoading(false);
    }

    try {
      const projs = await loadProjects();
      const active = projs.filter((p) => p.is_active);
      setProjects(active);
      if (active.length > 0) {
        setSelectedProjectId((prev) => prev || active[0].id);
      }
    } catch {
      // Non-fatal if projects endpoint is still deploying
    }

    try {
      const pastShifts = await loadWorkerHistory();
      setHistory(pastShifts);
    } catch {
      // Non-fatal
    }

    try {
      setPayrollProfile(await loadWorkerPayrollProfile());
    } catch {
      // Non-fatal while the payroll profile migration is being rolled out.
    } finally {
      setPayrollProfileLoading(false);
    }

    try {
      setPayrollSummary(await loadWorkerPayrollSummary());
    } catch {
      // Non-fatal while the payroll summary endpoint is being rolled out.
    }
  }, []);

  const triggerSync = useCallback(async () => {
    if (syncInFlight.current) return;
    syncInFlight.current = true;
    try {
      const res = await syncOfflineQueue((updated) => setShift(updated));
      setPendingQueueCount(getOfflineQueue().length);
      if (res.syncedCount > 0) {
        setMessage(`✅ Synced ${res.syncedCount} offline action(s) with the server.`);
        void loadData();
      }
    } finally {
      syncInFlight.current = false;
    }
  }, [loadData]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    const goOnline = () => {
      setOnline(true);
      void triggerSync();
    };
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, [triggerSync]);

  useEffect(() => {
    if (!online || pendingQueueCount === 0) return;
    void triggerSync();
    const timer = window.setInterval(() => void triggerSync(), 15_000);
    return () => window.clearInterval(timer);
  }, [online, pendingQueueCount, triggerSync]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const copy = stateCopy(shift.state, t);
  const action = shift.state === "off_shift"
    ? "clock_in"
    : shift.state === "working"
      ? "start_break"
      : shift.state === "on_break"
        ? "end_break"
        : null;
  const duration = formatWorkedDuration(shift.events, shift.state, now);
  const pinClockIn = shortMobileViewport && workerSection === "today" && action === "clock_in";

  const selectedProject = useMemo(() => {
    return projects.find((p) => p.id === (shift.projectId || selectedProjectId));
  }, [projects, shift.projectId, selectedProjectId]);

  async function act(nextAction: ShiftAction) {
    if (busy) return;
    if (!nextState(shift.state, nextAction)) {
      setMessage("That action is no longer available. Refresh your shift and try again.");
      return;
    }
    setMessage("");
    setBusy(nextAction);
    let fallback: {
      location: LocationEvidence;
      idempotencyKey: string;
      projectId?: string;
    } | null = null;

    const queueForServerConfirmation = ({ location, idempotencyKey, projectId }: NonNullable<typeof fallback>) => {
      try {
        queueOfflineAction(nextAction, location, idempotencyKey, projectId);
      } catch {
        setMessage("The network request failed and this device could not preserve the action. Keep this screen open and try again.");
        return false;
      }
      setPendingQueueCount(getOfflineQueue().length);
      const newEvent: ShiftEvent = {
        id: idempotencyKey,
        type: nextAction,
        at: new Date().toISOString(),
        location,
      };
      setShift((previous) => ({
        ...previous,
        state: nextState(previous.state, nextAction) ?? previous.state,
        projectId: projectId || previous.projectId,
        projectName: selectedProject?.name || previous.projectName,
        events: [...previous.events, newEvent],
      }));
      if (nextAction === "clock_out") setFinishRequested(false);
      setMessage("Saved on this device and pending server confirmation. It will retry automatically while this screen is open.");
      return true;
    };

    try {
      const location = await requestLocation();
      const idempotencyKey = crypto.randomUUID();
      const projectToSubmit = nextAction === "clock_in" ? selectedProjectId : undefined;
      fallback = { location, idempotencyKey, projectId: projectToSubmit };

      if (!online) {
        queueForServerConfirmation(fallback);
        return;
      }

      const updated = await runShiftAction(nextAction, location, idempotencyKey, projectToSubmit);
      const confirmed = await loadWorkerShift().catch(() => updated);
      setShift(confirmed);
      if (nextAction === "clock_out") {
        setFinishRequested(false);
        void loadData();
      }
      setMessage("Saved with a fresh GPS check and confirmed by the server.");
    } catch (caught) {
      if (fallback && (!online || caught instanceof TypeError)) {
        queueForServerConfirmation(fallback);
      } else {
        setMessage(messageFrom(caught, "We could not save that action."));
      }
    } finally {
      setBusy(null);
    }
  }

  const handleMainActionClick = (actionName: ShiftAction) => {
    void act(actionName);
  };

  async function handleWorkerProjectCreated(input: { name: string; description: string }) {
    const created = await createWorkerProject(input);
    setProjects((current) => [...current, created].sort((a, b) => a.name.localeCompare(b.name)));
    setSelectedProjectId(created.id);
    setWorkerProjectDialogOpen(false);
    setMessage(t("projectCreated"));
  }

  if (loading) {
    return (
      <Shell title={t("workerHeaderTitle")} user={user} onSignOut={onSignOut}>
        <div className="mx-auto max-w-3xl rounded-3xl border border-border bg-card p-7 text-sm text-muted-foreground" role="status">
          {t("saving")}
        </div>
      </Shell>
    );
  }

  return (
    <Shell title={t("workerHeaderTitle")} user={user} onSignOut={onSignOut}>
      <div className={`mx-auto max-w-3xl space-y-6 md:pb-0 ${(shift.state === "working" || shift.state === "on_break") && workerSection !== "today" ? "pb-32" : "pb-20"}`}>
        <SectionNavigation
          label={t("sections")}
          value={workerSection}
          onChange={selectWorkerSection}
          items={[
            { id: "today", label: t("todayTab"), icon: <Clock3 className="h-4 w-4" aria-hidden="true" /> },
            { id: "history", label: t("historyTab"), icon: <History className="h-4 w-4" aria-hidden="true" /> },
            { id: "pay", label: t("hoursSummaryTitle"), icon: <Briefcase className="h-4 w-4" aria-hidden="true" /> },
          ]}
        />

        {(shift.state === "working" || shift.state === "on_break") && workerSection !== "today" && (
          <div
            className="fixed inset-x-0 z-30 px-3 md:hidden"
            style={{ bottom: "calc(4.5rem + env(safe-area-inset-bottom))" }}
          >
            <button
              type="button"
              onClick={() => selectWorkerSection("today")}
              className="mx-auto flex min-h-12 w-full max-w-md items-center justify-between gap-3 rounded-2xl border border-brand/40 bg-foreground px-4 text-background shadow-lg"
            >
              <span className="flex min-w-0 items-center gap-2 text-sm font-semibold">
                <Clock3 className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="truncate">{copy.label}</span>
              </span>
              <span className="flex shrink-0 items-center gap-3">
                <span className="font-mono text-sm font-bold">{duration}</span>
                <span className="text-xs font-semibold">{t("todayTab")}</span>
              </span>
            </button>
          </div>
        )}

        {/* Offline & Queue Status Banner */}
        {(!online || pendingQueueCount > 0) && (
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-warning/40 bg-warning/10 p-4 text-xs font-semibold text-foreground">
            <div className="flex items-center gap-2">
              {!online ? <WifiOff className="h-4 w-4 text-warning" /> : <RefreshCw className="h-4 w-4 animate-spin text-warning" />}
              <span>
                {!online ? t("offline") : t("online")} — {pendingQueueCount} {t("syncPending")}
              </span>
            </div>
            {online && (
              <button
                type="button"
                onClick={() => void triggerSync()}
                className="min-h-11 rounded-xl bg-warning/20 px-3 py-2 hover:bg-warning/30"
              >
                Sync Now
              </button>
            )}
          </div>
        )}

        {message && (
          <div role="status" className="flex items-start justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3 text-sm shadow-xs">
            <span>{message}</span>
            <button type="button" onClick={() => setMessage("")} className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted" aria-label={t("close")}>
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        )}

        {workerSection === "today" && (
          <>
        <section className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between border-b border-border px-5 py-4 sm:px-7">
            <div>
              <p className="label-eyebrow">{new Date().toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}</p>
              <h1 className="mt-1 text-2xl font-semibold">{t("hiUser")}, {user.displayName.split(" ")[0]}</h1>
            </div>
            <div className="flex items-center gap-2">
              {online ? (
                <span className="flex items-center gap-1 rounded-full bg-success/15 px-2.5 py-0.5 text-[11px] font-semibold text-success">
                  <Wifi className="h-3 w-3" /> {t("online")}
                </span>
              ) : (
                <span className="flex items-center gap-1 rounded-full bg-warning/15 px-2.5 py-0.5 text-[11px] font-semibold text-foreground">
                  <WifiOff className="h-3 w-3" /> {t("offline")}
                </span>
              )}
              <div className={`rounded-full px-3 py-1 text-xs font-semibold ${copy.tone === "live" ? "bg-success/15 text-success" : copy.tone === "break" ? "bg-warning/15 text-foreground" : "bg-muted text-muted-foreground"}`}>
                {copy.label}
              </div>
            </div>
          </div>
          <div className="px-5 py-7 sm:px-7 sm:py-10">
            <div className="flex items-end justify-between gap-5">
              <div>
                <p className="label-eyebrow">{t("workedToday")}</p>
                <p className="mt-2 font-mono text-5xl font-semibold tracking-tight sm:text-6xl">{duration}</p>
              </div>
              <Clock3 className="mb-2 h-9 w-9 text-brand" aria-hidden="true" />
            </div>

            {/* Assigned Project or Project Selector */}
            <div className="mt-6 rounded-2xl border border-border bg-muted/30 p-4">
              {shift.state === "off_shift" ? (
                <div>
                    <div className={`mb-2 flex gap-2 ${shortMobileViewport ? "flex-row items-center justify-between" : "flex-col items-start sm:flex-row sm:items-center sm:justify-between"}`}>
                    <label className="flex items-center gap-1.5 text-xs font-semibold uppercase text-muted-foreground">
                      <Building2 className="h-3.5 w-3.5 text-brand" /> {t("assignedProject")}
                    </label>
                    <button
                      type="button"
                      onClick={() => setWorkerProjectDialogOpen(true)}
                      aria-label={t("newProjectBtn")}
                      className={`inline-flex min-h-11 items-center gap-1 rounded-xl text-xs font-semibold text-foreground hover:bg-brand/10 ${shortMobileViewport ? "min-w-11 justify-center px-0" : "px-3"}`}
                    >
                      <Plus className="h-3 w-3" aria-hidden="true" /> <span className={shortMobileViewport ? "sr-only" : ""}>{t("newProjectBtn")}</span>
                    </button>
                  </div>
                  {projects.length === 0 ? (
                    <p className="text-xs text-muted-foreground">{t("noProjectsAvailable")}</p>
                  ) : (
                    <select
                      aria-label={t("assignedProject")}
                      value={selectedProjectId}
                      onChange={(e) => setSelectedProjectId(e.target.value)}
                      className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} {p.code ? `(${p.code})` : ""}
                        </option>
                      ))}
                    </select>
                  )}
                  {!pinClockIn && selectedProject && selectedProject.latitude !== null && (
                    <p className="mt-2 text-[11px] text-muted-foreground flex items-center gap-1">
                      <Navigation className="h-3 w-3 text-info" /> {t("geofenceActive")} {selectedProject.radius_m}m.
                    </p>
                  )}
                  {!pinClockIn && selectedProject?.address && (
                    <p className="mt-2 text-xs leading-5 text-muted-foreground">{selectedProject.address}</p>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground font-medium">{t("assignedProject")}</p>
                    <p className="text-sm font-bold text-foreground mt-0.5">
                      {shift.projectName || selectedProject?.name || t("generalWork")}
                    </p>
                  </div>
                  <Briefcase className="h-5 w-5 text-muted-foreground" />
                </div>
              )}
            </div>

            {!pinClockIn && <p className="mt-4 max-w-lg text-sm leading-6 text-muted-foreground">{copy.detail}</p>}

            <div className={`${pinClockIn ? "mt-2 min-h-14" : "mt-7"} flex flex-col gap-3 sm:flex-row`}>
              {finishRequested ? (
                <div className="flex w-full flex-col gap-3 rounded-2xl border border-warning/40 bg-warning/10 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold">{t("finishPromptTitle")}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{t("finishPromptDetail")}</p>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setFinishRequested(false)} className="min-h-12 rounded-xl border border-border px-4 py-3 text-sm font-semibold hover:bg-background">{t("cancel")}</button>
                    <button type="button" onClick={() => act("clock_out")} disabled={Boolean(busy)} className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60">
                      {busy === "clock_out" && <Loader2 className="h-4 w-4 animate-spin" />}
                      {busy === "clock_out" ? t("saving") : t("confirmFinish")}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {action && (
                    <button
                      type="button"
                      onClick={() => handleMainActionClick(action)}
                      disabled={Boolean(busy) || (action === "clock_in" && !selectedProjectId)}
                      className={`flex min-h-14 flex-1 items-center justify-center gap-3 rounded-2xl px-5 text-base font-semibold shadow-sm transition hover:brightness-95 disabled:opacity-60 ${pinClockIn ? "fixed inset-x-3 z-30 mx-auto max-w-3xl" : ""} ${
                        action === "start_break" ? "bg-warning text-warning-foreground" : "bg-brand text-brand-foreground"
                      }`}
                      style={pinClockIn ? { bottom: "calc(4.5rem + env(safe-area-inset-bottom))" } : undefined}
                    >
                      {busy === action ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : action === "clock_in" ? (
                        <Navigation className="h-5 w-5" />
                      ) : action === "start_break" ? (
                        <Pause className="h-5 w-5" fill="currentColor" />
                      ) : (
                        <ArrowRight className="h-5 w-5" />
                      )}
                      {busy === action ? t("saving") : getActionLabel(action, t)}
                    </button>
                  )}
                  {shift.state === "working" && (
                    <button type="button" onClick={() => setFinishRequested(true)} disabled={Boolean(busy)} className="flex min-h-14 items-center justify-center gap-3 rounded-2xl border border-border px-5 text-base font-semibold transition hover:bg-muted disabled:opacity-60">
                      <LogOut className="h-5 w-5" /> {t("finishShift")}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </section>

        <LocationEvidenceList
          events={shift.events}
          timezone={user.timezone}
          collapsible
          onViewPhoto={(photo, ev) =>
            setPhotoModal({
              photo,
              title: `${user.displayName} — ${getActionLabel(ev.type, t)}`,
              subtitle: formatRecordedDateTime(ev.at, user.timezone),
            })
          }
        />
          </>
        )}

        {workerSection === "pay" && (
          <>
            <WorkerPayrollSummaryCard summary={payrollSummary} timezone={user.timezone} />
            <WorkerPayrollProfileForm
              profile={payrollProfile}
              loading={payrollProfileLoading}
              onSaved={(saved) => {
                setPayrollProfile(saved);
                setMessage(t("profileSavedStatus"));
              }}
            />
          </>
        )}

        {/* Worker Shift History Section */}
        {workerSection === "history" && (
        <section className="rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-7">
          <div className="flex items-center justify-between border-b border-border pb-4">
            <div>
              <p className="label-eyebrow">{t("historyTab")}</p>
              <h1 className="mt-1 text-lg font-semibold">{t("myPastShifts")}</h1>
            </div>
            <History className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="mt-4 divide-y divide-border">
            {historyLoading && <p className="py-4 text-center text-xs text-muted-foreground">{t("saving")}</p>}
            {!historyLoading && history.length === 0 && (
              <p className="py-6 text-center text-xs text-muted-foreground">{t("noPastShiftsYet")}</p>
            )}
            {history.slice(0, visibleWorkerHistory).map((record) => (
              <div key={record.id} data-testid="worker-history-record" className="flex items-start justify-between gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold">{record.work_date}</p>
                    {record.project_name && (
                      <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                        {record.project_name}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {t("colClockIn")}: {formatRecordedTime(record.clock_in_at, user.timezone)}
                    {record.clock_out_at ? ` · ${t("colClockOut")}: ${formatRecordedTime(record.clock_out_at, user.timezone)}` : ` · ${t("inProgress")}`}
                    {record.break_minutes > 0 && ` · ${t("colBreak")}: ${formatMinutes(record.break_minutes)}`}
                  </p>
                  {record.admin_adjustment && (
                    <div className="mt-2 rounded-lg border border-warning/50 bg-warning/15 px-3 py-2 text-xs leading-5 text-foreground">
                      <p className="font-semibold">
                        {record.admin_adjustment.kind === "created" ? t("adminCreatedNotice") : t("adminAdjustedNotice")}
                      </p>
                      <p className="mt-0.5"><span className="font-semibold">{record.admin_adjustment.kind === "created" ? t("adminCreatedDescription") : t("adminAdjustedReason")}:</span> {record.admin_adjustment.reason}</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {record.admin_adjustment.kind === "created" ? t("adminCreatedAt") : t("adminAdjustedAt")} {formatRecordedDateTime(record.admin_adjustment.adjusted_at, user.timezone)}
                      </p>
                    </div>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-mono text-sm font-bold text-foreground">{formatMinutes(record.net_minutes)}</p>
                  <p className="text-[11px] text-success font-medium">{t("logged")}</p>
                </div>
              </div>
            ))}
          </div>
          {visibleWorkerHistory < history.length && <div className="mt-4">
            <ShowMoreButton
              visible={Math.min(visibleWorkerHistory, history.length)}
              total={history.length}
              onClick={() => setVisibleWorkerHistory((current) => Math.min(current + LIST_PAGE_SIZE, history.length))}
              label={t("showMore")}
            />
          </div>}
        </section>
        )}

        {workerProjectDialogOpen && (
          <WorkerProjectModal
            onClose={() => setWorkerProjectDialogOpen(false)}
            onCreated={handleWorkerProjectCreated}
          />
        )}

        {/* Photo Evidence Modal */}
        {photoModal && (
          <PhotoEvidenceModal
            photo={photoModal.photo}
            title={photoModal.title}
            subtitle={photoModal.subtitle}
            onClose={() => setPhotoModal(null)}
          />
        )}

      </div>
    </Shell>
  );
}

function WorkerPayrollSummaryCard({
  summary,
  timezone,
}: {
  summary: WorkerPayrollSummary | null;
  timezone: string;
}) {
  const { t } = useI18n();
  return (
    <section className="rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-7" aria-labelledby="hours-pay-title">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="label-eyebrow">Field Hours · Jersey</p>
          <h1 id="hours-pay-title" className="mt-1 text-lg font-semibold">{t("hoursSummaryTitle")}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{t("hoursSummaryHelp")}</p>
        </div>
        <Calendar className="h-5 w-5 text-muted-foreground" />
      </div>
      {!summary ? (
        <p className="mt-5 rounded-2xl bg-muted/50 px-4 py-4 text-sm text-muted-foreground">{t("payrollSummaryUnavailable")}</p>
      ) : (
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-border bg-muted/30 p-4">
            <p className="text-xs font-semibold text-muted-foreground">{t("thisMonth")}</p>
            <p className="mt-2 font-mono text-2xl font-semibold">{formatMinutes(summary.currentMonthMinutes)}</p>
            <p className="mt-1 text-xs text-muted-foreground">{summary.currentMonthShifts} {t("completedShiftsLabel").toLowerCase()} · {formatCalendarDate(summary.currentMonthStart, timezone)}</p>
          </div>
          <div className="rounded-2xl border border-border bg-muted/30 p-4">
            <p className="text-xs font-semibold text-muted-foreground">{t("allCompletedShiftsLabel")}</p>
            <p className="mt-2 font-mono text-2xl font-semibold">{formatMinutes(summary.totalCompletedMinutes)}</p>
            <p className="mt-1 text-xs text-muted-foreground">{summary.totalCompletedShifts} {t("completedShiftsLabel").toLowerCase()}</p>
          </div>
        </div>
      )}
    </section>
  );
}

function WorkerPayrollProfileForm({
  profile,
  loading,
  onSaved,
}: {
  profile: WorkerPayrollProfile | null;
  loading: boolean;
  onSaved: (profile: WorkerPayrollProfile) => void;
}) {
  const { t } = useI18n();
  const [form, setForm] = useState(() => payrollFormFromProfile(profile));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setForm(payrollFormFromProfile(profile));
  }, [profile]);

  if (loading) {
    return (
      <section className="rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-7" aria-labelledby="payroll-profile-title">
        <p className="text-sm text-muted-foreground">{t("payrollProfileLoading")}</p>
      </section>
    );
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const saved = await saveWorkerPayrollProfile({
        legalName: form.legalName,
        address: form.address,
        employeeNumber: form.employeeNumber,
        taxReference: form.taxReference || undefined,
        socialReference: form.socialReference || undefined,
        itisRate: Number(form.itisRate),
      });
      setForm((previous) => ({
        ...previous,
        taxReference: "",
        socialReference: "",
      }));
      onSaved(saved);
    } catch (caught) {
      setError(messageFrom(caught, t("payrollProfileSaveError")));
    } finally {
      setBusy(false);
    }
  }

  const statusLabel = profile?.isComplete ? t("profileSavedStatus") : t("profileNotSavedStatus");

  return (
    <section className="rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-7" aria-labelledby="payroll-profile-title">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="label-eyebrow">{t("salaryDetailsTitle")} · Jersey</p>
          <h2 id="payroll-profile-title" className="mt-1 text-lg font-semibold">{t("salaryDetailsTitle")}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{t("salaryDetailsHelp")}</p>
        </div>
        <Briefcase className="h-5 w-5 text-muted-foreground" />
      </div>
      <div className="mt-4 rounded-2xl border border-border bg-muted/40 px-4 py-3 text-xs">
        <span className="font-semibold">{t("statusLabel")}:</span> {statusLabel}
      </div>
      <form className="mt-5 space-y-5" onSubmit={(event) => void submit(event)}>
        <div className="grid gap-4 sm:grid-cols-2">
          <PayrollInput label={t("legalName")} value={form.legalName} onChange={(value) => setForm({ ...form, legalName: value })} required autoComplete="name" />
          <PayrollInput
            label={t("employeeNumber")}
            value={form.employeeNumber}
            onChange={(value) => setForm({ ...form, employeeNumber: value.toUpperCase() })}
            required
            autoComplete="off"
            autoCapitalize="characters"
            pattern="[A-Za-z0-9][A-Za-z0-9._/-]{0,39}"
            maxLength={40}
            help={t("employeeNumberHelp")}
          />
        </div>
        <PayrollInput label={t("homeAddress")} value={form.address} onChange={(value) => setForm({ ...form, address: value })} required autoComplete="street-address" />
        <div className="grid gap-4 sm:grid-cols-2">
          <PayrollInput label={t("taxReference")} type="password" value={form.taxReference} onChange={(value) => setForm({ ...form, taxReference: value })} required={!profile?.hasTaxReference} autoComplete="off" placeholder={profile?.hasTaxReference ? t("storedKeepPlaceholder") : t("requiredLabel")} />
          <PayrollInput label={t("socialSecurityNumber")} type="password" value={form.socialReference} onChange={(value) => setForm({ ...form, socialReference: value })} required={!profile?.hasSocialReference} autoComplete="off" placeholder={profile?.hasSocialReference ? t("storedKeepPlaceholder") : t("requiredLabel")} />
          <PayrollInput
            label={t("employeeItisRate")}
            type="number"
            value={form.itisRate}
            onChange={(value) => setForm({ ...form, itisRate: value })}
            required
            min="0"
            max="100"
            step="1"
            suffix="%"
            help={t("itisRateHelp")}
            inputMode="numeric"
          />
        </div>
        <p className="text-xs text-muted-foreground">{t("sensitiveEncrypted")}</p>
        {error && <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-3 text-sm text-destructive">{error}</p>}
        <button type="submit" disabled={busy} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60 sm:w-auto">
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          {busy ? t("saving") : profile ? t("updateProfile") : t("saveProfile")}
        </button>
      </form>
    </section>
  );
}

type PayrollFormState = {
  legalName: string;
  address: string;
  employeeNumber: string;
  taxReference: string;
  socialReference: string;
  itisRate: string;
};

function payrollFormFromProfile(profile: WorkerPayrollProfile | null): PayrollFormState {
  return {
    legalName: profile?.legalName ?? "",
    address: profile?.address ?? "",
    employeeNumber: profile?.employeeNumber ?? "",
    taxReference: "",
    socialReference: "",
    itisRate: profile?.itisRate == null ? "" : String(profile.itisRate),
  };
}

function PayrollInput({
  label,
  value,
  onChange,
  required,
  type = "text",
  autoComplete,
  placeholder,
  min,
  max,
  step,
  suffix,
  pattern,
  maxLength,
  help,
  autoCapitalize,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  type?: string;
  autoComplete?: string;
  placeholder?: string;
  min?: string;
  max?: string;
  step?: string;
  suffix?: string;
  pattern?: string;
  maxLength?: number;
  help?: string;
  autoCapitalize?: "none" | "off" | "sentences" | "words" | "characters";
  inputMode?: "none" | "text" | "tel" | "url" | "email" | "numeric" | "decimal" | "search";
}) {
  return (
    <label className="block text-sm font-medium">
      {label}{required && <span className="ml-1 text-destructive">*</span>}
      <span className="relative mt-1.5 block">
        <input
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          required={required}
          autoComplete={autoComplete}
          placeholder={placeholder}
          min={min}
          max={max}
          step={step}
          pattern={pattern}
          maxLength={maxLength}
          autoCapitalize={autoCapitalize}
          inputMode={inputMode}
          className={`h-11 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground placeholder:opacity-100 outline-none focus-visible:ring-2 focus-visible:ring-ring ${suffix ? "pr-9" : ""}`}
        />
        {suffix && <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">{suffix}</span>}
      </span>
      {help && <span className="mt-1 block text-xs font-normal text-muted-foreground">{help}</span>}
    </label>
  );
}

function LocationEvidenceList({
  events,
  timezone,
  onViewPhoto,
  collapsible = false,
}: {
  events: ShiftEvent[];
  timezone: string;
  onViewPhoto?: (photo: string, event: ShiftEvent) => void;
  collapsible?: boolean;
}) {
  const { t } = useI18n();
  const latestEvent = events.at(-1);
  const header = (
    <div className="flex min-w-0 items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="label-eyebrow">{t("locationEvidenceTitle")}</p>
        <h2 id={collapsible ? "worker-evidence-title" : undefined} className="mt-1 text-lg font-semibold">{t("locationEvidenceSubtitle")}</h2>
        {collapsible && latestEvent && (
          <p className="mt-1 truncate text-xs text-muted-foreground">
            {getActionLabel(latestEvent.type, t)} · {formatRecordedTime(latestEvent.at, timezone)} · {events.length}
          </p>
        )}
      </div>
      <MapPin className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
    </div>
  );
  const content = (
    <div className="mt-5 space-y-3">
      {events.length === 0 && <p className="rounded-2xl bg-muted/60 px-4 py-4 text-sm text-muted-foreground">{t("noClockEventsToday")}</p>}
      {events.slice().reverse().map((event) => (
        <div key={event.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-muted/60 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            {event.photo && (
              <button
                type="button"
                onClick={() => onViewPhoto?.(event.photo!, event)}
                className="group relative h-11 w-11 shrink-0 overflow-hidden rounded-xl border border-border bg-black shadow-sm"
                aria-label={t("viewPhoto")}
              >
                <img src={event.photo} alt="" className="h-full w-full object-cover transition group-hover:scale-110" />
                <div className="absolute inset-0 flex items-center justify-center bg-black/20 text-white opacity-0 transition group-hover:opacity-100">
                  <Camera className="h-3.5 w-3.5" aria-hidden="true" />
                </div>
              </button>
            )}
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-1.5 text-sm font-semibold">
                {getActionLabel(event.type, t)}
                {event.photo && (
                  <span className="flex items-center gap-1 rounded-md bg-brand/15 px-1.5 py-0.5 text-[10px] font-semibold text-foreground">
                    <Camera className="h-3 w-3 text-brand" aria-hidden="true" /> {t("photoVerified")}
                  </span>
                )}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {formatRecordedTime(event.at, timezone)} · ±{event.location.accuracy}m
              </p>
            </div>
          </div>
          <a href={locationLink(event.location)} target="_blank" rel="noopener noreferrer" className="flex min-h-11 items-center rounded-xl px-3 text-xs font-semibold text-info underline-offset-4 hover:bg-background hover:underline">
            {t("openMap")}
          </a>
        </div>
      ))}
    </div>
  );

  if (collapsible) {
    return (
      <details className="group rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-7" aria-labelledby="worker-evidence-title">
        <summary className="min-h-11 cursor-pointer list-none rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
          {header}
        </summary>
        {content}
      </details>
    );
  }

  return (
    <section className="rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-7">
      {header}
      {content}
    </section>
  );
}

function toPerson(row: AdminSnapshot, t: Translate, timezone: string): Person {
  const latest = row.events.at(-1);
  return {
    id: row.user_id,
    name: row.display_name,
    role: row.role === "admin" ? "Administrator" : "Worker",
    state: row.state,
    clockInAt: row.clock_in_at,
    clockOutAt: row.clock_out_at,
    projectId: row.project_id,
    projectName: row.project_name,
    events: row.events,
    lastEvent: latest
      ? `${getActionLabel(latest.type, t)} · ${formatRecordedTime(latest.at, timezone)}`
      : t("stateOffShift"),
  };
}

function WorkerProjectModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (input: { name: string; description: string }) => Promise<void>;
}) {
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const dialogRef = useModalFocus(onClose);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmedName = name.trim();
    const trimmedDescription = description.trim();
    if (trimmedName.length < 2) {
      setError(t("projectNameMin"));
      return;
    }
    if (!trimmedDescription) {
      setError(t("projectDescriptionRequired"));
      return;
    }
    setBusy(true);
    setError("");
    try {
      await onCreated({ name: trimmedName, description: trimmedDescription });
    } catch (caught) {
      setError(messageFrom(caught, "Could not create project."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-foreground/40 p-4" onClick={onClose}>
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="worker-project-title"
        tabIndex={-1}
        className="max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto overscroll-contain rounded-3xl border border-border bg-card p-5 shadow-2xl outline-none sm:p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-border pb-4">
          <div>
            <p className="label-eyebrow text-muted-foreground font-semibold">{t("assignedProject")}</p>
            <h2 id="worker-project-title" className="mt-1 text-xl font-bold">{t("newProject")}</h2>
          </div>
          <button type="button" onClick={onClose} className="flex min-h-11 min-w-11 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted" aria-label={t("close")}>
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase text-muted-foreground">{t("projectName")}</label>
            <input
              aria-label={t("projectName")}
              data-dialog-initial-focus
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={120}
              className="mt-1.5 h-11 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase text-muted-foreground">{t("projectDescription")}</label>
            <textarea
              aria-label={t("projectDescription")}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={300}
              rows={4}
              className="mt-1.5 w-full resize-none rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              required
            />
          </div>
          <p className="rounded-xl bg-muted/50 px-3 py-2.5 text-xs text-muted-foreground">{t("workerProjectGpsHint")}</p>
          {error && <p role="alert" className="rounded-xl bg-destructive/10 p-2.5 text-xs text-destructive">{error}</p>}
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="min-h-11 flex-1 rounded-xl border border-border py-2.5 text-sm font-semibold hover:bg-muted">{t("cancel")}</button>
            <button type="submit" disabled={busy} className="min-h-11 flex-1 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
              {busy ? t("saving") : t("save")}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function ProjectEditModal({
  project,
  onClose,
  onSaved,
}: {
  project: Project | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useI18n();
  const [name, setName] = useState(project?.name || "");
  const [code, setCode] = useState(project?.code || "");
  const [address, setAddress] = useState(project?.address || "");
  const [latitude, setLatitude] = useState(project?.latitude?.toString() || "");
  const [longitude, setLongitude] = useState(project?.longitude?.toString() || "");
  const [radiusM, setRadiusM] = useState(project?.radius_m?.toString() || "200");
  const [isActive, setIsActive] = useState(project ? project.is_active : true);
  const [busy, setBusy] = useState(false);
  const [gpsBusy, setGpsBusy] = useState(false);
  const [error, setError] = useState("");
  const dialogRef = useModalFocus(onClose);

  const handleCaptureCurrentGPS = async () => {
    setGpsBusy(true);
    setError("");
    try {
      const loc = await requestLocation();
      setLatitude(loc.latitude.toString());
      setLongitude(loc.longitude.toString());
    } catch (caught) {
      setError(messageFrom(caught, "Could not capture device location."));
    } finally {
      setGpsBusy(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Project name is required.");
      return;
    }
    setError("");
    setBusy(true);
    try {
      await saveProject({
        id: project?.id,
        name: name.trim(),
        code: code.trim() || undefined,
        address: address.trim() || undefined,
        latitude: latitude ? parseFloat(latitude) : undefined,
        longitude: longitude ? parseFloat(longitude) : undefined,
        radiusM: radiusM ? parseInt(radiusM, 10) : 200,
        isActive,
      });
      onSaved();
      onClose();
    } catch (caught) {
      setError(messageFrom(caught, "Could not save project."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-foreground/40 p-4" onClick={onClose}>
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-project-title"
        tabIndex={-1}
        className="max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto overscroll-contain rounded-3xl border border-border bg-card p-5 shadow-2xl outline-none sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-border pb-4">
          <div>
            <p className="label-eyebrow text-muted-foreground font-semibold">{t("projectsSubtitle")}</p>
            <h2 id="admin-project-title" className="mt-1 text-xl font-bold">{project ? t("editProject") : t("newProject")}</h2>
          </div>
          <button type="button" onClick={onClose} className="flex min-h-11 min-w-11 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted" aria-label={t("close")}>
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase">{t("projectName")}</label>
            <input
              aria-label={t("projectName")}
              data-dialog-initial-focus
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Edificio Residencial Los Olivos"
              className="mt-1.5 h-11 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase">{t("projectCode")}</label>
              <input
                aria-label={t("projectCode")}
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="e.g. PRJ-01"
                className="mt-1.5 h-11 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase">{t("geofenceRadius")}</label>
              <input
                aria-label={t("geofenceRadius")}
                type="number"
                min={20}
                max={50000}
                value={radiusM}
                onChange={(e) => setRadiusM(e.target.value)}
                className="mt-1.5 h-11 w-full rounded-xl border border-input bg-background px-3 text-sm font-mono outline-none focus-visible:ring-2 focus-visible:ring-ring"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase">{t("siteAddress")}</label>
            <input
              aria-label={t("siteAddress")}
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="e.g. Av. Principal #450"
              className="mt-1.5 h-11 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          {/* GPS Coordinates & Capture Button */}
          <div className="rounded-2xl border border-border bg-muted/40 p-3 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5 text-brand" /> {t("gpsCoordinates")}
              </span>
              <button
                type="button"
                onClick={handleCaptureCurrentGPS}
                disabled={gpsBusy}
                className="flex min-h-11 items-center gap-1 rounded-lg px-2 text-[11px] font-semibold text-info hover:bg-background hover:underline"
              >
                {gpsBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Crosshair className="h-3 w-3" />}
                {t("useMyLocation")}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 font-mono text-xs">
              <input
                aria-label="Latitude"
                type="number"
                step="any"
                placeholder="Latitude"
                value={latitude}
                onChange={(e) => setLatitude(e.target.value)}
                className="h-11 rounded-lg border border-input bg-background px-2"
              />
              <input
                aria-label="Longitude"
                type="number"
                step="any"
                placeholder="Longitude"
                value={longitude}
                onChange={(e) => setLongitude(e.target.value)}
                className="h-11 rounded-lg border border-input bg-background px-2"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="isActiveCheck"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
            />
            <label htmlFor="isActiveCheck" className="text-xs font-medium text-foreground cursor-pointer">
              {t("activeProjectCheck")}
            </label>
          </div>

          {error && <p role="alert" className="text-xs text-destructive rounded-xl bg-destructive/10 p-2.5">{error}</p>}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="min-h-11 flex-1 rounded-xl border border-border py-2.5 text-sm font-semibold hover:bg-muted"
            >
              {t("cancel")}
            </button>
            <button
              type="submit"
              disabled={busy}
              className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {t("saveProject")}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function CreateAdminShiftModal({
  workers,
  projects,
  onClose,
  onSaved,
}: {
  workers: Person[];
  projects: Project[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useI18n();
  const localDateTime = (hour: number) => {
    const value = new Date();
    value.setHours(hour, 0, 0, 0);
    const offset = value.getTimezoneOffset() * 60_000;
    return new Date(value.getTime() - offset).toISOString().slice(0, 16);
  };
  const [workerId, setWorkerId] = useState(workers[0]?.id ?? "");
  const [projectId, setProjectId] = useState("");
  const [clockIn, setClockIn] = useState(() => localDateTime(8));
  const [clockOut, setClockOut] = useState(() => localDateTime(17));
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const dialogRef = useModalFocus(onClose);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!workerId) {
      setError(t("selectWorker"));
      return;
    }
    if (description.trim().length < 3) {
      setError(t("workDescription"));
      return;
    }
    const clockInAt = new Date(clockIn);
    const clockOutAt = new Date(clockOut);
    if (!clockIn || !clockOut || !Number.isFinite(clockInAt.getTime()) || !Number.isFinite(clockOutAt.getTime()) || clockOutAt <= clockInAt) {
      setError("Clock-out time must be after clock-in time.");
      return;
    }

    setError("");
    setBusy(true);
    try {
      await createAdminShift({
        userId: workerId,
        projectId: projectId || undefined,
        clockInAt: clockInAt.toISOString(),
        clockOutAt: clockOutAt.toISOString(),
        description: description.trim(),
      });
      onSaved();
      onClose();
    } catch (caught) {
      setError(messageFrom(caught, "Could not create the workday."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-foreground/40 p-4 sm:items-center" onClick={onClose}>
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-workday-title"
        tabIndex={-1}
        className="max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto overscroll-contain rounded-3xl border border-border bg-card p-5 shadow-2xl outline-none sm:p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-border pb-4">
          <div>
            <p className="label-eyebrow text-muted-foreground font-semibold">{t("auditAdjustment")}</p>
            <h2 id="create-workday-title" className="mt-1 text-xl font-bold">{t("createWorkdayTitle")}</h2>
          </div>
          <button type="button" onClick={onClose} className="flex min-h-11 min-w-11 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted" aria-label={t("close")}>
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <label className="block text-xs font-semibold uppercase text-muted-foreground">
            {t("selectWorker")}
            <select data-dialog-initial-focus value={workerId} onChange={(event) => setWorkerId(event.target.value)} required className="mt-1.5 h-11 w-full rounded-xl border border-input bg-background px-3 text-sm font-semibold text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <option value="" disabled>{t("selectWorker")}</option>
              {workers.map((worker) => <option key={worker.id} value={worker.id}>{worker.name}</option>)}
            </select>
          </label>

          <label className="block text-xs font-semibold uppercase text-muted-foreground">
            {t("optionalProject")}
            <select value={projectId} onChange={(event) => setProjectId(event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-input bg-background px-3 text-sm font-semibold text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <option value="">{t("generalWork")}</option>
              {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
            </select>
          </label>

          <label className="block text-xs font-semibold uppercase text-muted-foreground">
            {t("clockInTime")}
            <input type="datetime-local" value={clockIn} onChange={(event) => setClockIn(event.target.value)} required className="mt-1.5 h-11 w-full rounded-xl border border-input bg-background px-3 font-mono text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring" />
          </label>

          <label className="block text-xs font-semibold uppercase text-muted-foreground">
            {t("clockOutTime")}
            <input type="datetime-local" value={clockOut} onChange={(event) => setClockOut(event.target.value)} required className="mt-1.5 h-11 w-full rounded-xl border border-input bg-background px-3 font-mono text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring" />
          </label>

          <label className="block text-xs font-semibold uppercase text-muted-foreground">
            {t("workDescription")}
            <textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder={t("workDescriptionPlaceholder")} minLength={3} maxLength={300} rows={3} required className="mt-1.5 w-full rounded-xl border border-input bg-background p-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring" />
          </label>

          {error && <p role="alert" className="rounded-xl bg-destructive/10 p-2.5 text-xs text-destructive">{error}</p>}

          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="min-h-11 flex-1 rounded-xl border border-border py-2.5 text-sm font-semibold hover:bg-muted">{t("cancel")}</button>
            <button type="submit" disabled={busy || workers.length === 0} className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {t("saveWorkday")}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function AdjustShiftModal({
  shift,
  onClose,
  onSaved,
}: {
  shift: ShiftHistoryRecord;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useI18n();
  const [clockIn, setClockIn] = useState(
    shift.clock_in_at ? new Date(shift.clock_in_at).toISOString().slice(0, 16) : ""
  );
  const [clockOut, setClockOut] = useState(
    shift.clock_out_at ? new Date(shift.clock_out_at).toISOString().slice(0, 16) : new Date().toISOString().slice(0, 16)
  );
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const dialogRef = useModalFocus(onClose);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setError(t("adjustReason"));
      return;
    }
    setError("");
    setBusy(true);
    try {
      await adjustShift({
        shiftId: shift.id,
        clockInAt: clockIn ? new Date(clockIn).toISOString() : undefined,
        clockOutAt: clockOut ? new Date(clockOut).toISOString() : undefined,
        reason: reason.trim(),
      });
      onSaved();
      onClose();
    } catch (caught) {
      setError(messageFrom(caught, "Could not save shift adjustment."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-foreground/40 p-4" onClick={onClose}>
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="adjust-shift-title"
        tabIndex={-1}
        className="max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto overscroll-contain rounded-3xl border border-border bg-card p-5 shadow-2xl outline-none sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-border pb-4">
          <div>
            <p className="label-eyebrow text-muted-foreground font-semibold">{t("auditAdjustment")}</p>
            <h2 id="adjust-shift-title" className="mt-1 text-xl font-bold">{t("adjustShiftTimes")}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{shift.display_name} · {shift.work_date}</p>
          </div>
          <button type="button" onClick={onClose} className="flex min-h-11 min-w-11 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted" aria-label={t("close")}>
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase">{t("clockInTime")}</label>
            <input
              aria-label={t("clockInTime")}
              data-dialog-initial-focus
              type="datetime-local"
              value={clockIn}
              onChange={(e) => setClockIn(e.target.value)}
              className="mt-1.5 h-11 w-full rounded-xl border border-input bg-background px-3 text-sm font-mono outline-none focus-visible:ring-2 focus-visible:ring-ring"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase">{t("clockOutTime")}</label>
            <input
              aria-label={t("clockOutTime")}
              type="datetime-local"
              value={clockOut}
              onChange={(e) => setClockOut(e.target.value)}
              className="mt-1.5 h-11 w-full rounded-xl border border-input bg-background px-3 text-sm font-mono outline-none focus-visible:ring-2 focus-visible:ring-ring"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase">{t("adjustReason")}</label>
            <textarea
              aria-label={t("adjustReason")}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t("adjustReasonPlaceholder")}
              rows={3}
              required
              className="mt-1.5 w-full rounded-xl border border-input bg-background p-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          {error && <p role="alert" className="text-xs text-destructive rounded-xl bg-destructive/10 p-2.5">{error}</p>}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="min-h-11 flex-1 rounded-xl border border-border py-2.5 text-sm font-semibold hover:bg-muted"
            >
              {t("cancel")}
            </button>
            <button
              type="submit"
              disabled={busy}
              className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {t("saveAdjustment")}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function AdminView({ user, onSignOut }: { user: SessionUser; onSignOut: () => void }) {
  const { t } = useI18n();
  const [viewMode, setViewModeParam] = useSectionParam(ADMIN_SECTIONS, "today");
  const desktopLayout = useMediaQuery("(min-width: 768px)");
  const [people, setPeople] = useState<Person[]>([]);
  const [visiblePeople, setVisiblePeople] = useState(LIST_PAGE_SIZE);
  const [projects, setProjects] = useState<Project[]>([]);
  const [visibleProjects, setVisibleProjects] = useState(LIST_PAGE_SIZE);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null | "new">(null);
  
  const [historyRecords, setHistoryRecords] = useState<ShiftHistoryRecord[]>([]);
  const [visibleHistoryRecords, setVisibleHistoryRecords] = useState(LIST_PAGE_SIZE);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyFilterPeriod, setHistoryFilterPeriod] = useState<"all" | "today" | "this_week" | "last_week" | "this_month">("this_month");
  const [historyFilterWorker, setHistoryFilterWorker] = useState<string>("all");
  const [historyFilterProject, setHistoryFilterProject] = useState<string>("all");
  const [historyFiltersOpen, setHistoryFiltersOpen] = useState(false);
  const [invitePanelOpen, setInvitePanelOpen] = useState(false);
  const [auditPanelOpen, setAuditPanelOpen] = useState(false);
  
  const [invite, setInvite] = useState<{ token: string; expiresAt: string } | null>(null);
  const [inviteBusy, setInviteBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [selectedPersonHistory, setSelectedPersonHistory] = useState<ShiftHistoryRecord[]>([]);
  const [selectedPersonLoading, setSelectedPersonLoading] = useState(false);
  const [createShiftOpen, setCreateShiftOpen] = useState(false);
  const [shiftToAdjust, setShiftToAdjust] = useState<ShiftHistoryRecord | null>(null);
  const [photoModal, setPhotoModal] = useState<{ photo: string; title: string; subtitle: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [googleRequests, setGoogleRequests] = useState<GoogleAuthRequest[]>([]);
  const [reviewingGoogleRequest, setReviewingGoogleRequest] = useState<string | null>(null);
  const [passwordResetRequests, setPasswordResetRequests] = useState<PasswordResetRequest[]>([]);
  const [issuingPasswordReset, setIssuingPasswordReset] = useState<string | null>(null);
  const [rejectingPasswordReset, setRejectingPasswordReset] = useState<string | null>(null);
  const [passwordResetLink, setPasswordResetLink] = useState("");
  const [requestHistory, setRequestHistory] = useState<RequestHistoryItem[]>([]);
  const [requestHistoryLoading, setRequestHistoryLoading] = useState(false);
  const closeWorkerDetails = useCallback(() => setSelectedPerson(null), []);
  const workerDetailsDialogRef = useModalFocus(closeWorkerDetails, Boolean(selectedPerson));
  const setViewMode = (nextSection: AdminSection) => {
    setMessage("");
    if (nextSection === "today" && viewMode !== "today") setVisiblePeople(LIST_PAGE_SIZE);
    if (nextSection === "history" && viewMode !== "history") setVisibleHistoryRecords(LIST_PAGE_SIZE);
    if (nextSection === "projects" && viewMode !== "projects") setVisibleProjects(LIST_PAGE_SIZE);
    setViewModeParam(nextSection);
  };

  useEffect(() => {
    setVisibleHistoryRecords(LIST_PAGE_SIZE);
  }, [historyFilterPeriod, historyFilterWorker, historyFilterProject]);
  const refreshToday = useCallback(async () => {
    setLoading(true);
    try {
      const members = await loadAdminToday();
      setPeople(members.map((m) => toPerson(m, t, user.timezone)));
      setUpdatedAt(new Date());
    } catch (caught) {
      setMessage(messageFrom(caught, "Today’s team could not be loaded."));
    } finally {
      setLoading(false);
    }

    try {
      const projs = await loadProjects();
      setProjects(projs);
    } catch {
      // Non-fatal if projects endpoint is still deploying
    }
  }, [t, user.timezone]);

  const refreshGoogleRequests = useCallback(async () => {
    try {
      setGoogleRequests(await loadGoogleAuthRequests());
    } catch {
      // The request panel is supplementary to the time clock.
    }
  }, []);

  const refreshPasswordResetRequests = useCallback(async () => {
    try {
      setPasswordResetRequests(await loadPasswordResetRequests());
    } catch {
      // The password reset panel is supplementary to the time clock.
    }
  }, []);

  const refreshRequestHistory = useCallback(async () => {
    setRequestHistoryLoading(true);
    try {
      setRequestHistory(await loadRequestHistory());
    } catch {
      // The history panel is supplementary to the time clock.
    } finally {
      setRequestHistoryLoading(false);
    }
  }, []);

  const calculateDateRange = useCallback((period: string) => {
    const today = new Date();
    const toYMD = (d: Date) => d.toISOString().slice(0, 10);
    
    if (period === "today") {
      return { start: toYMD(today), end: toYMD(today) };
    }
    if (period === "this_week") {
      const day = today.getDay();
      const diff = today.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(today.setDate(diff));
      return { start: toYMD(monday), end: toYMD(new Date()) };
    }
    if (period === "last_week") {
      const prevMonday = new Date();
      prevMonday.setDate(prevMonday.getDate() - 7 - (prevMonday.getDay() === 0 ? 6 : prevMonday.getDay() - 1));
      const prevSunday = new Date(prevMonday);
      prevSunday.setDate(prevSunday.getDate() + 6);
      return { start: toYMD(prevMonday), end: toYMD(prevSunday) };
    }
    if (period === "this_month") {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      return { start: toYMD(firstDay), end: toYMD(new Date()) };
    }
    return { start: undefined, end: undefined };
  }, []);

  const refreshHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const { start, end } = calculateDateRange(historyFilterPeriod);
      const records = await loadAdminHistory({
        userId: historyFilterWorker,
        projectId: historyFilterProject,
        startDate: start,
        endDate: end,
      });
      setHistoryRecords(records);
    } catch (caught) {
      setMessage(messageFrom(caught, "Could not load shift history."));
    } finally {
      setHistoryLoading(false);
    }
  }, [calculateDateRange, historyFilterPeriod, historyFilterWorker, historyFilterProject]);

  const refreshProjectsList = useCallback(async () => {
    setProjectsLoading(true);
    try {
      setProjects(await loadProjects());
    } catch (caught) {
      setMessage(messageFrom(caught, "Could not load projects."));
    } finally {
      setProjectsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshToday();
    void refreshGoogleRequests();
    void refreshPasswordResetRequests();
    void refreshRequestHistory();
    const timer = window.setInterval(() => {
      setNow(Date.now());
      void refreshToday();
      void refreshGoogleRequests();
      void refreshPasswordResetRequests();
      void refreshRequestHistory();
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [refreshToday, refreshGoogleRequests, refreshPasswordResetRequests, refreshRequestHistory]);

  useEffect(() => {
    if (viewMode === "history") {
      void refreshHistory();
    } else if (viewMode === "projects") {
      void refreshProjectsList();
    }
  }, [viewMode, refreshHistory, refreshProjectsList]);

  const counts = useMemo(() => ({
    working: people.filter((person) => person.state === "working").length,
    onBreak: people.filter((person) => person.state === "on_break").length,
    complete: people.filter((person) => person.state === "complete").length,
    total: people.length,
  }), [people]);
  const pendingAccessCount = googleRequests.length + passwordResetRequests.length;
  const activeHistoryFilterCount = Number(historyFilterPeriod !== "this_month") + Number(historyFilterWorker !== "all") + Number(historyFilterProject !== "all");

  const historyTotals = useMemo(() => {
    const totalNetMinutes = historyRecords.reduce((acc, r) => acc + (r.net_minutes || 0), 0);
    const totalBreakMinutes = historyRecords.reduce((acc, r) => acc + (r.break_minutes || 0), 0);
    const uniqueWorkers = new Set(historyRecords.map((r) => r.user_id)).size;
    return {
      totalNetMinutes,
      totalHours: (totalNetMinutes / 60).toFixed(1),
      totalBreakHours: (totalBreakMinutes / 60).toFixed(1),
      shiftsCount: historyRecords.length,
      workersCount: uniqueWorkers,
    };
  }, [historyRecords]);

  const inviteLink = invite ? `${window.location.origin}/join#invite=${invite.token}` : "";

  async function generateInvite() {
    setInviteBusy(true);
    setMessage("");
    try {
      setInvite(await createInvitation());
      setMessage("One-time invitation ready. It expires in 30 minutes.");
    } catch (caught) {
      setMessage(messageFrom(caught, "The invitation could not be created."));
    } finally {
      setInviteBusy(false);
    }
  }

  async function reviewGoogleRequest(request: GoogleAuthRequest, decision: "approve" | "reject") {
    setReviewingGoogleRequest(request.id);
    setMessage("");
    try {
      await reviewGoogleAuthRequest(request.id, decision);
      await refreshGoogleRequests();
      setMessage(decision === "approve" ? "Google sign-in approved." : "Google sign-in request rejected.");
    } catch (caught) {
      setMessage(messageFrom(caught, "The Google sign-in request could not be updated."));
    } finally {
      setReviewingGoogleRequest(null);
    }
  }

  async function generatePasswordResetLink(request: PasswordResetRequest) {
    setIssuingPasswordReset(request.id);
    setMessage("");
    try {
      const result = await issuePasswordReset(request.id);
      setPasswordResetLink(result.resetUrl);
      await refreshPasswordResetRequests();
      setMessage("Enlace de restablecimiento generado. Compártelo directamente con el trabajador; caduca en 30 minutos.");
    } catch (caught) {
      setMessage(messageFrom(caught, "No se pudo generar el enlace de restablecimiento."));
    } finally {
      setIssuingPasswordReset(null);
    }
  }

  async function rejectPasswordResetRequest(request: PasswordResetRequest) {
    setRejectingPasswordReset(request.id);
    setMessage("");
    try {
      await rejectPasswordReset(request.id, "Rejected by administrator");
      await refreshPasswordResetRequests();
      setMessage("Password reset request rejected.");
    } catch (caught) {
      setMessage(messageFrom(caught, "The password reset request could not be rejected."));
    } finally {
      setRejectingPasswordReset(null);
    }
  }

  async function copyPasswordResetLink() {
    try {
      await navigator.clipboard.writeText(passwordResetLink);
      setMessage("Enlace copiado.");
    } catch {
      setMessage("No se pudo copiar el enlace; selecciónalo manualmente.");
    }
  }

  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setMessage(t("copied"));
    } catch {
      setMessage("Your browser could not copy the link. The QR code is still ready to scan.");
    }
  }

  const handleOpenPersonDetails = async (person: Person) => {
    setSelectedPerson(person);
    setSelectedPersonLoading(true);
    try {
      const records = await loadAdminHistory({ userId: person.id });
      setSelectedPersonHistory(records);
    } catch {
      setSelectedPersonHistory([]);
    } finally {
      setSelectedPersonLoading(false);
    }
  };

  const exportExcel = () => {
    const wb = XLSX.utils.book_new();
    const rows = historyRecords.map((r) => ({
      "Date": r.work_date,
      "Worker": r.display_name,
      "Project / Site": r.project_name || t("generalWork"),
      "Status": r.state,
      "Clock In": r.clock_in_at ? formatRecordedTime(r.clock_in_at, user.timezone) : "",
      "Clock Out": r.clock_out_at ? formatRecordedTime(r.clock_out_at, user.timezone) : t("inProgress"),
      "Break (Hours)": (r.break_minutes / 60).toFixed(2),
      "Net Hours Worked": (r.net_minutes / 60).toFixed(2),
      "Duration": formatMinutes(r.net_minutes),
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, "Shifts History");
    XLSX.writeFile(wb, `FieldHours_Report_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <Shell title={viewMode === "today" ? t("todayTab") : viewMode === "history" ? t("historyTab") : viewMode === "salary" ? t("salaryAdviceTab") : viewMode === "projects" ? t("projectsTab") : t("teamAccessTitle")} user={user} onSignOut={onSignOut}>
      <div className="space-y-6 pb-20 md:pb-0">
        <div className="flex items-center justify-between gap-4">
          <SectionNavigation
            label={t("sections")}
            value={viewMode}
            onChange={setViewMode}
            items={[
              { id: "today", label: t("todayTab"), mobileLabel: t("todayTabShort"), icon: <Activity className="h-4 w-4" aria-hidden="true" /> },
              { id: "history", label: t("historyTab"), mobileLabel: t("historyTabShort"), icon: <Calendar className="h-4 w-4" aria-hidden="true" /> },
              { id: "salary", label: t("salaryAdviceTab"), mobileLabel: t("salaryAdviceTabShort"), icon: <FileText className="h-4 w-4" aria-hidden="true" /> },
              { id: "projects", label: t("projectsTab"), mobileLabel: t("projectsTabShort"), icon: <Building2 className="h-4 w-4" aria-hidden="true" /> },
              { id: "access", label: t("moreTab"), mobileLabel: t("moreTabShort"), icon: <Menu className="h-4 w-4" aria-hidden="true" /> },
            ]}
          />
          <div className="hidden items-center gap-2 text-xs text-muted-foreground sm:flex">
            <span className="h-2 w-2 rounded-full bg-success" />
            {updatedAt ? `${t("liveStatus")} ${updatedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : t("saving")}
          </div>
        </div>

        {message && (
          <div role="status" className="flex items-start justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3 text-sm shadow-xs">
            <span>{message}</span>
            <button type="button" onClick={() => setMessage("")} className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted" aria-label={t("close")}>
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        )}

        {viewMode === "access" && (
          <>
        <section className="rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-7">
          <p className="label-eyebrow">Field Hours · Accounts</p>
          <h1 className="mt-1 text-2xl font-semibold">{t("teamAccessTitle")}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{t("teamAccessHelp")}</p>
        </section>

        <details
          open={desktopLayout || invitePanelOpen}
          onToggle={(event) => {
            if (!desktopLayout) setInvitePanelOpen(event.currentTarget.open);
          }}
          className="group rounded-3xl border border-border bg-card shadow-sm"
        >
          <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 marker:content-none md:hidden">
            <span>
              <span className="label-eyebrow block">{t("inviteWorkerTitle")}</span>
              <span className="mt-1 block text-base font-semibold">{t("inviteWorkerSubtitle")}</span>
            </span>
            <ChevronDown className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden="true" />
          </summary>
          <div className="border-t border-border p-5 md:border-0 md:p-7">
          <div className="hidden items-start justify-between gap-4 md:flex">
            <div>
              <p className="label-eyebrow">{t("inviteWorkerTitle")}</p>
              <h2 id="invite-worker-title" className="mt-1 text-lg font-semibold">{t("inviteWorkerSubtitle")}</h2>
              <p className="mt-2 text-sm leading-5 text-muted-foreground">{t("oneTimeNotice")}</p>
            </div>
            <QrCode className="h-5 w-5 shrink-0 text-brand" aria-hidden="true" />
          </div>
          {invite ? (
            <div className="mt-6">
              <div className="flex justify-center rounded-2xl bg-white p-5">
                <QRCodeSVG value={inviteLink} size={210} level="M" includeMargin />
              </div>
              <p className="mt-3 text-center text-xs text-muted-foreground">
                Expires {new Date(invite.expiresAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </p>
              <button type="button" aria-label={t("copyLink")} onClick={() => void copyInvite()} className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-border py-3 text-sm font-semibold hover:bg-muted">
                <Copy className="h-4 w-4" aria-hidden="true" /> {t("copyLink")}
              </button>
              <button type="button" aria-label={t("close")} onClick={() => setInvite(null)} className="mt-2 min-h-11 w-full text-xs font-semibold text-muted-foreground hover:text-foreground">{t("close")}</button>
            </div>
          ) : (
            <button type="button" aria-label={t("createInvitation")} disabled={inviteBusy} onClick={() => void generateInvite()} className="mt-6 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
              {inviteBusy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <QrCode className="h-4 w-4" aria-hidden="true" />}
              {inviteBusy ? t("creatingInvitation") : t("createInvitation")}
            </button>
          )}
          <div className="mt-6 flex items-start gap-2 text-xs leading-5 text-muted-foreground">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" />
            {t("qrInstruction")}
          </div>
          </div>
        </details>

        {googleRequests.length > 0 && (
          <section className="rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-7" aria-labelledby="google-requests-title">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="label-eyebrow">Account access</p>
                <h2 id="google-requests-title" className="mt-1 text-lg font-semibold">Google sign-in requests</h2>
                <p className="mt-2 text-sm text-muted-foreground">Approve a new worker or link Google to an existing account.</p>
              </div>
              <ShieldCheck className="h-5 w-5 text-brand" />
            </div>
            <div className="mt-5 divide-y divide-border rounded-2xl border border-border">
              {googleRequests.map((request) => (
                <div key={request.id} className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{request.displayName}</p>
                    <p className="truncate text-xs text-muted-foreground">{request.email}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {request.requestType === "migration" ? "Link to existing account" : "New worker access"}
                      {request.requestedAt ? ` · ${new Date(request.requestedAt).toLocaleString()}` : ""}
                    </p>
                  </div>
                  <div className="flex w-full shrink-0 gap-2 sm:w-auto">
                    <button
                      type="button"
                      disabled={reviewingGoogleRequest === request.id}
                      onClick={() => void reviewGoogleRequest(request, "reject")}
                      className="min-h-11 flex-1 rounded-xl border border-border px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted disabled:opacity-60"
                    >
                      Reject
                    </button>
                    <button
                      type="button"
                      disabled={reviewingGoogleRequest === request.id}
                      onClick={() => void reviewGoogleRequest(request, "approve")}
                      className="min-h-11 flex-1 rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
                    >
                      {reviewingGoogleRequest === request.id ? "Saving…" : "Approve"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {(passwordResetRequests.length > 0 || passwordResetLink) && (
          <section className="rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-7" aria-labelledby="password-reset-title">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="label-eyebrow">Account recovery</p>
                <h2 id="password-reset-title" className="mt-1 text-lg font-semibold">Password reset requests</h2>
                <p className="mt-2 text-sm text-muted-foreground">Generate a one-time link and share it privately with the worker.</p>
              </div>
              <ShieldCheck className="h-5 w-5 text-brand" />
            </div>
            {passwordResetRequests.length > 0 && (
              <div className="mt-5 divide-y divide-border rounded-2xl border border-border">
                {passwordResetRequests.map((request) => (
                  <div key={request.id} className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{request.displayName}</p>
                      <p className="truncate text-xs text-muted-foreground">{request.email}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{request.requestedAt ? new Date(request.requestedAt).toLocaleString() : ""}</p>
                    </div>
                    <div className="flex w-full shrink-0 gap-2 sm:w-auto">
                      <button
                        type="button"
                        disabled={issuingPasswordReset === request.id || rejectingPasswordReset === request.id}
                        onClick={() => void rejectPasswordResetRequest(request)}
                        className="min-h-11 flex-1 rounded-xl border border-border px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted disabled:opacity-60"
                      >
                        {rejectingPasswordReset === request.id ? "Rejecting…" : "Reject"}
                      </button>
                      <button
                        type="button"
                        disabled={issuingPasswordReset === request.id || rejectingPasswordReset === request.id}
                        onClick={() => void generatePasswordResetLink(request)}
                        className="min-h-11 flex-1 rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
                      >
                        {issuingPasswordReset === request.id ? "Generating…" : "Generate link"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {passwordResetLink && (
              <div className="mt-5 rounded-2xl border border-brand/30 bg-brand/10 p-4">
                <p className="text-xs font-semibold text-foreground">One-time reset link</p>
                <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                  <input readOnly value={passwordResetLink} className="min-h-11 min-w-0 flex-1 rounded-xl border border-input bg-background px-3 py-2 text-xs" />
                  <button type="button" onClick={() => void copyPasswordResetLink()} className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold hover:bg-muted"><Copy className="h-3.5 w-3.5" aria-hidden="true" /> Copy link</button>
                </div>
              </div>
            )}
          </section>
        )}

        <details
          open={desktopLayout || auditPanelOpen}
          onToggle={(event) => {
            if (!desktopLayout) setAuditPanelOpen(event.currentTarget.open);
          }}
          className="group rounded-3xl border border-border bg-card shadow-sm"
        >
          <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 marker:content-none md:hidden">
            <span>
              <span className="label-eyebrow block">Audit trail</span>
              <span className="mt-1 block text-base font-semibold">Request history · {requestHistory.length}</span>
            </span>
            <ChevronDown className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden="true" />
          </summary>
          <div className="border-t border-border p-5 md:border-0 md:p-7">
          <div className="hidden items-start justify-between gap-4 md:flex">
            <div>
              <p className="label-eyebrow">Audit trail</p>
              <h2 id="request-history-title" className="mt-1 text-lg font-semibold">Request history</h2>
              <p className="mt-2 text-sm text-muted-foreground">Reviewed Google access, migrations and password reset requests.</p>
            </div>
            <button
              type="button"
              aria-label="Refresh request history"
              onClick={() => void refreshRequestHistory()}
              className="min-h-11 rounded-xl border border-border px-3 py-2 text-xs font-semibold hover:bg-muted"
            >
              Refresh
            </button>
          </div>
          <div className="flex justify-end md:hidden">
            <button
              type="button"
              aria-label="Refresh request history"
              onClick={() => void refreshRequestHistory()}
              className="min-h-11 rounded-xl border border-border px-3 py-2 text-xs font-semibold hover:bg-muted"
            >
              Refresh
            </button>
          </div>
          <div className="mt-5 space-y-3 md:hidden">
            {requestHistory.map((item) => (
              <article key={`${item.category}-${item.id}`} className="rounded-2xl border border-border bg-background p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold">{item.category === "google" ? `Google · ${item.requestType}` : "Password reset"}</p>
                    <p className="mt-2 truncate text-sm font-semibold">{item.displayName}</p>
                    <p className="truncate text-xs text-muted-foreground">{item.email}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-muted px-2 py-1 text-xs font-semibold capitalize">{item.status}</span>
                </div>
                <dl className="mt-4 grid gap-3 border-t border-border pt-4 text-xs">
                  <div>
                    <dt className="text-muted-foreground">Requested</dt>
                    <dd className="mt-1 font-medium">{new Date(item.requestedAt).toLocaleString()}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Reviewed by</dt>
                    <dd className="mt-1 font-medium">{item.reviewerName ?? "—"}{item.reviewedAt ? ` · ${new Date(item.reviewedAt).toLocaleString()}` : ""}</dd>
                  </div>
                  {item.reason && (
                    <div>
                      <dt className="text-muted-foreground">Reason</dt>
                      <dd className="mt-1 font-medium">{item.reason}</dd>
                    </div>
                  )}
                </dl>
              </article>
            ))}
            {!requestHistoryLoading && requestHistory.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">No reviewed requests yet.</p>}
            {requestHistoryLoading && <p className="py-6 text-center text-sm text-muted-foreground">Loading history…</p>}
          </div>
          <div className="mt-5 hidden overflow-x-auto rounded-2xl border border-border md:block">
            <table className="w-full min-w-[720px] text-left text-xs">
              <thead className="border-b border-border bg-muted/40 text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-semibold">Type</th>
                  <th className="px-4 py-3 font-semibold">User</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Requested</th>
                  <th className="px-4 py-3 font-semibold">Reviewed by</th>
                  <th className="px-4 py-3 font-semibold">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {requestHistory.map((item) => (
                  <tr key={`${item.category}-${item.id}`}>
                    <td className="px-4 py-3 font-semibold">{item.category === "google" ? `Google · ${item.requestType}` : "Password reset"}</td>
                    <td className="px-4 py-3"><p className="font-semibold">{item.displayName}</p><p className="text-muted-foreground">{item.email}</p></td>
                    <td className="px-4 py-3"><span className="rounded-full bg-muted px-2 py-1 font-semibold capitalize">{item.status}</span></td>
                    <td className="px-4 py-3 whitespace-nowrap">{new Date(item.requestedAt).toLocaleString()}</td>
                    <td className="px-4 py-3">{item.reviewerName ?? "—"}{item.reviewedAt ? <p className="text-muted-foreground">{new Date(item.reviewedAt).toLocaleString()}</p> : null}</td>
                    <td className="max-w-[220px] px-4 py-3 text-muted-foreground">{item.reason || "—"}</td>
                  </tr>
                ))}
                {!requestHistoryLoading && requestHistory.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No reviewed requests yet.</td></tr>
                )}
                {requestHistoryLoading && (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Loading history…</td></tr>
                )}
              </tbody>
            </table>
          </div>
          </div>
        </details>
          </>
        )}

        {viewMode === "salary" ? (
          <SalaryAdviceWorkspace />
        ) : viewMode === "today" ? (
          <>
            {/* Today's Metrics Banner */}
            <section className="relative flex flex-col justify-between gap-5 rounded-3xl border border-border bg-card p-5 shadow-sm sm:flex-row sm:items-end sm:p-7">
              <div className={pendingAccessCount > 0 ? "pr-14 sm:pr-0" : undefined}>
                <p className="label-eyebrow">Field Hours · Live</p>
                <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">{t("adminGreeting")}, {user.displayName.split(" ")[0]}.</h1>
                <p className="mt-2 text-sm text-muted-foreground">{t("adminSubtitle")}</p>
              </div>
              {pendingAccessCount > 0 && (
                <button
                  type="button"
                  onClick={() => setViewMode("access")}
                  className="absolute right-4 top-4 flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-xl border border-brand/35 bg-brand/10 px-2 text-sm font-bold text-foreground hover:bg-brand/20 sm:static"
                  aria-label={`${pendingAccessCount} · ${t("teamAccessTitle")}`}
                >
                  <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                  {pendingAccessCount}
                </button>
              )}
            </section>

            <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              <Metric label={t("workingMetric")} value={counts.working} detail={t("activeShifts")} tone="live" icon={<Activity className="h-4 w-4" />} />
              <Metric label={t("onBreakMetric")} value={counts.onBreak} detail={t("pausedNow")} tone="break" icon={<Pause className="h-4 w-4" />} />
              <Metric label={t("finishedMetric")} value={counts.complete} detail={t("completedToday")} tone="neutral" icon={<Check className="h-4 w-4" />} />
              <Metric label={t("teamMetric")} value={counts.total} detail={t("staffMembers")} tone="neutral" icon={<Users className="h-4 w-4" />} />
            </section>

            <div>
              {/* Today's Team List */}
              <section className="rounded-3xl border border-border bg-card shadow-sm">
                <div className="flex items-center justify-between border-b border-border px-5 py-4 sm:px-7">
                  <div>
                    <p className="label-eyebrow">{t("todayTab")}</p>
                    <h2 className="mt-1 text-lg font-semibold">{t("todaysTeam")}</h2>
                  </div>
                  <button type="button" onClick={() => void refreshToday()} className="flex min-h-11 min-w-11 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted" aria-label="Refresh team">
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Activity className="h-4 w-4" />}
                  </button>
                </div>
                <div className="divide-y divide-border">
                  {!loading && people.length === 0 && <p className="px-5 py-8 text-sm text-muted-foreground sm:px-7">{t("noMembersYet")}</p>}
                  {people.slice(0, visiblePeople).map((person) => (
                    <div key={person.id} data-testid="admin-team-member" className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 sm:px-7">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary text-sm font-semibold text-primary-foreground">
                          {person.name.split(" ").map((part) => part[0]).join("").slice(0, 2)}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="truncate text-sm font-semibold">{person.name}</p>
                            {person.projectName && (
                              <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                                {person.projectName}
                              </span>
                            )}
                          </div>
                          <p className="mt-1 truncate text-xs text-muted-foreground">{person.role} · {person.lastEvent}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="font-mono text-sm font-semibold">{formatWorkedDuration(person.events, person.state, now)}</p>
                          <p className={`mt-1 text-xs font-semibold ${person.state === "working" ? "text-success" : person.state === "on_break" ? "text-warning" : "text-muted-foreground"}`}>
                            {stateCopy(person.state, t).label}
                          </p>
                        </div>
                        <button type="button" onClick={() => void handleOpenPersonDetails(person)} className="min-h-11 rounded-xl border border-border px-3 py-2 text-xs font-semibold hover:bg-muted" aria-label={`View details for ${person.name}`}>
                          {t("details")}
                        </button>
                      </div>
                    </div>
                  ))}
                  {visiblePeople < people.length && (
                    <div className="p-4 sm:px-7">
                      <ShowMoreButton
                        visible={visiblePeople}
                        total={people.length}
                        onClick={() => setVisiblePeople((current) => Math.min(current + LIST_PAGE_SIZE, people.length))}
                        label={t("showMore")}
                      />
                    </div>
                  )}
                </div>
              </section>

            </div>
          </>
        ) : viewMode === "history" ? (
          /* History & Reports Subview */
          <div className="space-y-6">
            {/* Filters Bar */}
            <section className="rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-7">
              <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
                <div>
                  <p className="label-eyebrow">{t("historyTab")}</p>
                  <h1 className="mt-1 text-2xl font-bold">{t("reportsTitle")}</h1>
                </div>
                <div className="grid w-full grid-cols-2 gap-3 md:flex md:w-auto md:items-center">
                  <button
                    type="button"
                    onClick={() => setCreateShiftOpen(true)}
                    disabled={people.length === 0}
                    className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-primary bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  >
                    <Plus className="h-4 w-4" />
                    {t("createWorkday")}
                  </button>
                  <button
                    type="button"
                    onClick={exportExcel}
                    disabled={historyRecords.length === 0}
                    className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  >
                    <Download className="h-4 w-4" />
                    {t("exportExcel")}
                  </button>
                </div>
              </div>

              <details
                open={desktopLayout || historyFiltersOpen}
                onToggle={(event) => {
                  if (!desktopLayout) setHistoryFiltersOpen(event.currentTarget.open);
                }}
                className="mt-5"
              >
                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between rounded-xl border border-border bg-muted/40 px-4 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden [&::-webkit-details-marker]:hidden">
                  <span className="flex items-center gap-2"><Filter className="h-4 w-4" aria-hidden="true" /> {t("filters")}</span>
                  {activeHistoryFilterCount > 0 && <span className="rounded-full bg-foreground px-2 py-0.5 text-xs text-background">{activeHistoryFilterCount}</span>}
                </summary>
                <div className="grid gap-3 pt-3 sm:grid-cols-3 md:flex md:flex-wrap md:items-center md:pt-0">
                  <select
                    aria-label={t("periodFilter")}
                    value={historyFilterPeriod}
                    onChange={(event) => setHistoryFilterPeriod(event.target.value as typeof historyFilterPeriod)}
                    className="min-h-11 min-w-0 rounded-xl border border-border bg-background px-3 py-2 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="today">{t("periodToday")}</option>
                    <option value="this_week">{t("periodThisWeek")}</option>
                    <option value="last_week">{t("periodLastWeek")}</option>
                    <option value="this_month">{t("periodThisMonth")}</option>
                    <option value="all">{t("periodAll")}</option>
                  </select>
                  <select
                    aria-label={t("workerFilter")}
                    value={historyFilterWorker}
                    onChange={(event) => setHistoryFilterWorker(event.target.value)}
                    className="min-h-11 min-w-0 rounded-xl border border-border bg-background px-3 py-2 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="all">{t("allStaff")}</option>
                    {people.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
                  </select>
                  <select
                    aria-label={t("projectFilter")}
                    value={historyFilterProject}
                    onChange={(event) => setHistoryFilterProject(event.target.value)}
                    className="min-h-11 min-w-0 rounded-xl border border-border bg-background px-3 py-2 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="all">{t("allProjects")}</option>
                    {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
                  </select>
                </div>
              </details>

              {/* Summary Stats Band */}
              <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 rounded-2xl bg-muted/40 p-4">
                <div>
                  <p className="text-xs text-muted-foreground font-medium">{t("totalWorked")}</p>
                  <p className="mt-1 text-2xl font-bold font-mono text-foreground">{historyTotals.totalHours}h</p>
                  <p className="text-[11px] text-muted-foreground">{formatMinutes(historyTotals.totalNetMinutes)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">{t("breakTime")}</p>
                  <p className="mt-1 text-2xl font-bold font-mono text-warning">{historyTotals.totalBreakHours}h</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">{t("totalShifts")}</p>
                  <p className="mt-1 text-2xl font-bold font-mono text-foreground">{historyTotals.shiftsCount}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">{t("activeStaff")}</p>
                  <p className="mt-1 text-2xl font-bold font-mono text-foreground">{historyTotals.workersCount}</p>
                </div>
              </div>
            </section>

            {/* Table of Shifts */}
            <section className="rounded-3xl border border-border bg-card shadow-sm overflow-hidden">
              <div className="divide-y divide-border md:hidden">
                {historyLoading && (
                  <div className="px-5 py-10 text-center text-sm text-muted-foreground">
                    <Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin text-brand" aria-hidden="true" />
                    {t("saving")}
                  </div>
                )}
                {!historyLoading && historyRecords.length === 0 && (
                  <div className="px-5 py-10 text-center text-sm text-muted-foreground">
                    <Info className="mx-auto mb-2 h-6 w-6" aria-hidden="true" />
                    {t("noShiftsFound")}
                  </div>
                )}
                {historyRecords.slice(0, visibleHistoryRecords).map((record) => (
                  <article key={record.id} data-testid="admin-history-record" className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{record.display_name}</p>
                        <p className="mt-1 truncate text-xs text-muted-foreground">{record.project_name || t("generalWork")}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="font-mono text-sm font-bold">{formatMinutes(record.net_minutes)}</p>
                        <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          record.state === "complete"
                            ? "bg-success/15 text-success"
                            : record.state === "working"
                              ? "bg-brand/15 text-foreground"
                              : record.state === "on_break"
                                ? "bg-warning/15 text-foreground"
                                : "bg-muted text-muted-foreground"
                        }`}>{record.state}</span>
                      </div>
                    </div>
                    <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-4 text-xs">
                      <div>
                        <dt className="text-muted-foreground">{t("colDate")}</dt>
                        <dd className="mt-1 font-medium">{record.work_date}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">{t("colBreak")}</dt>
                        <dd className="mt-1 font-mono font-medium">{record.break_minutes > 0 ? formatMinutes(record.break_minutes) : "—"}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">{t("colClockIn")}</dt>
                        <dd className="mt-1 font-mono font-medium">{formatRecordedTime(record.clock_in_at, user.timezone)}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">{t("colClockOut")}</dt>
                        <dd className="mt-1 font-mono font-medium">{record.clock_out_at ? formatRecordedTime(record.clock_out_at, user.timezone) : t("inProgress")}</dd>
                      </div>
                    </dl>
                    <div className="mt-4 grid grid-cols-2 gap-2">
                      {record.events.some((event) => event.photo) && (
                        <button
                          type="button"
                          onClick={() => {
                            const event = record.events.find((candidate) => candidate.photo);
                            if (event?.photo) {
                              setPhotoModal({
                                photo: event.photo,
                                title: `${record.display_name} — ${t("takeSelfieTitle")}`,
                                subtitle: `${record.work_date} ${formatRecordedTime(record.clock_in_at, user.timezone)}`,
                              });
                            }
                          }}
                          className="flex min-h-11 items-center justify-center gap-1 rounded-xl border border-brand/40 bg-brand/10 px-3 text-xs font-semibold text-foreground hover:bg-brand/20"
                        >
                          <Camera className="h-3.5 w-3.5" aria-hidden="true" /> {t("viewPhoto")}
                        </button>
                      )}
                      {record.events.length > 0 && (
                        <a
                          href={locationLink(record.events[0].location)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex min-h-11 items-center justify-center gap-1 rounded-xl border border-border px-3 text-xs font-semibold text-info hover:bg-muted"
                        >
                          <MapPin className="h-3.5 w-3.5" aria-hidden="true" /> {t("mapWithCount")} ({record.events.length})
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => setShiftToAdjust(record)}
                        className="col-span-2 flex min-h-11 items-center justify-center gap-1 rounded-xl border border-border px-3 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"
                      >
                        <Edit3 className="h-3.5 w-3.5" aria-hidden="true" /> {t("adjustShift")}
                      </button>
                    </div>
                  </article>
                ))}
                {visibleHistoryRecords < historyRecords.length && (
                  <div className="p-4">
                    <ShowMoreButton
                      visible={visibleHistoryRecords}
                      total={historyRecords.length}
                      onClick={() => setVisibleHistoryRecords((current) => Math.min(current + LIST_PAGE_SIZE, historyRecords.length))}
                      label={t("showMore")}
                    />
                  </div>
                )}
              </div>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-border bg-muted/50 text-xs text-muted-foreground uppercase">
                    <tr>
                      <th className="px-6 py-3.5 font-semibold">{t("colDate")}</th>
                      <th className="px-6 py-3.5 font-semibold">{t("colWorker")}</th>
                      <th className="px-6 py-3.5 font-semibold">{t("colProject")}</th>
                      <th className="px-6 py-3.5 font-semibold">{t("colClockIn")}</th>
                      <th className="px-6 py-3.5 font-semibold">{t("colClockOut")}</th>
                      <th className="px-6 py-3.5 font-semibold">{t("colBreak")}</th>
                      <th className="px-6 py-3.5 font-semibold">{t("colNetHours")}</th>
                      <th className="px-6 py-3.5 font-semibold">{t("colStatus")}</th>
                      <th className="px-6 py-3.5 font-semibold text-right">{t("colActions")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {historyLoading && (
                      <tr>
                        <td colSpan={9} className="py-12 text-center text-muted-foreground">
                          <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-brand" />
                          {t("saving")}
                        </td>
                      </tr>
                    )}
                    {!historyLoading && historyRecords.length === 0 && (
                      <tr>
                        <td colSpan={9} className="py-12 text-center text-muted-foreground">
                          <Info className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
                          {t("noShiftsFound")}
                        </td>
                      </tr>
                    )}
                    {historyRecords.map((r) => (
                      <tr key={r.id} className="hover:bg-muted/30 transition">
                        <td className="px-6 py-4 font-medium whitespace-nowrap">{r.work_date}</td>
                        <td className="px-6 py-4 font-semibold text-foreground">{r.display_name}</td>
                        <td className="px-6 py-4 text-xs font-medium text-muted-foreground">
                          {r.project_name || t("generalWork")}
                        </td>
                        <td className="px-6 py-4 font-mono text-xs">
                          {formatRecordedTime(r.clock_in_at, user.timezone)}
                        </td>
                        <td className="px-6 py-4 font-mono text-xs">
                          {r.clock_out_at ? formatRecordedTime(r.clock_out_at, user.timezone) : t("inProgress")}
                        </td>
                        <td className="px-6 py-4 font-mono text-xs text-muted-foreground">
                          {r.break_minutes > 0 ? formatMinutes(r.break_minutes) : "—"}
                        </td>
                        <td className="px-6 py-4 font-mono font-bold text-foreground">
                          {formatMinutes(r.net_minutes)}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            r.state === "complete"
                              ? "bg-success/15 text-success"
                              : r.state === "working"
                                ? "bg-brand/15 text-foreground"
                                : r.state === "on_break"
                                  ? "bg-warning/15 text-foreground"
                                  : "bg-muted text-muted-foreground"
                          }`}>
                            {r.state}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="inline-flex items-center gap-2">
                            {r.events.some((e) => e.photo) && (
                              <button
                                type="button"
                                onClick={() => {
                                  const ev = r.events.find((e) => e.photo);
                                  if (ev?.photo) {
                                    setPhotoModal({
                                      photo: ev.photo,
                                      title: `${r.display_name} — ${t("takeSelfieTitle")}`,
                                      subtitle: `${r.work_date} ${formatRecordedTime(r.clock_in_at, user.timezone)}`,
                                    });
                                  }
                                }}
                                className="inline-flex items-center gap-1 rounded-lg border border-brand/40 bg-brand/10 px-2.5 py-1 text-xs font-semibold text-foreground hover:bg-brand/20"
                                title={t("viewPhoto")}
                              >
                                <Camera className="h-3.5 w-3.5" /> {t("viewPhoto")}
                              </button>
                            )}
                            {r.events.length > 0 && (
                              <a
                                href={locationLink(r.events[0].location)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs font-semibold text-info hover:bg-muted"
                                title={t("openMap")}
                              >
                                <MapPin className="h-3.5 w-3.5" /> {t("mapWithCount")} ({r.events.length})
                              </a>
                            )}
                            <button
                              type="button"
                              onClick={() => setShiftToAdjust(r)}
                              className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted"
                              title={t("adjustShift")}
                            >
                              <Edit3 className="h-3.5 w-3.5" /> {t("adjustShift")}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        ) : viewMode === "projects" ? (
          /* Projects & Geofences Subview */
          <div className="space-y-6">
            <section className="rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-7">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="label-eyebrow">{t("projectsTab")}</p>
                  <h1 className="mt-1 text-2xl font-bold">{t("projectsTitle")}</h1>
                  <p className="text-xs text-muted-foreground mt-1">{t("projectsSubtitle")}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingProject("new")}
                  className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 sm:w-auto"
                >
                  <Plus className="h-4 w-4" /> {t("newProjectBtn")}
                </button>
              </div>

              <div className="mt-6 divide-y divide-border">
                {projectsLoading && (
                  <div className="py-8 text-center text-muted-foreground">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-brand" />
                    {t("saving")}
                  </div>
                )}
                {!projectsLoading && projects.length === 0 && (
                  <div className="py-10 text-center text-muted-foreground">
                    <Building2 className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="font-semibold text-sm text-foreground">{t("noProjectsYet")}</p>
                    <p className="text-xs mt-1">{t("noProjectsPrompt")}</p>
                  </div>
                )}
                {projects.slice(0, visibleProjects).map((proj) => (
                  <div key={proj.id} data-testid="admin-project-record" className="flex flex-col gap-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-brand/15 text-brand mt-0.5">
                        <Building2 className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="min-w-0 break-words font-bold text-base text-foreground">{proj.name}</h3>
                          {proj.code && (
                            <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-mono font-semibold">
                              {proj.code}
                            </span>
                          )}
                          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                            proj.is_active ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"
                          }`}>
                            {proj.is_active ? t("active") : t("archived")}
                          </span>
                        </div>
                        {proj.address && <p className="text-xs text-muted-foreground mt-1">{proj.address}</p>}
                        <div className="mt-1.5 flex flex-wrap items-center gap-3 font-mono text-xs text-muted-foreground">
                          {proj.latitude !== null && proj.longitude !== null ? (
                            <>
                              <span className="flex items-center gap-1">
                                <MapPin className="h-3.5 w-3.5 text-info" /> {proj.latitude.toFixed(5)}, {proj.longitude.toFixed(5)}
                              </span>
                              <span>· {proj.radius_m}m</span>
                            </>
                          ) : (
                            <span className="text-muted-foreground">{t("noGpsSet")}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:items-center">
                      {proj.latitude !== null && proj.longitude !== null && (
                        <a
                          href={`https://www.openstreetmap.org/?mlat=${proj.latitude}&mlon=${proj.longitude}#map=17/${proj.latitude}/${proj.longitude}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex min-h-11 items-center justify-center rounded-xl border border-border px-3 py-2 text-xs font-semibold text-info hover:bg-muted"
                        >
                          {t("viewMap")}
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => setEditingProject(proj)}
                        className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"
                      >
                        <Edit3 className="h-3.5 w-3.5" /> {t("edit")}
                      </button>
                    </div>
                  </div>
                ))}
                {visibleProjects < projects.length && (
                  <div className="py-4">
                    <ShowMoreButton
                      visible={visibleProjects}
                      total={projects.length}
                      onClick={() => setVisibleProjects((current) => Math.min(current + LIST_PAGE_SIZE, projects.length))}
                      label={t("showMore")}
                    />
                  </div>
                )}
              </div>
            </section>
          </div>
        ) : null}

        {/* Worker Details Modal with Shift History */}
        {selectedPerson && (
          <div className="fixed inset-0 z-40 flex items-end justify-center bg-foreground/30 p-4 sm:items-center" role="presentation" onClick={closeWorkerDetails}>
            <section ref={workerDetailsDialogRef} role="dialog" aria-modal="true" aria-labelledby="worker-details-title" tabIndex={-1} className="max-h-[calc(100dvh-2rem)] w-full max-w-2xl overflow-y-auto overscroll-contain rounded-3xl border border-border bg-card p-5 shadow-xl outline-none sm:p-7" onClick={(event) => event.stopPropagation()}>
              <div className="flex items-start justify-between gap-4 border-b border-border pb-4">
                <div>
                  <p className="label-eyebrow">{t("workerProfileHistory")}</p>
                  <h2 id="worker-details-title" data-dialog-initial-focus tabIndex={-1} className="mt-1 text-2xl font-bold outline-none">{selectedPerson.name}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t("todayTab")}: {stateCopy(selectedPerson.state, t).label} · {formatWorkedDuration(selectedPerson.events, selectedPerson.state, now)}
                  </p>
                </div>
                <button type="button" onClick={closeWorkerDetails} className="flex min-h-11 min-w-11 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted" aria-label="Close worker details">
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Today's Live Evidence */}
              <div className="mt-6">
                <h3 className="text-sm font-semibold mb-3">{t("todaysShiftEvidence")}</h3>
                <LocationEvidenceList
                  events={selectedPerson.events}
                  timezone={user.timezone}
                  onViewPhoto={(photo, ev) =>
                    setPhotoModal({
                      photo,
                      title: `${selectedPerson.name} — ${getActionLabel(ev.type, t)}`,
                      subtitle: formatRecordedDateTime(ev.at, user.timezone),
                    })
                  }
                />
              </div>

              {/* Past Shifts History for this Worker */}
              <div className="mt-8">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold">{t("recordedPastShifts")}</h3>
                  <span className="text-xs text-muted-foreground">
                    {selectedPersonHistory.length} {t("shiftsFound")}
                  </span>
                </div>

                <div className="overflow-hidden rounded-2xl border border-border">
                  <div className="divide-y divide-border md:hidden">
                    {selectedPersonLoading && <p className="p-5 text-center text-xs text-muted-foreground">{t("saving")}</p>}
                    {!selectedPersonLoading && selectedPersonHistory.length === 0 && <p className="p-5 text-center text-xs text-muted-foreground">{t("noPastShiftsYet")}</p>}
                    {selectedPersonHistory.map((shift) => (
                      <article key={shift.id} className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-xs font-semibold">{shift.work_date}</p>
                            <p className="mt-1 truncate text-xs text-muted-foreground">{shift.project_name || t("generalWork")}</p>
                          </div>
                          <p className="shrink-0 font-mono text-sm font-bold">{formatMinutes(shift.net_minutes)}</p>
                        </div>
                        <p className="mt-3 text-xs text-muted-foreground">
                          {formatRecordedTime(shift.clock_in_at, user.timezone)} – {shift.clock_out_at ? formatRecordedTime(shift.clock_out_at, user.timezone) : t("inProgress")}
                          {shift.break_minutes > 0 ? ` · ${t("colBreak")}: ${formatMinutes(shift.break_minutes)}` : ""}
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            closeWorkerDetails();
                            setShiftToAdjust(shift);
                          }}
                          className="mt-4 flex min-h-11 w-full items-center justify-center rounded-xl border border-border px-3 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"
                        >
                          {t("adjustShift")}
                        </button>
                      </article>
                    ))}
                  </div>
                  <div className="hidden overflow-x-auto md:block">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-muted/60 text-muted-foreground">
                      <tr>
                        <th className="px-4 py-2.5">{t("colDate")}</th>
                        <th className="px-4 py-2.5">{t("colProject")}</th>
                        <th className="px-4 py-2.5">{t("colClockIn")}</th>
                        <th className="px-4 py-2.5">{t("colClockOut")}</th>
                        <th className="px-4 py-2.5">{t("colBreak")}</th>
                        <th className="px-4 py-2.5">{t("colNetHours")}</th>
                        <th className="px-4 py-2.5 text-right">{t("colActions")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {selectedPersonLoading && (
                        <tr>
                          <td colSpan={7} className="py-6 text-center text-muted-foreground">
                            {t("saving")}
                          </td>
                        </tr>
                      )}
                      {!selectedPersonLoading && selectedPersonHistory.length === 0 && (
                        <tr>
                          <td colSpan={7} className="py-6 text-center text-muted-foreground">
                            {t("noPastShiftsYet")}
                          </td>
                        </tr>
                      )}
                      {selectedPersonHistory.map((s) => (
                        <tr key={s.id} className="hover:bg-muted/20">
                          <td className="px-4 py-2.5 font-medium">{s.work_date}</td>
                          <td className="px-4 py-2.5 text-muted-foreground">{s.project_name || t("generalWork")}</td>
                          <td className="px-4 py-2.5 font-mono">
                            {formatRecordedTime(s.clock_in_at, user.timezone)}
                          </td>
                          <td className="px-4 py-2.5 font-mono">
                            {s.clock_out_at ? formatRecordedTime(s.clock_out_at, user.timezone) : t("inProgress")}
                          </td>
                          <td className="px-4 py-2.5 font-mono text-muted-foreground">
                            {s.break_minutes > 0 ? formatMinutes(s.break_minutes) : "—"}
                          </td>
                          <td className="px-4 py-2.5 font-mono font-bold text-foreground">
                            {formatMinutes(s.net_minutes)}
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedPerson(null);
                                setShiftToAdjust(s);
                              }}
                              className="rounded-md border border-border px-2 py-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground hover:bg-muted"
                            >
                              {t("adjustShift")}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </div>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* Adjust Shift Modal */}
        {createShiftOpen && (
          <CreateAdminShiftModal
            workers={people}
            projects={projects}
            onClose={() => setCreateShiftOpen(false)}
            onSaved={() => {
              setMessage("Workday created successfully with audit description recorded.");
              void refreshHistory();
              void refreshToday();
            }}
          />
        )}

        {shiftToAdjust && (
          <AdjustShiftModal
            shift={shiftToAdjust}
            onClose={() => setShiftToAdjust(null)}
            onSaved={() => {
              setMessage("Shift adjusted successfully with audit event recorded.");
              void refreshHistory();
              void refreshToday();
            }}
          />
        )}

        {/* Project Edit Modal */}
        {editingProject && (
          <ProjectEditModal
            project={editingProject === "new" ? null : editingProject}
            onClose={() => setEditingProject(null)}
            onSaved={() => {
              setMessage("Project saved successfully.");
              void refreshProjectsList();
              void refreshToday();
            }}
          />
        )}

        {/* Photo Evidence Modal */}
        {photoModal && (
          <PhotoEvidenceModal
            photo={photoModal.photo}
            title={photoModal.title}
            subtitle={photoModal.subtitle}
            onClose={() => setPhotoModal(null)}
          />
        )}

      </div>
    </Shell>
  );
}

function Metric({
  label,
  value,
  detail,
  tone,
  icon,
}: {
  label: string;
  value: number | string;
  detail: string;
  tone: "live" | "break" | "neutral";
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3 shadow-sm sm:rounded-3xl sm:p-5">
      <div className="flex items-center justify-between">
        <span className={`rounded-xl p-2 ${tone === "live" ? "bg-success/15 text-success" : tone === "break" ? "bg-warning/15 text-warning" : "bg-muted text-muted-foreground"}`} aria-hidden="true">{icon}</span>
        <span className="font-mono text-2xl font-semibold sm:text-3xl">{value}</span>
      </div>
      <p className="mt-3 text-xs font-semibold sm:mt-5 sm:text-sm">{label}</p>
      <p className="mt-1 hidden text-xs text-muted-foreground min-[380px]:block">{detail}</p>
    </div>
  );
}

function Shell({
  title,
  user,
  onSignOut,
  children,
}: {
  title: string;
  user: SessionUser;
  onSignOut: () => void;
  children: React.ReactNode;
}) {
  const { t } = useI18n();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const menuPanelRef = useRef<HTMLDivElement>(null);
  const [googleNotice] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get("google");
    if (status) {
      params.delete("google");
      const remainingSearch = params.toString();
      window.history.replaceState({}, "", `${window.location.pathname}${remainingSearch ? `?${remainingSearch}` : ""}${window.location.hash}`);
    }
    return status === "pending" || status === "success" || status === "error" ? status : "";
  });
  useEffect(() => {
    if (!menuOpen) return undefined;
    const focusFrame = window.requestAnimationFrame(() => {
      Array.from(menuPanelRef.current?.querySelectorAll<HTMLButtonElement>("button:not([disabled])") ?? [])
        .find((button) => button.getClientRects().length > 0)
        ?.focus();
    });
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setMenuOpen(false);
      menuButtonRef.current?.focus();
    };
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!menuPanelRef.current?.contains(target) && !menuButtonRef.current?.contains(target)) {
        setMenuOpen(false);
        window.requestAnimationFrame(() => menuButtonRef.current?.focus());
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [menuOpen]);
  const closeMenu = () => {
    setMenuOpen(false);
    window.requestAnimationFrame(() => menuButtonRef.current?.focus());
  };
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b border-border/80 bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-2 px-3 sm:px-8">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground"><Crosshair className="h-4 w-4" /></div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold tracking-tight">{t("appTitle")}</p>
              <p className="text-[10px] uppercase tracking-[0.13em] text-muted-foreground">{title}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
            <div className="hidden sm:block">
              <LanguageSwitcher />
            </div>
            <div className="relative">
              <button ref={menuButtonRef} type="button" onClick={() => setMenuOpen((open) => !open)} className="flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-xl border border-border px-3 py-2 text-sm font-semibold hover:bg-muted" aria-expanded={menuOpen} aria-controls="field-hours-account-panel" aria-label={`${user.displayName} · ${t("accountMenu")}`}>
                <span className="hidden sm:inline">{user.displayName}</span><Menu className="h-4 w-4" />
              </button>
              {menuOpen && (
                <div ref={menuPanelRef} id="field-hours-account-panel" role="dialog" aria-label={t("accountMenu")} className="absolute right-0 z-50 mt-2 w-64 rounded-2xl border border-border bg-card p-2 shadow-lg">
                  <div className="mb-2 border-b border-border p-1 pb-3 sm:hidden">
                    <LanguageSwitcher />
                  </div>
                  <PwaInstallAction />
                  <button type="button" onClick={() => startGoogleSignIn("link")} className="flex min-h-11 w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm hover:bg-muted"><ShieldCheck className="h-4 w-4" /> {t("setupGoogleSignIn")}</button>
                  <button type="button" onClick={onSignOut} className="flex min-h-11 w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm hover:bg-muted"><LogOut className="h-4 w-4" /> {t("signOut")}</button>
                  <button type="button" onClick={closeMenu} className="mt-1 flex min-h-11 w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /> {t("close")}</button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>
      <main className="mx-auto min-w-0 max-w-7xl px-3 py-5 sm:px-8 sm:py-8">
        {googleNotice && <p role="status" className="mb-5 rounded-2xl border border-brand/30 bg-brand/10 px-4 py-3 text-sm text-foreground">{t(googleNotice === "pending" ? "googleRequestSent" : googleNotice === "success" ? "googleSignInReady" : "googleSignInError")}</p>}
        {children}
      </main>
      <footer className="mx-auto flex max-w-7xl items-center gap-2 px-3 pb-8 text-xs text-muted-foreground sm:px-8">
        <ShieldCheck className="h-3.5 w-3.5" /> {t("locationFooterNotice")}
      </footer>
    </div>
  );
}

function LoadingScreen() {
  const { t } = useI18n();
  return (
    <main className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex items-center gap-3 text-sm text-muted-foreground" role="status">
        <Loader2 className="h-5 w-5 animate-spin text-brand" /> {t("loadingSecureSession")}
      </div>
    </main>
  );
}

export default function ShiftClock() {
  const [user, setUser] = useState<SessionUser | null | undefined>(undefined);
  const [passwordPromptDismissed, setPasswordPromptDismissed] = useState(false);
  const resetToken = new URLSearchParams(window.location.search).get("reset") ?? "";

  useEffect(() => {
    let active = true;
    loadSession()
      .then((sessionUser) => {
        if (active) setUser(sessionUser);
      })
      .catch((error) => {
        if (active) {
          if (!(error instanceof ApiClientError) || error.status !== 401) {
            console.warn("Session restoration failed");
          }
          setUser(null);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  async function handleSignOut() {
    try {
      await signOut();
    } catch {
      // The local session is cleared even if it was already expired server-side.
    } finally {
      setUser(null);
    }
  }

  if (resetToken) {
    return (
      <PasswordResetScreen
        token={resetToken}
        onDone={() => {
          window.history.replaceState({}, "", "/");
          setUser(null);
        }}
      />
    );
  }
  if (user === undefined) return <LoadingScreen />;
  if (user === null) return <LoginScreen onLogin={setUser} />;
  if (user.mustChangePassword && !passwordPromptDismissed) {
    return (
      <PasswordChangeScreen
        user={user}
        onChanged={setUser}
        onCancel={() => setPasswordPromptDismissed(true)}
        onSignOut={() => void handleSignOut()}
      />
    );
  }
  return user.role === "admin"
    ? <AdminView user={user} onSignOut={() => void handleSignOut()} />
    : <WorkerView user={user} onSignOut={() => void handleSignOut()} />;
}
