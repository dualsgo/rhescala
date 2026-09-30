/**
 * Central de chaves de persistência do Rhescala.
 * Mapeia as chaves reais utilizadas no localStorage, sessionStorage e BroadcastChannel.
 * 
 * Regra: NUNCA renomeie as strings destas chaves, pois elas representam os dados já salvos
 * nos navegadores dos usuários e nas planilhas do Google Apps Script.
 */
export const STORAGE_KEYS = {
  // Dados de escala e equipe (useLocalStorage - sincronizados com nuvem)
  employees: 'riHappyEmployeesData',
  jornadaSettings: 'riHappyJornadaSettings',
  customHolidays: 'riHappyCustomHolidays',
  deletedNationalHolidays: 'riHappyDeletedNationalHolidays',
  monthNotes: 'riHappyMonthNotes',
  trackingStart: 'riHappyTrackingStart',
  officialSnapshots: 'riHappyOfficialSnapshots',
  protectedDays: 'riHappyProtectedDays',
  sectionAssignments: 'riHappySectionAssignments',
  validatedMonths: 'riHappyValidatedMonths',
  auditLogs: 'rhescala_audit_logs',

  // Sessão de autenticação (sessionStorage)
  authSession: 'rhescala_auth_session',

  // Configuração da API GAS (localStorage)
  gasApiUrl: 'escala_gas_api_url',

  // Preferências locais de UI (useLocalPreference / localStorage)
  darkMode: 'riHappyDarkMode',
  tacticalDisplayMode: 'rhescala_tactical_display_mode',
  viewerModeType: 'rhescala_viewer_mode_type',
  viewerSelectedEmpId: 'rhescala_viewer_selected_emp_id',
  cycleBadgesMode: 'rhescala_cycle_badges_mode',
} as const;

export type StorageKey = typeof STORAGE_KEYS[keyof typeof STORAGE_KEYS];

/**
 * Nomes padronizados para canais de comunicação multi-aba (BroadcastChannel).
 */
export const BROADCAST_CHANNELS = {
  employeesSync: `sync_${STORAGE_KEYS.employees}`,
  validatedMonthsSync: `sync_${STORAGE_KEYS.validatedMonths}`,
  syncChannel: (key: string) => `sync_${key}`,
} as const;
