import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Building2,
  CalendarDays,
  CheckCircle2,
  Download,
  Eye,
  FileText,
  Loader2,
  Users,
} from "lucide-react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ApiClientError } from "@/lib/safeClient";
import { downloadSalaryAdvicePdf, SalaryAdvicePdfError } from "@/lib/salaryAdvicePdf";
import {
  calculateAdminSalaryAdvice,
  loadAdminPayrollProfiles,
  loadAdminPayrollSettings,
  revealAdminPayrollProfile,
  saveAdminPayrollProfileCompensation,
  saveAdminPayrollSettings,
  type PayrollProfile,
  type PayrollProfileDetails,
  type PayrollSettings,
  type SalaryAdvice,
  type SalaryAdvicePeriodType,
  type SalaryAdviceWarningCode,
} from "@/lib/timeClock";
import { useI18n } from "@/lib/useI18n";

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiClientError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function jerseyTodayIso(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Jersey",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function addDays(value: string, days: number): string {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return isoDate(date);
}

function endOfMonth(value: string): string {
  const date = new Date(`${value}T00:00:00Z`);
  return isoDate(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)));
}

function currentWeekStart(): string {
  const today = jerseyTodayIso();
  const date = today.startsWith("2026-") ? new Date(`${today}T00:00:00Z`) : new Date("2026-08-30T00:00:00Z");
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  const start = isoDate(date);
  if (start < "2026-01-05") return "2026-01-05";
  if (start > "2026-12-21") return "2026-12-21";
  return start;
}

function currentMonthStart(): string {
  const today = jerseyTodayIso();
  const date = today.startsWith("2026-") ? new Date(`${today}T00:00:00Z`) : new Date("2026-08-01T00:00:00Z");
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

function periodEnd(type: SalaryAdvicePeriodType, start: string): string {
  return type === "weekly" ? addDays(start, 6) : endOfMonth(start);
}

function weekOptions(): string[] {
  const values: string[] = [];
  let cursor = "2025-12-29";
  while (cursor <= "2026-12-28") {
    values.push(cursor);
    cursor = addDays(cursor, 7);
  }
  return values.reverse();
}

function weekUsesConfiguredRules(start: string): boolean {
  return start >= "2026-01-05" && start <= "2026-12-21";
}

function monthOptions(): string[] {
  return Array.from({ length: 12 }, (_, index) => `2026-${String(index + 1).padStart(2, "0")}-01`).reverse();
}

function money(value: number): string {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(value);
}

type SalaryWorkspaceSection = "create" | "business" | "employees";

export function SalaryAdviceWorkspace() {
  const { lang, t } = useI18n();
  const [activeSection, setActiveSection] = useState<SalaryWorkspaceSection>("create");
  const [profiles, setProfiles] = useState<PayrollProfile[]>([]);
  const [settings, setSettings] = useState<PayrollSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [details, setDetails] = useState<PayrollProfileDetails | null>(null);
  const [detailsBusy, setDetailsBusy] = useState<string | null>(null);
  const detailsReturnFocus = useRef<HTMLElement | null>(null);
  const [settingsDirty, setSettingsDirty] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const salaryAdviceLoadError = t("salaryAdviceLoadError");

  useEffect(() => {
    let active = true;
    Promise.all([loadAdminPayrollProfiles(), loadAdminPayrollSettings()])
      .then(([loadedProfiles, loadedSettings]) => {
        if (!active) return;
        setProfiles(loadedProfiles);
        setSettings(loadedSettings);
      })
      .catch((error) => {
        if (active) setLoadError(errorMessage(error, salaryAdviceLoadError));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [salaryAdviceLoadError]);

  async function reveal(profile: PayrollProfile) {
    detailsReturnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setDetailsBusy(profile.userId);
    setLoadError("");
    try {
      setDetails(await revealAdminPayrollProfile(profile.userId));
    } catch (error) {
      setLoadError(errorMessage(error, t("employeeDetailsOpenError")));
    } finally {
      setDetailsBusy(null);
    }
  }

  function closeDetails() {
    setDetails(null);
    window.requestAnimationFrame(() => detailsReturnFocus.current?.focus());
  }

  if (loading) {
    return (
      <section className="rounded-3xl border border-border bg-card p-6 shadow-sm" role="status">
        <Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> {t("salaryAdviceLoading")}
      </section>
    );
  }

  const sectionCopy = {
    create: t("salaryCreateSection"),
    business: t("salaryBusinessSection"),
    employees: t("salaryEmployeesSection"),
  };
  const mobileSections: Array<{
    id: SalaryWorkspaceSection;
    label: string;
    icon: typeof FileText;
  }> = [
    { id: "create", label: sectionCopy.create, icon: FileText },
    { id: "business", label: sectionCopy.business, icon: Building2 },
    { id: "employees", label: sectionCopy.employees, icon: Users },
  ];

  return (
    <div className="space-y-6" data-testid="salary-advice-workspace">
      {loadError && (
        <p role="alert" className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {loadError}
        </p>
      )}
      <nav aria-label={t("sections")} className="rounded-2xl border border-border bg-card p-1 shadow-sm md:hidden">
        <div className="grid grid-cols-3 gap-1">
          {mobileSections.map(({ id, label, icon: Icon }) => {
            const selected = activeSection === id;
            return (
              <button
                key={id}
                type="button"
                aria-controls={`salary-${id}-section`}
                aria-pressed={selected}
                onClick={() => setActiveSection(id)}
                className={`flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-2 py-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                  selected
                    ? "bg-foreground text-background shadow-sm"
                    : "text-foreground/75 hover:bg-muted hover:text-foreground"
                }`}
              >
                <Icon aria-hidden="true" className="h-4 w-4" />
                <span className="w-full truncate">{label}</span>
              </button>
            );
          })}
        </div>
      </nav>
      <div id="salary-create-section" className={activeSection === "create" ? "block" : "hidden md:block"}>
        <SalaryAdviceCalculator
          profiles={profiles.filter((profile) => profile.isComplete && profile.hourlyRate !== null && profile.itisRate !== null)}
          settingsReady={Boolean(settings) && !settingsDirty && !settingsSaving}
          settingsNeedSave={Boolean(settings) && (settingsDirty || settingsSaving)}
          onOpenBusiness={() => {
            setActiveSection("business");
            window.requestAnimationFrame(() => document.getElementById("salary-business-section")?.scrollIntoView({ behavior: "smooth", block: "start" }));
          }}
        />
      </div>
      <div id="salary-business-section" className={activeSection === "business" ? "block" : "hidden md:block"}>
        <BusinessDetailsCard
          settings={settings}
          onSaved={setSettings}
          onDirtyChange={setSettingsDirty}
          onSavingChange={setSettingsSaving}
        />
      </div>
      <div id="salary-employees-section" className={activeSection === "employees" ? "block" : "hidden md:block"}>
        <EmployeeProfilesCard
          profiles={profiles}
          detailsBusy={detailsBusy}
          onReveal={reveal}
          onUpdated={(updated) => setProfiles((current) => current.map((profile) => profile.userId === updated.userId ? updated : profile))}
        />
      </div>
      {details && <EmployeeDetailsDialog details={details} onClose={closeDetails} />}
      <p className="sr-only" aria-live="polite">{lang}</p>
    </div>
  );
}

function BusinessDetailsCard({
  settings,
  onSaved,
  onDirtyChange,
  onSavingChange,
}: {
  settings: PayrollSettings | null;
  onSaved: (settings: PayrollSettings) => void;
  onDirtyChange: (dirty: boolean) => void;
  onSavingChange: (saving: boolean) => void;
}) {
  const { t } = useI18n();
  const [businessName, setBusinessName] = useState(settings?.businessName ?? "");
  const [businessAddress, setBusinessAddress] = useState(settings?.businessAddress ?? "");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [noticeError, setNoticeError] = useState(false);

  useEffect(() => {
    setBusinessName(settings?.businessName ?? "");
    setBusinessAddress(settings?.businessAddress ?? "");
    onDirtyChange(false);
  }, [settings, onDirtyChange]);

  function updateDraft(nextName: string, nextAddress: string) {
    setBusinessName(nextName);
    setBusinessAddress(nextAddress);
    onDirtyChange(
      nextName.trim() !== (settings?.businessName ?? "")
      || nextAddress.trim() !== (settings?.businessAddress ?? "")
    );
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    onSavingChange(true);
    setNotice("");
    setNoticeError(false);
    try {
      const saved = await saveAdminPayrollSettings({
        businessName,
        businessAddress,
      });
      setBusinessName(saved.businessName);
      setBusinessAddress(saved.businessAddress);
      onSaved(saved);
      onDirtyChange(false);
      setNotice(t("businessDetailsSaved"));
    } catch (error) {
      setNotice(errorMessage(error, t("businessDetailsSaveError")));
      setNoticeError(true);
    } finally {
      setBusy(false);
      onSavingChange(false);
    }
  }

  return (
    <section className="rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-7" aria-labelledby="salary-business-title">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="label-eyebrow">{t("salaryDocumentIdentityLabel")}</p>
          <h2 id="salary-business-title" className="mt-1 text-lg font-semibold">{t("businessDetails")}</h2>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">{t("businessDetailsHelp")}</p>
        </div>
        <Building2 className="h-5 w-5 shrink-0 text-muted-foreground" />
      </div>
      <form className="mt-5 grid gap-4 md:grid-cols-2" onSubmit={(event) => void submit(event)}>
        <fieldset disabled={busy} className="contents">
        <label className="text-sm font-medium">
          {t("businessName")}
          <input value={businessName} onChange={(event) => updateDraft(event.target.value, businessAddress)} required maxLength={160} className="mt-1.5 h-11 w-full rounded-xl border border-input bg-background px-3" />
        </label>
        <label className="text-sm font-medium">
          {t("businessAddress")}
          <input value={businessAddress} onChange={(event) => updateDraft(businessName, event.target.value)} required maxLength={250} className="mt-1.5 h-11 w-full rounded-xl border border-input bg-background px-3" />
        </label>
        <div className="flex items-end">
          <button type="submit" disabled={busy} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60 md:w-auto">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}{t("saveBusinessDetails")}
          </button>
        </div>
        </fieldset>
        {notice && (
          <p role={noticeError ? "alert" : "status"} className={`text-sm md:col-span-2 ${noticeError ? "text-destructive" : "text-muted-foreground"}`}>
            {notice}
          </p>
        )}
      </form>
    </section>
  );
}

function EmployeeProfilesCard({
  profiles,
  detailsBusy,
  onReveal,
  onUpdated,
}: {
  profiles: PayrollProfile[];
  detailsBusy: string | null;
  onReveal: (profile: PayrollProfile) => void;
  onUpdated: (profile: PayrollProfile) => void;
}) {
  const { t } = useI18n();
  const [draftRates, setDraftRates] = useState<Record<string, string>>({});
  const [draftItisRates, setDraftItisRates] = useState<Record<string, string>>({});
  const [savingUserId, setSavingUserId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ userId: string; message: string; error: boolean } | null>(null);

  async function saveRate(profile: PayrollProfile) {
    const rawRate = draftRates[profile.userId] ?? (profile.hourlyRate == null ? "" : String(profile.hourlyRate));
    const rate = Number(rawRate);
    if (!Number.isFinite(rate) || rate < 0.01 || rate > 10_000 || Math.abs(rate * 100 - Math.round(rate * 100)) > 1e-7) {
      setNotice({ userId: profile.userId, message: t("hourlyRateValidation"), error: true });
      return;
    }
    const rawItisRate = draftItisRates[profile.userId] ?? (profile.itisRate == null ? "" : String(profile.itisRate));
    const itisRate = Number(rawItisRate);
    if (!Number.isInteger(itisRate) || itisRate < 0 || itisRate > 100) {
      setNotice({ userId: profile.userId, message: t("itisRateHelp"), error: true });
      return;
    }
    setSavingUserId(profile.userId);
    setNotice(null);
    try {
      const updated = await saveAdminPayrollProfileCompensation(profile.userId, rate, itisRate);
      onUpdated(updated);
      setDraftRates((current) => ({ ...current, [profile.userId]: String(updated.hourlyRate ?? rate) }));
      setDraftItisRates((current) => ({ ...current, [profile.userId]: String(updated.itisRate ?? itisRate) }));
      setNotice({ userId: profile.userId, message: t("employeeRateSaved"), error: false });
    } catch (error) {
      setNotice({ userId: profile.userId, message: errorMessage(error, t("employeeRateSaveError")), error: true });
    } finally {
      setSavingUserId(null);
    }
  }

  return (
    <section className="rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-7" aria-labelledby="salary-profiles-title">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="label-eyebrow">{t("salaryEmployeesLabel")}</p>
          <h2 id="salary-profiles-title" className="mt-1 text-lg font-semibold">{t("profilesTitle")}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{t("profilesHelp")}</p>
        </div>
        <Users className="h-5 w-5 shrink-0 text-muted-foreground" />
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {profiles.map((profile) => (
          <article key={profile.userId} className="rounded-2xl border border-border bg-muted/25 p-4">
            <p className="font-semibold">{profile.displayName}</p>
            <p className={`mt-3 flex items-center gap-1.5 text-xs font-semibold ${profile.isComplete && profile.hourlyRate !== null && profile.itisRate !== null ? "text-success" : "text-muted-foreground"}`}>
              {profile.isComplete && profile.hourlyRate !== null && profile.itisRate !== null ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
              {!profile.isComplete ? t("profileMissing") : profile.hourlyRate === null || profile.itisRate === null ? t("profileRateMissing") : t("profileReady")}
            </p>
            <label className="mt-3 block text-sm font-medium">
              {t("editHourlyRate")}
              <input
                type="number"
                min="0.01"
                max="10000"
                step="0.01"
                value={draftRates[profile.userId] ?? (profile.hourlyRate == null ? "" : String(profile.hourlyRate))}
                onChange={(event) => setDraftRates((current) => ({ ...current, [profile.userId]: event.target.value }))}
                disabled={!profile.isComplete || savingUserId !== null}
                className="mt-1.5 h-10 w-full rounded-xl border border-input bg-background px-3 font-mono"
                inputMode="decimal"
              />
            </label>
            <label className="mt-3 block text-sm font-medium">
              {t("employeeItisRate")}
              <input
                type="number"
                min="0"
                max="100"
                step="1"
                value={draftItisRates[profile.userId] ?? (profile.itisRate == null ? "" : String(profile.itisRate))}
                onChange={(event) => setDraftItisRates((current) => ({ ...current, [profile.userId]: event.target.value }))}
                disabled={!profile.isComplete || savingUserId !== null}
                className="mt-1.5 h-10 w-full rounded-xl border border-input bg-background px-3 font-mono"
                inputMode="numeric"
              />
              <span className="mt-1 block text-xs font-normal text-muted-foreground">{t("itisRateHelp")}</span>
            </label>
            {profile.isComplete && (
              <button type="button" onClick={() => void saveRate(profile)} disabled={savingUserId !== null} className="mt-3 flex min-h-10 w-full items-center justify-center gap-2 rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60">
                {savingUserId === profile.userId && <Loader2 className="h-4 w-4 animate-spin" />}{t("saveProfile")}
              </button>
            )}
            {notice?.userId === profile.userId && <p role={notice.error ? "alert" : "status"} className={`mt-2 text-xs ${notice.error ? "text-destructive" : "text-muted-foreground"}`}>{notice.message}</p>}
            {profile.isComplete && (
              <button type="button" onClick={() => onReveal(profile)} disabled={detailsBusy !== null} className="mt-3 flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-border px-3 py-2 text-sm font-semibold hover:bg-muted disabled:opacity-60">
                {detailsBusy === profile.userId ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}{t("viewDetails")}
              </button>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}

function SalaryAdviceCalculator({
  profiles,
  settingsReady,
  settingsNeedSave,
  onOpenBusiness,
}: {
  profiles: PayrollProfile[];
  settingsReady: boolean;
  settingsNeedSave: boolean;
  onOpenBusiness: () => void;
}) {
  const { lang, t } = useI18n();
  const [periodType, setPeriodType] = useState<SalaryAdvicePeriodType>("weekly");
  const [periodStart, setPeriodStart] = useState(currentWeekStart());
  const [payDate, setPayDate] = useState(periodEnd("weekly", currentWeekStart()));
  const [userId, setUserId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [downloaded, setDownloaded] = useState("");
  const [advice, setAdvice] = useState<SalaryAdvice | null>(null);
  const documentRevision = useRef(0);
  const values = useMemo(() => periodType === "weekly" ? weekOptions() : monthOptions(), [periodType]);
  const selectedProfile = profiles.find((profile) => profile.userId === userId);
  const locale = lang === "es" ? "es-ES" : lang === "pt" ? "pt-PT" : "en-GB";
  const sectionCopy = {
    business: t("salaryBusinessSection"),
    employeePeriod: t("salaryEmployeePeriodGroup"),
    confirmedAmounts: t("salaryConfirmedAmountsGroup"),
    totalsDownload: t("salaryTotalsDownloadGroup"),
  };

  useEffect(() => {
    if (!profiles.some((profile) => profile.userId === userId)) setUserId(profiles[0]?.userId ?? "");
  }, [profiles, userId]);

  function clearDocumentInputs() {
    documentRevision.current += 1;
    setAdvice(null);
    setDownloaded("");
    setError("");
  }

  function markDocumentChanged() {
    documentRevision.current += 1;
    setAdvice(null);
    setDownloaded("");
    setError("");
  }

  function selectPeriodType(type: SalaryAdvicePeriodType) {
    const start = type === "weekly" ? currentWeekStart() : currentMonthStart();
    setPeriodType(type);
    setPeriodStart(start);
    setPayDate(periodEnd(type, start));
    clearDocumentInputs();
  }

  function selectPeriod(start: string) {
    setPeriodStart(start);
    setPayDate(periodEnd(periodType, start));
    clearDocumentInputs();
  }

  function optionLabel(start: string): string {
    const formatter = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
    if (periodType === "weekly") return `${formatter.format(new Date(`${start}T00:00:00Z`))} – ${formatter.format(new Date(`${addDays(start, 6)}T00:00:00Z`))}`;
    return new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${start}T00:00:00Z`));
  }

  async function calculate(downloadPdf: boolean): Promise<void> {
    setError("");
    setDownloaded("");
    const submittedRevision = documentRevision.current;
    setBusy(true);
    try {
      const result = await calculateAdminSalaryAdvice({
        userId,
        periodType,
        periodStart,
        payDate,
      });
      if (documentRevision.current !== submittedRevision) return;
      setAdvice(result);
      if (downloadPdf) {
        const filename = await downloadSalaryAdvicePdf(result);
        if (documentRevision.current !== submittedRevision) return;
        setDownloaded(`${t("downloaded")}: ${filename}`);
      }
    } catch (caught) {
      setError(
        caught instanceof SalaryAdvicePdfError
          ? t(caught.code === "FONT_LOAD_FAILED" ? "salaryAdviceFontLoadError" : "salaryAdviceUnsupportedCharacters")
          : errorMessage(caught, t("salaryAdviceDownloadError")),
      );
    } finally {
      setBusy(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void calculate(true);
  }

  return (
    <section className="rounded-3xl border border-brand/30 bg-card p-5 shadow-sm sm:p-7" aria-labelledby="salary-calculator-title">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="label-eyebrow">{t("salaryEstimateLabel")}</p>
          <h1 id="salary-calculator-title" className="mt-1 text-xl font-semibold">{t("salaryAdviceTitle")}</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">{t("salaryAdviceSubtitle")}</p>
        </div>
        <FileText className="h-5 w-5 shrink-0 text-brand" />
      </div>
      {!settingsReady && (
        <div role="alert" className="mt-5 rounded-2xl border border-warning/40 bg-warning/15 p-4 text-sm text-foreground">
          <p>{t(settingsNeedSave ? "businessDetailsUnsaved" : "salaryConfigurationMissing")}</p>
          <button type="button" onClick={onOpenBusiness} className="mt-3 min-h-11 rounded-xl border border-border bg-background px-4 text-sm font-semibold hover:bg-muted">
            {sectionCopy.business}
          </button>
        </div>
      )}
      {profiles.length === 0 ? (
        <p className="mt-5 rounded-2xl border border-warning/40 bg-warning/15 px-4 py-3 text-sm text-foreground">{t("noReadyProfiles")}</p>
      ) : (
        <form className="mt-6 grid gap-6" onSubmit={(event) => void submit(event)} aria-busy={busy}>
          <fieldset disabled={busy} className="contents">
          <section aria-labelledby="salary-period-group-title" className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <div className="md:col-span-2 xl:col-span-3">
            <h3 id="salary-period-group-title" className="text-sm font-semibold text-foreground">{sectionCopy.employeePeriod}</h3>
          </div>
          <label className="text-sm font-medium">
            {t("employee")}
            <select value={userId} onChange={(event) => { setUserId(event.target.value); clearDocumentInputs(); }} required className="mt-1.5 h-11 w-full rounded-xl border border-input bg-background px-3">
              {profiles.map((profile) => <option key={profile.userId} value={profile.userId}>{profile.displayName}{profile.employeeNumber ? ` · ${profile.employeeNumber}` : ""}</option>)}
            </select>
            {selectedProfile && (
              <div className="mt-2 grid grid-cols-2 gap-2 rounded-xl border border-border bg-muted/25 p-3 text-xs">
                <div>
                  <p className="text-muted-foreground">{t("editHourlyRate")}</p>
                  <p className="mt-1 font-mono font-semibold">{money(selectedProfile.hourlyRate ?? 0)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">{t("employeeItisRate")}</p>
                  <p className="mt-1 font-mono font-semibold">{selectedProfile.itisRate ?? 0}%</p>
                </div>
              </div>
            )}
          </label>
          <fieldset>
            <legend className="text-sm font-medium">{t("periodType")}</legend>
            <div className="mt-1.5 grid grid-cols-2 rounded-xl border border-input bg-muted/30 p-1">
              {(["weekly", "monthly"] as const).map((type) => (
                <button key={type} type="button" onClick={() => selectPeriodType(type)} aria-pressed={periodType === type} className={`min-h-11 rounded-lg px-3 text-sm font-semibold transition-colors ${periodType === type ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
                  {t(type)}
                </button>
              ))}
            </div>
          </fieldset>
          <label className="text-sm font-medium">
            {periodType === "weekly" ? t("selectedWeek") : t("selectedMonth")}
            <select value={periodStart} onChange={(event) => selectPeriod(event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-input bg-background px-3">
              {values.map((value) => (
                <option key={value} value={value} disabled={periodType === "weekly" && !weekUsesConfiguredRules(value)}>
                  {optionLabel(value)}{periodType === "weekly" && !weekUsesConfiguredRules(value) ? ` · ${t("adjacentRulesUnavailable")}` : ""}
                </option>
              ))}
            </select>
            {periodType === "weekly" && <span className="mt-1 block text-xs font-normal text-muted-foreground">{t("weeklyCoverageHelp")}</span>}
          </label>
          <label className="text-sm font-medium">
            {t("payDate")}
            <input type="date" value={payDate} min={periodStart} onChange={(event) => { setPayDate(event.target.value); markDocumentChanged(); }} required className="mt-1.5 h-11 w-full rounded-xl border border-input bg-background px-3" />
          </label>
          </section>
          <section aria-labelledby="salary-automatic-group-title" className="grid gap-4 border-t border-border pt-5 md:grid-cols-2 xl:grid-cols-3">
          <div className="md:col-span-2 xl:col-span-3">
            <h3 id="salary-automatic-group-title" className="text-sm font-semibold text-foreground">{sectionCopy.confirmedAmounts}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{t("automaticCalculationHelp")}</p>
          </div>
          <div className="rounded-2xl border border-border bg-muted/25 p-4 text-sm md:col-span-2 xl:col-span-3">
            <p className="font-semibold">{t("socialSecurityStandard")}</p>
          </div>
          <div className="flex items-end md:col-span-2 xl:col-span-3">
            <button type="button" onClick={() => void calculate(false)} disabled={!settingsReady || busy} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-brand bg-background px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-brand/10 disabled:opacity-60">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarDays className="h-4 w-4" />}
              {busy ? t("checkingSavedHours") : t("checkSavedHours")}
            </button>
          </div>
          <div className="flex items-end md:col-span-2 xl:col-span-3">
            <button type="submit" disabled={!settingsReady || busy} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand/90 disabled:opacity-60">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {busy ? t("calculating") : t("calculateDownload")}
            </button>
          </div>
          </section>
          </fieldset>
          {error && <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-3 text-sm text-destructive">{error}</p>}
          {downloaded && <p role="status" className="rounded-xl border border-success/30 bg-success/10 px-3 py-3 text-sm text-foreground">{downloaded}</p>}
        </form>
      )}
      {advice && <SalaryAdviceSummary advice={advice} />}
    </section>
  );
}

function SalaryAdviceSummary({ advice }: { advice: SalaryAdvice }) {
  const { t } = useI18n();
  const hours = Number.isInteger(advice.allowance.hours * 100)
    ? advice.allowance.hours.toFixed(2)
    : advice.allowance.hours.toFixed(4);
  const metrics = [
    [t("completedShiftsLabel"), String(advice.allowance.shiftCount)],
    [t("hoursLabel"), hours],
    [t("grossPay"), money(advice.grossTaxablePay)],
    [t("itisLabel"), money(advice.deductions.incomeTax)],
    [t("socialSecurityLabel"), money(advice.deductions.workerSocialSecurity)],
    [t("totalDeductions"), money(advice.deductions.total)],
    [t("netPay"), money(advice.netPay)],
    [t("yearToDateGross"), money(advice.totalsToDate.grossTaxablePay)],
    [t("yearToDateTax"), money(advice.totalsToDate.taxPaid)],
  ];
  const primaryMetrics = [
    [t("grossPay"), money(advice.grossTaxablePay)],
    [t("totalDeductions"), money(advice.deductions.total)],
    [t("netPay"), money(advice.netPay)],
  ];
  const breakdownMetrics = [
    [t("completedShiftsLabel"), String(advice.allowance.shiftCount)],
    [t("hoursLabel"), hours],
    [t("itisLabel"), money(advice.deductions.incomeTax)],
    [t("socialSecurityLabel"), money(advice.deductions.workerSocialSecurity)],
    [t("yearToDateGross"), money(advice.totalsToDate.grossTaxablePay)],
    [t("yearToDateTax"), money(advice.totalsToDate.taxPaid)],
  ];
  return (
    <div className="mt-6 border-t border-border pt-5">
      <div className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-brand" /><h3 className="font-semibold">{t("previewTitle")}</h3></div>
      <p className="mt-1 text-xs text-muted-foreground">{advice.worker.displayName} · {advice.period.start} – {advice.period.end}</p>
      <dl className="mt-4 grid grid-cols-3 overflow-hidden rounded-2xl border border-border md:hidden">
        {primaryMetrics.map(([label, value]) => <div key={label} className="min-w-0 border-r border-border p-3 last:border-r-0"><dt className="truncate text-[11px] text-muted-foreground">{label}</dt><dd className="mt-1 truncate font-mono text-sm font-semibold">{value}</dd></div>)}
      </dl>
      <details className="mt-3 rounded-2xl border border-border md:hidden">
        <summary className="flex min-h-11 cursor-pointer list-none items-center px-4 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">{t("viewBreakdown")}</summary>
        <dl className="divide-y divide-border border-t border-border px-4">
          {breakdownMetrics.map(([label, value]) => <div key={label} className="flex items-center justify-between gap-4 py-3"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="font-mono text-xs font-semibold">{value}</dd></div>)}
        </dl>
      </details>
      <dl className="mt-4 hidden overflow-hidden rounded-2xl border border-border md:grid md:grid-cols-3 xl:grid-cols-5">
        {metrics.map(([label, value]) => <div key={label} className="border-b border-r border-border bg-muted/20 p-3"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 font-mono text-sm font-semibold">{value}</dd></div>)}
      </dl>
      {advice.isEstimate && (
        <p className="mt-4 rounded-xl border border-warning/40 bg-warning/15 px-3 py-3 text-xs leading-5 text-foreground">
          {t("estimateNotice")}
        </p>
      )}
      {advice.warnings.length > 0 && (
        <ul className="mt-2 list-disc space-y-1 rounded-xl border border-warning/40 bg-warning/10 px-7 py-3 text-xs leading-5 text-foreground">
          {advice.warnings.map((warning) => <li key={warning}>{salaryAdviceWarningText(warning, t)}</li>)}
        </ul>
      )}
    </div>
  );
}

function salaryAdviceWarningText(
  warning: SalaryAdviceWarningCode,
  t: ReturnType<typeof useI18n>["t"],
): string {
  switch (warning) {
    case "WEEKLY_SOCIAL_SECURITY_RECONCILIATION_REQUIRED":
      return t("weeklySocialSecurityWarning");
  }
}

function EmployeeDetailsDialog({ details, onClose }: { details: PayrollProfileDetails; onClose: () => void }) {
  const { t } = useI18n();
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent closeLabel={t("close")} className="max-h-[90vh] w-[calc(100%_-_1.5rem)] max-w-xl overflow-y-auto rounded-3xl border-border bg-card p-5 sm:p-7">
        <DialogHeader>
          <p className="label-eyebrow">{t("salaryIdentityLabel")}</p>
          <DialogTitle className="text-xl">{t("profileDetails")}</DialogTitle>
          <DialogDescription>{t("profilesHelp")}</DialogDescription>
        </DialogHeader>
        <dl className="mt-5 grid gap-3 sm:grid-cols-2">
          {[
            [t("employee"), details.legalName],
            [t("employeeNumber"), details.employeeNumber],
            [t("editHourlyRate"), details.hourlyRate == null ? "—" : money(details.hourlyRate)],
            [t("employeeItisRate"), details.itisRate == null ? "—" : `${details.itisRate}%`],
            [t("taxReference"), details.taxReference],
            [t("socialReference"), details.socialReference],
          ].map(([label, value]) => <div key={label} className="rounded-2xl border border-border bg-muted/25 p-3"><dt className="text-xs font-semibold text-muted-foreground">{label}</dt><dd className="mt-1 break-words font-mono text-sm">{value ?? "—"}</dd></div>)}
          <div className="rounded-2xl border border-border bg-muted/25 p-3 sm:col-span-2">
            <dt className="text-xs font-semibold text-muted-foreground">{t("address")}</dt>
            <dd className="mt-1 break-words text-sm">{details.address}</dd>
          </div>
        </dl>
        <DialogClose asChild>
          <button type="button" className="mt-5 min-h-11 w-full rounded-xl border border-border px-4 py-2 text-sm font-semibold hover:bg-muted sm:w-auto">{t("close")}</button>
        </DialogClose>
      </DialogContent>
    </Dialog>
  );
}
