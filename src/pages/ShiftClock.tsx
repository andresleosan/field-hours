import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
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
  Clock3,
  Copy,
  Crosshair,
  Download,
  Edit3,
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
import { useI18n } from "@/lib/i18n";
import { SelfieModal } from "@/components/SelfieModal";
import {
  actionLabel,
  adjustShift,
  calculateDistanceMeters,
  changePassword,
  createInvitation,
  formatMinutes,
  formatCalendarDate,
  formatRecordedDateTime,
  formatRecordedTime,
  formatWorkedDuration,
  loadAdminHistory,
  loadAdminToday,
  loadAdminPayrollProfiles,
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
  revealAdminPayrollProfile,
  reviewAdminPayrollProfile,
  saveWorkerPayrollProfile,
  completePasswordReset,
  startGoogleSignIn,
  type AdminSnapshot,
  type GoogleAuthRequest,
  type PasswordResetRequest,
  type RequestHistoryItem,
  type LocationEvidence,
  type PayrollProfile,
  type PayrollProfileDetails,
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

function stateCopy(state: ShiftState, t: (key: any) => string): { label: string; detail: string; tone: string } {
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

function getActionLabel(action: ShiftAction, t: (key: any) => string): string {
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
    <div className="inline-flex items-center rounded-xl border border-border bg-muted/60 p-1 text-xs font-semibold">
      <button
        type="button"
        onClick={() => setLang("es")}
        className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
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
        className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
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
        className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
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
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50 p-4 backdrop-blur-sm" onClick={onClose}>
      <section
        role="dialog"
        aria-modal="true"
        className="w-full max-w-sm overflow-hidden rounded-3xl border border-border bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <h3 className="text-sm font-bold">{title}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted">
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
                  className="mt-3 w-full text-center text-sm font-medium text-brand underline-offset-4 hover:underline"
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
  const [shift, setShift] = useState<ShiftSnapshot>(emptyShift);
  const [payrollSummary, setPayrollSummary] = useState<WorkerPayrollSummary | null>(null);
  const [payrollProfile, setPayrollProfile] = useState<WorkerPayrollProfile | null>(null);
  const [payrollProfileLoading, setPayrollProfileLoading] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [history, setHistory] = useState<ShiftHistoryRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [busy, setBusy] = useState<ShiftAction | null>(null);
  const [message, setMessage] = useState("");
  const [online, setOnline] = useState(() => navigator.onLine);
  const [pendingQueueCount, setPendingQueueCount] = useState(() => getOfflineQueue().length);
  const [finishRequested, setFinishRequested] = useState(false);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());
  const [selfieModalOpen, setSelfieModalOpen] = useState(false);
  const [photoModal, setPhotoModal] = useState<{ photo: string; title: string; subtitle: string } | null>(null);

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
    const res = await syncOfflineQueue((updated) => setShift(updated));
    setPendingQueueCount(getOfflineQueue().length);
    if (res.syncedCount > 0) {
      setMessage(`✅ Synced ${res.syncedCount} offline action(s) with the server.`);
      void loadData();
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

  const selectedProject = useMemo(() => {
    return projects.find((p) => p.id === (shift.projectId || selectedProjectId));
  }, [projects, shift.projectId, selectedProjectId]);

  async function act(nextAction: ShiftAction, photo?: string) {
    if (busy) return;
    if (!nextState(shift.state, nextAction)) {
      setMessage("That action is no longer available. Refresh your shift and try again.");
      return;
    }
    setMessage("");
    setBusy(nextAction);
    try {
      const location = await requestLocation();
      const idempotencyKey = crypto.randomUUID();
      const projectToSubmit = nextAction === "clock_in" ? selectedProjectId : undefined;

      if (!online) {
        // Queue offline
        queueOfflineAction(nextAction, location, idempotencyKey, projectToSubmit, photo);
        setPendingQueueCount(getOfflineQueue().length);
        const optimisticNext = nextState(shift.state, nextAction) || shift.state;
        const newEvent: ShiftEvent = {
          id: idempotencyKey,
          type: nextAction,
          at: new Date().toISOString(),
          location,
          photo,
        };
        setShift((prev) => ({
          ...prev,
          state: optimisticNext,
          projectId: projectToSubmit || prev.projectId,
          projectName: selectedProject?.name || prev.projectName,
          events: [...prev.events, newEvent],
        }));
        if (nextAction === "clock_out") setFinishRequested(false);
        setMessage("⚡ Saved offline with timestamp & GPS. Will sync automatically once back online.");
        return;
      }

      const updated = await runShiftAction(nextAction, location, idempotencyKey, projectToSubmit, photo);
      setShift(updated);
      if (nextAction === "clock_out") {
        setFinishRequested(false);
        void loadData();
      }
      setMessage("Saved with a fresh location check.");
    } catch (caught) {
      if (!online || (caught instanceof Error && caught.message.includes("fetch"))) {
        setMessage("Network failed. Action saved offline and queued for automatic sync.");
      } else {
        setMessage(messageFrom(caught, "We could not save that action."));
      }
    } finally {
      setBusy(null);
    }
  }

  const handleMainActionClick = (actionName: ShiftAction) => {
    if (actionName === "clock_in") {
      setSelfieModalOpen(true);
    } else {
      void act(actionName);
    }
  };

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
      <div className="mx-auto max-w-3xl space-y-6">
        {/* Offline & Queue Status Banner */}
        {(!online || pendingQueueCount > 0) && (
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-warning/40 bg-warning/10 p-4 text-xs font-semibold text-warning-foreground">
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
                className="rounded-lg bg-warning/20 px-3 py-1.5 hover:bg-warning/30"
              >
                Sync Now
              </button>
            )}
          </div>
        )}

        <WorkerPayrollSummaryCard summary={payrollSummary} timezone={user.timezone} />

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
                <span className="flex items-center gap-1 rounded-full bg-warning/15 px-2.5 py-0.5 text-[11px] font-semibold text-warning">
                  <WifiOff className="h-3 w-3" /> {t("offline")}
                </span>
              )}
              <div className={`rounded-full px-3 py-1 text-xs font-semibold ${copy.tone === "live" ? "bg-success/15 text-success" : copy.tone === "break" ? "bg-warning/15 text-warning" : "bg-muted text-muted-foreground"}`}>
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
                  <label className="block text-xs font-semibold uppercase text-muted-foreground mb-1.5 flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5 text-brand" /> {t("assignedProject")}
                  </label>
                  {projects.length === 0 ? (
                    <p className="text-xs text-muted-foreground">{t("noProjectsAvailable")}</p>
                  ) : (
                    <select
                      value={selectedProjectId}
                      onChange={(e) => setSelectedProjectId(e.target.value)}
                      className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} {p.code ? `(${p.code})` : ""} {p.address ? `— ${p.address}` : ""}
                        </option>
                      ))}
                    </select>
                  )}
                  {selectedProject && selectedProject.latitude !== null && (
                    <p className="mt-2 text-[11px] text-muted-foreground flex items-center gap-1">
                      <Navigation className="h-3 w-3 text-info" /> {t("geofenceActive")} {selectedProject.radius_m}m.
                    </p>
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

            <p className="mt-4 max-w-lg text-sm leading-6 text-muted-foreground">{copy.detail}</p>
            {message && <p role="status" className="mt-5 rounded-xl border border-border bg-muted/50 px-3 py-3 text-sm">{message}</p>}
            
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              {finishRequested ? (
                <div className="flex w-full flex-col gap-3 rounded-2xl border border-warning/40 bg-warning/10 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold">{t("finishPromptTitle")}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{t("finishPromptDetail")}</p>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setFinishRequested(false)} className="rounded-xl border border-border px-4 py-3 text-sm font-semibold hover:bg-background">{t("cancel")}</button>
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
                      disabled={Boolean(busy)}
                      className={`flex min-h-14 flex-1 items-center justify-center gap-3 rounded-2xl px-5 text-base font-semibold shadow-sm transition hover:brightness-95 disabled:opacity-60 ${
                        action === "start_break" ? "bg-warning text-warning-foreground" : "bg-brand text-brand-foreground"
                      }`}
                    >
                      {busy === action ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : action === "clock_in" ? (
                        <Camera className="h-5 w-5" />
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
          onViewPhoto={(photo, ev) =>
            setPhotoModal({
              photo,
              title: `${user.displayName} — ${getActionLabel(ev.type, t)}`,
              subtitle: formatRecordedDateTime(ev.at, user.timezone),
            })
          }
        />

        <WorkerPayrollProfileForm
          profile={payrollProfile}
          loading={payrollProfileLoading}
          onSaved={(saved) => {
            setPayrollProfile(saved);
            setMessage("Payroll details saved and sent for administrator review.");
          }}
        />

        {/* Worker Shift History Section */}
        <section className="rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-7">
          <div className="flex items-center justify-between border-b border-border pb-4">
            <div>
              <p className="label-eyebrow">{t("historyTab")}</p>
              <h2 className="mt-1 text-lg font-semibold">{t("myPastShifts")}</h2>
            </div>
            <History className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="mt-4 divide-y divide-border">
            {historyLoading && <p className="py-4 text-center text-xs text-muted-foreground">{t("saving")}</p>}
            {!historyLoading && history.length === 0 && (
              <p className="py-6 text-center text-xs text-muted-foreground">{t("noPastShiftsYet")}</p>
            )}
            {history.map((record) => (
              <div key={record.id} className="flex items-center justify-between py-3">
                <div>
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
                </div>
                <div className="text-right">
                  <p className="font-mono text-sm font-bold text-foreground">{formatMinutes(record.net_minutes)}</p>
                  <p className="text-[11px] text-success font-medium">{t("logged")}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Selfie Capture Modal */}
        {selfieModalOpen && (
          <SelfieModal
            onClose={() => setSelfieModalOpen(false)}
            onCapture={(photo) => {
              setSelfieModalOpen(false);
              void act("clock_in", photo || undefined);
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

function WorkerPayrollSummaryCard({
  summary,
  timezone,
}: {
  summary: WorkerPayrollSummary | null;
  timezone: string;
}) {
  return (
    <section className="rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-7" aria-labelledby="hours-pay-title">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="label-eyebrow">Payroll overview · Jersey</p>
          <h2 id="hours-pay-title" className="mt-1 text-lg font-semibold">Hours and pay schedule</h2>
          <p className="mt-2 text-sm text-muted-foreground">Completed shifts only. Final payroll remains subject to administrator review.</p>
        </div>
        <Calendar className="h-5 w-5 text-muted-foreground" />
      </div>
      {!summary ? (
        <p className="mt-5 rounded-2xl bg-muted/50 px-4 py-4 text-sm text-muted-foreground">Payroll summary is not available yet.</p>
      ) : (
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-border bg-muted/30 p-4">
            <p className="text-xs font-semibold text-muted-foreground">This month</p>
            <p className="mt-2 font-mono text-2xl font-semibold">{formatMinutes(summary.currentPeriodMinutes)}</p>
            <p className="mt-1 text-xs text-muted-foreground">{summary.currentPeriodShifts} completed shift{summary.currentPeriodShifts === 1 ? "" : "s"} since {formatCalendarDate(summary.currentPeriodStart, timezone)}</p>
          </div>
          <div className="rounded-2xl border border-border bg-muted/30 p-4">
            <p className="text-xs font-semibold text-muted-foreground">All completed shifts</p>
            <p className="mt-2 font-mono text-2xl font-semibold">{formatMinutes(summary.totalCompletedMinutes)}</p>
            <p className="mt-1 text-xs text-muted-foreground">{summary.totalCompletedShifts} recorded shift{summary.totalCompletedShifts === 1 ? "" : "s"}</p>
          </div>
          <div className="rounded-2xl border border-brand/30 bg-brand/10 p-4">
            <p className="text-xs font-semibold text-muted-foreground">Next scheduled pay date</p>
            <p className="mt-2 text-lg font-semibold">{formatCalendarDate(summary.nextPayDate, timezone)}</p>
            <p className="mt-1 text-xs text-muted-foreground">Monthly payment on the first day</p>
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
  const [form, setForm] = useState(() => payrollFormFromProfile(profile));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setForm(payrollFormFromProfile(profile));
  }, [profile?.userId, profile?.submittedAt, profile?.status]);

  if (loading) {
    return (
      <section className="rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-7" aria-labelledby="payroll-profile-title">
        <p className="text-sm text-muted-foreground">Loading payroll profile…</p>
      </section>
    );
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const itisRate = Number(form.itisRate);
    if (!Number.isFinite(itisRate) || itisRate < 0 || itisRate > 100 || Math.round(itisRate * 100) !== itisRate * 100) {
      setError("ITIS must be a percentage between 0 and 100, with up to two decimal places.");
      setBusy(false);
      return;
    }
    try {
      const saved = await saveWorkerPayrollProfile({
        legalName: form.legalName,
        address: form.address,
        employeeNumber: form.employeeNumber,
        socialSecurityNumber: form.socialSecurityNumber || undefined,
        taxReference: form.taxReference || undefined,
        socialReference: form.socialReference || undefined,
        bankAccountName: form.bankAccountName || undefined,
        bankSortCode: form.bankSortCode || undefined,
        bankAccountNumber: form.bankAccountNumber || undefined,
        itisRate,
      });
      setForm((previous) => ({
        ...previous,
        socialSecurityNumber: "",
        taxReference: "",
        socialReference: "",
        bankAccountName: "",
        bankSortCode: "",
        bankAccountNumber: "",
      }));
      onSaved(saved);
    } catch (caught) {
      setError(messageFrom(caught, "The payroll profile could not be saved."));
    } finally {
      setBusy(false);
    }
  }

  const statusLabel = profile?.status === "approved"
    ? "Approved by administrator"
    : profile?.status === "changes_requested"
      ? "Changes requested"
      : profile?.status === "pending_review"
        ? "Waiting for administrator review"
        : "Not submitted";

  return (
    <section className="rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-7" aria-labelledby="payroll-profile-title">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="label-eyebrow">Payroll profile · Jersey</p>
          <h2 id="payroll-profile-title" className="mt-1 text-lg font-semibold">Your salary and tax details</h2>
          <p className="mt-2 text-sm text-muted-foreground">Complete this once so the administrator can prepare your monthly Salary Advice.</p>
        </div>
        <Briefcase className="h-5 w-5 text-muted-foreground" />
      </div>
      <div className="mt-4 rounded-2xl border border-border bg-muted/40 px-4 py-3 text-xs">
        <span className="font-semibold">Status:</span> {statusLabel}
        {profile?.reviewNote && <span className="ml-2 text-muted-foreground">· {profile.reviewNote}</span>}
      </div>
      <form className="mt-5 space-y-5" onSubmit={(event) => void submit(event)}>
        <div className="grid gap-4 sm:grid-cols-2">
          <PayrollInput label="Legal name" value={form.legalName} onChange={(value) => setForm({ ...form, legalName: value })} required autoComplete="name" />
          <PayrollInput label="Employee number" value={form.employeeNumber} onChange={(value) => setForm({ ...form, employeeNumber: value })} required autoComplete="off" />
        </div>
        <PayrollInput label="Home address" value={form.address} onChange={(value) => setForm({ ...form, address: value })} required autoComplete="street-address" />
        <div className="grid gap-4 sm:grid-cols-2">
          <PayrollInput label="Social security number" type="password" value={form.socialSecurityNumber} onChange={(value) => setForm({ ...form, socialSecurityNumber: value })} required={!profile?.hasSocialSecurityNumber} autoComplete="off" placeholder={profile?.hasSocialSecurityNumber ? "Already stored · leave blank to keep" : "Required"} />
          <PayrollInput label="Tax Reference" type="password" value={form.taxReference} onChange={(value) => setForm({ ...form, taxReference: value })} required={!profile?.hasTaxReference} autoComplete="off" placeholder={profile?.hasTaxReference ? "Already stored · leave blank to keep" : "Required"} />
          <PayrollInput label="Social Reference" type="password" value={form.socialReference} onChange={(value) => setForm({ ...form, socialReference: value })} required={!profile?.hasSocialReference} autoComplete="off" placeholder={profile?.hasSocialReference ? "Already stored · leave blank to keep" : "Required"} />
          <PayrollInput label="ITIS percentage" type="number" min="0" max="100" step="0.01" value={form.itisRate} onChange={(value) => setForm({ ...form, itisRate: value })} required placeholder="Example: 15" suffix="%" />
        </div>
        <div>
          <p className="text-sm font-semibold">Bank details (optional)</p>
          <p className="mt-1 text-xs text-muted-foreground">Only complete these if the business needs them for payment.</p>
          <div className="mt-3 grid gap-4 sm:grid-cols-3">
            <PayrollInput label="Account name" type="password" value={form.bankAccountName} onChange={(value) => setForm({ ...form, bankAccountName: value })} autoComplete="off" />
            <PayrollInput label="Sort code" type="password" value={form.bankSortCode} onChange={(value) => setForm({ ...form, bankSortCode: value })} autoComplete="off" />
            <PayrollInput label="Account number" type="password" value={form.bankAccountNumber} onChange={(value) => setForm({ ...form, bankAccountNumber: value })} autoComplete="off" />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">Sensitive identifiers are encrypted. The administrator must review this profile before using it for payroll.</p>
        {error && <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-3 text-sm text-destructive">{error}</p>}
        <button type="submit" disabled={busy} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60 sm:w-auto">
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          {busy ? "Saving…" : profile ? "Update payroll profile" : "Save payroll profile"}
        </button>
      </form>
    </section>
  );
}

type PayrollFormState = {
  legalName: string;
  address: string;
  employeeNumber: string;
  socialSecurityNumber: string;
  taxReference: string;
  socialReference: string;
  bankAccountName: string;
  bankSortCode: string;
  bankAccountNumber: string;
  itisRate: string;
};

function payrollFormFromProfile(profile: WorkerPayrollProfile | null): PayrollFormState {
  return {
    legalName: profile?.legalName ?? "",
    address: profile?.address ?? "",
    employeeNumber: profile?.employeeNumber ?? "",
    socialSecurityNumber: "",
    taxReference: "",
    socialReference: "",
    bankAccountName: "",
    bankSortCode: "",
    bankAccountNumber: "",
    itisRate: profile?.itisRate === null || profile?.itisRate === undefined ? "" : String(profile.itisRate),
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
          className={`h-11 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring ${suffix ? "pr-9" : ""}`}
        />
        {suffix && <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">{suffix}</span>}
      </span>
    </label>
  );
}

function LocationEvidenceList({
  events,
  timezone,
  onViewPhoto,
}: {
  events: ShiftEvent[];
  timezone: string;
  onViewPhoto?: (photo: string, event: ShiftEvent) => void;
}) {
  const { t } = useI18n();
  return (
    <section className="rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-7">
      <div className="flex items-center justify-between">
        <div>
          <p className="label-eyebrow">{t("locationEvidenceTitle")}</p>
          <h2 className="mt-1 text-lg font-semibold">{t("locationEvidenceSubtitle")}</h2>
        </div>
        <MapPin className="h-5 w-5 text-muted-foreground" />
      </div>
      <div className="mt-5 space-y-3">
        {events.length === 0 && <p className="rounded-2xl bg-muted/60 px-4 py-4 text-sm text-muted-foreground">{t("noClockEventsToday")}</p>}
        {events.slice().reverse().map((event) => (
          <div key={event.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-muted/60 px-4 py-3">
            <div className="flex items-center gap-3">
              {event.photo && (
                <button
                  type="button"
                  onClick={() => onViewPhoto?.(event.photo!, event)}
                  className="group relative h-10 w-10 shrink-0 overflow-hidden rounded-xl border border-border bg-black shadow-sm"
                  title={t("viewPhoto")}
                >
                  <img src={event.photo} alt="Selfie" className="h-full w-full object-cover transition group-hover:scale-110" />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20 text-white opacity-0 transition group-hover:opacity-100">
                    <Camera className="h-3.5 w-3.5" />
                  </div>
                </button>
              )}
              <div>
                <p className="text-sm font-semibold flex items-center gap-1.5">
                  {getActionLabel(event.type, t)}
                  {event.photo && (
                    <span className="rounded-md bg-brand/15 px-1.5 py-0.5 text-[10px] font-semibold text-brand flex items-center gap-1">
                      <Camera className="h-3 w-3" /> {t("photoVerified")}
                    </span>
                  )}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {formatRecordedTime(event.at, timezone)} · ±{event.location.accuracy}m
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {event.photo && (
                <button
                  type="button"
                  onClick={() => onViewPhoto?.(event.photo!, event)}
                  className="text-xs font-semibold text-brand underline-offset-4 hover:underline flex items-center gap-1"
                >
                  <Camera className="h-3 w-3" /> {t("viewPhoto")}
                </button>
              )}
              <a href={locationLink(event.location)} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-info underline-offset-4 hover:underline">
                {t("openMap")}
              </a>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function toPerson(row: AdminSnapshot, t: (key: any) => string, timezone: string): Person {
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
        role="dialog"
        aria-modal="true"
        className="w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-border pb-4">
          <div>
            <p className="label-eyebrow text-brand font-semibold">{t("projectsSubtitle")}</p>
            <h2 className="mt-1 text-xl font-bold">{project ? t("editProject") : t("newProject")}</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase">{t("projectName")}</label>
            <input
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
                className="flex items-center gap-1 text-[11px] font-semibold text-brand hover:underline"
              >
                {gpsBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Crosshair className="h-3 w-3" />}
                {t("useMyLocation")}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 font-mono text-xs">
              <input
                type="number"
                step="any"
                placeholder="Latitude"
                value={latitude}
                onChange={(e) => setLatitude(e.target.value)}
                className="h-9 rounded-lg border border-input bg-background px-2"
              />
              <input
                type="number"
                step="any"
                placeholder="Longitude"
                value={longitude}
                onChange={(e) => setLongitude(e.target.value)}
                className="h-9 rounded-lg border border-input bg-background px-2"
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

          {error && <p className="text-xs text-destructive rounded-xl bg-destructive/10 p-2.5">{error}</p>}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-border py-2.5 text-sm font-semibold hover:bg-muted"
            >
              {t("cancel")}
            </button>
            <button
              type="submit"
              disabled={busy}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
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
        role="dialog"
        aria-modal="true"
        className="w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-border pb-4">
          <div>
            <p className="label-eyebrow text-warning font-semibold">{t("auditAdjustment")}</p>
            <h2 className="mt-1 text-xl font-bold">{t("adjustShiftTimes")}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{shift.display_name} · {shift.work_date}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase">{t("clockInTime")}</label>
            <input
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
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t("adjustReasonPlaceholder")}
              rows={3}
              required
              className="mt-1.5 w-full rounded-xl border border-input bg-background p-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          {error && <p className="text-xs text-destructive rounded-xl bg-destructive/10 p-2.5">{error}</p>}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-border py-2.5 text-sm font-semibold hover:bg-muted"
            >
              {t("cancel")}
            </button>
            <button
              type="submit"
              disabled={busy}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
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
  const [viewMode, setViewMode] = useState<"today" | "history" | "projects">("today");
  const [people, setPeople] = useState<Person[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null | "new">(null);
  
  const [historyRecords, setHistoryRecords] = useState<ShiftHistoryRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyFilterPeriod, setHistoryFilterPeriod] = useState<"all" | "today" | "this_week" | "last_week" | "this_month">("this_month");
  const [historyFilterWorker, setHistoryFilterWorker] = useState<string>("all");
  const [historyFilterProject, setHistoryFilterProject] = useState<string>("all");
  
  const [invite, setInvite] = useState<{ token: string; expiresAt: string } | null>(null);
  const [inviteBusy, setInviteBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [selectedPersonHistory, setSelectedPersonHistory] = useState<ShiftHistoryRecord[]>([]);
  const [selectedPersonLoading, setSelectedPersonLoading] = useState(false);
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
  const [payrollProfiles, setPayrollProfiles] = useState<PayrollProfile[]>([]);
  const [payrollProfilesLoading, setPayrollProfilesLoading] = useState(false);
  const [payrollReviewing, setPayrollReviewing] = useState<string | null>(null);
  const [payrollRevealBusy, setPayrollRevealBusy] = useState<string | null>(null);
  const [revealedPayrollProfile, setRevealedPayrollProfile] = useState<PayrollProfileDetails | null>(null);

  const refreshToday = useCallback(async () => {
    setLoading(true);
    try {
      const members = await loadAdminToday();
      setPeople(members.map((m) => toPerson(m, t, user.timezone)));
      setUpdatedAt(new Date());
      setMessage("");
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
  }, [t]);

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

  const refreshPayrollProfiles = useCallback(async () => {
    setPayrollProfilesLoading(true);
    try {
      setPayrollProfiles(await loadAdminPayrollProfiles());
    } catch {
      // The payroll panel is supplementary while its migration is being rolled out.
    } finally {
      setPayrollProfilesLoading(false);
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
    void refreshPayrollProfiles();
    const timer = window.setInterval(() => {
      setNow(Date.now());
      void refreshToday();
      void refreshGoogleRequests();
      void refreshPasswordResetRequests();
      void refreshRequestHistory();
      void refreshPayrollProfiles();
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [refreshToday, refreshGoogleRequests, refreshPasswordResetRequests, refreshRequestHistory, refreshPayrollProfiles]);

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

  async function reviewPayrollProfile(profile: PayrollProfile, decision: "approved" | "changes_requested") {
    setPayrollReviewing(profile.userId);
    setMessage("");
    try {
      await reviewAdminPayrollProfile(profile.userId, decision, decision === "changes_requested" ? "Please review and update the payroll details." : undefined);
      await refreshPayrollProfiles();
      setMessage(decision === "approved" ? "Payroll profile approved." : "Changes requested for the payroll profile.");
    } catch (caught) {
      setMessage(messageFrom(caught, "The payroll profile could not be reviewed."));
    } finally {
      setPayrollReviewing(null);
    }
  }

  async function revealPayrollProfile(profile: PayrollProfile) {
    setPayrollRevealBusy(profile.userId);
    setMessage("");
    try {
      setRevealedPayrollProfile(await revealAdminPayrollProfile(profile.userId));
    } catch (caught) {
      setMessage(messageFrom(caught, "The payroll details could not be opened."));
    } finally {
      setPayrollRevealBusy(null);
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
    <Shell title={viewMode === "today" ? t("todayTab") : viewMode === "history" ? t("historyTab") : t("projectsTab")} user={user} onSignOut={onSignOut}>
      <div className="space-y-6">
        {/* Navigation Mode Switcher */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="inline-flex rounded-2xl border border-border bg-muted/60 p-1.5 shadow-xs">
            <button
              type="button"
              onClick={() => setViewMode("today")}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${
                viewMode === "today"
                  ? "bg-background text-foreground shadow-xs font-bold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Activity className="h-4 w-4 text-brand" />
              {t("todayTab")}
            </button>
            <button
              type="button"
              onClick={() => setViewMode("history")}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${
                viewMode === "history"
                  ? "bg-background text-foreground shadow-xs font-bold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Calendar className="h-4 w-4 text-info" />
              {t("historyTab")}
            </button>
            <button
              type="button"
              onClick={() => setViewMode("projects")}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${
                viewMode === "projects"
                  ? "bg-background text-foreground shadow-xs font-bold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Building2 className="h-4 w-4 text-primary" />
              {t("projectsTab")}
            </button>
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-success" />
            {updatedAt ? `${t("liveStatus")} ${updatedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : t("saving")}
          </div>
        </div>

        {message && <p role="status" className="rounded-2xl border border-border bg-card px-4 py-3 text-sm">{message}</p>}

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
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      disabled={reviewingGoogleRequest === request.id}
                      onClick={() => void reviewGoogleRequest(request, "reject")}
                      className="rounded-xl border border-border px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted disabled:opacity-60"
                    >
                      Reject
                    </button>
                    <button
                      type="button"
                      disabled={reviewingGoogleRequest === request.id}
                      onClick={() => void reviewGoogleRequest(request, "approve")}
                      className="rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
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
                    <div className="flex shrink-0 gap-2">
                      <button
                        type="button"
                        disabled={issuingPasswordReset === request.id || rejectingPasswordReset === request.id}
                        onClick={() => void rejectPasswordResetRequest(request)}
                        className="rounded-xl border border-border px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted disabled:opacity-60"
                      >
                        {rejectingPasswordReset === request.id ? "Rejecting…" : "Reject"}
                      </button>
                      <button
                        type="button"
                        disabled={issuingPasswordReset === request.id || rejectingPasswordReset === request.id}
                        onClick={() => void generatePasswordResetLink(request)}
                        className="rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
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
                  <input readOnly value={passwordResetLink} className="min-w-0 flex-1 rounded-xl border border-input bg-background px-3 py-2 text-xs" />
                  <button type="button" onClick={() => void copyPasswordResetLink()} className="flex items-center justify-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold hover:bg-muted"><Copy className="h-3.5 w-3.5" /> Copy link</button>
                </div>
              </div>
            )}
          </section>
        )}

        <section className="rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-7" aria-labelledby="request-history-title">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="label-eyebrow">Audit trail</p>
              <h2 id="request-history-title" className="mt-1 text-lg font-semibold">Request history</h2>
              <p className="mt-2 text-sm text-muted-foreground">Reviewed Google access, migrations and password reset requests.</p>
            </div>
            <button
              type="button"
              onClick={() => void refreshRequestHistory()}
              className="rounded-xl border border-border px-3 py-2 text-xs font-semibold hover:bg-muted"
            >
              Refresh
            </button>
          </div>
          <div className="mt-5 overflow-x-auto rounded-2xl border border-border">
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
        </section>

        <section className="rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-7" aria-labelledby="payroll-profiles-title">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="label-eyebrow">Payroll · Jersey</p>
              <h2 id="payroll-profiles-title" className="mt-1 text-lg font-semibold">Worker payroll profiles</h2>
              <p className="mt-2 text-sm text-muted-foreground">Review ITIS and the payroll identifiers submitted by each worker. Sensitive values stay masked until explicitly revealed.</p>
            </div>
            <button type="button" onClick={() => void refreshPayrollProfiles()} className="rounded-xl border border-border px-3 py-2 text-xs font-semibold hover:bg-muted">Refresh</button>
          </div>
          <div className="mt-5 overflow-x-auto rounded-2xl border border-border">
            <table className="w-full min-w-[860px] text-left text-xs">
              <thead className="border-b border-border bg-muted/40 text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-semibold">Worker</th>
                  <th className="px-4 py-3 font-semibold">ITIS</th>
                  <th className="px-4 py-3 font-semibold">Identifiers</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {payrollProfiles.map((profile) => (
                  <tr key={profile.userId}>
                    <td className="px-4 py-3">
                      <p className="font-semibold">{profile.displayName}</p>
                      <p className="text-muted-foreground">{profile.email}</p>
                      {profile.employeeNumber && <p className="mt-1 text-muted-foreground">Employee: {profile.employeeNumber}</p>}
                    </td>
                    <td className="px-4 py-3 font-mono font-semibold">{profile.itisRate === null ? "—" : `${profile.itisRate.toFixed(2)}%`}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {profile.status === "not_started" ? "Not submitted" : `SSN ${profile.maskedSocialSecurityNumber ?? "—"} · Tax ${profile.maskedTaxReference ?? "—"} · Social ${profile.maskedSocialReference ?? "—"}`}
                    </td>
                    <td className="px-4 py-3"><span className="rounded-full bg-muted px-2 py-1 font-semibold capitalize">{profile.status.replace("_", " ")}</span></td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex flex-wrap justify-end gap-2">
                        {profile.status !== "not_started" && (
                          <button type="button" onClick={() => void revealPayrollProfile(profile)} disabled={payrollRevealBusy === profile.userId} className="rounded-xl border border-border px-3 py-2 font-semibold hover:bg-muted disabled:opacity-60">
                            {payrollRevealBusy === profile.userId ? "Opening…" : "View details"}
                          </button>
                        )}
                        {profile.status === "pending_review" && (
                          <>
                            <button type="button" onClick={() => void reviewPayrollProfile(profile, "changes_requested")} disabled={payrollReviewing === profile.userId} className="rounded-xl border border-border px-3 py-2 font-semibold hover:bg-muted disabled:opacity-60">Request changes</button>
                            <button type="button" onClick={() => void reviewPayrollProfile(profile, "approved")} disabled={payrollReviewing === profile.userId} className="rounded-xl bg-primary px-3 py-2 font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60">Approve</button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {!payrollProfilesLoading && payrollProfiles.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No workers found.</td></tr>
                )}
                {payrollProfilesLoading && (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Loading payroll profiles…</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {viewMode === "today" ? (
          <>
            {/* Today's Metrics Banner */}
            <section className="flex flex-col justify-between gap-5 rounded-3xl border border-border bg-card p-5 shadow-sm sm:flex-row sm:items-end sm:p-7">
              <div>
                <p className="label-eyebrow">Field Hours · Live</p>
                <h1 className="mt-1 text-3xl font-semibold tracking-tight">{t("adminGreeting")}, {user.displayName.split(" ")[0]}.</h1>
                <p className="mt-2 text-sm text-muted-foreground">{t("adminSubtitle")}</p>
              </div>
            </section>

            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Metric label={t("workingMetric")} value={counts.working} detail={t("activeShifts")} tone="live" icon={<Activity className="h-4 w-4" />} />
              <Metric label={t("onBreakMetric")} value={counts.onBreak} detail={t("pausedNow")} tone="break" icon={<Pause className="h-4 w-4" />} />
              <Metric label={t("finishedMetric")} value={counts.complete} detail={t("completedToday")} tone="neutral" icon={<Check className="h-4 w-4" />} />
              <Metric label={t("teamMetric")} value={counts.total} detail={t("staffMembers")} tone="neutral" icon={<Users className="h-4 w-4" />} />
            </section>

            <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
              {/* Today's Team List */}
              <section className="rounded-3xl border border-border bg-card shadow-sm">
                <div className="flex items-center justify-between border-b border-border px-5 py-4 sm:px-7">
                  <div>
                    <p className="label-eyebrow">{t("todayTab")}</p>
                    <h2 className="mt-1 text-lg font-semibold">{t("todaysTeam")}</h2>
                  </div>
                  <button type="button" onClick={() => void refreshToday()} className="rounded-lg p-2 text-muted-foreground hover:bg-muted" aria-label="Refresh team">
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Activity className="h-4 w-4" />}
                  </button>
                </div>
                <div className="divide-y divide-border">
                  {!loading && people.length === 0 && <p className="px-5 py-8 text-sm text-muted-foreground sm:px-7">{t("noMembersYet")}</p>}
                  {people.map((person) => (
                    <div key={person.id} className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 sm:px-7">
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
                        <button type="button" onClick={() => void handleOpenPersonDetails(person)} className="rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:bg-muted" aria-label={`View details for ${person.name}`}>
                          {t("details")}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Invite Card */}
              <section className="rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-7">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="label-eyebrow">{t("inviteWorkerTitle")}</p>
                    <h2 className="mt-1 text-lg font-semibold">{t("inviteWorkerSubtitle")}</h2>
                    <p className="mt-2 text-sm leading-5 text-muted-foreground">{t("oneTimeNotice")}</p>
                  </div>
                  <QrCode className="h-5 w-5 text-brand" />
                </div>
                {invite ? (
                  <div className="mt-6">
                    <div className="flex justify-center rounded-2xl bg-white p-5">
                      <QRCodeSVG value={inviteLink} size={210} level="M" includeMargin />
                    </div>
                    <p className="mt-3 text-center text-xs text-muted-foreground">
                      Expires {new Date(invite.expiresAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </p>
                    <button type="button" onClick={() => void copyInvite()} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-border py-3 text-sm font-semibold hover:bg-muted">
                      <Copy className="h-4 w-4" /> {t("copyLink")}
                    </button>
                    <button type="button" onClick={() => setInvite(null)} className="mt-2 w-full py-2 text-xs font-semibold text-muted-foreground hover:text-foreground">{t("close")}</button>
                  </div>
                ) : (
                  <button type="button" disabled={inviteBusy} onClick={() => void generateInvite()} className="mt-6 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
                    {inviteBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <QrCode className="h-4 w-4" />}
                    {inviteBusy ? t("creatingInvitation") : t("createInvitation")}
                  </button>
                )}
                <div className="mt-6 flex items-start gap-2 text-xs leading-5 text-muted-foreground">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                  {t("qrInstruction")}
                </div>
              </section>
            </div>
          </>
        ) : viewMode === "history" ? (
          /* History & Reports Subview */
          <div className="space-y-6">
            {/* Filters Bar */}
            <section className="rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-7">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <p className="label-eyebrow">{t("historyTab")}</p>
                  <h2 className="mt-1 text-2xl font-bold">{t("reportsTitle")}</h2>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  {/* Period Filter */}
                  <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-muted-foreground" />
                    <select
                      value={historyFilterPeriod}
                      onChange={(e: any) => setHistoryFilterPeriod(e.target.value)}
                      className="rounded-xl border border-border bg-background px-3 py-2 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <option value="today">{t("periodToday")}</option>
                      <option value="this_week">{t("periodThisWeek")}</option>
                      <option value="last_week">{t("periodLastWeek")}</option>
                      <option value="this_month">{t("periodThisMonth")}</option>
                      <option value="all">{t("periodAll")}</option>
                    </select>
                  </div>

                  {/* Worker Filter */}
                  <select
                    value={historyFilterWorker}
                    onChange={(e) => setHistoryFilterWorker(e.target.value)}
                    className="rounded-xl border border-border bg-background px-3 py-2 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="all">{t("allStaff")}</option>
                    {people.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>

                  {/* Project Filter */}
                  <select
                    value={historyFilterProject}
                    onChange={(e) => setHistoryFilterProject(e.target.value)}
                    className="rounded-xl border border-border bg-background px-3 py-2 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="all">{t("allProjects")}</option>
                    {projects.map((pr) => (
                      <option key={pr.id} value={pr.id}>{pr.name}</option>
                    ))}
                  </select>

                  {/* Export Button */}
                  <button
                    type="button"
                    onClick={exportExcel}
                    disabled={historyRecords.length === 0}
                    className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  >
                    <Download className="h-4 w-4" />
                    {t("exportExcel")}
                  </button>
                </div>
              </div>

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
              <div className="overflow-x-auto">
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
                                ? "bg-brand/15 text-brand"
                                : r.state === "on_break"
                                  ? "bg-warning/15 text-warning"
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
                                className="inline-flex items-center gap-1 rounded-lg border border-brand/40 bg-brand/10 px-2.5 py-1 text-xs font-semibold text-brand hover:bg-brand/20"
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
        ) : (
          /* Projects & Geofences Subview */
          <div className="space-y-6">
            <section className="rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-7">
              <div className="flex items-center justify-between">
                <div>
                  <p className="label-eyebrow">{t("projectsTab")}</p>
                  <h2 className="mt-1 text-2xl font-bold">{t("projectsTitle")}</h2>
                  <p className="text-xs text-muted-foreground mt-1">{t("projectsSubtitle")}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingProject("new")}
                  className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
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
                {projects.map((proj) => (
                  <div key={proj.id} className="flex flex-wrap items-center justify-between gap-4 py-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-brand/15 text-brand mt-0.5">
                        <Building2 className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-base text-foreground">{proj.name}</h3>
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
                        <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground font-mono">
                          {proj.latitude !== null && proj.longitude !== null ? (
                            <>
                              <span className="flex items-center gap-1">
                                <MapPin className="h-3.5 w-3.5 text-info" /> {proj.latitude.toFixed(5)}, {proj.longitude.toFixed(5)}
                              </span>
                              <span>· {proj.radius_m}m</span>
                            </>
                          ) : (
                            <span className="text-warning">{t("noGpsSet")}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {proj.latitude !== null && proj.longitude !== null && (
                        <a
                          href={`https://www.openstreetmap.org/?mlat=${proj.latitude}&mlon=${proj.longitude}#map=17/${proj.latitude}/${proj.longitude}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-info hover:bg-muted"
                        >
                          {t("viewMap")}
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => setEditingProject(proj)}
                        className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted"
                      >
                        <Edit3 className="h-3.5 w-3.5" /> {t("edit")}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {/* Worker Details Modal with Shift History */}
        {selectedPerson && (
          <div className="fixed inset-0 z-30 flex items-end justify-center bg-foreground/30 p-4 sm:items-center" role="presentation" onClick={() => setSelectedPerson(null)}>
            <section role="dialog" aria-modal="true" aria-labelledby="worker-details-title" className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-border bg-card p-5 shadow-xl sm:p-7" onClick={(event) => event.stopPropagation()}>
              <div className="flex items-start justify-between gap-4 border-b border-border pb-4">
                <div>
                  <p className="label-eyebrow">{t("workerProfileHistory")}</p>
                  <h2 id="worker-details-title" className="mt-1 text-2xl font-bold">{selectedPerson.name}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t("todayTab")}: {stateCopy(selectedPerson.state, t).label} · {formatWorkedDuration(selectedPerson.events, selectedPerson.state, now)}
                  </p>
                </div>
                <button type="button" onClick={() => setSelectedPerson(null)} className="rounded-lg p-2 text-muted-foreground hover:bg-muted" aria-label="Close worker details">
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

                <div className="rounded-2xl border border-border overflow-hidden">
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
            </section>
          </div>
        )}

        {/* Adjust Shift Modal */}
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

        {revealedPayrollProfile && (
          <div className="fixed inset-0 z-40 flex items-end justify-center bg-foreground/30 p-4 sm:items-center" role="presentation" onClick={() => setRevealedPayrollProfile(null)}>
            <section role="dialog" aria-modal="true" aria-labelledby="payroll-details-title" className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-3xl border border-border bg-card p-5 shadow-xl sm:p-7" onClick={(event) => event.stopPropagation()}>
              <div className="flex items-start justify-between gap-4 border-b border-border pb-4">
                <div>
                  <p className="label-eyebrow">Restricted payroll data</p>
                  <h2 id="payroll-details-title" className="mt-1 text-xl font-semibold">{revealedPayrollProfile.displayName}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">This access was recorded in the audit trail.</p>
                </div>
                <button type="button" onClick={() => setRevealedPayrollProfile(null)} className="rounded-lg p-2 text-muted-foreground hover:bg-muted" aria-label="Close payroll details"><X className="h-5 w-5" /></button>
              </div>
              <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
                <PayrollDetail label="Legal name" value={revealedPayrollProfile.legalName} />
                <PayrollDetail label="Employee number" value={revealedPayrollProfile.employeeNumber} />
                <PayrollDetail label="Address" value={revealedPayrollProfile.address} />
                <PayrollDetail label="ITIS" value={revealedPayrollProfile.itisRate === null ? null : `${revealedPayrollProfile.itisRate.toFixed(2)}%`} />
                <PayrollDetail label="Social security number" value={revealedPayrollProfile.socialSecurityNumber} />
                <PayrollDetail label="Tax Reference" value={revealedPayrollProfile.taxReference} />
                <PayrollDetail label="Social Reference" value={revealedPayrollProfile.socialReference} />
                <PayrollDetail label="Bank account name" value={revealedPayrollProfile.bankAccountName} />
                <PayrollDetail label="Sort code" value={revealedPayrollProfile.bankSortCode} />
                <PayrollDetail label="Account number" value={revealedPayrollProfile.bankAccountNumber} />
              </dl>
            </section>
          </div>
        )}
      </div>
    </Shell>
  );
}

function PayrollDetail({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="rounded-2xl border border-border bg-muted/30 p-3">
      <dt className="text-xs font-semibold text-muted-foreground">{label}</dt>
      <dd className="mt-1 break-words font-medium">{value || "—"}</dd>
    </div>
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
    <div className="rounded-3xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <span className={`rounded-xl p-2 ${tone === "live" ? "bg-success/15 text-success" : tone === "break" ? "bg-warning/15 text-warning" : "bg-muted text-muted-foreground"}`}>{icon}</span>
        <span className="font-mono text-3xl font-semibold">{value}</span>
      </div>
      <p className="mt-5 text-sm font-semibold">{label}</p>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
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
  const [googleNotice] = useState(() => {
    const status = new URLSearchParams(window.location.search).get("google");
    if (status) window.history.replaceState({}, "", window.location.pathname);
    if (status === "pending") return "Google sign-in request sent. An administrator must approve it before you can use Google to sign in.";
    if (status === "success") return "Google sign-in is ready for this account.";
    if (status === "error") return "Google sign-in could not be completed. Your current session is unchanged.";
    return "";
  });
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b border-border/80 bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground"><Crosshair className="h-4 w-4" /></div>
            <div>
              <p className="text-sm font-semibold tracking-tight">{t("appTitle")}</p>
              <p className="text-[10px] uppercase tracking-[0.13em] text-muted-foreground">{title}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            <div className="relative">
              <button type="button" onClick={() => setMenuOpen((open) => !open)} className="flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm font-semibold hover:bg-muted" aria-expanded={menuOpen}>
                <span className="hidden sm:inline">{user.displayName}</span><Menu className="h-4 w-4" />
              </button>
              {menuOpen && (
                <div className="absolute right-0 mt-2 w-56 rounded-2xl border border-border bg-card p-2 shadow-lg">
                  <button type="button" onClick={() => startGoogleSignIn("link")} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm hover:bg-muted"><ShieldCheck className="h-4 w-4" /> Set up Google sign-in</button>
                  <button type="button" onClick={onSignOut} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm hover:bg-muted"><LogOut className="h-4 w-4" /> {t("signOut")}</button>
                  <button type="button" onClick={() => setMenuOpen(false)} className="mt-1 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /> {t("close")}</button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-5 py-6 sm:px-8 sm:py-8">
        {googleNotice && <p role="status" className="mb-5 rounded-2xl border border-brand/30 bg-brand/10 px-4 py-3 text-sm text-foreground">{googleNotice}</p>}
        {children}
      </main>
      <footer className="mx-auto flex max-w-7xl items-center gap-2 px-5 pb-8 text-xs text-muted-foreground sm:px-8">
        <ShieldCheck className="h-3.5 w-3.5" /> {t("locationFooterNotice")}
      </footer>
    </div>
  );
}

function LoadingScreen() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex items-center gap-3 text-sm text-muted-foreground" role="status">
        <Loader2 className="h-5 w-5 animate-spin text-brand" /> Loading secure session…
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
