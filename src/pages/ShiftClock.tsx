import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  Activity,
  ArrowRight,
  Check,
  Clock3,
  Copy,
  Crosshair,
  Loader2,
  LogOut,
  MapPin,
  Menu,
  Pause,
  Play,
  QrCode,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import { ApiClientError, type SessionUser } from "@/lib/safeClient";
import {
  actionLabel,
  changePassword,
  createInvitation,
  formatWorkedDuration,
  loadAdminToday,
  loadSession,
  loadWorkerShift,
  nextState,
  registerWorker,
  requestLocation,
  runShiftAction,
  signIn,
  signOut,
  type AdminSnapshot,
  type LocationEvidence,
  type ShiftAction,
  type ShiftEvent,
  type ShiftSnapshot,
  type ShiftState,
} from "@/lib/timeClock";

type Person = {
  id: string;
  name: string;
  role: string;
  state: ShiftState;
  clockInAt: string | null;
  clockOutAt: string | null;
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
  events: [],
};

function invitationFromLocation(): string {
  const fragment = window.location.hash.startsWith("#")
    ? window.location.hash.slice(1)
    : window.location.hash;
  return new URLSearchParams(fragment).get("invite") ?? "";
}

function stateCopy(state: ShiftState): { label: string; detail: string; tone: string } {
  return {
    off_shift: {
      label: "Off shift",
      detail: "Your next action records the place you start work.",
      tone: "neutral",
    },
    working: {
      label: "Working",
      detail: "Your shift is live. Take a break or finish when you are done.",
      tone: "live",
    },
    on_break: {
      label: "On break",
      detail: "Your paid-time clock is paused until you return.",
      tone: "break",
    },
    complete: {
      label: "Shift complete",
      detail: "Your worked time and location evidence are saved for today.",
      tone: "complete",
    },
  }[state];
}

function locationLink(location: LocationEvidence): string {
  return `https://www.openstreetmap.org/?mlat=${location.latitude}&mlon=${location.longitude}#map=16/${location.latitude}/${location.longitude}`;
}

function messageFrom(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function LoginScreen({ onLogin }: { onLogin: (user: SessionUser) => void }) {
  const initialToken = invitationFromLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [inviteToken, setInviteToken] = useState(initialToken);
  const [error, setError] = useState("");
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
      window.history.replaceState({}, "", "/clock");
      onLogin(user);
    } catch (caught) {
      setError(messageFrom(caught, "We could not sign you in."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-background px-5 py-8 sm:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-6xl items-center justify-center">
        <section className="grid w-full max-w-5xl overflow-hidden rounded-3xl border border-border bg-card shadow-lg lg:grid-cols-[1.05fr_.95fr]">
          <div className="hidden bg-primary p-10 text-primary-foreground lg:flex lg:flex-col lg:justify-between">
            <div>
              <div className="mb-14 flex items-center gap-3 text-sm font-semibold tracking-[0.16em] uppercase">
                <Crosshair className="h-5 w-5 text-brand" /> Field hours
              </div>
              <p className="max-w-md text-4xl font-semibold leading-[1.05]">Time that follows the workday.</p>
              <p className="mt-6 max-w-sm text-sm leading-6 text-primary-foreground/70">
                One clear action at a time, with a fresh location check when you clock in, take a break, return, or finish.
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs text-primary-foreground/60">
              <ShieldCheck className="h-4 w-4" /> Server-authorized. Location only when you act.
            </div>
          </div>
          <div className="p-6 sm:p-10">
            <div className="mb-8 flex items-center gap-3 text-sm font-semibold tracking-[0.16em] uppercase lg:hidden">
              <Crosshair className="h-5 w-5 text-brand" /> Field hours
            </div>
            <div className="mb-8">
              <p className="label-eyebrow">Secure access</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight">
                {registration ? "Join your team" : "Welcome back"}
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {registration
                  ? "Your one-time invitation decides your worker access."
                  : "Sign in to clock time or see today’s team."}
              </p>
            </div>
            <form onSubmit={submit} className="space-y-5">
              {registration && (
                <>
                  <label className="block text-sm font-medium">
                    Full name
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
                    Invitation token
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
                Email
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
                Password
                <input
                  required
                  minLength={12}
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
                {registration ? "Create worker account" : "Sign in"}
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>
            <button
              type="button"
              onClick={() => {
                setRegistration((current) => !current);
                setError("");
              }}
              className="mt-5 w-full text-center text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              {registration ? "Back to sign in" : "I have a staff invitation"}
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}

function PasswordChangeScreen({
  user,
  onChanged,
  onSignOut,
}: {
  user: SessionUser;
  onChanged: (user: SessionUser) => void;
  onSignOut: () => void;
}) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (password !== confirmation) {
      setError("The passwords do not match.");
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
        <p className="label-eyebrow mt-7">First sign-in</p>
        <h1 className="mt-2 text-2xl font-semibold">Choose your permanent password</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          The temporary administrator password can only open this screen. Use at least 12 characters.
        </p>
        <form onSubmit={submit} className="mt-7 space-y-5">
          <label className="block text-sm font-medium">
            New password
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
            Confirm password
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
          {error && <p role="alert" className="rounded-xl bg-destructive/10 px-3 py-3 text-sm text-destructive">{error}</p>}
          <button disabled={busy} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground disabled:opacity-60">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Save password
          </button>
        </form>
        <button type="button" onClick={onSignOut} className="mt-4 w-full text-sm text-muted-foreground hover:text-foreground">
          Sign out of {user.email}
        </button>
      </section>
    </main>
  );
}

function WorkerView({ user, onSignOut }: { user: SessionUser; onSignOut: () => void }) {
  const [shift, setShift] = useState<ShiftSnapshot>(emptyShift);
  const [busy, setBusy] = useState<ShiftAction | null>(null);
  const [message, setMessage] = useState("");
  const [online, setOnline] = useState(() => navigator.onLine);
  const [finishRequested, setFinishRequested] = useState(false);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    loadWorkerShift()
      .then(setShift)
      .catch((caught) => setMessage(messageFrom(caught, "We could not load your shift.")))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const copy = stateCopy(shift.state);
  const action = shift.state === "off_shift"
    ? "clock_in"
    : shift.state === "working"
      ? "start_break"
      : shift.state === "on_break"
        ? "end_break"
        : null;
  const duration = formatWorkedDuration(shift.events, shift.state, now);

  async function act(nextAction: ShiftAction) {
    if (busy) return;
    if (!online) {
      setMessage("You are offline. Reconnect before recording a clock action.");
      return;
    }
    if (!nextState(shift.state, nextAction)) {
      setMessage("That action is no longer available. Refresh your shift and try again.");
      return;
    }
    setMessage("");
    setBusy(nextAction);
    try {
      const location = await requestLocation();
      setShift(await runShiftAction(nextAction, location, crypto.randomUUID()));
      if (nextAction === "clock_out") setFinishRequested(false);
      setMessage("Saved with a fresh location check.");
    } catch (caught) {
      setMessage(messageFrom(caught, "We could not save that action."));
    } finally {
      setBusy(null);
    }
  }

  if (loading) {
    return (
      <Shell title="My shift" user={user} onSignOut={onSignOut}>
        <div className="mx-auto max-w-3xl rounded-3xl border border-border bg-card p-7 text-sm text-muted-foreground" role="status">
          Loading today’s shift…
        </div>
      </Shell>
    );
  }

  return (
    <Shell title="My shift" user={user} onSignOut={onSignOut}>
      <div className="mx-auto max-w-3xl space-y-6">
        <section className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between border-b border-border px-5 py-4 sm:px-7">
            <div>
              <p className="label-eyebrow">Today · {new Date().toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}</p>
              <h1 className="mt-1 text-2xl font-semibold">Hi, {user.displayName.split(" ")[0]}</h1>
            </div>
            <div className={`rounded-full px-3 py-1 text-xs font-semibold ${copy.tone === "live" ? "bg-success/15 text-success" : copy.tone === "break" ? "bg-warning/15 text-warning" : "bg-muted text-muted-foreground"}`}>
              {copy.label}
            </div>
          </div>
          <div className="px-5 py-7 sm:px-7 sm:py-10">
            <div className="flex items-end justify-between gap-5">
              <div>
                <p className="label-eyebrow">Worked today</p>
                <p className="mt-2 font-mono text-5xl font-semibold tracking-tight sm:text-6xl">{duration}</p>
              </div>
              <Clock3 className="mb-2 h-9 w-9 text-brand" aria-hidden="true" />
            </div>
            <p className="mt-4 max-w-lg text-sm leading-6 text-muted-foreground">{copy.detail}</p>
            {!online && <p role="status" className="mt-5 rounded-xl border border-warning/40 bg-warning/10 px-3 py-3 text-sm">Offline — reconnect before recording an action.</p>}
            {message && <p role="status" className="mt-5 rounded-xl border border-border bg-muted/50 px-3 py-3 text-sm">{message}</p>}
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              {finishRequested ? (
                <div className="flex w-full flex-col gap-3 rounded-2xl border border-warning/40 bg-warning/10 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold">Finish your shift?</p>
                    <p className="mt-1 text-xs text-muted-foreground">This records the current time and a fresh location check.</p>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setFinishRequested(false)} className="rounded-xl border border-border px-4 py-3 text-sm font-semibold hover:bg-background">Cancel</button>
                    <button type="button" onClick={() => act("clock_out")} disabled={Boolean(busy) || !online} className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60">
                      {busy === "clock_out" && <Loader2 className="h-4 w-4 animate-spin" />}
                      {busy === "clock_out" ? "Saving…" : "Confirm finish"}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {action && (
                    <button type="button" onClick={() => act(action)} disabled={Boolean(busy) || !online} className={`flex min-h-14 flex-1 items-center justify-center gap-3 rounded-2xl px-5 text-base font-semibold shadow-sm transition hover:brightness-95 disabled:opacity-60 ${action === "start_break" ? "bg-warning text-warning-foreground" : "bg-brand text-brand-foreground"}`}>
                      {busy === action ? <Loader2 className="h-5 w-5 animate-spin" /> : action === "clock_in" ? <Play className="h-5 w-5" fill="currentColor" /> : action === "start_break" ? <Pause className="h-5 w-5" fill="currentColor" /> : <ArrowRight className="h-5 w-5" />}
                      {busy === action ? "Saving…" : actionLabel(action)}
                    </button>
                  )}
                  {shift.state === "working" && (
                    <button type="button" onClick={() => setFinishRequested(true)} disabled={Boolean(busy) || !online} className="flex min-h-14 items-center justify-center gap-3 rounded-2xl border border-border px-5 text-base font-semibold transition hover:bg-muted disabled:opacity-60">
                      <LogOut className="h-5 w-5" /> Finish shift
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </section>
        <LocationEvidenceList events={shift.events} />
      </div>
    </Shell>
  );
}

function LocationEvidenceList({ events }: { events: ShiftEvent[] }) {
  return (
    <section className="rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-7">
      <div className="flex items-center justify-between">
        <div>
          <p className="label-eyebrow">Location evidence</p>
          <h2 className="mt-1 text-lg font-semibold">Only when you tap an action</h2>
        </div>
        <MapPin className="h-5 w-5 text-muted-foreground" />
      </div>
      <div className="mt-5 space-y-3">
        {events.length === 0 && <p className="rounded-2xl bg-muted/60 px-4 py-4 text-sm text-muted-foreground">No clock events recorded today.</p>}
        {events.slice().reverse().map((event) => (
          <div key={event.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-muted/60 px-4 py-3">
            <div>
              <p className="text-sm font-semibold">{actionLabel(event.type)}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {new Date(event.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · ±{event.location.accuracy}m accuracy
              </p>
            </div>
            <a href={locationLink(event.location)} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-info underline-offset-4 hover:underline">Open map</a>
          </div>
        ))}
      </div>
    </section>
  );
}

function toPerson(row: AdminSnapshot): Person {
  const latest = row.events.at(-1);
  return {
    id: row.user_id,
    name: row.display_name,
    role: row.role === "admin" ? "Administrator" : "Worker",
    state: row.state,
    clockInAt: row.clock_in_at,
    clockOutAt: row.clock_out_at,
    events: row.events,
    lastEvent: latest
      ? `${actionLabel(latest.type)} at ${new Date(latest.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
      : "Not clocked in",
  };
}

function AdminView({ user, onSignOut }: { user: SessionUser; onSignOut: () => void }) {
  const [people, setPeople] = useState<Person[]>([]);
  const [invite, setInvite] = useState<{ token: string; expiresAt: string } | null>(null);
  const [inviteBusy, setInviteBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const refresh = useCallback(async () => {
    try {
      setPeople((await loadAdminToday()).map(toPerson));
      setUpdatedAt(new Date());
      setMessage("");
    } catch (caught) {
      setMessage(messageFrom(caught, "Today’s team could not be loaded."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => {
      setNow(Date.now());
      void refresh();
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const counts = useMemo(() => ({
    working: people.filter((person) => person.state === "working").length,
    onBreak: people.filter((person) => person.state === "on_break").length,
    complete: people.filter((person) => person.state === "complete").length,
    total: people.length,
  }), [people]);
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

  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setMessage("Invitation link copied.");
    } catch {
      setMessage("Your browser could not copy the link. The QR code is still ready to scan.");
    }
  }

  return (
    <Shell title="Today" user={user} onSignOut={onSignOut}>
      <div className="space-y-6">
        <section className="flex flex-col justify-between gap-5 rounded-3xl border border-border bg-card p-5 shadow-sm sm:flex-row sm:items-end sm:p-7">
          <div>
            <p className="label-eyebrow">Operations · live snapshot</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight">Good day, {user.displayName.split(" ")[0]}.</h1>
            <p className="mt-2 text-sm text-muted-foreground">A clear view of the team’s progress and location evidence.</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-success" />
            {updatedAt ? `Updated ${updatedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "Loading"}
          </div>
        </section>
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Metric label="Working" value={counts.working} detail="active shifts" tone="live" icon={<Activity className="h-4 w-4" />} />
          <Metric label="On break" value={counts.onBreak} detail="paused now" tone="break" icon={<Pause className="h-4 w-4" />} />
          <Metric label="Finished" value={counts.complete} detail="completed today" tone="neutral" icon={<Check className="h-4 w-4" />} />
          <Metric label="Team" value={counts.total} detail="staff members" tone="neutral" icon={<Users className="h-4 w-4" />} />
        </section>
        {message && <p role="status" className="rounded-2xl border border-border bg-card px-4 py-3 text-sm">{message}</p>}
        <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
          <section className="rounded-3xl border border-border bg-card shadow-sm">
            <div className="flex items-center justify-between border-b border-border px-5 py-4 sm:px-7">
              <div>
                <p className="label-eyebrow">Today’s team</p>
                <h2 className="mt-1 text-lg font-semibold">Progress at a glance</h2>
              </div>
              <button type="button" onClick={() => void refresh()} className="rounded-lg p-2 text-muted-foreground hover:bg-muted" aria-label="Refresh team">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Activity className="h-4 w-4" />}
              </button>
            </div>
            <div className="divide-y divide-border">
              {!loading && people.length === 0 && <p className="px-5 py-8 text-sm text-muted-foreground sm:px-7">No staff members have joined yet. Create an invitation to add the first worker.</p>}
              {people.map((person) => (
                <div key={person.id} className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 sm:px-7">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary text-sm font-semibold text-primary-foreground">
                      {person.name.split(" ").map((part) => part[0]).join("").slice(0, 2)}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{person.name}</p>
                      <p className="mt-1 truncate text-xs text-muted-foreground">{person.role} · {person.lastEvent}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="font-mono text-sm font-semibold">{formatWorkedDuration(person.events, person.state, now)}</p>
                      <p className={`mt-1 text-xs font-semibold ${person.state === "working" ? "text-success" : person.state === "on_break" ? "text-warning" : "text-muted-foreground"}`}>
                        {stateCopy(person.state).label}
                      </p>
                    </div>
                    <button type="button" onClick={() => setSelectedPerson(person)} className="rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:bg-muted" aria-label={`View details for ${person.name}`}>
                      Details
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
          <section className="rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="label-eyebrow">Invite staff</p>
                <h2 className="mt-1 text-lg font-semibold">Scan to join</h2>
                <p className="mt-2 text-sm leading-5 text-muted-foreground">The raw token is shown once; D1 stores only its cryptographic hash.</p>
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
                  <Copy className="h-4 w-4" /> Copy secure link
                </button>
                <button type="button" onClick={() => setInvite(null)} className="mt-2 w-full py-2 text-xs font-semibold text-muted-foreground hover:text-foreground">Hide this invitation</button>
              </div>
            ) : (
              <button type="button" disabled={inviteBusy} onClick={() => void generateInvite()} className="mt-6 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
                {inviteBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <QrCode className="h-4 w-4" />}
                {inviteBusy ? "Creating…" : "Create invitation"}
              </button>
            )}
            <div className="mt-6 flex items-start gap-2 text-xs leading-5 text-muted-foreground">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" />
              Each invitation expires quickly and can register exactly one worker.
            </div>
          </section>
        </div>
        {selectedPerson && (
          <div className="fixed inset-0 z-30 flex items-end justify-center bg-foreground/30 p-4 sm:items-center" role="presentation" onClick={() => setSelectedPerson(null)}>
            <section role="dialog" aria-modal="true" aria-labelledby="worker-details-title" className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-border bg-card p-5 shadow-xl sm:p-7" onClick={(event) => event.stopPropagation()}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="label-eyebrow">Worker detail</p>
                  <h2 id="worker-details-title" className="mt-1 text-xl font-semibold">{selectedPerson.name}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{stateCopy(selectedPerson.state).label} · {formatWorkedDuration(selectedPerson.events, selectedPerson.state, now)}</p>
                </div>
                <button type="button" onClick={() => setSelectedPerson(null)} className="rounded-lg p-2 text-muted-foreground hover:bg-muted" aria-label="Close worker details">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-6">
                <LocationEvidenceList events={selectedPerson.events} />
              </div>
            </section>
          </div>
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
  value: number;
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
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b border-border/80 bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground"><Crosshair className="h-4 w-4" /></div>
            <div>
              <p className="text-sm font-semibold tracking-tight">Field hours</p>
              <p className="text-[10px] uppercase tracking-[0.13em] text-muted-foreground">{title}</p>
            </div>
          </div>
          <div className="relative">
            <button type="button" onClick={() => setMenuOpen((open) => !open)} className="flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm font-semibold hover:bg-muted" aria-expanded={menuOpen}>
              <span className="hidden sm:inline">{user.displayName}</span><Menu className="h-4 w-4" />
            </button>
            {menuOpen && (
              <div className="absolute right-0 mt-2 w-44 rounded-2xl border border-border bg-card p-2 shadow-lg">
                <button type="button" onClick={onSignOut} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm hover:bg-muted"><LogOut className="h-4 w-4" /> Sign out</button>
                <button type="button" onClick={() => setMenuOpen(false)} className="mt-1 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /> Close</button>
              </div>
            )}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-5 py-6 sm:px-8 sm:py-8">{children}</main>
      <footer className="mx-auto flex max-w-7xl items-center gap-2 px-5 pb-8 text-xs text-muted-foreground sm:px-8">
        <ShieldCheck className="h-3.5 w-3.5" /> Location is captured only for a clock action.
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

  if (user === undefined) return <LoadingScreen />;
  if (user === null) return <LoginScreen onLogin={setUser} />;
  if (user.mustChangePassword) {
    return <PasswordChangeScreen user={user} onChanged={setUser} onSignOut={() => void handleSignOut()} />;
  }
  return user.role === "admin"
    ? <AdminView user={user} onSignOut={() => void handleSignOut()} />
    : <WorkerView user={user} onSignOut={() => void handleSignOut()} />;
}
