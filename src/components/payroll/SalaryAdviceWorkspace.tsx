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

export function SalaryAdviceWorkspace() {
  const { lang, t } = useI18n();
  const [profiles, setProfiles] = useState<PayrollProfile[]>([]);
  const [settings, setSettings] = useState<PayrollSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [details, setDetails] = useState<PayrollProfileDetails | null>(null);
  const [detailsBusy, setDetailsBusy] = useState<string | null>(null);
  const detailsReturnFocus = useRef<HTMLElement | null>(null);
  const [settingsDirty, setSettingsDirty] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([loadAdminPayrollProfiles(), loadAdminPayrollSettings()])
      .then(([loadedProfiles, loadedSettings]) => {
        if (!active) return;
        setProfiles(loadedProfiles);
        setSettings(loadedSettings);
      })
      .catch((error) => {
        if (active) setLoadError(errorMessage(error, t("salaryAdviceLoadError")));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

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

  return (
    <div className="space-y-6" data-testid="salary-advice-workspace">
      {loadError && (
        <p role="alert" className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {loadError}
        </p>
      )}
      <SalaryAdviceCalculator
        profiles={profiles.filter((profile) => profile.isComplete)}
        settingsReady={Boolean(settings) && !settingsDirty && !settingsSaving}
        settingsNeedSave={Boolean(settings) && (settingsDirty || settingsSaving)}
      />
      <BusinessDetailsCard
        settings={settings}
        onSaved={setSettings}
        onDirtyChange={setSettingsDirty}
        onSavingChange={setSettingsSaving}
      />
      <EmployeeProfilesCard profiles={profiles} detailsBusy={detailsBusy} onReveal={reveal} />
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
      || nextAddress.trim() !== (settings?.businessAddress ?? ""),
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
}: {
  profiles: PayrollProfile[];
  detailsBusy: string | null;
  onReveal: (profile: PayrollProfile) => void;
}) {
  const { t } = useI18n();
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
            <p className={`mt-3 flex items-center gap-1.5 text-xs font-semibold ${profile.isComplete ? "text-success" : "text-muted-foreground"}`}>
              {profile.isComplete ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
              {profile.isComplete ? t("profileReady") : t("profileMissing")}
            </p>
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
}: {
  profiles: PayrollProfile[];
  settingsReady: boolean;
  settingsNeedSave: boolean;
}) {
  const { lang, t } = useI18n();
  const [periodType, setPeriodType] = useState<SalaryAdvicePeriodType>("weekly");
  const [periodStart, setPeriodStart] = useState(currentWeekStart());
  const [payDate, setPayDate] = useState(periodEnd("weekly", currentWeekStart()));
  const [userId, setUserId] = useState("");
  const [hourlyRate, setHourlyRate] = useState("");
  const [itisRate, setItisRate] = useState("");
  const [monthlySocialSecurityRate, setMonthlySocialSecurityRate] = useState<0 | 6 | null>(null);
  const [weeklySocialSecurity, setWeeklySocialSecurity] = useState("");
  const [yearToDateGross, setYearToDateGross] = useState("");
  const [yearToDateTax, setYearToDateTax] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [downloaded, setDownloaded] = useState("");
  const [advice, setAdvice] = useState<SalaryAdvice | null>(null);
  const documentRevision = useRef(0);
  const values = useMemo(() => periodType === "weekly" ? weekOptions() : monthOptions(), [periodType]);
  const locale = lang === "es" ? "es-ES" : lang === "pt" ? "pt-PT" : "en-GB";

  useEffect(() => {
    if (!profiles.some((profile) => profile.userId === userId)) setUserId(profiles[0]?.userId ?? "");
  }, [profiles, userId]);

  function clearDocumentInputs() {
    documentRevision.current += 1;
    setHourlyRate("");
    setItisRate("");
    setMonthlySocialSecurityRate(null);
    setWeeklySocialSecurity("");
    setYearToDateGross("");
    setYearToDateTax("");
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

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setDownloaded("");
    const rate = Number(hourlyRate);
    if (!Number.isFinite(rate) || rate < 0.01 || rate > 10_000 || Math.abs(rate * 100 - Math.round(rate * 100)) > 1e-7) {
      setError(t("hourlyRateValidation"));
      return;
    }
    const confirmedItisRate = Number(itisRate);
    if (!Number.isInteger(confirmedItisRate) || confirmedItisRate < 0 || confirmedItisRate > 100) {
      setError(t("itisRateHelp"));
      return;
    }
    const confirmedWeeklySocialSecurity = Number(weeklySocialSecurity);
    if (
      periodType === "weekly"
      && (!Number.isFinite(confirmedWeeklySocialSecurity)
        || confirmedWeeklySocialSecurity < 0
        || Math.abs(confirmedWeeklySocialSecurity * 100 - Math.round(confirmedWeeklySocialSecurity * 100)) > 1e-7)
    ) {
      setError(t("weeklySocialSecurityHelp"));
      return;
    }
    if (periodType === "monthly" && monthlySocialSecurityRate === null) {
      setError(t("monthlySocialSecurityHelp"));
      return;
    }
    const confirmedYearToDateGross = Number(yearToDateGross);
    const confirmedYearToDateTax = Number(yearToDateTax);
    if (
      !Number.isFinite(confirmedYearToDateGross)
      || !Number.isFinite(confirmedYearToDateTax)
      || confirmedYearToDateGross < 0
      || confirmedYearToDateTax < 0
      || confirmedYearToDateTax > confirmedYearToDateGross
      || Math.abs(confirmedYearToDateGross * 100 - Math.round(confirmedYearToDateGross * 100)) > 1e-7
      || Math.abs(confirmedYearToDateTax * 100 - Math.round(confirmedYearToDateTax * 100)) > 1e-7
    ) {
      setError(t("totalsToDateHelp"));
      return;
    }
    const submittedRevision = documentRevision.current;
    setBusy(true);
    try {
      const result = await calculateAdminSalaryAdvice({
        userId,
        periodType,
        periodStart,
        payDate,
        hourlyRate: rate,
        itisRate: confirmedItisRate,
        ...(periodType === "weekly"
          ? { weeklyWorkerSocialSecurity: confirmedWeeklySocialSecurity }
          : { workerSocialSecurityRate: monthlySocialSecurityRate as 0 | 6 }),
        yearToDateGrossTaxablePay: confirmedYearToDateGross,
        yearToDateTaxPaid: confirmedYearToDateTax,
      });
      if (documentRevision.current !== submittedRevision) return;
      const filename = await downloadSalaryAdvicePdf(result);
      if (documentRevision.current !== submittedRevision) return;
      setAdvice(result);
      setDownloaded(`${t("downloaded")}: ${filename}`);
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

  return (
    <section className="rounded-3xl border border-brand/30 bg-card p-5 shadow-sm sm:p-7" aria-labelledby="salary-calculator-title">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="label-eyebrow">{t("salaryEstimateLabel")}</p>
          <h2 id="salary-calculator-title" className="mt-1 text-xl font-semibold">{t("salaryAdviceTitle")}</h2>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">{t("salaryAdviceSubtitle")}</p>
        </div>
        <FileText className="h-5 w-5 shrink-0 text-brand" />
      </div>
      {profiles.length === 0 ? (
        <p className="mt-5 rounded-2xl border border-warning/40 bg-warning/15 px-4 py-3 text-sm text-foreground">{t("noReadyProfiles")}</p>
      ) : (
        <form className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3" onSubmit={(event) => void submit(event)} aria-busy={busy}>
          <fieldset disabled={busy} className="contents">
          <label className="text-sm font-medium">
            {t("employee")}
            <select value={userId} onChange={(event) => { setUserId(event.target.value); clearDocumentInputs(); }} required className="mt-1.5 h-11 w-full rounded-xl border border-input bg-background px-3">
              {profiles.map((profile) => <option key={profile.userId} value={profile.userId}>{profile.displayName}{profile.employeeNumber ? ` · ${profile.employeeNumber}` : ""}</option>)}
            </select>
          </label>
          <fieldset>
            <legend className="text-sm font-medium">{t("periodType")}</legend>
            <div className="mt-1.5 grid grid-cols-2 rounded-xl border border-input bg-muted/30 p-1">
              {(["weekly", "monthly"] as const).map((type) => (
                <button key={type} type="button" onClick={() => selectPeriodType(type)} aria-pressed={periodType === type} className={`min-h-9 rounded-lg px-3 text-sm font-semibold ${periodType === type ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
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
          <label className="text-sm font-medium">
            {t("hourlyRateAdvice")}
            <input type="number" min="0.01" max="10000" step="0.01" value={hourlyRate} onChange={(event) => { setHourlyRate(event.target.value); markDocumentChanged(); }} required inputMode="decimal" className="mt-1.5 h-11 w-full rounded-xl border border-input bg-background px-3 font-mono" />
            <span className="mt-1 block text-xs font-normal text-muted-foreground">{t("hourlyRateHelp")}</span>
          </label>
          <label className="text-sm font-medium">
            {t("itisRateAdvice")}
            <input type="number" min="0" max="100" step="1" value={itisRate} onChange={(event) => { setItisRate(event.target.value); markDocumentChanged(); }} required inputMode="numeric" className="mt-1.5 h-11 w-full rounded-xl border border-input bg-background px-3 font-mono" />
            <span className="mt-1 block text-xs font-normal text-muted-foreground">{t("itisRateHelp")}</span>
          </label>
          {periodType === "monthly" ? (
            <fieldset>
              <legend className="text-sm font-medium">{t("monthlySocialSecurityStatus")}</legend>
              <div className="mt-1.5 grid grid-cols-2 rounded-xl border border-input bg-muted/30 p-1">
                {([6, 0] as const).map((rate) => (
                  <button key={rate} type="button" onClick={() => { setMonthlySocialSecurityRate(rate); markDocumentChanged(); }} aria-pressed={monthlySocialSecurityRate === rate} className={`min-h-9 rounded-lg px-2 text-xs font-semibold ${monthlySocialSecurityRate === rate ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
                    {rate === 6 ? t("socialSecurityStandard") : t("socialSecurityExempt")}
                  </button>
                ))}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{t("monthlySocialSecurityHelp")}</p>
            </fieldset>
          ) : (
            <label className="text-sm font-medium">
              {t("weeklySocialSecurityAmount")}
              <input type="number" min="0" step="0.01" value={weeklySocialSecurity} onChange={(event) => { setWeeklySocialSecurity(event.target.value); markDocumentChanged(); }} required inputMode="decimal" className="mt-1.5 h-11 w-full rounded-xl border border-input bg-background px-3 font-mono" />
              <span className="mt-1 block text-xs font-normal text-muted-foreground">{t("weeklySocialSecurityHelp")}</span>
            </label>
          )}
          <label className="text-sm font-medium">
            {t("yearToDateGross")}
            <input type="number" min="0" step="0.01" value={yearToDateGross} onChange={(event) => { setYearToDateGross(event.target.value); markDocumentChanged(); }} required inputMode="decimal" className="mt-1.5 h-11 w-full rounded-xl border border-input bg-background px-3 font-mono" />
          </label>
          <label className="text-sm font-medium">
            {t("yearToDateTax")}
            <input type="number" min="0" step="0.01" value={yearToDateTax} onChange={(event) => { setYearToDateTax(event.target.value); markDocumentChanged(); }} required inputMode="decimal" className="mt-1.5 h-11 w-full rounded-xl border border-input bg-background px-3 font-mono" />
            <span className="mt-1 block text-xs font-normal text-muted-foreground">{t("totalsToDateHelp")}</span>
          </label>
          <div className="flex items-end">
            <button type="submit" disabled={!settingsReady} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground hover:bg-brand/90 disabled:opacity-60">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {busy ? t("calculating") : t("calculateDownload")}
            </button>
          </div>
          </fieldset>
          {!settingsReady && <p role="alert" className="text-sm text-destructive md:col-span-2 xl:col-span-3">{t(settingsNeedSave ? "businessDetailsUnsaved" : "businessDetailsRequired")}</p>}
          {error && <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-3 text-sm text-destructive md:col-span-2 xl:col-span-3">{error}</p>}
          {downloaded && <p role="status" className="rounded-xl border border-success/30 bg-success/10 px-3 py-3 text-sm text-foreground md:col-span-2 xl:col-span-3">{downloaded}</p>}
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
  return (
    <div className="mt-6 border-t border-border pt-5">
      <div className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-brand" /><h3 className="font-semibold">{t("previewTitle")}</h3></div>
      <p className="mt-1 text-xs text-muted-foreground">{advice.worker.displayName} · {advice.period.start} – {advice.period.end}</p>
      <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {metrics.map(([label, value]) => <div key={label} className="rounded-2xl border border-border bg-muted/25 p-3"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 font-mono text-sm font-semibold">{value}</dd></div>)}
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
