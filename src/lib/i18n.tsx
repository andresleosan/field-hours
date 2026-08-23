import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Language = "es" | "en" | "pt";

export interface Translations {
  // Navigation & Shell
  appTitle: string;
  todayTab: string;
  historyTab: string;
  projectsTab: string;
  signOut: string;
  liveStatus: string;
  online: string;
  offline: string;
  syncPending: string;
  syncedSuccess: string;

  // Worker View
  workerHeaderTitle: string;
  assignedProject: string;
  selectProject: string;
  generalWork: string;
  geofenceActive: string;
  stateOffShift: string;
  stateWorking: string;
  stateOnBreak: string;
  stateComplete: string;
  clockIn: string;
  startBreak: string;
  endBreak: string;
  finishShift: string;
  confirmFinish: string;
  finishPromptTitle: string;
  finishPromptDetail: string;
  cancel: string;
  save: string;
  saving: string;
  myPastShifts: string;
  takeSelfiePrompt: string;
  takeSelfieTitle: string;
  takeSelfieSubtitle: string;
  capturePhoto: string;
  skipPhoto: string;
  switchCamera: string;
  retake: string;
  confirmPhoto: string;

  // Admin View
  adminGreeting: string;
  adminSubtitle: string;
  workingMetric: string;
  onBreakMetric: string;
  finishedMetric: string;
  teamMetric: string;
  activeShifts: string;
  pausedNow: string;
  completedToday: string;
  staffMembers: string;
  todaysTeam: string;
  progressAtAGlance: string;
  details: string;
  noMembersYet: string;
  inviteWorkerTitle: string;
  inviteWorkerSubtitle: string;
  createInvitation: string;
  creatingInvitation: string;
  copyLink: string;
  copied: string;
  qrInstruction: string;
  oneTimeNotice: string;

  // History & Reports
  reportsTitle: string;
  periodFilter: string;
  workerFilter: string;
  projectFilter: string;
  allStaff: string;
  allProjects: string;
  periodToday: string;
  periodThisWeek: string;
  periodLastWeek: string;
  periodThisMonth: string;
  periodAll: string;
  totalWorked: string;
  breakTime: string;
  totalShifts: string;
  activeStaff: string;
  exportExcel: string;
  colDate: string;
  colWorker: string;
  colProject: string;
  colClockIn: string;
  colClockOut: string;
  colBreak: string;
  colNetHours: string;
  colStatus: string;
  colActions: string;
  noShiftsFound: string;
  adjustShift: string;
  adjustTitle: string;
  adjustReason: string;
  adjustReasonPlaceholder: string;
  adjustSave: string;
  viewPhotoEvidence: string;
  photoEvidenceTitle: string;

  // Projects View
  projectsTitle: string;
  projectsSubtitle: string;
  newProjectBtn: string;
  noProjectsYet: string;
  editProject: string;
  newProject: string;
  projectName: string;
  projectCode: string;
  siteAddress: string;
  geofenceRadius: string;
  gpsCoordinates: string;
  useMyLocation: string;
  activeStatus: string;
  inactiveStatus: string;
  active: string;
  inactive: string;
}

export const translations: Record<Language, Translations> = {
  es: {
    appTitle: "Field Hours",
    todayTab: "Hoy en Vivo",
    historyTab: "Historial y Reportes",
    projectsTab: "Proyectos y Obras",
    signOut: "Cerrar sesión",
    liveStatus: "Actualizado",
    online: "En línea",
    offline: "Sin conexión (Modo offline)",
    syncPending: "pendientes de sincronizar",
    syncedSuccess: "acciones sincronizadas con el servidor.",

    workerHeaderTitle: "Registro de Jornada",
    assignedProject: "Obra / Proyecto Asignado",
    selectProject: "Seleccionar obra...",
    generalWork: "Trabajo General",
    geofenceActive: "Geocerca activa: tolerancia de",
    stateOffShift: "Fuera de turno",
    stateWorking: "En turno activo",
    stateOnBreak: "En pausa / descanso",
    stateComplete: "Jornada completada",
    clockIn: "Marcar Entrada",
    startBreak: "Iniciar Pausa",
    endBreak: "Finalizar Pausa",
    finishShift: "Finalizar Jornada",
    confirmFinish: "Confirmar Salida",
    finishPromptTitle: "¿Deseas finalizar tu jornada?",
    finishPromptDetail: "Esto registrará la hora actual y la verificación GPS de salida.",
    cancel: "Cancelar",
    save: "Guardar",
    saving: "Guardando…",
    myPastShifts: "Mis Turnos Anteriores",
    takeSelfiePrompt: "Foto de Entrada (Evidencia de presencia)",
    takeSelfieTitle: "Verificación de Identidad",
    takeSelfieSubtitle: "Toma una foto rápida para certificar tu presencia en la obra.",
    capturePhoto: "Tomar Foto",
    skipPhoto: "Omitir Foto",
    switchCamera: "Cambiar Cámara",
    retake: "Repetir Foto",
    confirmPhoto: "Usar Esta Foto",

    adminGreeting: "Buen día",
    adminSubtitle: "Panel de control en tiempo real y registro de evidencias GPS.",
    workingMetric: "Trabajando",
    onBreakMetric: "En Pausa",
    finishedMetric: "Finalizados",
    teamMetric: "Equipo",
    activeShifts: "turnos activos",
    pausedNow: "en descanso",
    completedToday: "completados hoy",
    staffMembers: "trabajadores registrados",
    todaysTeam: "Equipo de hoy",
    progressAtAGlance: "Resumen de actividad",
    details: "Detalles",
    noMembersYet: "Aún no hay trabajadores registrados. Crea una invitación para agregar el primero.",
    inviteWorkerTitle: "Invitar Trabajador",
    inviteWorkerSubtitle: "Genera un enlace o código QR de un solo uso para registrar a un nuevo operario.",
    createInvitation: "Crear Invitación",
    creatingInvitation: "Generando…",
    copyLink: "Copiar Enlace",
    copied: "¡Enlace copiado!",
    qrInstruction: "El trabajador puede escanear este código QR para registrarse.",
    oneTimeNotice: "El token es de un solo uso y vence en 30 minutos.",

    reportsTitle: "Historial de Turnos y Reportes",
    periodFilter: "Período",
    workerFilter: "Trabajador",
    projectFilter: "Proyecto / Obra",
    allStaff: "Todos los trabajadores",
    allProjects: "Todos los proyectos / obras",
    periodToday: "Hoy",
    periodThisWeek: "Esta Semana",
    periodLastWeek: "Semana Pasada",
    periodThisMonth: "Este Mes",
    periodAll: "Todos los registros",
    totalWorked: "Horas Trabajadas",
    breakTime: "Tiempo de Pausas",
    totalShifts: "Total Turnos",
    activeStaff: "Personal Activo",
    exportExcel: "Exportar a Excel",
    colDate: "Fecha",
    colWorker: "Trabajador",
    colProject: "Proyecto / Obra",
    colClockIn: "Entrada",
    colClockOut: "Salida",
    colBreak: "Pausa",
    colNetHours: "Horas Netas",
    colStatus: "Estado",
    colActions: "Acciones",
    noShiftsFound: "No se encontraron turnos para este período. Prueba seleccionando 'Todos los registros'.",
    adjustShift: "Ajustar",
    adjustTitle: "Ajuste Manual de Turno",
    adjustReason: "Motivo del Ajuste *",
    adjustReasonPlaceholder: "Ej. El trabajador olvidó fichar su salida al finalizar el turno",
    adjustSave: "Guardar Ajuste",
    viewPhotoEvidence: "Ver Foto",
    photoEvidenceTitle: "Evidencia Fotográfica de Entrada",

    projectsTitle: "Gestión de Proyectos y Obras",
    projectsSubtitle: "Define obras, ubicaciones GPS y perímetros de geocerca permitidos.",
    newProjectBtn: "Nuevo Proyecto / Obra",
    noProjectsYet: "No hay proyectos u obras creados aún. Haz clic en 'Nuevo Proyecto' para crear el primero.",
    editProject: "Editar Proyecto / Obra",
    newProject: "Nuevo Proyecto / Obra",
    projectName: "Nombre de la Obra / Proyecto *",
    projectCode: "Código de Obra",
    siteAddress: "Dirección",
    geofenceRadius: "Radio de Geocerca (metros)",
    gpsCoordinates: "Coordenadas GPS",
    useMyLocation: "Usar mi ubicación",
    activeStatus: "Estado Activo",
    inactiveStatus: "Inactivo",
    active: "Activo",
    inactive: "Inactivo",
  },
  en: {
    appTitle: "Field Hours",
    todayTab: "Live Today",
    historyTab: "History & Reports",
    projectsTab: "Projects & Sites",
    signOut: "Sign out",
    liveStatus: "Updated",
    online: "Online",
    offline: "Offline Mode",
    syncPending: "pending to sync",
    syncedSuccess: "action(s) synced with the server.",

    workerHeaderTitle: "Shift Clock",
    assignedProject: "Assigned Project / Job Site",
    selectProject: "Select site...",
    generalWork: "General Work",
    geofenceActive: "Geofence active: tolerance of",
    stateOffShift: "Off shift",
    stateWorking: "Working",
    stateOnBreak: "On break",
    stateComplete: "Shift complete",
    clockIn: "Clock In",
    startBreak: "Start Break",
    endBreak: "End Break",
    finishShift: "Finish Shift",
    confirmFinish: "Confirm Finish",
    finishPromptTitle: "Finish your shift?",
    finishPromptDetail: "This records the current timestamp and a fresh GPS location check.",
    cancel: "Cancel",
    save: "Save",
    saving: "Saving…",
    myPastShifts: "My Past Shifts",
    takeSelfiePrompt: "Clock In Photo (Presence evidence)",
    takeSelfieTitle: "Identity Verification",
    takeSelfieSubtitle: "Take a quick photo to certify your physical presence on the job site.",
    capturePhoto: "Take Photo",
    skipPhoto: "Skip Photo",
    switchCamera: "Switch Camera",
    retake: "Retake Photo",
    confirmPhoto: "Use This Photo",

    adminGreeting: "Good day",
    adminSubtitle: "Live operations snapshot and GPS location audit.",
    workingMetric: "Working",
    onBreakMetric: "On break",
    finishedMetric: "Finished",
    teamMetric: "Team",
    activeShifts: "active shifts",
    pausedNow: "paused now",
    completedToday: "completed today",
    staffMembers: "registered staff",
    todaysTeam: "Today’s team",
    progressAtAGlance: "Progress at a glance",
    details: "Details",
    noMembersYet: "No staff members have joined yet. Create an invitation to add the first worker.",
    inviteWorkerTitle: "Invite Staff Member",
    inviteWorkerSubtitle: "Generate a secure one-time link or QR code to register a new worker.",
    createInvitation: "Create Invitation",
    creatingInvitation: "Generating…",
    copyLink: "Copy Link",
    copied: "Link copied!",
    qrInstruction: "The worker can scan this QR code with their mobile device.",
    oneTimeNotice: "The token is single-use and expires in 30 minutes.",

    reportsTitle: "Shift History & Reports",
    periodFilter: "Period",
    workerFilter: "Worker",
    projectFilter: "Project / Site",
    allStaff: "All staff members",
    allProjects: "All projects / sites",
    periodToday: "Today",
    periodThisWeek: "This Week",
    periodLastWeek: "Last Week",
    periodThisMonth: "This Month",
    periodAll: "All records",
    totalWorked: "Total Worked",
    breakTime: "Break Time",
    totalShifts: "Total Shifts",
    activeStaff: "Active Staff",
    exportExcel: "Export to Excel",
    colDate: "Date",
    colWorker: "Worker",
    colProject: "Project / Site",
    colClockIn: "Clock In",
    colClockOut: "Clock Out",
    colBreak: "Break",
    colNetHours: "Net Hours",
    colStatus: "Status",
    colActions: "Actions",
    noShiftsFound: "No shift records found for this period. Try selecting 'All records'.",
    adjustShift: "Adjust",
    adjustTitle: "Manual Shift Adjustment",
    adjustReason: "Reason for Adjustment *",
    adjustReasonPlaceholder: "e.g. Worker forgot to clock out at the end of the shift",
    adjustSave: "Save Adjustment",
    viewPhotoEvidence: "View Photo",
    photoEvidenceTitle: "Clock In Photo Evidence",

    projectsTitle: "Projects & Job Sites",
    projectsSubtitle: "Manage construction sites, GPS coordinates and geofence radiuses.",
    newProjectBtn: "New Project / Site",
    noProjectsYet: "No projects created yet. Click 'New Project' to add the first one.",
    editProject: "Edit Project / Site",
    newProject: "New Project / Site",
    projectName: "Project / Site Name *",
    projectCode: "Site Code",
    siteAddress: "Site Address",
    geofenceRadius: "Geofence Radius (meters)",
    gpsCoordinates: "GPS Coordinates",
    useMyLocation: "Use My Location",
    activeStatus: "Active Status",
    inactiveStatus: "Inactive",
    active: "Active",
    inactive: "Inactive",
  },
  pt: {
    appTitle: "Field Hours",
    todayTab: "Hoje ao Vivo",
    historyTab: "Histórico e Relatórios",
    projectsTab: "Projetos e Obras",
    signOut: "Sair",
    liveStatus: "Atualizado",
    online: "Online",
    offline: "Modo Offline",
    syncPending: "pendentes de sincronização",
    syncedSuccess: "ação(ões) sincronizada(s) com o servidor.",

    workerHeaderTitle: "Controle de Ponto",
    assignedProject: "Obra / Projeto Atribuído",
    selectProject: "Selecionar obra...",
    generalWork: "Trabalho Geral",
    geofenceActive: "Cerca geográfica ativa: tolerância de",
    stateOffShift: "Fora de turno",
    stateWorking: "Em jornada ativa",
    stateOnBreak: "Em intervalo / pausa",
    stateComplete: "Jornada finalizada",
    clockIn: "Bater Entrada",
    startBreak: "Iniciar Intervalo",
    endBreak: "Finalizar Intervalo",
    finishShift: "Finalizar Jornada",
    confirmFinish: "Confirmar Saída",
    finishPromptTitle: "Deseja finalizar sua jornada?",
    finishPromptDetail: "Isso registrará o horário atual e a verificação GPS de saída.",
    cancel: "Cancelar",
    save: "Salvar",
    saving: "Salvando…",
    myPastShifts: "Meus Turnos Anteriores",
    takeSelfiePrompt: "Foto de Entrada (Comprovante de presença)",
    takeSelfieTitle: "Verificação de Identidade",
    takeSelfieSubtitle: "Tire uma foto rápida para certificar sua presença na obra.",
    capturePhoto: "Tirar Foto",
    skipPhoto: "Pular Foto",
    switchCamera: "Trocar Câmera",
    retake: "Tirar Outra Foto",
    confirmPhoto: "Usar Esta Foto",

    adminGreeting: "Bom dia",
    adminSubtitle: "Visão em tempo real e auditoria de presença por GPS.",
    workingMetric: "Trabalhando",
    onBreakMetric: "Em Pausa",
    finishedMetric: "Finalizados",
    teamMetric: "Equipe",
    activeShifts: "turnos ativos",
    pausedNow: "em intervalo",
    completedToday: "finalizados hoje",
    staffMembers: "funcionários registrados",
    todaysTeam: "Equipe de hoje",
    progressAtAGlance: "Progresso geral",
    details: "Detalhes",
    noMembersYet: "Nenhum funcionário cadastrado ainda. Crie um convite para adicionar o primeiro.",
    inviteWorkerTitle: "Convidar Funcionário",
    inviteWorkerSubtitle: "Gere um link ou QR code de uso único para cadastrar um novo operário.",
    createInvitation: "Criar Convite",
    creatingInvitation: "Gerando…",
    copyLink: "Copiar Link",
    copied: "Link copiado!",
    qrInstruction: "O funcionário pode ler este QR code com seu celular.",
    oneTimeNotice: "O token é de uso único e expira em 30 minutos.",

    reportsTitle: "Histórico de Turnos e Relatórios",
    periodFilter: "Período",
    workerFilter: "Funcionário",
    projectFilter: "Projeto / Obra",
    allStaff: "Todos os funcionários",
    allProjects: "Todas as obras / projetos",
    periodToday: "Hoje",
    periodThisWeek: "Esta Semana",
    periodLastWeek: "Semana Passada",
    periodThisMonth: "Este Mês",
    periodAll: "Todos os registros",
    totalWorked: "Horas Trabalhadas",
    breakTime: "Tempo de Intervalo",
    totalShifts: "Total de Turnos",
    activeStaff: "Funcionários Ativos",
    exportExcel: "Exportar para Excel",
    colDate: "Data",
    colWorker: "Funcionário",
    colProject: "Projeto / Obra",
    colClockIn: "Entrada",
    colClockOut: "Saída",
    colBreak: "Intervalo",
    colNetHours: "Horas Líquidas",
    colStatus: "Status",
    colActions: "Ações",
    noShiftsFound: "Nenhum registro encontrado para este período. Tente selecionar 'Todos os registros'.",
    adjustShift: "Ajustar",
    adjustTitle: "Ajuste Manual de Ponto",
    adjustReason: "Motivo do Ajuste *",
    adjustReasonPlaceholder: "Ex. O funcionário esqueceu de registrar a saída ao fim do expediente",
    adjustSave: "Salvar Ajuste",
    viewPhotoEvidence: "Ver Foto",
    photoEvidenceTitle: "Comprovante Fotográfico de Entrada",

    projectsTitle: "Gestão de Projetos e Obras",
    projectsSubtitle: "Cadastre locais de trabalho, coordenadas GPS e raios de tolerância.",
    newProjectBtn: "Novo Projeto / Obra",
    noProjectsYet: "Nenhum projeto cadastrado ainda. Clique em 'Novo Projeto' para criar o primeiro.",
    editProject: "Editar Projeto / Obra",
    newProject: "Novo Projeto / Obra",
    projectName: "Nome da Obra / Projeto *",
    projectCode: "Código da Obra",
    siteAddress: "Endereço",
    geofenceRadius: "Raio de Geocerca (metros)",
    gpsCoordinates: "Coordenadas GPS",
    useMyLocation: "Usar Minha Localização",
    activeStatus: "Status Ativo",
    inactiveStatus: "Inativo",
    active: "Ativo",
    inactive: "Inativo",
  },
};

interface I18nContextType {
  lang: Language;
  setLang: (l: Language) => void;
  t: (key: keyof Translations) => string;
}

const I18nContext = createContext<I18nContextType | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>(() => {
    const saved = localStorage.getItem("fh_lang") as Language;
    if (saved && (saved === "es" || saved === "en" || saved === "pt")) {
      return saved;
    }
    // Default to spanish
    return "es";
  });

  const setLang = (newLang: Language) => {
    setLangState(newLang);
    localStorage.setItem("fh_lang", newLang);
  };

  const t = (key: keyof Translations): string => {
    return translations[lang]?.[key] || translations.es[key] || key;
  };

  return (
    <I18nContext.Provider value={{ lang, setLang, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    // Fallback if rendered outside provider
    return {
      lang: "es" as Language,
      setLang: () => {},
      t: (key: keyof Translations) => translations.es[key] || key,
    };
  }
  return context;
}
