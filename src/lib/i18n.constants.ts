export type Language = "es" | "en" | "pt";

export interface Translations {
  // Navigation & Shell
  appTitle: string;
  todayTab: string;
  historyTab: string;
  projectsTab: string;
  signOut: string;
  home: string;
  sections: string;
  overview: string;
  statements: string;
  storage: string;
  invite: string;
  loading: string;
  managerRole: string;
  builderRole: string;
  onTheClock: string;
  liveStatus: string;
  online: string;
  offline: string;
  syncPending: string;
  syncedSuccess: string;
  locationFooterNotice: string;
  close: string;
  installApp: string;
  installAppAndroidHelp: string;
  installAppDismissed: string;
  installAppError: string;
  salaryAdviceTab: string;
  address: string;
  salaryAdviceLoading: string;
  salaryAdviceLoadError: string;
  employeeDetailsOpenError: string;
  businessDetailsSaveError: string;
  hourlyRateValidation: string;
  salaryAdviceDownloadError: string;
  salaryAdviceUnsupportedCharacters: string;
  salaryAdviceFontLoadError: string;
  salaryDocumentIdentityLabel: string;
  salaryEmployeesLabel: string;
  salaryEstimateLabel: string;
  salaryIdentityLabel: string;
  payrollSummaryUnavailable: string;
  payrollProfileLoading: string;
  payrollProfileSaveError: string;
  statusLabel: string;
  legalName: string;
  homeAddress: string;
  socialSecurityNumber: string;
  storedKeepPlaceholder: string;
  requiredLabel: string;
  employeeNumberHelp: string;
  weeklyCoverageHelp: string;
  adjacentRulesUnavailable: string;
  accountMenu: string;
  setupGoogleSignIn: string;
  googleRequestSent: string;
  googleSignInReady: string;
  googleSignInError: string;
  loadingSecureSession: string;
  salaryAdviceTitle: string;
  salaryAdviceSubtitle: string;
  businessDetails: string;
  businessDetailsHelp: string;
  businessName: string;
  businessAddress: string;
  saveBusinessDetails: string;
  businessDetailsSaved: string;
  profilesTitle: string;
  profilesHelp: string;
  profileReady: string;
  profileMissing: string;
  viewDetails: string;
  employee: string;
  periodType: string;
  weekly: string;
  monthly: string;
  selectedWeek: string;
  selectedMonth: string;
  payDate: string;
  hourlyRateAdvice: string;
  hourlyRateHelp: string;
  itisRateAdvice: string;
  itisRateHelp: string;
  monthlySocialSecurityStatus: string;
  monthlySocialSecurityHelp: string;
  socialSecurityStandard: string;
  socialSecurityExempt: string;
  weeklySocialSecurityAmount: string;
  weeklySocialSecurityHelp: string;
  weeklySocialSecurityWarning: string;
  yearToDateGross: string;
  yearToDateTax: string;
  totalsToDateHelp: string;
  businessDetailsRequired: string;
  businessDetailsUnsaved: string;
  calculateDownload: string;
  calculating: string;
  downloaded: string;
  previewTitle: string;
  completedShiftsLabel: string;
  hoursLabel: string;
  grossPay: string;
  itisLabel: string;
  socialSecurityLabel: string;
  totalDeductions: string;
  netPay: string;
  estimateNotice: string;
  noReadyProfiles: string;
  profileDetails: string;
  employeeNumber: string;
  taxReference: string;
  socialReference: string;
  hoursSummaryTitle: string;
  hoursSummaryHelp: string;
  thisMonth: string;
  allCompletedShiftsLabel: string;
  salaryDetailsTitle: string;
  salaryDetailsHelp: string;
  profileSavedStatus: string;
  profileNotSavedStatus: string;
  sensitiveEncrypted: string;
  saveProfile: string;
  updateProfile: string;

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
  createWorkday: string;
  createWorkdayTitle: string;
  selectWorker: string;
  optionalProject: string;
  workDescription: string;
  workDescriptionPlaceholder: string;
  saveWorkday: string;
  adjustShift: string;
  auditAdjustment: string;
  adjustShiftTimes: string;
  clockInTime: string;
  clockOutTime: string;
  adjustReason: string;
  adjustReasonPlaceholder: string;
  saveAdjustment: string;
  adminAdjustedNotice: string;
  adminCreatedNotice: string;
  adminAdjustedReason: string;
  adminCreatedDescription: string;
  adminAdjustedAt: string;
  adminCreatedAt: string;
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
    home: "Inicio",
    sections: "Secciones",
    overview: "Resumen",
    statements: "Extractos",
    storage: "Archivos",
    invite: "Invitar",
    loading: "Cargando",
    managerRole: "Administrador",
    builderRole: "Trabajador",
    onTheClock: "Turno en curso",
    liveStatus: "Actualizado",
    online: "En línea",
    offline: "Sin conexión",
    syncPending: "pendientes de sincronizar",
    syncedSuccess: "acciones sincronizadas con el servidor.",
    locationFooterNotice: "La ubicación GPS solo se captura al pulsar una acción de fichaje.",
    close: "Cerrar",
    installApp: "Instalar app en Android",
    installAppAndroidHelp: "En Android, abre el menú de Chrome y toca “Instalar aplicación” o “Añadir a pantalla principal”.",
    installAppDismissed: "La instalación no se completó. Puedes usar el menú de Chrome para intentarlo de nuevo.",
    installAppError: "Chrome no pudo abrir la instalación. Usa su menú y toca “Instalar aplicación” o “Añadir a pantalla principal”.",
    salaryAdviceTab: "Salary Advice",
    address: "Dirección",
    salaryAdviceLoading: "Cargando herramientas de Salary Advice…",
    salaryAdviceLoadError: "No se pudieron cargar los datos de Salary Advice.",
    employeeDetailsOpenError: "No se pudieron abrir los datos del empleado.",
    businessDetailsSaveError: "No se pudieron guardar los datos del negocio.",
    hourlyRateValidation: "Introduce una tarifa entre £0,01 y £10.000 con hasta dos decimales.",
    salaryAdviceDownloadError: "No se pudo calcular o descargar el Salary Advice.",
    salaryAdviceUnsupportedCharacters: "El PDF no admite uno de los caracteres de la identidad. No se generó ningún documento; contacta a soporte sin modificar los datos legales.",
    salaryAdviceFontLoadError: "No se pudo cargar la fuente segura del PDF. No se generó ningún documento; vuelve a intentarlo con conexión o contacta a soporte.",
    salaryDocumentIdentityLabel: "Salary Advice · identidad del documento",
    salaryEmployeesLabel: "Salary Advice · empleados",
    salaryEstimateLabel: "Salary Advice · estimación",
    salaryIdentityLabel: "Salary Advice · identidad",
    payrollSummaryUnavailable: "El resumen de horas todavía no está disponible.",
    payrollProfileLoading: "Cargando perfil para Salary Advice…",
    payrollProfileSaveError: "No se pudo guardar el perfil para Salary Advice.",
    statusLabel: "Estado",
    legalName: "Nombre legal",
    homeAddress: "Dirección del domicilio",
    socialSecurityNumber: "Número de Social Security",
    storedKeepPlaceholder: "Ya guardado · deja vacío para conservarlo",
    requiredLabel: "Obligatorio",
    employeeNumberHelp: "Usa A-Z, 0-9, punto, guion bajo, barra o guion; se guarda en mayúsculas.",
    weeklyCoverageHelp: "Se muestran todas las semanas lunes–domingo que tocan 2026. Las dos semanas limítrofes quedan visibles pero deshabilitadas hasta configurar las reglas del año adyacente.",
    adjacentRulesUnavailable: "reglas del año adyacente no disponibles",
    accountMenu: "menú de cuenta",
    setupGoogleSignIn: "Configurar acceso con Google",
    googleRequestSent: "Solicitud de acceso con Google enviada. Un administrador debe aprobarla antes de usar Google para entrar.",
    googleSignInReady: "El acceso con Google ya está listo para esta cuenta.",
    googleSignInError: "No se pudo completar el acceso con Google. Tu sesión actual no cambió.",
    loadingSecureSession: "Cargando sesión segura…",
    salaryAdviceTitle: "Calcular y descargar Salary Advice",
    salaryAdviceSubtitle: "Elige un empleado y un periodo. La descarga crea únicamente el documento y no inicia pagos.",
    businessDetails: "Datos del negocio para el documento",
    businessDetailsHelp: "Estos son los únicos datos del negocio que utiliza el documento.",
    businessName: "Nombre del negocio",
    businessAddress: "Dirección del negocio",
    saveBusinessDetails: "Guardar datos del documento",
    businessDetailsSaved: "Datos del documento guardados.",
    profilesTitle: "Datos de empleados",
    profilesHelp: "El Salary Advice requiere que los datos del empleado estén completos.",
    profileReady: "Datos completos",
    profileMissing: "Faltan datos",
    viewDetails: "Ver datos",
    employee: "Empleado",
    periodType: "Tipo de periodo",
    weekly: "Semanal",
    monthly: "Mensual",
    selectedWeek: "Semana (lunes a domingo)",
    selectedMonth: "Mes calendario",
    payDate: "Fecha de pago",
    hourlyRateAdvice: "Tarifa para este Salary Advice (£)",
    hourlyRateHelp: "Se usa solo en este cálculo; no se guarda como tarifa estándar del negocio.",
    itisRateAdvice: "ITIS confirmado para este documento (%)",
    itisRateHelp: "Introduce el porcentaje entero del aviso ITIS vigente del empleado.",
    monthlySocialSecurityStatus: "Social Security mensual",
    monthlySocialSecurityHelp: "Usa 0% únicamente si la tarjeta vigente confirma exención de la cotización primaria.",
    socialSecurityStandard: "Estándar · 6%",
    socialSecurityExempt: "Exento · 0%",
    weeklySocialSecurityAmount: "Social Security semanal confirmada (£)",
    weeklySocialSecurityHelp: "Introduce el importe comprobado con el acumulado salarial del mes; no se calcula aislando esta semana.",
    weeklySocialSecurityWarning: "La Seguridad Social semanal fue confirmada por el administrador usando el acumulado salarial del mes y debe coincidir con el aviso oficial de cotización.",
    yearToDateGross: "Bruto imponible acumulado (£)",
    yearToDateTax: "ITIS pagado acumulado (£)",
    totalsToDateHelp: "Valores confirmados que ya incluyen este Salary Advice; no se guardan ni se inventan.",
    businessDetailsRequired: "Guarda primero el nombre y la dirección del negocio.",
    businessDetailsUnsaved: "Guarda los cambios del nombre o la dirección del negocio antes de generar el PDF.",
    calculateDownload: "Calcular y descargar PDF",
    calculating: "Calculando y creando PDF…",
    downloaded: "PDF descargado",
    previewTitle: "Resumen del documento descargado",
    completedShiftsLabel: "Turnos completados",
    hoursLabel: "Horas",
    grossPay: "Bruto",
    itisLabel: "ITIS",
    socialSecurityLabel: "Seguridad Social",
    totalDeductions: "Deducciones",
    netPay: "Neto",
    estimateNotice: "Estimación basada en turnos completados y reglas Jersey 2026; confirma el resultado con el aviso oficial.",
    noReadyProfiles: "Ningún empleado tiene todavía los datos completos para generar el documento.",
    profileDetails: "Datos del empleado",
    employeeNumber: "Número de empleado",
    taxReference: "Referencia fiscal (ITIS)",
    socialReference: "Referencia de Seguridad Social",
    hoursSummaryTitle: "Resumen de horas",
    hoursSummaryHelp: "Solo turnos completados. Las fechas y periodos del Salary Advice los elige el administrador.",
    thisMonth: "Este mes",
    allCompletedShiftsLabel: "Todos los turnos completados",
    salaryDetailsTitle: "Tus datos salariales y fiscales",
    salaryDetailsHelp: "Guárdalos para que el administrador pueda generar un Salary Advice semanal o mensual.",
    profileSavedStatus: "Datos guardados y disponibles",
    profileNotSavedStatus: "Datos pendientes",
    sensitiveEncrypted: "Los identificadores sensibles están cifrados y solo se muestran cuando hacen falta para el documento.",
    saveProfile: "Guardar perfil",
    updateProfile: "Actualizar perfil",

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
    createWorkday: "Agregar jornada",
    createWorkdayTitle: "Crear jornada de horas",
    selectWorker: "Trabajador *",
    optionalProject: "Proyecto / Obra (opcional)",
    workDescription: "Descripción de la jornada *",
    workDescriptionPlaceholder: "Ej. Jornada agregada por parte manual entregado por el trabajador",
    saveWorkday: "Guardar Jornada",
    adjustShift: "Ajustar",
    auditAdjustment: "Ajuste de Auditoría",
    adjustShiftTimes: "Ajustar Horas del Turno",
    clockInTime: "Hora de Entrada",
    clockOutTime: "Hora de Salida",
    adjustReason: "Motivo del Ajuste *",
    adjustReasonPlaceholder: "Ej. El trabajador olvidó fichar su salida al finalizar el turno",
    saveAdjustment: "Guardar Ajuste",
    adminAdjustedNotice: "Horas modificadas por un administrador",
    adminCreatedNotice: "Jornada agregada por un administrador",
    adminAdjustedReason: "Motivo",
    adminCreatedDescription: "Descripción",
    adminAdjustedAt: "Modificado el",
    adminCreatedAt: "Agregado el",
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
    home: "Home",
    sections: "Sections",
    overview: "Overview",
    statements: "Statements",
    storage: "Storage",
    invite: "Invite",
    loading: "Loading",
    managerRole: "Manager",
    builderRole: "Worker",
    onTheClock: "On the clock",
    liveStatus: "Updated",
    online: "Online",
    offline: "Offline",
    syncPending: "pending to sync",
    syncedSuccess: "action(s) synced with the server.",
    locationFooterNotice: "Location is captured only for a clock action.",
    close: "Close",
    installApp: "Install app on Android",
    installAppAndroidHelp: "On Android, open Chrome’s menu and tap “Install app” or “Add to Home screen”.",
    installAppDismissed: "Installation was not completed. You can retry from Chrome’s menu.",
    installAppError: "Chrome could not open the installer. Use its menu and tap “Install app” or “Add to Home screen”.",
    salaryAdviceTab: "Salary Advice",
    address: "Address",
    salaryAdviceLoading: "Loading Salary Advice tools…",
    salaryAdviceLoadError: "Salary Advice data could not be loaded.",
    employeeDetailsOpenError: "Employee details could not be opened.",
    businessDetailsSaveError: "Business details could not be saved.",
    hourlyRateValidation: "Enter a rate between £0.01 and £10,000 with up to two decimal places.",
    salaryAdviceDownloadError: "Salary Advice could not be calculated or downloaded.",
    salaryAdviceUnsupportedCharacters: "The PDF cannot represent a character in the identity. No document was generated; contact support without changing legal data.",
    salaryAdviceFontLoadError: "The PDF font could not be loaded safely. No document was generated; retry while online or contact support.",
    salaryDocumentIdentityLabel: "Salary Advice · document identity",
    salaryEmployeesLabel: "Salary Advice · employees",
    salaryEstimateLabel: "Salary Advice · estimate",
    salaryIdentityLabel: "Salary Advice · identity",
    payrollSummaryUnavailable: "The hours summary is not available yet.",
    payrollProfileLoading: "Loading the Salary Advice profile…",
    payrollProfileSaveError: "The Salary Advice profile could not be saved.",
    statusLabel: "Status",
    legalName: "Legal name",
    homeAddress: "Home address",
    socialSecurityNumber: "Social Security Number",
    storedKeepPlaceholder: "Already stored · leave blank to keep",
    requiredLabel: "Required",
    employeeNumberHelp: "Use A-Z, 0-9, dot, underscore, slash or hyphen; it is stored in uppercase.",
    weeklyCoverageHelp: "Every Monday-to-Sunday week touching 2026 is shown. The two boundary weeks stay visible but disabled until adjacent-year rules are configured.",
    adjacentRulesUnavailable: "adjacent-year rules unavailable",
    accountMenu: "account menu",
    setupGoogleSignIn: "Set up Google sign-in",
    googleRequestSent: "Google sign-in request sent. An administrator must approve it before you can use Google to sign in.",
    googleSignInReady: "Google sign-in is ready for this account.",
    googleSignInError: "Google sign-in could not be completed. Your current session is unchanged.",
    loadingSecureSession: "Loading secure session…",
    salaryAdviceTitle: "Calculate and download Salary Advice",
    salaryAdviceSubtitle: "Choose one employee and period. The download creates only the document and does not initiate payment.",
    businessDetails: "Business details for the document",
    businessDetailsHelp: "These are the only business details used by the document.",
    businessName: "Business name",
    businessAddress: "Business address",
    saveBusinessDetails: "Save document details",
    businessDetailsSaved: "Document details saved.",
    profilesTitle: "Employee details",
    profilesHelp: "Salary Advice requires complete employee details.",
    profileReady: "Details complete",
    profileMissing: "Details missing",
    viewDetails: "View details",
    employee: "Employee",
    periodType: "Period type",
    weekly: "Weekly",
    monthly: "Monthly",
    selectedWeek: "Week (Monday to Sunday)",
    selectedMonth: "Calendar month",
    payDate: "Pay date",
    hourlyRateAdvice: "Rate for this Salary Advice (£)",
    hourlyRateHelp: "Used only for this calculation; it is not saved as a standard business rate.",
    itisRateAdvice: "Confirmed ITIS for this document (%)",
    itisRateHelp: "Enter the whole percentage from the employee's current ITIS notice.",
    monthlySocialSecurityStatus: "Monthly Social Security",
    monthlySocialSecurityHelp: "Use 0% only when the current card confirms exemption from primary contributions.",
    socialSecurityStandard: "Standard · 6%",
    socialSecurityExempt: "Exempt · 0%",
    weeklySocialSecurityAmount: "Confirmed weekly Social Security (£)",
    weeklySocialSecurityHelp: "Enter the amount checked against the month's running wage total; it is not calculated from this week in isolation.",
    weeklySocialSecurityWarning: "Weekly Social Security was confirmed by the administrator from the employee's running calendar-month record and must match the official contribution notice.",
    yearToDateGross: "Gross taxable pay to date (£)",
    yearToDateTax: "ITIS paid to date (£)",
    totalsToDateHelp: "Confirmed values that already include this Salary Advice; they are neither stored nor invented.",
    businessDetailsRequired: "Save the business name and address first.",
    businessDetailsUnsaved: "Save business name or address changes before generating the PDF.",
    calculateDownload: "Calculate and download PDF",
    calculating: "Calculating and creating PDF…",
    downloaded: "PDF downloaded",
    previewTitle: "Downloaded document summary",
    completedShiftsLabel: "Completed shifts",
    hoursLabel: "Hours",
    grossPay: "Gross pay",
    itisLabel: "ITIS",
    socialSecurityLabel: "Social Security",
    totalDeductions: "Deductions",
    netPay: "Net pay",
    estimateNotice: "Estimate based on completed shifts and Jersey 2026 rules; confirm it against the official notice.",
    noReadyProfiles: "No employee has complete details for the document yet.",
    profileDetails: "Employee details",
    employeeNumber: "Employee number",
    taxReference: "Tax Reference (ITIS)",
    socialReference: "Social Security Reference",
    hoursSummaryTitle: "Hours overview",
    hoursSummaryHelp: "Completed shifts only. The administrator chooses Salary Advice dates and periods.",
    thisMonth: "This month",
    allCompletedShiftsLabel: "All completed shifts",
    salaryDetailsTitle: "Your salary and tax details",
    salaryDetailsHelp: "Save them so the administrator can generate a weekly or monthly Salary Advice.",
    profileSavedStatus: "Details saved and available",
    profileNotSavedStatus: "Details pending",
    sensitiveEncrypted: "Sensitive identifiers are encrypted and shown only when needed for the document.",
    saveProfile: "Save profile",
    updateProfile: "Update profile",

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
    createWorkday: "Add workday",
    createWorkdayTitle: "Create workday hours",
    selectWorker: "Worker *",
    optionalProject: "Project / Site (optional)",
    workDescription: "Workday description *",
    workDescriptionPlaceholder: "e.g. Workday added from the worker's approved paper timesheet",
    saveWorkday: "Save Workday",
    adjustShift: "Adjust",
    auditAdjustment: "Audit Adjustment",
    adjustShiftTimes: "Adjust Shift Times",
    clockInTime: "Clock In Time",
    clockOutTime: "Clock Out Time",
    adjustReason: "Reason for Adjustment *",
    adjustReasonPlaceholder: "e.g. Worker forgot to clock out at the end of the shift",
    saveAdjustment: "Save Adjustment",
    adminAdjustedNotice: "Hours modified by an administrator",
    adminCreatedNotice: "Workday added by an administrator",
    adminAdjustedReason: "Reason",
    adminCreatedDescription: "Description",
    adminAdjustedAt: "Modified on",
    adminCreatedAt: "Added on",
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
    home: "Início",
    sections: "Seções",
    overview: "Visão geral",
    statements: "Extratos",
    storage: "Arquivos",
    invite: "Convidar",
    loading: "Carregando",
    managerRole: "Administrador",
    builderRole: "Funcionário",
    onTheClock: "Turno em andamento",
    liveStatus: "Atualizado",
    online: "Online",
    offline: "Offline",
    syncPending: "pendentes de sincronização",
    syncedSuccess: "ação(ões) sincronizada(s) com o servidor.",
    locationFooterNotice: "A localização GPS é capturada apenas ao bater o ponto.",
    close: "Fechar",
    installApp: "Instalar app no Android",
    installAppAndroidHelp: "No Android, abra o menu do Chrome e toque em “Instalar app” ou “Adicionar à tela inicial”.",
    installAppDismissed: "A instalação não foi concluída. Você pode tentar novamente pelo menu do Chrome.",
    installAppError: "O Chrome não conseguiu abrir a instalação. Use o menu e toque em “Instalar app” ou “Adicionar à tela inicial”.",
    salaryAdviceTab: "Salary Advice",
    address: "Endereço",
    salaryAdviceLoading: "Carregando ferramentas de Salary Advice…",
    salaryAdviceLoadError: "Não foi possível carregar os dados de Salary Advice.",
    employeeDetailsOpenError: "Não foi possível abrir os dados do funcionário.",
    businessDetailsSaveError: "Não foi possível guardar os dados da empresa.",
    hourlyRateValidation: "Introduza uma tarifa entre £0,01 e £10.000 com até duas casas decimais.",
    salaryAdviceDownloadError: "Não foi possível calcular ou baixar o Salary Advice.",
    salaryAdviceUnsupportedCharacters: "O PDF não suporta um caractere da identidade. Nenhum documento foi gerado; contacte o suporte sem alterar os dados legais.",
    salaryAdviceFontLoadError: "Não foi possível carregar a fonte segura do PDF. Nenhum documento foi gerado; tente novamente com ligação ou contacte o suporte.",
    salaryDocumentIdentityLabel: "Salary Advice · identidade do documento",
    salaryEmployeesLabel: "Salary Advice · funcionários",
    salaryEstimateLabel: "Salary Advice · estimativa",
    salaryIdentityLabel: "Salary Advice · identidade",
    payrollSummaryUnavailable: "O resumo de horas ainda não está disponível.",
    payrollProfileLoading: "Carregando o perfil para Salary Advice…",
    payrollProfileSaveError: "Não foi possível guardar o perfil para Salary Advice.",
    statusLabel: "Estado",
    legalName: "Nome legal",
    homeAddress: "Endereço residencial",
    socialSecurityNumber: "Número de Social Security",
    storedKeepPlaceholder: "Já guardado · deixe vazio para manter",
    requiredLabel: "Obrigatório",
    employeeNumberHelp: "Use A-Z, 0-9, ponto, sublinhado, barra ou hífen; o valor é guardado em maiúsculas.",
    weeklyCoverageHelp: "Todas as semanas de segunda a domingo que abrangem 2026 são mostradas. As duas semanas limítrofes ficam visíveis, mas desativadas até configurar as regras do ano adjacente.",
    adjacentRulesUnavailable: "regras do ano adjacente indisponíveis",
    accountMenu: "menu da conta",
    setupGoogleSignIn: "Configurar acesso com Google",
    googleRequestSent: "Pedido de acesso com Google enviado. Um administrador deve aprová-lo antes de usar o Google para entrar.",
    googleSignInReady: "O acesso com Google está pronto para esta conta.",
    googleSignInError: "Não foi possível concluir o acesso com Google. A sessão atual não foi alterada.",
    loadingSecureSession: "Carregando sessão segura…",
    salaryAdviceTitle: "Calcular e baixar Salary Advice",
    salaryAdviceSubtitle: "Escolha um funcionário e um período. O download cria somente o documento e não inicia pagamentos.",
    businessDetails: "Dados da empresa para o documento",
    businessDetailsHelp: "Estes são os únicos dados da empresa usados pelo documento.",
    businessName: "Nome da empresa",
    businessAddress: "Endereço da empresa",
    saveBusinessDetails: "Salvar dados do documento",
    businessDetailsSaved: "Dados do documento guardados.",
    profilesTitle: "Dados dos funcionários",
    profilesHelp: "O Salary Advice exige que os dados do funcionário estejam completos.",
    profileReady: "Dados completos",
    profileMissing: "Faltam dados",
    viewDetails: "Ver dados",
    employee: "Funcionário",
    periodType: "Tipo de período",
    weekly: "Semanal",
    monthly: "Mensal",
    selectedWeek: "Semana (segunda a domingo)",
    selectedMonth: "Mês civil",
    payDate: "Data de pagamento",
    hourlyRateAdvice: "Tarifa para este Salary Advice (£)",
    hourlyRateHelp: "Usada só neste cálculo; não é salva como tarifa padrão da empresa.",
    itisRateAdvice: "ITIS confirmado para este documento (%)",
    itisRateHelp: "Informe a percentagem inteira do aviso ITIS atual do funcionário.",
    monthlySocialSecurityStatus: "Social Security mensal",
    monthlySocialSecurityHelp: "Use 0% apenas se o cartão atual confirmar isenção da contribuição primária.",
    socialSecurityStandard: "Padrão · 6%",
    socialSecurityExempt: "Isento · 0%",
    weeklySocialSecurityAmount: "Social Security semanal confirmada (£)",
    weeklySocialSecurityHelp: "Informe o valor conferido com o acumulado salarial do mês; ele não é calculado isolando esta semana.",
    weeklySocialSecurityWarning: "A Segurança Social semanal foi confirmada pelo administrador usando o acumulado salarial do mês e deve coincidir com o aviso oficial de contribuição.",
    yearToDateGross: "Bruto tributável acumulado (£)",
    yearToDateTax: "ITIS pago acumulado (£)",
    totalsToDateHelp: "Valores confirmados que já incluem este Salary Advice; não são salvos nem inventados.",
    businessDetailsRequired: "Salve primeiro o nome e o endereço da empresa.",
    businessDetailsUnsaved: "Salve as alterações no nome ou endereço da empresa antes de gerar o PDF.",
    calculateDownload: "Calcular e baixar PDF",
    calculating: "Calculando e criando PDF…",
    downloaded: "PDF baixado",
    previewTitle: "Resumo do documento baixado",
    completedShiftsLabel: "Turnos concluídos",
    hoursLabel: "Horas",
    grossPay: "Bruto",
    itisLabel: "ITIS",
    socialSecurityLabel: "Segurança Social",
    totalDeductions: "Deduções",
    netPay: "Líquido",
    estimateNotice: "Estimativa baseada em turnos concluídos e regras de Jersey 2026; confirme com o aviso oficial.",
    noReadyProfiles: "Nenhum funcionário possui dados completos para o documento.",
    profileDetails: "Dados do funcionário",
    employeeNumber: "Número do funcionário",
    taxReference: "Referência fiscal (ITIS)",
    socialReference: "Referência da Segurança Social",
    hoursSummaryTitle: "Resumo de horas",
    hoursSummaryHelp: "Somente turnos concluídos. O administrador escolhe datas e períodos do Salary Advice.",
    thisMonth: "Este mês",
    allCompletedShiftsLabel: "Todos os turnos concluídos",
    salaryDetailsTitle: "Seus dados salariais e fiscais",
    salaryDetailsHelp: "Salve-os para o administrador gerar um Salary Advice semanal ou mensal.",
    profileSavedStatus: "Dados salvos e disponíveis",
    profileNotSavedStatus: "Dados pendentes",
    sensitiveEncrypted: "Os identificadores sensíveis são criptografados e exibidos somente quando necessários para o documento.",
    saveProfile: "Salvar perfil",
    updateProfile: "Atualizar perfil",

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
    createWorkday: "Adicionar jornada",
    createWorkdayTitle: "Criar jornada de horas",
    selectWorker: "Funcionário *",
    optionalProject: "Projeto / Obra (opcional)",
    workDescription: "Descrição da jornada *",
    workDescriptionPlaceholder: "Ex. Jornada adicionada a partir da folha de ponto aprovada do funcionário",
    saveWorkday: "Salvar Jornada",
    adjustShift: "Ajustar",
    auditAdjustment: "Ajuste de Auditoria",
    adjustShiftTimes: "Ajustar Horários do Turno",
    clockInTime: "Horário de Entrada",
    clockOutTime: "Horário de Saída",
    adjustReason: "Motivo do Ajuste *",
    adjustReasonPlaceholder: "Ex. O funcionário esqueceu de registrar a saída ao fim do expediente",
    saveAdjustment: "Salvar Ajuste",
    adminAdjustedNotice: "Horas modificadas por um administrador",
    adminCreatedNotice: "Jornada adicionada por um administrador",
    adminAdjustedReason: "Motivo",
    adminCreatedDescription: "Descrição",
    adminAdjustedAt: "Modificado em",
    adminCreatedAt: "Adicionado em",
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
