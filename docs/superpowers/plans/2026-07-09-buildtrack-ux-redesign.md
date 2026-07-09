# BuildTrack Pro — Plan de rediseño UX/UI por página y función

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Llevar cada página y cada ventana de BuildTrack Pro al patrón de diseño validado en Mobbin para su categoría (field service / gestión de obra), manteniendo TODAS las funciones intactas y reduciendo líneas de código.

**Architecture:** SPA Vite + React 18 + shadcn/ui sobre Supabase cloud. Ya existen: design system "site office" (fondo bone, tinta charcoal, ámbar hi-vis como único acento), `AppShell` (nav persistente), `useRequireRole` (guard central) y `responsive-dialog` (bottom sheets en móvil). Este plan completa las superficies restantes: ProjectDetails (la página más usada, hoy lenta y con jerarquía rota), JobCard, agrupación del overview de Managers, saludo/orden en Builders, banda de totales en Statements y layout GoPay en Invite.

**Tech Stack:** React 18, TypeScript, Tailwind, shadcn/ui, Supabase JS v2 (`createSignedUrls` para lotes), react-router v6, Playwright (verificación), Docker multi-stage + tailscale serve.

## Global Constraints

- Rama de trabajo: `redesign/professional-ui` (todo el trabajo previo vive ahí sin commit — la Task 0 crea el checkpoint).
- PROHIBIDO crear cuentas o escribir en la base Supabase de producción durante verificación. Vista builder = mock de ruta **solo-GET** sobre `user_roles` (patrón de `verify2.mjs`); abortar y contar cualquier request no-GET.
- Un solo color "fuerte" por pantalla: `brand` (ámbar hi-vis). Todo lo demás usa tokens semánticos existentes (`success`, `warning`, `destructive`, `muted`).
- Moneda visible: **£** (los datos de invoices ya son £; el símbolo `$` en Managers es un bug de etiqueta y se corrige en Task 5).
- Cada función existente debe seguir operando igual: mismos handlers, mismas tablas, mismos payloads. Este plan cambia presentación, jerarquía y eficiencia de lectura — no lógica de negocio (única excepción: `fetchJobs` se re-implementa con las MISMAS consultas semánticas pero en lote).
- Credenciales de verificación: manager `luismadef45+manager@gmail.com` (password en `/root/compartido/salida/buildtrack-pro-mapa-completo.md`). Nunca commitearlas: los scripts las leen de `BT_EMAIL` / `BT_PASSWORD`.
- Playwright: importar desde `/root/jobsite-jedi/node_modules/playwright-core/index.mjs` con `executablePath` `/root/.cache/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-linux64/chrome-headless-shell`.
- Commits frecuentes con mensajes `feat:`/`fix:`/`perf:` y coautoría `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

---

## 1 · Inventario funcional completo

### 1.1 Rutas

| Ruta | Página | Rol | Funciones | Estado de diseño |
|---|---|---|---|---|
| `/` | Index | público | landing, CTA a /auth | ✅ conforme (pase anterior) |
| `/auth` | Auth | público | sign-in, sign-up con código de invitación, escáner QR (`QRScannerDialog`, lazy) | ✅ conforme |
| `/dashboard` | Dashboard | ambos | redirección por rol (`homeOf`) | ✅ conforme |
| `/managers` | Managers | manager | 8 StatTiles (3 abren diálogo, 1 navega), tabs Projects/Finished/Suppliers, crear proyecto | 🔧 Task 5 |
| `/builders` | Builders | builder | selector de proyecto, clock in/out + GPS, jobs to-do, 8 acciones de obra | 🔧 Task 6 |
| `/project/:projectId` | ProjectDetails | ambos | secciones colapsables de jobs, crear/editar/importar jobs, selección masiva + borrado, tracking por job, envío/revisión, realtime | 🔧 Tasks 1–4 |
| `/statements` | Statements | manager | 5 tabs (Daily/Weekly/Monthly/Project/Builder) con filtros, totales, tablas y export xlsx | 🔧 Task 7 |
| `/storage` | Storage | manager | 4 tabs: Materials, Tools, Requests, Checkouts | ✅ conforme (tabla estilo Shopify ya presente) |
| `/invite` | Invite | manager | generar invitación QR con caducidad 5 min, copiar link | 🔧 Task 8 |
| `*` | NotFound | público | 404 | ✅ conforme |

### 1.2 Ventanas (las 30), su función y su diseño objetivo

Todas ya renderizan como **diálogo centrado en ≥768px y bottom sheet en <768px** vía `responsive-dialog`. "Conforme" = solo hereda el patrón; no requiere tarea propia.

| # | Ventana | Se abre desde | Función | Diseño objetivo |
|---|---|---|---|---|
| 1 | QRScannerDialog | Auth | escanear QR de invitación | conforme (cámara a pantalla completa del sheet) |
| 2 | CreateProjectDialog | Managers | alta de proyecto (nombre*, cliente*, dirección, descripción) | conforme — formulario 1 columna |
| 3 | EditProjectDialog | ProjectList | editar + status | conforme |
| 4 | Finish Project (AlertDialog) | ProjectList | archivar proyecto | conforme (confirm destructivo) |
| 5 | Reactivate Project (AlertDialog) | FinishedProjectList | reactivar | conforme |
| 6 | MaterialsDetailDialog | tile Materials | logs de uso de material | conforme — lista de registros |
| 7 | TimeTrackingDetailDialog | tile Builder hours | horas por builder / por proyecto | conforme |
| 8 | InvoicesDetailDialog | tile Invoiced | facturas + imagen | conforme |
| 9 | ManagerRiskAssessmentDialog | tile Risk assessments | subir/gestionar PDFs (título, proyecto, PDF) | conforme |
| 10 | ManagerRubbishDialog | tile Rubbish requests | cola: aprobar/completar recogidas, ver fotos | conforme — patrón cola de aprobación (Jira Approvals) |
| 11 | ManagerMaterialDeliveryDialog | tile Material requests | cola: aprobar entregas | conforme — ídem |
| 12 | SupplierManagement (inline) | tab Suppliers | alta y lista de proveedores | conforme |
| 13 | SelectJobDialog | Builders (clock-in) | elegir job a trackear | conforme — lista simple |
| 14 | EnhancedMaterialDialog | Builders | 3 tabs: log de uso / crear material / revisar logs | conforme — Jobber "New request" (form seccionado, CTA al fondo) |
| 15 | EnhancedInvoiceDialog | Builders | subir factura (proveedor, nº*, fecha*, total £*, notas, foto) | conforme — ídem |
| 16 | DailyReportDialog | Builders | parte diario: texto + hasta 20 fotos | conforme — tiles de foto con contador n/20 ([monday upload](https://mobbin.com/flows/fdfe42af-95ce-4d06-99f4-4f6d2aee65f8)) |
| 17 | ChangeProjectDialog | Builders | cambiar de proyecto estando fichado | conforme |
| 18 | RiskAssessmentDialog | Builders | ver/firmar documentos de seguridad | conforme |
| 19 | RubbishCollectionDialog | Builders | solicitar recogida (proyecto, fotos*, descripción) | conforme |
| 20 | MaterialDeliveryDialog | Builders | solicitar entrega (buscador + carrito + notas) | conforme |
| 21 | ToolRequestDialog | Builders | solicitar herramientas | conforme |
| 22 | CreateJobDialog | ProjectDetails | alta de job (título*, sección, descripción, fotos) | conforme |
| 23 | EditJobDialog | ProjectDetails | editar job + fotos de referencia | conforme |
| 24 | BulkJobUploadDialog | ProjectDetails | importar Excel → selección de jobs extraídos | conforme |
| 25 | JobSubmissionDialog | JobCard | entregar job: fotos* + notas + materiales + colaboradores | conforme — [flujo Jobber](https://mobbin.com/flows/54dfb6e2-9112-4ca1-a3b6-c7a892cc09f7) |
| 26 | ManagerFeedbackDialog | JobCard | pedir correcciones: notas + fotos de referencia | conforme |
| 27 | ManagerReferencePhotosDialog | ManagerJobsList | ver fotos de referencia | conforme |
| 28 | JobReviewDialog | ManagerJobsList | revisar entregas | conforme |
| 29 | Delete N Jobs (AlertDialog) | ProjectDetails | borrado masivo confirmado | conforme |
| 30 | Add/Edit Material · Add/Edit Tool · CameraCapture | Storage / varios | alta-edición con foto/cámara | conforme |

---

## 2 · Diseño exacto por página (referencias Mobbin)

### 2.1 ProjectDetails — patrón **Asana list** ([referencia](https://mobbin.com/screens/2af90759-4ce5-4763-a3d0-796f38cb18e8))
La página más usada. Diseño exacto:
1. **AppShell** con nav del rol (hoy es la única página sin shell).
2. **Cabecera de contenido**: ← back (a `homeOf(role)`), nombre del proyecto en `text-2xl font-bold`, descripción en `muted-foreground`; a la derecha (solo manager): `Select` (outline) · `Import` (outline) · `Create Job` (primary).
3. **Secciones planas**: fila-botón por sección (chevron + nombre + `n/m done` tabular + badge warning con pendientes de revisión) — NO tarjeta-dentro-de-tarjeta. Jobs debajo con sangría y borde izquierdo.
4. **Carga**: skeleton inmediato (sin barra de progreso falsa — es un anti-patrón: promete un avance que no mide). La carga real baja de segundos a <1s con el fetch en lote (Task 1), que es lo que elimina la necesidad del teatro.

### 2.2 JobCard — jerarquía por estado (Asana row + Jira approvals)
1. Header: título + badge de estado + editar (manager). 2. **Franja de datos** única (`dl` 3 columnas: Working now / Time / Materials £) en vez de 3 mini-Cards anidadas. 3. Secciones de entrega/corrección como hoy. 4. **Acciones con jerarquía**: una primaria por estado (builder To Do → `Start working` en brand; needs_correction → `Resubmit`; manager waiting review → `Job Done` primaria + `Needs correction` outline-destructivo). Bug a corregir: `workers.some(w => w.user_id === userRole)` compara contra el rol, no contra el usuario — `Start working` nunca se oculta.

### 2.3 Managers — patrón **Retool/StackAI** ([Retool](https://mobbin.com/screens/3a111a01-0f86-4621-b63f-d35133815c9e), [StackAI](https://mobbin.com/screens/03fb91f0-89d0-45e6-ada1-34d533a3febf))
Dos grupos con eyebrow: **"Needs attention"** (las 3 colas: Rubbish, Material requests, Requested tools — el punto de atención ya existe) y **"Business"** (Active projects, Builder hours, Invoiced £, Materials, Risk assessments). Corrige `$` → `£` y "Note collections" → "Invoiced". Tabs y diálogos intactos.

### 2.4 Builders — patrón **Jobber home/timesheet** ([home](https://mobbin.com/screens/37434a49-440a-4f28-a9f1-ad057c39fd69), [timesheet](https://mobbin.com/screens/e8203389-abe0-42f4-9110-e1ff5e1a80f6))
1. Saludo grande + fecha ("Good morning, Luis" / "Wednesday, 9 July"). 2. Clock-in hero como hoy (franja hi-vis). 3. Línea "This week: Xh Ym" en la TimeTrackingCard (Jobber: "Total completed time"). 4. Acciones "On site" reordenadas por frecuencia real de obra: materiales → parte diario → entrega → herramientas → escombros → factura → riesgo → cambiar proyecto.

### 2.5 Statements — patrón **Toggl/Harvest** ([Toggl](https://mobbin.com/screens/1828be7f-9881-40bf-a11e-9fb0f7cfd54e), [Harvest](https://mobbin.com/screens/9d9e449c-69ff-4dea-9784-040e533e713c))
Por tab: fila única de cabecera (título + selector de período + **Export siempre visible** a la derecha) y **banda de totales** (stats inline separadas por divisores, `tabular-nums`) en vez de 3-4 Cards grandes. Tablas y export xlsx intactos.

### 2.6 Invite — patrón **GoPay** ([referencia](https://mobbin.com/screens/e60ccc08-0b6d-47df-9b0c-000d3dedde8a))
Orden exacto: 1) banner-píldora de vigencia ("Active for 4:32", tinte destructive <60s), 2) tarjeta QR, 3) fila código + copiar, 4) fila "Invite via link → Copy link", 5) Generate new (ghost). Selector de rol arriba, como hoy.

### 2.7 Storage — patrón **Shopify inventory** ([referencia](https://mobbin.com/screens/da48f281-973a-416a-8f49-292946f8b108))
**Ya conforme**: tabla con thumbnail, nombre, categoría, cantidad, min stock, badge Low Stock y acciones. Sin tarea.

---

## 3 · Tareas

### Task 0: Checkpoint + script de verificación visual

**Files:**
- Create: `scripts/uxcheck.mjs`
- Commit: todo el árbol de trabajo actual

**Interfaces:**
- Produces: `node scripts/uxcheck.mjs <ruta> [--builder] [--mobile] [--out <png>]` — abre el preview logueado y captura pantalla. Lo consumen todas las tareas siguientes.

- [ ] **Step 1: Commit del estado actual de la rama (checkpoint del rediseño previo)**

```bash
cd /root/jobsite-jedi
git add -A
git commit -m "feat: professional redesign + ponytail restructure (shell, guard, sheets, -1337 LOC)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

- [ ] **Step 2: Escribir `scripts/uxcheck.mjs`**

```js
// Visual check: login + screenshot de una ruta. Uso:
//   BT_EMAIL=... BT_PASSWORD=... node scripts/uxcheck.mjs /managers --out shot.png
//   flags: --builder (mock solo-GET del rol), --mobile (390px)
import { chromium } from "playwright-core";

const args = process.argv.slice(2);
const route = args.find((a) => a.startsWith("/")) ?? "/managers";
const asBuilder = args.includes("--builder");
const mobile = args.includes("--mobile");
const out = args[args.indexOf("--out") + 1] ?? "uxcheck.png";
const BASE = process.env.BASE ?? "http://127.0.0.1:4173";
const { BT_EMAIL, BT_PASSWORD } = process.env;
if (!BT_EMAIL || !BT_PASSWORD) throw new Error("Set BT_EMAIL and BT_PASSWORD");

const browser = await chromium.launch({
  executablePath:
    "/root/.cache/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-linux64/chrome-headless-shell",
});
const ctx = await browser.newContext({
  viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 },
  ...(mobile ? { isMobile: true, hasTouch: true } : {}),
});
const blocked = [];
if (asBuilder) {
  await ctx.route(/\/rest\/v1\/user_roles\?/, (r) =>
    r.request().method() === "GET"
      ? r.fulfill({ status: 200, contentType: "application/json",
          headers: { "access-control-allow-origin": "*" },
          body: JSON.stringify({ role: "builder" }) })
      : r.abort(),
  );
  await ctx.route(/supabase\.co\/rest\/v1\//, (r) => {
    if (r.request().method() !== "GET") { blocked.push(r.request().url()); return r.abort(); }
    return r.fallback();
  });
}
const page = await ctx.newPage();
const errors = [];
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(BASE + "/auth", { waitUntil: "networkidle" });
await page.fill("#signin-email", BT_EMAIL);
await page.fill("#signin-password", BT_PASSWORD);
await page.getByRole("button", { name: "Sign In", exact: true }).click();
await page.waitForURL(asBuilder ? "**/builders" : "**/managers", { timeout: 30000 });
if (route !== "/managers" && route !== "/builders") {
  await page.goto(BASE + route, { waitUntil: "networkidle" });
}
await page.waitForTimeout(1500);
await page.screenshot({ path: out, fullPage: true });
console.log(`saved ${out} | console errors: ${errors.length} | blocked writes: ${blocked.length}`);
errors.forEach((e) => console.log("  ERR", e));
await browser.close();
```

- [ ] **Step 3: Verificar que el script corre**

```bash
npm run build && (npx vite preview --port 4173 &) && sleep 3
BT_EMAIL=luismadef45+manager@gmail.com BT_PASSWORD='<DEL MAPA>' node scripts/uxcheck.mjs /managers --out /tmp/base-managers.png
```
Esperado: `saved /tmp/base-managers.png | console errors: 0 | blocked writes: 0`

- [ ] **Step 4: Commit**

```bash
git add scripts/uxcheck.mjs
git commit -m "chore: add uxcheck visual verification script

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 1: ProjectDetails — `fetchJobs` en lote (elimina el N+1)

Hoy `fetchJobs` hace ~10 consultas POR JOB (perfil, tracking, materiales en bucle, entregas en bucle con fotos/colaboradores/URLs firmadas una a una). Con 20 jobs son ~200 requests → segundos de espera → por eso existe el loader falso. Se reescribe con las mismas consultas semánticas en lote (`.in()`, `createSignedUrls`) manteniendo EXACTAMENTE la forma de datos que consumen `JobCard` y el render (`job.profiles`, `job.job_time_tracking`, `job.job_materials[].material_usage.materials`, `job.job_completions[].{job_completion_photos, job_collaborators, profiles}`, `job.job_photos`).

**Files:**
- Modify: `src/pages/ProjectDetails.tsx:271-481` (función `fetchJobs` completa)

**Interfaces:**
- Produces: `fetchJobs(): Promise<void>` — misma firma, mismos estados poblados (`setJobs`, `setActiveWorkers`, `setPhotoUrls`, `setManagerFeedbackPhotoUrls`), misma forma de objeto job enriquecido.

- [ ] **Step 1: Reemplazar la función `fetchJobs` completa (líneas 271-481) por:**

```ts
  const fetchJobs = async () => {
    try {
      const { data: jobsData, error: jobsError } = await supabase
        .from("jobs")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });
      if (jobsError) throw jobsError;
      const baseJobs = jobsData || [];
      if (baseJobs.length === 0) {
        setJobs([]); setActiveWorkers({}); setPhotoUrls({});
        return;
      }
      const jobIds = baseJobs.map((j) => j.id);

      const [tt, jm, comps, managerPhotos] = await Promise.all([
        supabase.from("job_time_tracking").select("*").in("job_id", jobIds),
        supabase.from("job_materials").select("id, job_id, material_usage_id").in("job_id", jobIds),
        supabase.from("job_completions").select("*").in("job_id", jobIds).order("completed_at", { ascending: false }),
        supabase.from("job_photos").select("*").in("job_id", jobIds),
      ]);

      const usageIds = (jm.data || []).map((l) => l.material_usage_id).filter(Boolean);
      const compIds = (comps.data || []).map((c) => c.id);
      const [usages, compPhotos, collabs] = await Promise.all([
        usageIds.length ? supabase.from("material_usage").select("*").in("id", usageIds) : { data: [] },
        compIds.length ? supabase.from("job_completion_photos").select("*").in("completion_id", compIds) : { data: [] },
        compIds.length ? supabase.from("job_collaborators").select("*").in("job_completion_id", compIds) : { data: [] },
      ]);

      const materialIds = [...new Set((usages.data || []).map((u: any) => u.material_id).filter(Boolean))];
      const profileIds = [...new Set([
        ...baseJobs.map((j) => j.created_by),
        ...(tt.data || []).map((t: any) => t.user_id),
        ...(comps.data || []).map((c: any) => c.completed_by),
        ...(collabs.data || []).map((c: any) => c.user_id),
      ].filter(Boolean))];
      const [mats, profs] = await Promise.all([
        materialIds.length ? supabase.from("materials").select("*").in("id", materialIds) : { data: [] },
        profileIds.length ? supabase.from("profiles").select("id, full_name").in("id", profileIds) : { data: [] },
      ]);

      const profileOf = (id: string) => (profs.data || []).find((p: any) => p.id === id) || null;
      const usageById = new Map((usages.data || []).map((u: any) => [u.id, u]));
      const matById = new Map((mats.data || []).map((m: any) => [m.id, m]));

      // Signed URLs en lote (thumbnail con fallback al original)
      const cleanPath = (p: string, bucket: string) => {
        if (!p.includes("/storage/v1/object/")) return p;
        const parts = p.split(`/${bucket}/`);
        return parts[1] ? decodeURIComponent(parts[1]) : p;
      };
      const signBatch = async (bucket: string, paths: string[]) => {
        if (!paths.length) return new Map<string, string>();
        const thumbs = paths.map(getThumbnailPath);
        const [t, o] = await Promise.all([
          supabase.storage.from(bucket).createSignedUrls(thumbs, 3600),
          supabase.storage.from(bucket).createSignedUrls(paths, 3600),
        ]);
        const map = new Map<string, string>();
        paths.forEach((p, i) => {
          const url = t.data?.[i]?.signedUrl || o.data?.[i]?.signedUrl;
          if (url) map.set(p, url);
        });
        return map;
      };
      const compPhotoRows = compPhotos.data || [];
      const mgrPhotoRows = managerPhotos.data || [];
      const [compUrlMap, mgrUrlMap] = await Promise.all([
        signBatch("job-completion-photos", compPhotoRows.map((p: any) => p.photo_url)),
        signBatch("job-photos", mgrPhotoRows.map((p: any) => cleanPath(p.photo_url, "job-photos"))),
      ]);

      const workersMap: { [key: string]: any[] } = {};
      const urlsMap: { [key: string]: string[] } = {};
      const mgrUrls: { [key: string]: string[] } = {};

      const enrichedJobs = baseJobs.map((job) => {
        const jobTT = (tt.data || []).filter((t: any) => t.job_id === job.id);
        const active = jobTT
          .filter((t: any) => !t.ended_at)
          .map((t: any) => ({ ...t, profiles: profileOf(t.user_id) }));
        if (active.length) workersMap[job.id] = active;

        const jobJM = (jm.data || [])
          .filter((l: any) => l.job_id === job.id)
          .map((l: any) => {
            const mu: any = usageById.get(l.material_usage_id);
            return { id: l.id, material_usage: mu ? { ...mu, materials: matById.get(mu.material_id) || null } : null };
          });

        const jobComps = (comps.data || [])
          .filter((c: any) => c.job_id === job.id)
          .map((c: any) => ({
            ...c,
            job_completion_photos: compPhotoRows.filter((p: any) => p.completion_id === c.id),
            job_collaborators: (collabs.data || [])
              .filter((x: any) => x.job_completion_id === c.id)
              .map((x: any) => ({ ...x, profiles: profileOf(x.user_id) })),
            profiles: profileOf(c.completed_by) ? { full_name: profileOf(c.completed_by).full_name } : null,
          }));
        const latestPhotos = jobComps.find((c: any) => c.job_completion_photos.length)?.job_completion_photos || [];
        const photoLinks = latestPhotos
          .map((p: any) => compUrlMap.get(p.photo_url))
          .filter(Boolean) as string[];
        if (photoLinks.length) urlsMap[job.id] = photoLinks;

        const jobMgrPhotos = mgrPhotoRows.filter((p: any) => p.job_id === job.id);
        const jobMgrUrls = jobMgrPhotos
          .map((p: any) => mgrUrlMap.get(cleanPath(p.photo_url, "job-photos")))
          .filter(Boolean) as string[];
        if (jobMgrUrls.length) mgrUrls[job.id] = jobMgrUrls;

        const creator = profileOf(job.created_by);
        return {
          ...job,
          profiles: creator ? { full_name: creator.full_name } : null,
          job_time_tracking: jobTT,
          job_materials: jobJM,
          job_completions: jobComps,
          job_photos: jobMgrPhotos,
        };
      });

      setJobs(enrichedJobs);
      setActiveWorkers(workersMap);
      setPhotoUrls(urlsMap);
      setManagerFeedbackPhotoUrls(mgrUrls);
    } catch (error: any) {
      console.error("Error fetching jobs:", error);
    }
  };
```

- [ ] **Step 2: Compilar**

```bash
npx tsc --noEmit && npm run build
```
Esperado: sin errores. Si `tsc` protesta por los `{ data: [] }` en los ternarios, envolverlos: `Promise.resolve({ data: [] as any[] })`.

- [ ] **Step 3: Verificar contra datos reales (solo lectura)**

```bash
(npx vite preview --port 4173 &) && sleep 3
BT_EMAIL=... BT_PASSWORD=... node scripts/uxcheck.mjs /managers --out /tmp/t1-managers.png
```
Luego navegar manualmente a un proyecto (o añadir goto en el script con la URL real de un proyecto listado) y confirmar: jobs visibles con tiempo, materiales, fotos de entregas y feedback — idénticos a antes, cargando en <1s. `console errors: 0`.

- [ ] **Step 4: Commit**

```bash
git add src/pages/ProjectDetails.tsx
git commit -m "perf: batch ProjectDetails queries (~10 requests instead of ~10 per job)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: ProjectDetails — AppShell + guard central + fin del loader falso

**Files:**
- Modify: `src/pages/ProjectDetails.tsx` (imports, estados de carga, `checkAuth`, render de loading, wrapper y cabecera)

**Interfaces:**
- Consumes: `useRequireRole()` → `{ userId, role, fullName, isLoading }`; `homeOf(role)`; `AppShell`, `PageLoader`.
- Produces: `userId` disponible en el componente (lo consume Task 4 vía prop `currentUserId` de JobCard).

- [ ] **Step 1: Imports — añadir y limpiar**

Añadir:
```ts
import { useRequireRole, homeOf } from "@/hooks/useRequireRole";
import { AppShell, PageLoader } from "@/components/layout/AppShell";
```
Quitar de los imports al final de la tarea (quedarán sin uso): `Progress`, `Building2`.

- [ ] **Step 2: Sustituir la autenticación propia por el hook**

Eliminar el estado `const [userRole, setUserRole] = useState<...>(null);`, la función `checkAuth` completa (líneas 225-245) y su llamada en el `useEffect`. En su lugar, al inicio del componente:

```ts
  const { userId, role: userRole, fullName, isLoading: isAuthLoading } = useRequireRole();
```

- [ ] **Step 3: Eliminar el teatro de carga**

Borrar: estados `loadingProgress`/`loadingStage` (líneas 47-48), el `useEffect` de animación (51-81) y el bloque de render `if (isLoading) { ... }` (617-679). Sustituir por:

```tsx
  if (isAuthLoading || isLoading) {
    return <PageLoader />;
  }
```

- [ ] **Step 4: Envolver en AppShell con cabecera nueva**

Reemplazar el wrapper `<div className="container mx-auto p-4 md:p-6 space-y-4 md:space-y-6">` y la cabecera actual (back + título + toolbar, líneas 695-744) por:

```tsx
    <AppShell role={userRole ?? "builder"} fullName={fullName}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(homeOf(userRole ?? "builder"))} className="mt-1 shrink-0" aria-label="Back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-0">
            <h1 className="break-words text-2xl font-bold">{project.name}</h1>
            {project.description && <p className="text-sm text-muted-foreground">{project.description}</p>}
          </div>
        </div>
        {userRole === "manager" && (
          <div className="flex flex-wrap gap-2">
            <Button variant={selectionMode ? "default" : "outline"} onClick={toggleSelectionMode} size="sm">
              {selectionMode ? <><XCircle className="mr-2 h-4 w-4" />Cancel</> : <><CheckSquare className="mr-2 h-4 w-4" />Select</>}
            </Button>
            {!selectionMode && (
              <>
                <Button variant="outline" onClick={() => setShowBulkUpload(true)} size="sm">
                  <FileSpreadsheet className="mr-2 h-4 w-4" />Import
                </Button>
                <Button variant="brand" onClick={() => setShowCreateJob(true)} size="sm">
                  <Plus className="mr-2 h-4 w-4" />Create Job
                </Button>
              </>
            )}
          </div>
        )}
      </div>
```
y cerrar con `</AppShell>` donde cerraba el `div` contenedor. El bloque "Project not found" también se envuelve: `return <AppShell role={userRole ?? "builder"} fullName={fullName}>…</AppShell>`.

- [ ] **Step 5: Compilar + verificar ambos roles**

```bash
npx tsc --noEmit && npm run build && (npx vite preview --port 4173 &) && sleep 3
BT_EMAIL=... BT_PASSWORD=... node scripts/uxcheck.mjs /project/<ID-REAL> --out /tmp/t2-project.png
BT_EMAIL=... BT_PASSWORD=... node scripts/uxcheck.mjs /project/<ID-REAL> --builder --mobile --out /tmp/t2-project-builder.png
```
Esperado: nav persistente visible como manager; sin toolbar de manager en la vista builder; back → overview del rol; 0 errores de consola, 0 escrituras bloqueadas.

- [ ] **Step 6: Commit**

```bash
git add src/pages/ProjectDetails.tsx
git commit -m "feat: ProjectDetails under AppShell with central guard, skeleton over fake progress

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: ProjectDetails — secciones planas estilo Asana

**Files:**
- Modify: `src/pages/ProjectDetails.tsx` (los dos bloques `Collapsible`: secciones con nombre y "Unsectioned Jobs")

**Interfaces:**
- Consumes: `groupedJobs`, `openSections`, `toggleSection` (sin cambios).

- [ ] **Step 1: Reemplazar el trigger de sección (Card completa dentro de `CollapsibleTrigger`) por una fila-botón**

Para el bloque de secciones nombradas, el `CollapsibleTrigger asChild` pasa a envolver:

```tsx
                  <CollapsibleTrigger asChild>
                    <button
                      type="button"
                      className="flex w-full items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 text-left shadow-xs transition-colors hover:bg-muted/50"
                    >
                      {isOpen ? (
                        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                      )}
                      <span className="min-w-0 truncate font-semibold">{sectionName}</span>
                      <span className="ml-auto flex shrink-0 items-center gap-2">
                        {pendingCount > 0 && (
                          <Badge variant="warning" className="text-xs">
                            <Clock className="mr-1 h-3 w-3" />
                            {pendingCount} to review
                          </Badge>
                        )}
                        <span className="font-mono text-xs tabular-nums text-muted-foreground">
                          {completedCount}/{sectionJobs.length} done
                        </span>
                      </span>
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="ml-2 mt-2 space-y-3 border-l-2 border-border pl-4">
```

- [ ] **Step 2: Aplicar la MISMA fila-botón al bloque "Unsectioned Jobs"** (mismo JSX, con `Unsectioned` como nombre, sus counts calculados como hoy, y `text-muted-foreground` en el nombre). Eliminar los iconos `FolderOpen` y los imports que queden sin uso (`FolderOpen`, `CardDescription` si ya no se usa).

- [ ] **Step 3: Compilar + captura**

```bash
npx tsc --noEmit && npm run build && (npx vite preview --port 4173 &) && sleep 3
BT_EMAIL=... BT_PASSWORD=... node scripts/uxcheck.mjs /project/<ID-REAL> --out /tmp/t3-sections.png
```
Esperado: filas de sección de una línea; abrir/cerrar funciona; counts correctos.

- [ ] **Step 4: Commit**

```bash
git add src/pages/ProjectDetails.tsx
git commit -m "feat: flat Asana-style section rows in ProjectDetails

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: JobCard — franja de datos + jerarquía de acciones + fix `Start working`

**Files:**
- Modify: `src/components/jobs/JobCard.tsx`
- Modify: `src/pages/ProjectDetails.tsx` (pasar `currentUserId={userId}` en los DOS usos de `<JobCard …>`)

**Interfaces:**
- Consumes: `userId` de Task 2.
- Produces: prop nueva `currentUserId?: string` en `JobCardProps`.

- [ ] **Step 1: Añadir la prop** en la interfaz y el destructuring: `currentUserId?: string;` / `currentUserId,`. En `ProjectDetails.tsx`, añadir `currentUserId={userId ?? undefined}` a ambos `<JobCard>`.

- [ ] **Step 2: Reemplazar la "Quick Stats Row" (3 Cards anidadas, líneas 115-181) por la franja única:**

```tsx
          {/* Stats strip */}
          <dl className="grid grid-cols-3 divide-x divide-border overflow-hidden rounded-lg border border-border bg-muted/30 text-center">
            <div className="px-2 py-3">
              <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">Working now</dt>
              <dd className="mt-1 truncate px-1 text-sm font-semibold">
                {workers.length > 0
                  ? workers.map((w: any) => w.profiles?.full_name?.split(" ")[0] ?? "?").join(", ")
                  : "—"}
              </dd>
            </div>
            <div className="px-2 py-3">
              <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">Time</dt>
              <dd className="mt-1 text-sm font-semibold tabular-nums">{totalTime > 0 ? formatTime(totalTime) : "0h 0m"}</dd>
            </div>
            <div className="px-2 py-3">
              <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">Materials</dt>
              <dd className="mt-1 text-sm font-semibold tabular-nums">
                {materials.length}
                {materialsCost > 0 && <span className="text-muted-foreground"> · £{materialsCost.toFixed(0)}</span>}
              </dd>
            </div>
          </dl>
```
con el cálculo (junto a los demás derivados al inicio del componente):
```ts
  const materialsCost = materials.reduce((sum: number, m: any) => {
    const usage = m.material_usage;
    return sum + (usage?.quantity_used * usage?.materials?.cost_per_unit || 0);
  }, 0);
```

- [ ] **Step 3: Jerarquía de acciones (bloque "Action Buttons", líneas 328-366) →**

```tsx
          <div className="flex flex-wrap gap-2 border-t pt-4">
            {userRole === "builder" && job.status === "approved" && (
              <>
                {!workers.some((w: any) => w.user_id === currentUserId) && (
                  <Button variant="brand" onClick={() => onStartTracking(job.id)}>
                    <PlayCircle className="mr-2 h-4 w-4" />
                    Start working
                  </Button>
                )}
                <Button variant="outline" onClick={() => onSubmitForReview(job.id)}>
                  Submit for review
                </Button>
              </>
            )}
            {userRole === "builder" && job.status === "needs_correction" && (
              <Button variant="brand" onClick={() => onSubmitForReview(job.id)}>Resubmit job</Button>
            )}
            {userRole === "manager" && (job.status === "pending" || job.status === "waiting_review") && (
              <>
                <Button onClick={() => onJobDone(job.id)}>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Job done
                </Button>
                <Button
                  variant="outline"
                  className="border-destructive/40 text-destructive hover:bg-destructive/10"
                  onClick={() => onNeedsCorrection(job.id)}
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  Needs correction
                </Button>
              </>
            )}
          </div>
```
Limpiar imports sin uso que queden (`Users`, `Package` si ya no se usan, `Card*` de las mini-cards si el resto del archivo no los usa — `Card` del contenedor exterior SÍ se queda).

- [ ] **Step 4: Compilar + capturas ambos roles**

```bash
npx tsc --noEmit && npm run build && (npx vite preview --port 4173 &) && sleep 3
BT_EMAIL=... BT_PASSWORD=... node scripts/uxcheck.mjs /project/<ID-REAL> --out /tmp/t4-jobcard.png
BT_EMAIL=... BT_PASSWORD=... node scripts/uxcheck.mjs /project/<ID-REAL> --builder --mobile --out /tmp/t4-jobcard-builder.png
```
Esperado: franja de 3 datos por job; una sola acción en brand por tarjeta; "Job done" primaria en revisión de manager.

- [ ] **Step 5: Commit**

```bash
git add src/components/jobs/JobCard.tsx src/pages/ProjectDetails.tsx
git commit -m "feat: JobCard stats strip + status-driven action hierarchy; fix start-tracking visibility check

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: Managers — "Needs attention" / "Business" + £

**Files:**
- Modify: `src/pages/Managers.tsx:137-201` (la grid única de 8 tiles)

- [ ] **Step 1: Reemplazar la sección "Overview" por dos grupos.** Los `StatTile` se mueven tal cual (mismos props/handlers); solo cambian el orden, los contenedores y dos etiquetas:

```tsx
        <section aria-label="Needs attention" className="space-y-3">
          <h2 className="label-eyebrow font-mono">Needs attention</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {/* mover aquí, sin cambios: Rubbish requests · Material requests · Requested tools */}
          </div>
        </section>

        <section aria-label="Business" className="space-y-3">
          <h2 className="label-eyebrow font-mono">Business</h2>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
            {/* mover aquí, sin cambios: Active projects · Builder hours · Invoiced · Materials · Risk assessments */}
          </div>
        </section>
```

- [ ] **Step 2: Corregir la etiqueta de moneda** en el tile de facturas:

```tsx
            <StatTile
              label="Invoiced"
              value={`£${stats.totalSpent.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}`}
              caption="from invoices"
              icon={DollarSign}
              onClick={() => setIsInvoicesOpen(true)}
            />
```

- [ ] **Step 3: Compilar + captura** — `npx tsc --noEmit && npm run build`, preview, `node scripts/uxcheck.mjs /managers --out /tmp/t5-managers.png`. Esperado: colas primero con eyebrow, KPI compactos después, `£` en Invoiced.

- [ ] **Step 4: Commit**

```bash
git add src/pages/Managers.tsx
git commit -m "feat: manager overview grouped into needs-attention queues and business KPIs; GBP label fix

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: Builders — saludo Jobber + "this week" + orden de acciones

**Files:**
- Modify: `src/pages/Builders.tsx`
- Modify: `src/components/dashboard/TimeTrackingCard.tsx`

**Interfaces:**
- Produces: prop nueva opcional `weekMinutes?: number` en `TimeTrackingCard`.

- [ ] **Step 1: Saludo + fecha** — primer hijo dentro de `<AppShell …>` en Builders:

```tsx
        <section>
          <p className="text-sm text-muted-foreground">
            {new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long" }).format(new Date())}
          </p>
          <h1 className="text-2xl font-bold">
            {(() => { const h = new Date().getHours(); return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening"; })()}
            {fullName ? `, ${fullName.split(" ")[0]}` : ""}
          </h1>
        </section>
```

- [ ] **Step 2: Horas de la semana.** En Builders, estado + fetch (tabla `time_tracking`, la misma del clock-in; lunes como inicio de semana):

```ts
  const [weekMinutes, setWeekMinutes] = useState(0);

  const fetchWeekMinutes = async (uid: string) => {
    const monday = new Date();
    monday.setHours(0, 0, 0, 0);
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
    const { data } = await supabase
      .from("time_tracking")
      .select("clock_in, clock_out")
      .eq("user_id", uid)
      .gte("clock_in", monday.toISOString());
    const mins = (data || []).reduce((sum, e: any) => {
      const end = e.clock_out ? new Date(e.clock_out) : new Date();
      return sum + Math.max(0, (end.getTime() - new Date(e.clock_in).getTime()) / 60000);
    }, 0);
    setWeekMinutes(Math.round(mins));
  };
```
Llamarla donde ya se llama `checkClockInStatus(userId)` (mismo efecto y en `handleClockOut`/`handleProjectChanged`). ⚠️ Verificar primero los nombres reales de columnas en `src/pages/Builders.tsx` (`clock_in`/`clock_out` vs `started_at`/`ended_at`) mirando `checkClockInStatus`, y usar los mismos.

- [ ] **Step 3: Mostrarlo.** `TimeTrackingCard` recibe `weekMinutes` (`<TimeTrackingCard … weekMinutes={weekMinutes} />`) y bajo el botón añade:

```tsx
        <p className="text-center font-mono text-xs tabular-nums text-muted-foreground">
          This week: {Math.floor(weekMinutes / 60)}h {weekMinutes % 60}m
        </p>
```

- [ ] **Step 4: Reordenar el array de acciones "On site"** (solo mover objetos, cero cambios internos): Log material usage → Add day report → Request material delivery → Request tools → Request rubbish collection → Add invoice → Risk assessment → Change project.

- [ ] **Step 5: Compilar + captura builder móvil** — build, preview, `node scripts/uxcheck.mjs /builders --builder --mobile --out /tmp/t6-builders.png`. Esperado: saludo + fecha arriba, "This week" bajo el botón de fichaje, acciones en el orden nuevo, `blocked writes: 0`.

- [ ] **Step 6: Commit**

```bash
git add src/pages/Builders.tsx src/components/dashboard/TimeTrackingCard.tsx
git commit -m "feat: Jobber-style greeting, weekly total and frequency-ordered site actions for builders

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7: Statements — banda de totales Toggl en los 5 tabs

**Files:**
- Modify: `src/pages/Statements.tsx`

**Interfaces:**
- Produces: componente local `SummaryBand` (solo dentro de Statements — no crear archivo aparte).

- [ ] **Step 1: Definir el componente local** encima del componente `Statements`:

```tsx
const SummaryBand = ({ items }: { items: { label: string; value: string }[] }) => (
  <div className="flex flex-wrap items-stretch gap-x-8 gap-y-3 rounded-lg border border-border bg-card px-5 py-4 shadow-xs">
    {items.map(({ label, value }) => (
      <div key={label} className="min-w-[7rem]">
        <p className="label-eyebrow font-mono">{label}</p>
        <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
      </div>
    ))}
  </div>
);
```

- [ ] **Step 2: Transformación idéntica en CADA tab (daily, weekly, monthly, project, builder):**
  1. La Card de cabecera del tab se aplana a una fila: `<div className="flex flex-wrap items-center justify-between gap-3">` con el título (`h2 text-lg font-semibold` + icono), el `Select` de período y el botón Export a la derecha — mismos handlers y opciones.
  2. La grid de stat-Cards pequeñas (las de `CardTitle className="text-sm"`) se reemplaza por UNA `<SummaryBand items={[…]} />` reutilizando las MISMAS expresiones de valor que ya renderizan esas cards (no recalcular nada). Etiquetas por tab — daily: `Hours`, `Invoiced`, `Materials`; weekly: + `Projects`; monthly: + `Builders`; project y builder: las que tenga cada uno hoy, con el mismo texto de su CardTitle.
  3. Las tablas ("Time Entries", "Invoices", …) no se tocan.
  Los valores monetarios se muestran con `£` (los datos ya lo son).

- [ ] **Step 3: Compilar + capturas** — build, preview, `node scripts/uxcheck.mjs /statements --out /tmp/t7-statements.png` y también `--mobile`. Esperado: por tab, una fila de cabecera + una banda de totales + tablas; Export visible sin scroll; sin overflow horizontal a 390px (la banda envuelve con `flex-wrap`).

- [ ] **Step 4: Probar el export** manualmente en el preview (botón Export del tab Daily) — descarga un xlsx como antes.

- [ ] **Step 5: Commit**

```bash
git add src/pages/Statements.tsx
git commit -m "feat: Toggl-style summary bands and flat tab headers in Statements

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 8: Invite — layout GoPay

**Files:**
- Modify: `src/pages/Invite.tsx:156-223` (el bloque `invitationCode ? …`)

- [ ] **Step 1: Reordenar el estado "código activo"** a: banner de vigencia → QR → código+copiar → generar nuevo. Reemplazar el bloque actual (Timer + QR + código + badge de rol + botón) por:

```tsx
              <div className="space-y-6">
                <div className={`flex items-center justify-between rounded-full border px-4 py-2 text-sm ${
                  timeRemaining <= 60 ? "border-destructive/40 bg-destructive/10 text-destructive" : "border-border bg-muted/50"
                }`}>
                  <span>This QR code &amp; link are active for</span>
                  <span className="flex items-center gap-1.5 font-mono font-bold tabular-nums">
                    <Clock className="h-4 w-4" />
                    {formatTime(timeRemaining)}
                  </span>
                </div>

                <div className="flex justify-center">
                  <div className="relative rounded-2xl border border-border bg-white p-4 shadow-xs">
                    <img src={generateQRCodeUrl(invitationCode)} alt="Invitation QR Code" className="h-64 w-64" />
                    {timeRemaining === 0 && (
                      <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-background/80 backdrop-blur-sm">
                        <span className="font-semibold text-destructive">Expired</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-center gap-2">
                  <code className="rounded-lg bg-muted px-4 py-2 font-mono text-lg tracking-wider">{invitationCode}</code>
                  <Button variant="outline" size="icon" onClick={copyToClipboard} aria-label="Copy invitation link">
                    {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-center text-xs text-muted-foreground">
                  {role === "builder" ? "Builder" : "Manager"} invitation · single use · copies as a signup link
                </p>

                <Button variant="outline" className="w-full" onClick={() => { setInvitationCode(null); setExpiresAt(null); }}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Generate new code
                </Button>
              </div>
```
Nota: quitar los imports que queden sin uso (`Badge`, `HardHat`, `Users` si ya no se usan en el archivo — `Users`/`HardHat` siguen en el Select de rol, revisar antes de quitar). BUG PREEXISTENTE a corregir de paso: `Loader2` se usa en el botón de generar pero no está importado — añadirlo al import de lucide.

- [ ] **Step 2: Compilar + captura** — build, preview, `node scripts/uxcheck.mjs /invite --out /tmp/t8-invite.png`. Generar un código real (escritura mínima aceptable: expira en 5 min y es de un solo uso) y verificar countdown, copy y overlay Expired.

- [ ] **Step 3: Commit**

```bash
git add src/pages/Invite.tsx
git commit -m "feat: GoPay-style invite layout (validity banner, QR card, code row); import missing Loader2

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 9: Verificación E2E completa + despliegue

**Files:**
- Ninguno nuevo (reutiliza `verify2.mjs` del scratchpad de la sesión o replica sus 12 checks con `scripts/uxcheck.mjs`)

- [ ] **Step 1: Regresión E2E** — correr la suite `verify2.mjs` (login manager, nav 4 secciones, diálogo centrado desktop, guard anónimo, builder mock → bottom sheets a 390px, sin overflow) contra `npm run build && vite preview`. Esperado: 12/12 PASS, 0 console errors, 0 blocked writes.
- [ ] **Step 2: Checks nuevos** — con `uxcheck.mjs`: `/project/<ID>` (ambos roles), `/statements --mobile`, `/invite`. 0 errores.
- [ ] **Step 3: Lighthouse rápido opcional** sobre `/project/<ID>` para confirmar la mejora de carga (antes: cascada N+1).
- [ ] **Step 4: Desplegar**

```bash
docker compose up -d --build
until [ "$(docker inspect -f '{{.State.Health.Status}}' jobsite-jedi)" = "healthy" ]; do sleep 3; done
docker run --rm --network jobsite-jedi_default curlimages/curl -s -o /dev/null -w '%{http_code}' http://jobsite-jedi/managers
```
Esperado: `healthy` y `200`.

- [ ] **Step 5: Commit final + resumen** — `git add -A && git commit` si quedó algo suelto; reportar a Luis: diff stat, capturas y decisión pendiente de merge a `main`.

---

## Self-review (hecho al escribir el plan)

- **Cobertura**: las 10 rutas y las 30 ventanas están inventariadas con veredicto; las 6 superficies no conformes tienen tarea (1-8); Storage/Auth/Index/NotFound/Dashboard justificadas como conformes.
- **Tipos**: `useRequireRole()` devuelve `{ userId, role, fullName, isLoading }` (verificado en `src/hooks/useRequireRole.ts`); `homeOf(role)` existe; variante `brand` de Button existe (pase anterior); `label-eyebrow`, `shadow-xs`, `tabular` y `Badge variant="warning"` existen en el design system actual.
- **Riesgos señalados en línea**: nombres de columnas de `time_tracking` (Task 6 Step 2 exige verificarlos), tipado de los ternarios `{ data: [] }` (Task 1 Step 2), imports huérfanos por tarea.
