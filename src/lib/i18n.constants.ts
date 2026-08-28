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
  locationFooterNotice: string;
  close: string;

  // Auth & Onboarding
  secureAccess: string;
  welcomeBack: string;
  welcomeBackSubtitle: string;
  joinTeam: string;
  joinTeamSubtitle: string;
  signIn: string;
  createWorkerAccount: string;
  email: string;
  password: string;
  fullName: string;
  invitationCode: string;
  haveInvitation: string;
  backToSignIn: string;
  firstSignIn: string;
  choosePermanentPassword: string;
  changePasswordDetail: string;
  newPassword: string;
  confirmPassword: string;
  savePassword: string;
  passwordsDoNotMatch: string;

  // Worker View
  workerHeaderTitle: string;
  hiUser: string;
  workedToday: string;
  assignedProject: string;
  selectProject: string;
  noProjectsAvailable: string;
  generalWork: string;
  geofenceActive: string;
  stateOffShift: string;
  stateOffShiftDetail: string;
  stateWorking: string;
  stateWorkingDetail: string;
  stateOnBreak: string;
  stateOnBreakDetail: string;
  stateComplete: string;
  stateCompleteDetail: string;
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
  noPastShiftsYet: string;
  inProgress: string;
  logged: string;
  takeSelfiePrompt: string;
  takeSelfieTitle: string;
  takeSelfieSubtitle: string;
  capturePhoto: string;
  skipPhoto: string;
  switchCamera: string;
  retake: string;
  confirmPhoto: string;
  photoVerified: string;
  viewPhoto: string;
  openMap: string;
  locationEvidenceTitle: string;
  locationEvidenceSubtitle: string;
  noClockEventsToday: string;

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
  workerProfileHistory: string;
  todaysShiftEvidence: string;
  recordedPastShifts: string;
  shiftsFound: string;

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
  auditAdjustment: string;
  adjustShiftTimes: string;
  clockInTime: string;
  clockOutTime: string;
  adjustReason: string;
  adjustReasonPlaceholder: string;
  saveAdjustment: string;
  mapWithCount: string;

  // Projects View
  projectsTitle: string;
  projectsSubtitle: string;
  newProjectBtn: string;
  noProjectsYet: string;
  noProjectsPrompt: string;
  editProject: string;
  newProject: string;
  projectName: string;
  projectDescription: string;
  projectNameMin: string;
  projectDescriptionRequired: string;
  workerProjectGpsHint: string;
  projectCreated: string;
  projectCode: string;
  siteAddress: string;
  geofenceRadius: string;
  gpsCoordinates: string;
  useMyLocation: string;
  activeProjectCheck: string;
  saveProject: string;
  active: string;
  archived: string;
  noGpsSet: string;
  viewMap: string;
  edit: string;
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
    offline: "Sin conexión",
    syncPending: "pendientes de sincronizar",
    syncedSuccess: "acciones sincronizadas con el servidor.",
    locationFooterNotice: "La ubicación GPS solo se captura al pulsar una acción de fichaje.",
    close: "Cerrar",

    secureAccess: "Acceso seguro",
    welcomeBack: "Bienvenido de nuevo",
    welcomeBackSubtitle: "Inicia sesión para registrar tu jornada o consultar el equipo.",
    joinTeam: "Únete a tu equipo",
    joinTeamSubtitle: "Tu invitación de un solo uso determina tu acceso de trabajador.",
    signIn: "Iniciar sesión",
    createWorkerAccount: "Crear cuenta de trabajador",
    email: "Correo electrónico",
    password: "Contraseña",
    fullName: "Nombre completo",
    invitationCode: "Código de invitación",
    haveInvitation: "Tengo una invitación de personal",
    backToSignIn: "Volver a iniciar sesión",
    firstSignIn: "Primer inicio de sesión",
    choosePermanentPassword: "Elige tu contraseña definitiva",
    changePasswordDetail: "La contraseña temporal de administrador solo puede abrir esta pantalla. Usa al menos 12 caracteres.",
    newPassword: "Nueva contraseña",
    confirmPassword: "Confirmar nueva contraseña",
    savePassword: "Guardar contraseña",
    passwordsDoNotMatch: "Las contraseñas no coinciden.",

    workerHeaderTitle: "Mi Jornada",
    hiUser: "Hola",
    workedToday: "Trabajado hoy",
    assignedProject: "Proyecto / Obra Asignada",
    selectProject: "Seleccionar obra o proyecto...",
    noProjectsAvailable: "No hay proyectos activos. Puedes crear uno nuevo.",
    generalWork: "Trabajo General",
    geofenceActive: "Perímetro de geocerca activo: tolerancia de",
    stateOffShift: "Fuera de turno",
    stateOffShiftDetail: "Tu siguiente acción registra el lugar donde inicias el trabajo.",
    stateWorking: "Trabajando",
    stateWorkingDetail: "Tu turno está activo. Toma una pausa o finaliza al terminar el trabajo.",
    stateOnBreak: "En pausa",
    stateOnBreakDetail: "El contador de tiempo está pausado hasta que regreses.",
    stateComplete: "Jornada completada",
    stateCompleteDetail: "Tu tiempo trabajado y evidencias GPS han sido guardados para hoy.",
    clockIn: "Marcar Entrada",
    startBreak: "Iniciar Pausa",
    endBreak: "Finalizar Pausa",
    finishShift: "Finalizar Jornada",
    confirmFinish: "Confirmar Salida",
    finishPromptTitle: "¿Deseas finalizar tu jornada?",
    finishPromptDetail: "Esto registrará la hora actual y una verificación GPS de salida.",
    cancel: "Cancelar",
    save: "Guardar",
    saving: "Guardando…",
    myPastShifts: "Mis Turnos Anteriores",
    noPastShiftsYet: "Aún no hay turnos completados registrados.",
    inProgress: "En curso",
    logged: "Registrado",
    takeSelfiePrompt: "Foto de Entrada (Evidencia de presencia)",
    takeSelfieTitle: "Verificación de Identidad",
    takeSelfieSubtitle: "Toma una selfie rápida para certificar tu presencia en la obra.",
    capturePhoto: "Tomar Foto",
    skipPhoto: "Omitir Foto",
    switchCamera: "Cambiar Cámara",
    retake: "Repetir Foto",
    confirmPhoto: "Confirmar y Fichar",
    photoVerified: "Foto verificada",
    viewPhoto: "Ver Foto",
    openMap: "Ver mapa",
    locationEvidenceTitle: "Evidencias de Ubicación y Foto",
    locationEvidenceSubtitle: "Registradas al momento de cada acción",
    noClockEventsToday: "No hay eventos registrados hoy.",

    adminGreeting: "Buen día",
    adminSubtitle: "Vista en tiempo real del progreso del equipo y auditoría de presencia.",
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
    noMembersYet: "Aún no hay trabajadores registrados. Crea una invitación para agregar al primero.",
    inviteWorkerTitle: "Invitar Personal",
    inviteWorkerSubtitle: "Escanear para unirse",
    createInvitation: "Crear Invitación",
    creatingInvitation: "Generando…",
    copyLink: "Copiar Enlace",
    copied: "¡Enlace copiado!",
    qrInstruction: "El trabajador puede escanear este código QR con su móvil.",
    oneTimeNotice: "El token es de un solo uso y vence en 30 minutos.",
    workerProfileHistory: "Perfil y Registro del Trabajador",
    todaysShiftEvidence: "Evidencias del Turno de Hoy",
    recordedPastShifts: "Turnos Pasados Registrados",
    shiftsFound: "turno(s) encontrados",

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
    auditAdjustment: "Ajuste de Auditoría",
    adjustShiftTimes: "Ajustar Horas del Turno",
    clockInTime: "Hora de Entrada",
    clockOutTime: "Hora de Salida",
    adjustReason: "Motivo del Ajuste *",
    adjustReasonPlaceholder: "Ej. El trabajador olvidó fichar su salida al finalizar el turno",
    saveAdjustment: "Guardar Ajuste",
    mapWithCount: "Mapa",

    projectsTitle: "Gestión de Proyectos y Obras",
    projectsSubtitle: "Configura direcciones de obra, coordenadas GPS y radio de tolerancia en metros.",
    newProjectBtn: "Agregar Proyecto",
    noProjectsYet: "No hay proyectos registrados aún",
    noProjectsPrompt: "Agrega tu primera obra para que los trabajadores puedan asociar sus jornadas y verificar geocercas.",
    editProject: "Editar Proyecto / Obra",
    newProject: "Nueva Obra / Proyecto",
    projectName: "Nombre del Proyecto / Obra *",
    projectDescription: "Descripción breve *",
    projectNameMin: "El nombre debe tener al menos 2 caracteres.",
    projectDescriptionRequired: "La descripción del proyecto es obligatoria.",
    workerProjectGpsHint: "La ubicación GPS se capturará al iniciar el turno y seleccionar este proyecto.",
    projectCreated: "Proyecto creado y seleccionado para tu próximo turno.",
    projectCode: "Código de Obra",
    siteAddress: "Dirección",
    geofenceRadius: "Radio de Geocerca (metros)",
    gpsCoordinates: "Coordenadas GPS",
    useMyLocation: "Capturar GPS actual",
    activeProjectCheck: "Proyecto Activo (Disponible para que los trabajadores fichen)",
    saveProject: "Guardar Proyecto",
    active: "Activo",
    archived: "Archivado",
    noGpsSet: "Sin coordenadas GPS (geocerca inactiva)",
    viewMap: "Ver Mapa",
    edit: "Editar",
  },
  en: {
    appTitle: "Field Hours",
    todayTab: "Live Today",
    historyTab: "History & Reports",
    projectsTab: "Projects & Sites",
    signOut: "Sign out",
    liveStatus: "Updated",
    online: "Online",
    offline: "Offline",
    syncPending: "pending to sync",
    syncedSuccess: "action(s) synced with the server.",
    locationFooterNotice: "Location is captured only for a clock action.",
    close: "Close",

    secureAccess: "Secure access",
    welcomeBack: "Welcome back",
    welcomeBackSubtitle: "Sign in to clock time or see today’s team.",
    joinTeam: "Join your team",
    joinTeamSubtitle: "Your one-time invitation decides your worker access.",
    signIn: "Sign in",
    createWorkerAccount: "Create worker account",
    email: "Email address",
    password: "Password",
    fullName: "Full name",
    invitationCode: "Invitation code",
    haveInvitation: "I have a staff invitation",
    backToSignIn: "Back to sign in",
    firstSignIn: "First sign-in",
    choosePermanentPassword: "Choose your permanent password",
    changePasswordDetail: "The temporary administrator password can only open this screen. Use at least 12 characters.",
    newPassword: "New password",
    confirmPassword: "Confirm password",
    savePassword: "Save password",
    passwordsDoNotMatch: "The passwords do not match.",

    workerHeaderTitle: "My shift",
    hiUser: "Hi",
    workedToday: "Worked today",
    assignedProject: "Assigned Project / Job Site",
    selectProject: "Select Job Site / Project...",
    noProjectsAvailable: "No active projects available. You can create one.",
    generalWork: "General Work",
    geofenceActive: "Geofence perimeter active: tolerance of",
    stateOffShift: "Off shift",
    stateOffShiftDetail: "Your next action records the place you start work.",
    stateWorking: "Working",
    stateWorkingDetail: "Your shift is live. Take a break or finish when you are done.",
    stateOnBreak: "On break",
    stateOnBreakDetail: "Your paid-time clock is paused until you return.",
    stateComplete: "Shift complete",
    stateCompleteDetail: "Your worked time and location evidence are saved for today.",
    clockIn: "Clock in",
    startBreak: "Start break",
    endBreak: "End break",
    finishShift: "Finish shift",
    confirmFinish: "Confirm finish",
    finishPromptTitle: "Finish your shift?",
    finishPromptDetail: "This records the current time and a fresh location check.",
    cancel: "Cancel",
    save: "Save",
    saving: "Saving…",
    myPastShifts: "My Past Shifts",
    noPastShiftsYet: "No completed shifts recorded yet.",
    inProgress: "In Progress",
    logged: "Logged",
    takeSelfiePrompt: "Clock In Photo (Presence evidence)",
    takeSelfieTitle: "Identity Verification",
    takeSelfieSubtitle: "Take a quick selfie to certify your presence on the job site.",
    capturePhoto: "Take Photo",
    skipPhoto: "Skip Photo",
    switchCamera: "Switch Camera",
    retake: "Retake Photo",
    confirmPhoto: "Confirm & Clock In",
    photoVerified: "Photo verified",
    viewPhoto: "View Photo",
    openMap: "Open map",
    locationEvidenceTitle: "Location & Photo evidence",
    locationEvidenceSubtitle: "Captured upon action",
    noClockEventsToday: "No clock events recorded today.",

    adminGreeting: "Good day",
    adminSubtitle: "A clear view of the team’s progress and location evidence.",
    workingMetric: "Working",
    onBreakMetric: "On break",
    finishedMetric: "Finished",
    teamMetric: "Team",
    activeShifts: "active shifts",
    pausedNow: "paused now",
    completedToday: "completed today",
    staffMembers: "staff members",
    todaysTeam: "Today’s team",
    progressAtAGlance: "Progress at a glance",
    details: "Details",
    noMembersYet: "No staff members have joined yet. Create an invitation to add the first worker.",
    inviteWorkerTitle: "Invite staff",
    inviteWorkerSubtitle: "Scan to join",
    createInvitation: "Create invitation",
    creatingInvitation: "Generating…",
    copyLink: "Copy Link",
    copied: "Link copied!",
    qrInstruction: "The worker can scan this QR code with their mobile device.",
    oneTimeNotice: "The raw token is shown once; D1 stores only its cryptographic hash.",
    workerProfileHistory: "Worker Profile & History",
    todaysShiftEvidence: "Today's Shift Evidence",
    recordedPastShifts: "Recorded Past Shifts",
    shiftsFound: "shift(s) found",

    reportsTitle: "Shift History & Reports",
    periodFilter: "Period",
    workerFilter: "Worker",
    projectFilter: "Project / Site",
    allStaff: "All Staff Members",
    allProjects: "All Projects / Sites",
    periodToday: "Today",
    periodThisWeek: "This Week",
    periodLastWeek: "Last Week",
    periodThisMonth: "This Month",
    periodAll: "All Records",
    totalWorked: "Total Worked",
    breakTime: "Break Time",
    totalShifts: "Total Shifts",
    activeStaff: "Active Staff",
    exportExcel: "Export Excel",
    colDate: "Date",
    colWorker: "Worker",
    colProject: "Project / Site",
    colClockIn: "Clock In",
    colClockOut: "Clock Out",
    colBreak: "Break",
    colNetHours: "Net Hours",
    colStatus: "Status",
    colActions: "Actions",
    noShiftsFound: "No shift records found for this period. Try selecting 'All Records'.",
    adjustShift: "Adjust",
    auditAdjustment: "Audit Adjustment",
    adjustShiftTimes: "Adjust Shift Times",
    clockInTime: "Clock In Time",
    clockOutTime: "Clock Out Time",
    adjustReason: "Reason for Adjustment *",
    adjustReasonPlaceholder: "e.g. Worker forgot to clock out at the end of the shift",
    saveAdjustment: "Save Adjustment",
    mapWithCount: "Map",

    projectsTitle: "Manage Construction Projects",
    projectsSubtitle: "Configure site addresses, GPS center coordinates, and tolerance radius in meters.",
    newProjectBtn: "Add Project",
    noProjectsYet: "No projects registered yet",
    noProjectsPrompt: "Add your first job site so workers can associate their shifts and verify geofences.",
    editProject: "Edit Project",
    newProject: "New Project",
    projectName: "Project Name *",
    projectDescription: "Short description *",
    projectNameMin: "The name must contain at least 2 characters.",
    projectDescriptionRequired: "Project description is required.",
    workerProjectGpsHint: "GPS will be captured when you start the shift and select this project.",
    projectCreated: "Project created and selected for your next shift.",
    projectCode: "Project Code",
    siteAddress: "Site Address",
    geofenceRadius: "Geofence Radius (meters)",
    gpsCoordinates: "GPS Coordinates",
    useMyLocation: "Capture Current GPS",
    activeProjectCheck: "Active Project (Available for workers to clock in)",
    saveProject: "Save Project",
    active: "Active",
    archived: "Archived",
    noGpsSet: "No GPS coordinates set (geofence inactive)",
    viewMap: "View Map",
    edit: "Edit",
  },
  pt: {
    appTitle: "Field Hours",
    todayTab: "Hoje ao Vivo",
    historyTab: "Histórico e Relatórios",
    projectsTab: "Projetos e Obras",
    signOut: "Sair",
    liveStatus: "Atualizado",
    online: "Online",
    offline: "Offline",
    syncPending: "pendentes de sincronização",
    syncedSuccess: "ação(ões) sincronizada(s) com o servidor.",
    locationFooterNotice: "A localização GPS é capturada apenas ao bater o ponto.",
    close: "Fechar",

    secureAccess: "Acesso seguro",
    welcomeBack: "Bem-vindo de volta",
    welcomeBackSubtitle: "Entre para registrar seu ponto ou acompanhar a equipe.",
    joinTeam: "Junte-se à sua equipe",
    joinTeamSubtitle: "Seu convite de uso único define seu acesso de operário.",
    signIn: "Entrar",
    createWorkerAccount: "Criar conta de operário",
    email: "E-mail",
    password: "Senha",
    fullName: "Nome completo",
    invitationCode: "Código de convite",
    haveInvitation: "Tenho um convite de funcionário",
    backToSignIn: "Voltar para o login",
    firstSignIn: "Primeiro acesso",
    choosePermanentPassword: "Defina sua senha definitiva",
    changePasswordDetail: "A senha provisória de administrador serve apenas para este acesso. Use pelo menos 12 caracteres.",
    newPassword: "Nova senha",
    confirmPassword: "Confirmar nova senha",
    savePassword: "Salvar senha",
    passwordsDoNotMatch: "As senhas não conferem.",

    workerHeaderTitle: "Meu Ponto",
    hiUser: "Olá",
    workedToday: "Trabalhado hoje",
    assignedProject: "Obra / Projeto Atribuído",
    selectProject: "Selecionar obra ou projeto...",
    noProjectsAvailable: "Nenhuma obra ativa disponível. Você pode criar uma nova.",
    generalWork: "Trabalho Geral",
    geofenceActive: "Perímetro de geocerca ativo: tolerância de",
    stateOffShift: "Fora de turno",
    stateOffShiftDetail: "Sua próxima ação registra o local onde você inicia o trabalho.",
    stateWorking: "Trabalhando",
    stateWorkingDetail: "Sua jornada está ativa. Faça um intervalo ou finalize ao encerrar o expediente.",
    stateOnBreak: "Em pausa",
    stateOnBreakDetail: "A contagem de horas está pausada até você retornar.",
    stateComplete: "Jornada finalizada",
    stateCompleteDetail: "Seu tempo trabalhado e comprovantes GPS foram salvos hoje.",
    clockIn: "Bater Entrada",
    startBreak: "Iniciar Pausa",
    endBreak: "Finalizar Pausa",
    finishShift: "Finalizar Jornada",
    confirmFinish: "Confirmar Saída",
    finishPromptTitle: "Deseja finalizar sua jornada?",
    finishPromptDetail: "Isso registrará o horário atual e a verificação GPS de saída.",
    cancel: "Cancelar",
    save: "Salvar",
    saving: "Salvando…",
    myPastShifts: "Meus Turnos Anteriores",
    noPastShiftsYet: "Nenhum turno finalizado registrado ainda.",
    inProgress: "Em andamento",
    logged: "Registrado",
    takeSelfiePrompt: "Foto de Entrada (Comprovante de presença)",
    takeSelfieTitle: "Verificação de Identidade",
    takeSelfieSubtitle: "Tire uma selfie rápida para comprovar sua presença na obra.",
    capturePhoto: "Tirar Foto",
    skipPhoto: "Pular Foto",
    switchCamera: "Trocar Câmera",
    retake: "Tirar Outra Foto",
    confirmPhoto: "Confirmar e Registrar",
    photoVerified: "Foto verificada",
    viewPhoto: "Ver Foto",
    openMap: "Ver mapa",
    locationEvidenceTitle: "Comprovantes de Localização e Foto",
    locationEvidenceSubtitle: "Registrados ao bater o ponto",
    noClockEventsToday: "Nenhum evento registrado hoje.",

    adminGreeting: "Bom dia",
    adminSubtitle: "Visão em tempo real do progresso da equipe e auditoria de presença.",
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
    inviteWorkerSubtitle: "Escanear para entrar",
    createInvitation: "Criar Convite",
    creatingInvitation: "Gerando…",
    copyLink: "Copiar Link",
    copied: "Link copiado!",
    qrInstruction: "O funcionário pode ler este QR code com o celular.",
    oneTimeNotice: "O token é de uso único e expira em 30 minutos.",
    workerProfileHistory: "Perfil e Histórico do Operário",
    todaysShiftEvidence: "Comprovantes do Turno de Hoje",
    recordedPastShifts: "Turnos Anteriores Registrados",
    shiftsFound: "turno(s) encontrados",

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
    auditAdjustment: "Ajuste de Auditoria",
    adjustShiftTimes: "Ajustar Horários do Turno",
    clockInTime: "Horário de Entrada",
    clockOutTime: "Horário de Saída",
    adjustReason: "Motivo do Ajuste *",
    adjustReasonPlaceholder: "Ex. O funcionário esqueceu de registrar a saída ao fim do expediente",
    saveAdjustment: "Salvar Ajuste",
    mapWithCount: "Mapa",

    projectsTitle: "Gestão de Obras e Projetos",
    projectsSubtitle: "Cadastre locais de trabalho, coordenadas GPS e raios de tolerância em metros.",
    newProjectBtn: "Adicionar Obra",
    noProjectsYet: "Nenhuma obra cadastrada ainda",
    noProjectsPrompt: "Adicione sua primeira obra para que os operários possam associar seus pontos e validar geocercas.",
    editProject: "Editar Obra",
    newProject: "Nova Obra / Projeto",
    projectName: "Nome da Obra / Projeto *",
    projectDescription: "Descrição breve *",
    projectNameMin: "O nome deve ter pelo menos 2 caracteres.",
    projectDescriptionRequired: "A descrição do projeto é obrigatória.",
    workerProjectGpsHint: "A localização GPS será capturada ao iniciar o turno e selecionar este projeto.",
    projectCreated: "Projeto criado e selecionado para seu próximo turno.",
    projectCode: "Código da Obra",
    siteAddress: "Endereço",
    geofenceRadius: "Raio de Geocerca (metros)",
    gpsCoordinates: "Coordenadas GPS",
    useMyLocation: "Capturar GPS atual",
    activeProjectCheck: "Obra Ativa (Disponível para os operários baterem ponto)",
    saveProject: "Salvar Obra",
    active: "Ativo",
    archived: "Arquivado",
    noGpsSet: "Sem coordenadas GPS (geocerca inativa)",
    viewMap: "Ver Mapa",
    edit: "Editar",
  },
};
