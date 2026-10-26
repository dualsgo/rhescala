
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useDialog } from './contexts/DialogContext';
import { useLocalStorage, useLocalPreference, useSyncStatus } from './hooks/useLocalStorage';
import { useScheduleFilters } from './hooks/useScheduleFilters';
import { 
  generateYearSchedule, 
  applyMonthUpdate, 
  applyHoursOnly,
  applyFolgasOnly,
  generateCleanMonthSchedule,
  detectScheduleDiffs,
  resolveTacticalDay, 
  calculateLunches, 
  getShiftClassification, 
  findSundayViolations, 
  isWorkingShift, 
} from './hooks/useScheduleEngine';

import { Header } from './components/Header';

import { ShiftGrid } from './components/ShiftGrid';
import { TeamView } from './components/TeamView';
import { AnalysisPanel } from './components/AnalysisPanel';
import { HolidayManager } from './components/HolidayManager';
import { DaySummaryCard } from './components/DaySummaryCard';
import { DataManager } from './components/DataManager';
import { WorkedHolidaysList } from './components/WorkedHolidaysList';
import { CleaningSchedule } from './components/CleaningSchedule';
import { PatrolSchedule } from './components/PatrolSchedule';
import { SectionManager } from './components/SectionManager';
import { EssentialActivities } from './components/EssentialActivities';
import { DailyRoutine } from './components/DailyRoutine';
import { OperationalNotices } from './components/OperationalNotices';
import { Icon } from './components/Icon';
import { Login } from './components/Login';
import { PrintableSchedule } from './components/PrintableSchedule';
import { useHolidayCredits } from './hooks/useHolidayCredits';
import { PLACEHOLDER_EMPLOYEE, PLACEHOLDER_EMPLOYEE_ID, SHIFT_HOURS, buildHolidaySet, getDefaultHourForDay, getNationalHolidays, DEFAULT_JORNADA_SETTINGS, getShortName, isEmployeeActiveInMonth, getTacticalEmoji, getTacticalLabel } from './constants';
import { Employee, MonthYear, Holiday, JornadaSettings, OfficialScheduleSnapshot, ScheduleDiffItem, TacticalDisplayMode, ProtectedDaysMap, AuditLogEntry, AuditChangeType, ShiftType } from './types';
import { HelpCenter } from './components/HelpCenter';
import { JornadaManager } from './components/JornadaManager';
import { EmployeeScheduleCard } from './components/EmployeeScheduleCard';
import { RequestManager } from './components/RequestManager';
import { InconsistencyModal } from './components/InconsistencyModal';
import { detectInconsistencies } from './components/InconsistencyPanel';
import { SyncBlockingOverlay } from './components/SyncBlockingOverlay';
import { PresetOptionsModal } from './components/PresetOptionsModal';
import { ScheduleDiffModal } from './components/ScheduleDiffModal';
import { MobileEmployerViewer } from './components/MobileEmployerViewer';
import { CreateMonthModal } from './components/CreateMonthModal';
import { DailyScheduleModulatorModal } from './components/DailyScheduleModulatorModal';
import { AuditJustificationModal, AuditImpactPreview } from './components/AuditJustificationModal';
import { MobileNavBar } from './components/MobileNavBar';
import { ScheduleSkeleton } from './components/ScheduleSkeleton';
import { migrateLegacyEmployeeData } from './src/services/scheduleMigrationService';
import { useScheduleExport } from './hooks/useScheduleExport';
import { useHolidayHandlers } from './hooks/useHolidayHandlers';
import { useScheduleCommands } from './hooks/useScheduleCommands';
import { STORAGE_KEYS } from './src/infrastructure/storage/storageKeys';
import { getAuthSession, setAuthSession, AuthSession } from './src/infrastructure/storage/sessionAuthAdapter';
import { executeManualSave, determineSaveFeedback } from './src/infrastructure/storage/persistenceCoordinator';

const App: React.FC = () => {
  const [employees, setEmployees] = useLocalStorage<Employee[]>(STORAGE_KEYS.employees, [PLACEHOLDER_EMPLOYEE]);
  const [jornadaSettings, setJornadaSettings] = useLocalStorage<JornadaSettings>(STORAGE_KEYS.jornadaSettings, DEFAULT_JORNADA_SETTINGS);
  const [showCreateMonthModal, setShowCreateMonthModal] = useState(false);
  const [createMonthTargetMY, setCreateMonthTargetMY] = useState<MonthYear | null>(null);

  const activeJornadaSettings = useMemo(() => ({
    ...DEFAULT_JORNADA_SETTINGS,
    ...jornadaSettings,
    shiftHours: {
      ...DEFAULT_JORNADA_SETTINGS.shiftHours,
      ...(jornadaSettings?.shiftHours || {}),
    },
    lunchRules: {
      ...DEFAULT_JORNADA_SETTINGS.lunchRules,
      ...(jornadaSettings?.lunchRules || {}),
    }
  }), [jornadaSettings]);

  const [customHolidays, setCustomHolidays] = useLocalStorage<Holiday[]>(STORAGE_KEYS.customHolidays, []);
  const [deletedNationalHolidays, setDeletedNationalHolidays] = useLocalStorage<string[]>(STORAGE_KEYS.deletedNationalHolidays, []);
  const [monthNotes, setMonthNotes] = useLocalStorage<Record<string, string>>(STORAGE_KEYS.monthNotes, {});
  const [trackingStartDate, setTrackingStartDate] = useLocalStorage<string>(STORAGE_KEYS.trackingStart, `${new Date().getFullYear()}-01-01`);
  const [officialSnapshots, setOfficialSnapshots] = useLocalStorage<Record<string, OfficialScheduleSnapshot>>(STORAGE_KEYS.officialSnapshots, {});
  const [protectedDaysMap, setProtectedDaysMap] = useLocalStorage<ProtectedDaysMap>(STORAGE_KEYS.protectedDays, {});
  
  const syncStatus = useSyncStatus();
  const [showHolidayManager, setShowHolidayManager] = useState(false);
  const [showDayDetail, setShowDayDetail] = useState(false);
  const [showPresetModal, setShowPresetModal] = useState(false);
  const [presetInitialEmpId, setPresetInitialEmpId] = useState<string | null>(null);
  const [editingTeamEmpId, setEditingTeamEmpId] = useState<string | null>(null);
  const [showDiffModal, setShowDiffModal] = useState(false);
  const [currentView, setCurrentView] = useState<string>('grid');
  const [currentMY, setCurrentMY] = useState<MonthYear>({ month: new Date().getMonth(), year: new Date().getFullYear() });
  const [isChangingMonth, setIsChangingMonth] = useState(false);

  const handleMonthChange = useCallback((newMY: MonthYear | ((prev: MonthYear) => MonthYear)) => {
    setIsChangingMonth(true);
    setCurrentMY(newMY);
    const timer = setTimeout(() => {
      setIsChangingMonth(false);
    }, 200);
    return () => clearTimeout(timer);
  }, []);
  const [sectionAssignments, setSectionAssignments] = useLocalStorage<Record<string, any>>(STORAGE_KEYS.sectionAssignments, {});
  const [validatedMonths, setValidatedMonths] = useLocalStorage<Record<string, boolean>>(STORAGE_KEYS.validatedMonths, {});
  const [selectedDayIdx, setSelectedDayIdx] = useState(new Date().getDate() - 1);
  const [showInconsistencyModal, setShowInconsistencyModal] = useState(false);
  // Preferências por dispositivo: NÃO sincronizam com a nuvem (evita propagar a escolha de um celular para toda a loja)
  const [viewerModeType, setViewerModeType] = useLocalPreference<'personal' | 'grid'>(STORAGE_KEYS.viewerModeType, 'personal');
  const [viewerSelectedEmpId, setViewerSelectedEmpId] = useLocalPreference<string>(STORAGE_KEYS.viewerSelectedEmpId, '');
  const [auditLogs, setAuditLogs] = useLocalStorage<AuditLogEntry[]>(STORAGE_KEYS.auditLogs, []);
  const [pendingAuditAction, setPendingAuditAction] = useState<{
    impacts: AuditImpactPreview[];
    onConfirm: (justification: string) => void;
  } | null>(null);
  const [auth, setAuth] = useState<AuthSession>(() => getAuthSession());

  const updateAuth = useCallback((newAuth: AuthSession | ((prev: AuthSession) => AuthSession)) => {
    setAuth(prev => {
      const next = typeof newAuth === 'function' ? newAuth(prev) : newAuth;
      setAuthSession(next);
      return next;
    });
  }, []);
  const [authenticatedEmployeeId, setAuthenticatedEmployeeId] = useState<string | null>(null);
  const {
    filter,
    contractFilter,
    onlyWorkingToday,
    selectedGroup,
    setFilter,
    setContractFilter,
    setOnlyWorkingToday,
    toggleOnlyWorkingToday,
    setSelectedGroup,
    clearFilters: handleClearFilters,
  } = useScheduleFilters();

  const [isDarkMode] = useLocalPreference<boolean>(STORAGE_KEYS.darkMode, false);
  const [tacticalDisplayMode, setTacticalDisplayMode] = useLocalPreference<TacticalDisplayMode>(STORAGE_KEYS.tacticalDisplayMode, 'off');
  const [densityMode, setDensityMode] = useLocalPreference<'clean' | 'audit'>('rhescala_cycle_badges_mode', 'clean');
  const { showDialog } = useDialog();
  const [waModal, setWaModal] = useState<{ show: boolean; dayIdx: number }>({ show: false, dayIdx: 0 });
  const [showHelp, setShowHelp] = useState(false);
  const [selectedEmployeeForCard, setSelectedEmployeeForCard] = useState<Employee | null>(null);
  const [employeeCardInitialTab, setEmployeeCardInitialTab] = useState<'mes' | 'atual' | 'pedidos' | 'atestado'>('mes');
  const [employeeCardInitialDate, setEmployeeCardInitialDate] = useState<string | undefined>(undefined);

  const monthKey = `${currentMY.year}-${String(currentMY.month + 1).padStart(2, '0')}`;
  const isReadOnly = auth.role === 'viewer';
  const isValidated = validatedMonths[monthKey] || false;

  useEffect(() => {
    if (isReadOnly && currentView !== 'grid') {
      setCurrentView('grid');
    }
  }, [isReadOnly, currentView]);

  

  
  
  const scheduleDiffs = useMemo(
    () => detectScheduleDiffs(officialSnapshots[monthKey], employees, currentMY),
    [officialSnapshots, employees, currentMY, monthKey]
  );

  const activeInconsistencies = useMemo(
    () => detectInconsistencies(employees, currentMY.year, currentMY.month, new Date()),
    [employees, currentMY]
  );

  const [isSaving, setIsSaving] = useState(false);
  const [isJustSaved, setIsJustSaved] = useState(false);

  const handleManualSave = useCallback(async () => {
    if (isSaving) return;
    setIsSaving(true);

    try {
      const saveResult = await executeManualSave({
        employees,
        jornadaSettings,
        customHolidays,
        deletedNationalHolidays,
        monthNotes,
        trackingStartDate,
        officialSnapshots,
        protectedDaysMap,
        sectionAssignments,
        validatedMonths,
        auditLogs
      });

      const feedback = determineSaveFeedback(saveResult);

      if (feedback.status === 'full_success') {
        setIsJustSaved(true);
        setTimeout(() => setIsJustSaved(false), 3000);
      } else {
        showDialog({
          title: feedback.title || 'Aviso de Sincronização',
          message: feedback.message || '',
          type: 'alert'
        });
      }
    } catch (err) {
      console.error('Erro no salvamento local:', err);
      showDialog({
        title: 'Erro de Salvamento Local',
        message: 'Não foi possível concluir o salvamento local das alterações. O armazenamento do navegador pode estar indisponível ou esgotado. Tente novamente.',
        type: 'alert'
      });
    } finally {
      setIsSaving(false);
    }
  }, [
    employees,
    jornadaSettings,
    customHolidays,
    deletedNationalHolidays,
    monthNotes,
    trackingStartDate,
    officialSnapshots,
    protectedDaysMap,
    sectionAssignments,
    validatedMonths,
    auditLogs,
    isSaving,
    showDialog
  ]);

  // Atalho de teclado global Ctrl+S / Cmd+S
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (auth.role === 'admin') {
          handleManualSave();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleManualSave, auth.role]);

  // Listeners globais para eventos de conflito e falha persistente de sincronização
  useEffect(() => {
    const handleSyncConflict = async (event: Event) => {
      const customEvent = event as CustomEvent<{ key: string; resolve: (useCloud: boolean) => void }>;
      if (!customEvent.detail || typeof customEvent.detail.resolve !== 'function') return;

      const { key, resolve } = customEvent.detail;
      const keyLabel = key === STORAGE_KEYS.employees ? 'Colaboradores / Escala' : key;

      const userChoseCloud = await showDialog({
        title: 'Conflito de Sincronização',
        message: `Os dados de "${keyLabel}" foram alterados na planilha remota enquanto você possuía modificações locais pendentes. Deseja carregar a versão da planilha (descartando as alterações locais deste computador) ou manter as alterações locais?`,
        type: 'confirm',
        confirmText: 'Usar Dados da Planilha',
        cancelText: 'Manter Alterações Locais'
      });

      resolve(Boolean(userChoseCloud));
    };

    const handleSyncPersistentError = (event: Event) => {
      const customEvent = event as CustomEvent<{ key: string; data?: unknown }>;
      const key = customEvent.detail?.key || 'dados';
      const keyLabel = key === STORAGE_KEYS.employees ? 'Colaboradores / Escala' : key;

      showDialog({
        title: 'Falha na Sincronização em Nuvem',
        message: `Não foi possível enviar os dados de "${keyLabel}" para a planilha após várias tentativas. As alterações continuam salvas com segurança no cache local deste computador. Verifique a conexão com a internet ou realize um backup no Painel de Dados.`,
        type: 'alert'
      });
    };

    window.addEventListener('sync-conflict', handleSyncConflict);
    window.addEventListener('sync-persistent-error', handleSyncPersistentError);

    return () => {
      window.removeEventListener('sync-conflict', handleSyncConflict);
      window.removeEventListener('sync-persistent-error', handleSyncPersistentError);
    };
  }, [showDialog]);

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleGoToToday = useCallback(() => {
    const now = new Date();
    setCurrentMY({ month: now.getMonth(), year: now.getFullYear() });
    setSelectedDayIdx(now.getDate() - 1);
    setCurrentView('grid');
    setIsMobileMenuOpen(false);
  }, []);
  
  const onToggleValidation = useCallback(async () => {
    const newVal = !isValidated;
    const monthName = new Date(currentMY.year, currentMY.month).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

    if (newVal) {
      // Oficializar
      const hasExistingSnapshot = !!officialSnapshots[monthKey];
      let createSnapshot = true;

      if (hasExistingSnapshot) {
        const choice = await showDialog({
          title: 'Oficializar Escala',
          message: `A escala de ${monthName} já possui um registro oficial anterior gravado. Deseja atualizar a linha de base oficial (novo snapshot) ou manter o registro oficial anterior para histórico de auditoria?`,
          type: 'confirm'
        });
        createSnapshot = !!choice;
      } else {
        const confirmed = await showDialog({
          title: 'Oficializar Escala',
          message: `Deseja oficializar a escala de ${monthName}? Ela ficará visível para toda a equipe e uma cópia oficial congelada será registrada para auditoria de alterações.`,
          type: 'confirm'
        });
        if (!confirmed) return;
      }

      setValidatedMonths(prev => ({ ...prev, [monthKey]: true }));

      if (createSnapshot) {
        const newSnapshot: OfficialScheduleSnapshot = {
          validatedAt: new Date().toISOString(),
          monthKey,
          shifts: {},
          dailyHours: {},
          tacticalPositions: {}
        };
        employees.forEach(emp => {
          if (emp.shifts[monthKey]) newSnapshot.shifts[emp.id] = [...emp.shifts[monthKey]];
          if (emp.dailyHours[monthKey]) newSnapshot.dailyHours[emp.id] = [...emp.dailyHours[monthKey]];
          if (emp.tacticalPositions?.[monthKey] && newSnapshot.tacticalPositions) newSnapshot.tacticalPositions[emp.id] = [...emp.tacticalPositions[monthKey]];
        });
        setOfficialSnapshots(prev => ({ ...prev, [monthKey]: newSnapshot }));
      }
    } else {
      // Retornar para rascunho
      const confirmed = await showDialog({
        title: 'Retornar para Rascunho',
        message: 'A escala voltará ao modo rascunho e ficará oculta para a equipe. O histórico oficial de auditoria será preservado. Continuar?',
        type: 'confirm'
      });
      if (confirmed) {
        setValidatedMonths(prev => ({ ...prev, [monthKey]: false }));
      }
    }
  }, [isValidated, monthKey, currentMY, setValidatedMonths, showDialog, officialSnapshots, setOfficialSnapshots, employees]);

  // Sync validatedMonths to GAS
  // We'll handle this in the useEffect that syncs all data, or add a specific one.
  // Actually, DataManager should handle it, but for real-time we can add it here.

  const holidayCredits = useHolidayCredits(
    employees, 
    customHolidays, 
    currentMY.year, 
    trackingStartDate, 
    deletedNationalHolidays, 
    validatedMonths
  );

  const pendingRequestsCount = useMemo(() => {
    let count = 0;
    employees.forEach(emp => {
      if (!emp.isHidden && emp.status === 'active') {
        count += (emp.requests || []).filter(r => r.status === 'pending').length;
      }
    });
    return count;
  }, [employees]);

  const onUpdateEmployee = useCallback((empId: string, data: Partial<Employee>) => {
    setEmployees(prev => prev.map(emp => emp.id === empId ? { ...emp, ...data } : emp));
  }, [setEmployees]);

  const sundayViolations = useMemo(() => findSundayViolations(employees, currentMY), [employees, currentMY]);

  const onDeleteEmployee = useCallback((empId: string) => {
    setEmployees(prev => prev.filter(emp => emp.id !== empId));
  }, [setEmployees]);

  const onAddEmployee = useCallback((name: string, isYoung: boolean, courseDay: string, cargo: any, birthday: string, contractType?: 'CLT' | 'Sazonal', jornada?: '6x1' | '5x2', hiredAt?: string, firedAt?: string, secondaryRole?: 'Caixa' | 'Pacote' | 'Vendas' | 'Apoio') => {
    let preferredDayOff = '';
    if (cargo === 'Estoquista' || cargo === 'Estoque') preferredDayOff = 'Domingo';
    if (cargo === 'Aprendiz') preferredDayOff = 'Sábado';

    const newEmp: Employee = {
      ...PLACEHOLDER_EMPLOYEE,
      id: Math.random().toString(36).substring(2, 9),
      name,
      isYoungApprentice: isYoung,
      courseDay: isYoung ? courseDay : undefined,
      contractType: contractType || 'CLT',
      jornada: jornada || '6x1',
      primaryRole: cargo,
      secondaryRole: secondaryRole || undefined,
      cargo,
      role: cargo,
      birthday,
      hiredAt: hiredAt || undefined,
      firedAt: firedAt || undefined,
      preferredDayOff,
      status: 'active',
      shifts: {},
      dailyHours: {},
      dailyAssignedRoles: {},
      tacticalPositions: {},
    };
    setEmployees(prev => [...prev.filter(e => e.id !== PLACEHOLDER_EMPLOYEE_ID), newEmp]);
  }, [setEmployees]);

  const { onAddHoliday, onRemoveHoliday, onEditHoliday } = useHolidayHandlers({
    setCustomHolidays,
    setDeletedNationalHolidays,
  });

  const [isEditable, setIsEditable] = useState(false);
  const [allowRetroactive, setAllowRetroactive] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  
  const canGoNext = useMemo(() => {
    const today = new Date();
    const targetDate = new Date(currentMY.year, currentMY.month, 1);
    const currentMonthDate = new Date(today.getFullYear(), today.getMonth(), 1);
    
    // Admins can go to next month (to prepare it)
    // Viewers are locked to current/past months, unless next month is validated
    if (isReadOnly) {
      if (targetDate < currentMonthDate) return true;
      if (targetDate.getTime() === currentMonthDate.getTime()) {
        const nextDate = new Date(currentMY.year, currentMY.month + 1, 1);
        const nextKey = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}`;
        return validatedMonths[nextKey] === true;
      }
      return false;
    }
    
    const limitDate = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    return targetDate < limitDate;
  }, [currentMY, isReadOnly, validatedMonths]);

  // Dark mode effect
  React.useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode);
  }, [isDarkMode]);

  // Migration: Abbreviate ESTOQUE to ESTQ in existing data
  useEffect(() => {
    const { employees: migrated, hasChanged } = migrateLegacyEmployeeData(employees);
    if (hasChanged) {
      setEmployees(migrated);
    }
  }, [employees, setEmployees]);


  const {
    handleUpdateShift,
    handleUpdateShifts,
    onUpdateEmployeeDailyHour,
    onUpdateTacticalPosition,
  } = useScheduleCommands({
    employees,
    setEmployees,
    currentMY,
    monthKey,
    isReadOnly,
    isValidated,
    setAuditLogs,
    setPendingAuditAction,
    customHolidays,
    deletedNationalHolidays,
    jornadaSettings,
  });

  const {
    handleShareApoioWhatsApp,
    handleExportScheduleCsv,
    handleExportDayImage,
  } = useScheduleExport({
    employees,
    currentMY,
    jornadaSettings: activeJornadaSettings,
    customHolidays,
    deletedNationalHolidays,
    tacticalDisplayMode,
    showDialog,
  });

  const handleApplyGranularPresets = useCallback((options: {
    scope: 'all' | 'single';
    targetEmpId?: string;
    applyMode: 'hours_only' | 'folgas_only' | 'full';
  }) => {
    const { scope, targetEmpId, applyMode } = options;
    const empId = scope === 'single' ? targetEmpId : undefined;

    if (applyMode === 'hours_only') {
      const updatedHours = applyHoursOnly(employees, currentMY.year, currentMY.month, empId, customHolidays, deletedNationalHolidays, activeJornadaSettings);
      setEmployees(prev => prev.map(emp => {
        if (updatedHours[emp.id]) {
          return { ...emp, dailyHours: { ...emp.dailyHours, [monthKey]: updatedHours[emp.id] } };
        }
        return emp;
      }));
      showDialog({ title: 'Sucesso', message: 'Horários padrão recalculados com sucesso! Todas as folgas e turnos foram preservados.' });
    } else if (applyMode === 'folgas_only') {
      const updatedShifts = applyFolgasOnly(employees, currentMY.year, currentMY.month, empId, customHolidays, deletedNationalHolidays, activeJornadaSettings, {});
      setEmployees(prev => prev.map(emp => {
        if (updatedShifts[emp.id]) {
          return { ...emp, shifts: { ...emp.shifts, [monthKey]: updatedShifts[emp.id] } };
        }
        return emp;
      }));
      showDialog({ title: 'Sucesso', message: 'Folgas e rotação de domingos recalculadas com sucesso respeitando os dias protegidos/sazonais!' });

    } else if (applyMode === 'full') {
      const updatedData = applyMonthUpdate(employees, currentMY.year, currentMY.month, customHolidays, deletedNationalHolidays, activeJornadaSettings, {}, 'suggested_retro', empId);
      setEmployees(prev => prev.map(emp => {
        if (empId && emp.id !== empId) return emp;
        if (updatedData[emp.id]) {
          return {
            ...emp,
            shifts: { ...emp.shifts, [monthKey]: updatedData[emp.id].shifts },
            dailyHours: { ...emp.dailyHours, [monthKey]: updatedData[emp.id].hours },
            decisionReasons: {
              ...(emp.decisionReasons || {}),
              [monthKey]: updatedData[emp.id].decisionReasons || {}
            },
            dailyAssignedRoles: {
              ...(emp.dailyAssignedRoles || {}),
              [monthKey]: updatedData[emp.id].dailyAssignedRoles || {}
            }
          };
        }
        return emp;
      }));
      showDialog({ title: 'Sucesso', message: 'Redefinição geral completa aplicada com sucesso respeitando regras sazonais!' });
    }
  }, [employees, currentMY, monthKey, customHolidays, deletedNationalHolidays, activeJornadaSettings, {}, setEmployees, showDialog]);

  const handleApplyFolgas = (targetMY = currentMY, targetKey = monthKey) => {
    const updatedData = applyMonthUpdate(employees, targetMY.year, targetMY.month, customHolidays, deletedNationalHolidays, jornadaSettings, {});
    setEmployees(prev => prev.map(emp => {
      if (updatedData[emp.id]) {
        return {
          ...emp,
          shifts: { ...emp.shifts, [targetKey]: updatedData[emp.id].shifts },
          dailyHours: { ...emp.dailyHours, [targetKey]: updatedData[emp.id].hours },
          decisionReasons: {
            ...(emp.decisionReasons || {}),
            [targetKey]: updatedData[emp.id].decisionReasons || {}
          },
          dailyAssignedRoles: {
            ...(emp.dailyAssignedRoles || {}),
            [targetKey]: updatedData[emp.id].dailyAssignedRoles || {}
          }
        };
      }
      return emp;
    }));
  };

  const handleSortearDomingo = (targetMY = currentMY, targetKey = monthKey, skipConfirm = false) => {
    const perform = () => {
      const updatedData = applyMonthUpdate(employees, targetMY.year, targetMY.month, customHolidays, deletedNationalHolidays, jornadaSettings, {});
      setEmployees(prev => prev.map(emp => {
        if (updatedData[emp.id]) {
          return {
            ...emp,
            shifts: { ...emp.shifts, [targetKey]: updatedData[emp.id].shifts },
            dailyHours: { ...emp.dailyHours, [targetKey]: updatedData[emp.id].hours },
            decisionReasons: {
              ...(emp.decisionReasons || {}),
              [targetKey]: updatedData[emp.id].decisionReasons || {}
            },
            dailyAssignedRoles: {
              ...(emp.dailyAssignedRoles || {}),
              [targetKey]: updatedData[emp.id].dailyAssignedRoles || {}
            }
          };
        }
        return emp;
      }));
    };

    if (skipConfirm) {
      perform();
    } else {
      showDialog({ title: 'Sortear Domingos', message: 'Deseja realizar o sorteio dos domingos para este mês?', type: 'confirm' }).then(ok => {
        if (ok) perform();
      });
    }
  };

  

  

  const handleSaveDayPositions = useCallback((dayIdx: number, posMap: Record<string, string>) => {
    setEmployees(prev => prev.map(emp => {
      if (posMap[emp.id] !== undefined) {
        const existing = [...(emp.tacticalPositions?.[monthKey] || [])];
        existing[dayIdx] = posMap[emp.id];
        return {
          ...emp,
          tacticalPositions: {
            ...emp.tacticalPositions,
            [monthKey]: existing
          }
        };
      }
      return emp;
    }));
  }, [monthKey]);

  const handleShareWhatsApp = useCallback((dayIdx: number) => {
    setSelectedDayIdx(dayIdx);
    setWaModal({ show: true, dayIdx });
  }, []);



  const handleCreateMonth = () => {
    const nextDate = new Date(currentMY.year, currentMY.month + 1, 1);
    const nextMY = { month: nextDate.getMonth(), year: nextDate.getFullYear() };
    setCreateMonthTargetMY(nextMY);
    setShowCreateMonthModal(true);
  };

  const handleConfirmCreateMonth = (mode: 'suggested_retro' | 'all_working') => {
    if (!createMonthTargetMY) return;
    const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    const targetMonthName = monthNames[createMonthTargetMY.month];

    const updatedEmployees = generateCleanMonthSchedule(
      employees,
      createMonthTargetMY.year,
      createMonthTargetMY.month,
      customHolidays,
      deletedNationalHolidays,
      activeJornadaSettings,
      {},
      mode
    );
    setEmployees(updatedEmployees);
    setCurrentMY(createMonthTargetMY);
    showDialog({
      title: 'Sucesso!',
      message: mode === 'all_working'
        ? `Escala base 100% trabalhada de ${targetMonthName}/${createMonthTargetMY.year} gerada com sucesso! Você pode lançar as folgas manualmente no grid.`
        : `Escala de ${targetMonthName}/${createMonthTargetMY.year} criada com sucesso e validada com verificação retroativa CLT!`,
      type: 'alert'
    });
  };

  const handleOpenEmployeeCard = useCallback(async (
    emp: Employee, 
    tab: 'mes' | 'atual' | 'pedidos' | 'atestado' = 'mes', 
    initialDate?: string
  ) => {
    // Administrador acessa diretamente qualquer cartão
    if (auth.role === 'admin') {
      setEmployeeCardInitialTab(tab);
      setEmployeeCardInitialDate(initialDate);
      setSelectedEmployeeForCard(emp);
      return;
    }

    // Se já autenticado para este colaborador nesta sessão
    if (authenticatedEmployeeId === emp.id) {
      setEmployeeCardInitialTab(tab);
      setEmployeeCardInitialDate(initialDate);
      setSelectedEmployeeForCard(emp);
      return;
    }

    // Solicitar senha pessoal do colaborador
    const password = await showDialog({
      type: 'prompt',
      title: `🔒 Acesso Individual: ${emp.name}`,
      message: 'Digite sua senha pessoal de colaborador para acessar seu cartão individual e dados de solicitações:'
    });

    if (typeof password === 'string') {
      const entered = password.trim();
      const expected = (emp.password || '1234').trim();
      if (entered === expected) {
        setAuthenticatedEmployeeId(emp.id);
        setEmployeeCardInitialTab(tab);
        setEmployeeCardInitialDate(initialDate);
        setSelectedEmployeeForCard(emp);
      } else {
        showDialog({ 
          title: 'Senha Incorreta', 
          message: 'A senha informada não confere. Caso tenha esquecido, solicite a redefinição ao seu gerente.', 
          type: 'alert' 
        });
      }
    }
  }, [auth.role, authenticatedEmployeeId, showDialog]);

  if (!auth.isAuthenticated) {
    return <Login onLogin={(role) => updateAuth({ isAuthenticated: true, role })} />;
  }

  return (
    <>
      <div className={`h-screen flex flex-col overflow-hidden ${isDarkMode ? 'dark bg-zinc-950 text-zinc-100' : 'bg-zinc-50 text-zinc-900'} transition-colors font-sans print:hidden`}>
        <Header 
              currentView={currentView}
              currentMY={currentMY}
              filter={filter}
              onViewChange={setCurrentView}
              onMonthChange={handleMonthChange}
              onFilterChange={setFilter}
              onShareWhatsApp={() => handleShareWhatsApp(selectedDayIdx)}
              onShareApoioWhatsApp={() => handleShareApoioWhatsApp(selectedDayIdx)}
              syncStatus={syncStatus}
              selectedDayIdx={selectedDayIdx}
              isReadOnly={auth.role === 'viewer'}
              isEditable={isEditable}
              onToggleEdit={() => setIsEditable(!isEditable)}
              allowRetroactive={allowRetroactive}
              onToggleRetroactive={() => setAllowRetroactive(!allowRetroactive)}
              onPrint={() => window.print()}
              onCreateMonth={handleCreateMonth}
              onApplyFolgas={handleApplyFolgas}
              onSortearDomingo={handleSortearDomingo}
              showNotes={showNotes}
              onToggleNotes={() => setShowNotes(!showNotes)}
              onLogout={() => updateAuth({ isAuthenticated: false, role: 'viewer' })}
              onSwitchRole={() => {
                if (auth.role === 'admin') {
                  updateAuth(prev => ({ ...prev, role: 'viewer' }));
                } else {
                  // If switching from viewer to admin, we must logout to force password entry
                  updateAuth({ isAuthenticated: false, role: 'viewer' });
                }
              }}
              onShowHelp={() => setShowHelp(true)}
              canGoNext={canGoNext}
              sundayViolations={sundayViolations}
              isValidated={isValidated}
              onToggleValidation={onToggleValidation}
              pendingRequestsCount={pendingRequestsCount}
              inconsistencyCount={activeInconsistencies.length}
              onOpenInconsistencyModal={() => setShowInconsistencyModal(true)}
              diffCount={scheduleDiffs.length}
              onOpenDiffModal={() => setShowDiffModal(true)}
              onOpenPresetModal={() => {
                setPresetInitialEmpId(null);
                setShowPresetModal(true);
              }}
              tacticalDisplayMode={tacticalDisplayMode}
              onToggleTacticalDisplayMode={(mode) => { if (mode) setTacticalDisplayMode(mode); else setTacticalDisplayMode(prev => prev === "off" ? "positions" : prev === "positions" ? "roles" : "off"); }}
              onManualSave={handleManualSave}
              isSaving={isSaving}
              isJustSaved={isJustSaved}
              isMobileMenuOpen={isMobileMenuOpen}
              onToggleMobileMenu={setIsMobileMenuOpen}
              onExportCsv={handleExportScheduleCsv}
              contractFilter={contractFilter}
              onContractFilterChange={setContractFilter}
              onlyWorkingToday={onlyWorkingToday}
              onToggleOnlyWorkingToday={() => setOnlyWorkingToday(prev => !prev)}
              selectedGroup={selectedGroup}
              onSelectedGroupChange={setSelectedGroup}
              onClearFilters={handleClearFilters}
              densityMode={densityMode}
              onToggleDensityMode={() => setDensityMode(prev => prev === 'clean' ? 'audit' : 'clean')}
            />

       <main className="flex-1 overflow-y-auto p-2 sm:p-4 pb-24 lg:pb-4">
         {(() => {
           const dateStr = `${currentMY.year}-${String(currentMY.month + 1).padStart(2, '0')}-${String(selectedDayIdx + 1).padStart(2, '0')}`;
           const isHoliday = buildHolidaySet(currentMY.year, customHolidays, deletedNationalHolidays).has(dateStr);
           const isSunday = new Date(currentMY.year, currentMY.month, selectedDayIdx + 1).getDay() === 0;
             const selectedDayResolvedPositions = resolveTacticalDay(
               employees.filter(e => !e.isHidden && e.status === 'active'),
               monthKey,
               selectedDayIdx,
               isHoliday,
               isSunday,
               jornadaSettings
             );

           switch (currentView) {
             case 'grid': {
                if (isChangingMonth) {
                  return <ScheduleSkeleton mode="auto" />;
                }
               if (isReadOnly && !isValidated) {
                 return (
                   <div className="h-full flex flex-col items-center justify-center p-8 text-center animate-fade-in">
                     <div className="w-24 h-24 bg-amber-100 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 rounded-[2.5rem] flex items-center justify-center mb-8 shadow-xl shadow-amber-500/10">
                       <Icon name="construction" className="text-5xl" />
                     </div>
                     <h3 className="text-2xl font-black text-zinc-800 dark:text-zinc-100 uppercase tracking-tight mb-3">Escala em Construção</h3>
                     <p className="text-zinc-500 dark:text-zinc-400 font-bold text-sm max-w-sm leading-relaxed">
                       O gerente ainda está preparando a escala para este mês. 
                       Assim que for oficializada, você poderá visualizá-la aqui.
                     </p>
                     <div className="mt-10 flex gap-4">
                        <button onClick={() => setCurrentMY(prev => prev.month === 0 ? { month: 11, year: prev.year - 1 } : { ...prev, month: prev.month - 1 })} className="px-6 py-3 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 rounded-xl font-bold hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors">Voltar</button>
                     </div>
                   </div>
                 );
                }

                const renderShiftGrid = () => (
                  <ShiftGrid
                    employees={employees}
                    currentMY={currentMY}
                    selectedDayIdx={selectedDayIdx}
                    today={new Date()}
                    customHolidays={customHolidays}
                    holidayCredits={holidayCredits}
                    filter={filter}
                    onFilterChange={setFilter}
                    contractFilter={contractFilter}
                    onContractFilterChange={setContractFilter}
                    onlyWorkingToday={onlyWorkingToday}
                    onToggleOnlyWorkingToday={() => setOnlyWorkingToday(prev => !prev)}
                    selectedGroup={selectedGroup}
                    onSelectedGroupChange={setSelectedGroup}
                    isReadOnly={isReadOnly}
                    isEditable={isEditable}
                    allowRetroactive={allowRetroactive}
                    showNotes={showNotes}
                    onCloseNotes={() => setShowNotes(false)}
                    resolvedPositions={selectedDayResolvedPositions}
                    onSelectDay={setSelectedDayIdx}
                    tacticalDisplayMode={tacticalDisplayMode}
                    onToggleTacticalDisplayMode={(mode) => { if (mode) setTacticalDisplayMode(mode); else setTacticalDisplayMode(prev => prev === "off" ? "positions" : prev === "positions" ? "roles" : "off"); }}
                    onUpdateShift={handleUpdateShift}
                    onUpdateShifts={handleUpdateShifts}
                    onUpdateEmployeeDailyHour={onUpdateEmployeeDailyHour}
                    onUpdateTacticalPosition={onUpdateTacticalPosition}
                    onShareWhatsApp={handleShareWhatsApp}
                    onOpenDayDetail={(idx) => {
                      setSelectedDayIdx(idx);
                      setShowDayDetail(true);
                    }}
                    onResetMonth={handleCreateMonth}
                    onApplyFolgas={handleApplyFolgas}
                    onSortearDomingo={handleSortearDomingo}
                    onOpenAnalysis={() => setCurrentView('analysis')}
                    onShowHolidayManager={() => setCurrentView('feriados')}
                    onNextMonth={() => handleMonthChange(prev => prev.month === 11 ? { month: 0, year: prev.year + 1 } : { ...prev, month: prev.month + 1 })}
                    onPrevMonth={() => handleMonthChange(prev => prev.month === 0 ? { month: 11, year: prev.year - 1 } : { ...prev, month: prev.month - 1 })}
                    monthNotes={monthNotes[monthKey] || ''}
                    onUpdateMonthNotes={(text) => {
                      if (isReadOnly) return;
                      setMonthNotes(prev => ({ ...prev, [monthKey]: text }));
                    }}
                    jornadaSettings={jornadaSettings}
                    diffs={scheduleDiffs}
                    onOpenPresetForEmployee={(empId) => {
                      setPresetInitialEmpId(empId);
                      setShowPresetModal(true);
                    }}
                    onExportCsv={isReadOnly ? undefined : handleExportScheduleCsv}
                    highlightedEmpId=""
                    onHighlightEmp={(empId) => {
                      setViewerSelectedEmpId(empId);
                    }}
                    onOpenEmployeeCard={handleOpenEmployeeCard}
                    densityMode={densityMode}
                    onToggleDensityMode={() => setDensityMode(prev => prev === 'clean' ? 'audit' : 'clean')}
                    protectedDaysConfig={protectedDaysMap[monthKey]}
                    onEditEmployee={(empId) => {
                      setEditingTeamEmpId(empId);
                      setCurrentView('team');
                    }}
                  />
                );

                if (isReadOnly && viewerModeType === 'personal') {
                  return (
                    <>
                      <div className="lg:hidden flex-1 overflow-y-auto px-2 pt-2">
                        <MobileEmployerViewer
                          employees={employees}
                          currentMY={currentMY}
                          customHolidays={customHolidays}
                          deletedNationalHolidays={deletedNationalHolidays}
                          jornadaSettings={jornadaSettings}
                          holidayCredits={holidayCredits}
                          selectedEmployeeId={viewerSelectedEmpId}
                          onSelectEmployee={(empId) => setViewerSelectedEmpId(empId)}
                          onOpenEmployeeCard={handleOpenEmployeeCard}
                          onSwitchToFullGrid={() => setViewerModeType('grid')}
                          onMonthChange={handleMonthChange}
                          onUpdateEmployee={onUpdateEmployee}
                          tacticalDisplayMode={tacticalDisplayMode}
                          onToggleTacticalDisplayMode={(mode) => { if (mode) setTacticalDisplayMode(mode); else setTacticalDisplayMode(prev => prev === "off" ? "positions" : prev === "positions" ? "roles" : "off"); }}
                          isLoading={isChangingMonth}
                        />
                      </div>
                      <div className="hidden lg:block h-full">
                        {renderShiftGrid()}
                      </div>
                    </>
                  );
                }

                return renderShiftGrid();
              }
              case 'daily': {
                return (
                  <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-zinc-50 dark:bg-zinc-950 flex flex-col items-center">
                    <div className="max-w-4xl w-full space-y-4">
                      <div className="flex items-center justify-between bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-3 rounded-2xl shadow-sm">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setSelectedDayIdx(prev => Math.max(0, prev - 1))}
                            disabled={selectedDayIdx === 0}
                            className="min-h-[38px] min-w-[38px] p-2 rounded-xl border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-30 disabled:pointer-events-none transition-all flex items-center justify-center"
                            title="Dia anterior"
                            aria-label="Dia anterior"
                          >
                            <Icon name="chevron_left" className="text-base" />
                          </button>
                          <div className="px-3 py-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-xl text-center">
                            <span className="text-xs font-black uppercase text-zinc-800 dark:text-zinc-100 tabular-nums">
                              Dia {String(selectedDayIdx + 1).padStart(2, '0')}/{String(currentMY.month + 1).padStart(2, '0')}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setSelectedDayIdx(prev => Math.min(new Date(currentMY.year, currentMY.month + 1, 0).getDate() - 1, prev + 1))}
                            disabled={selectedDayIdx >= new Date(currentMY.year, currentMY.month + 1, 0).getDate() - 1}
                            className="min-h-[38px] min-w-[38px] p-2 rounded-xl border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-30 disabled:pointer-events-none transition-all flex items-center justify-center"
                            title="Próximo dia"
                            aria-label="Próximo dia"
                          >
                            <Icon name="chevron_right" className="text-base" />
                          </button>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleShareWhatsApp(selectedDayIdx)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-sm active:scale-95"
                            title="Compartilhar escala do dia via WhatsApp"
                          >
                            <Icon name="campaign" className="text-sm" />
                            <span>WhatsApp do Dia</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setCurrentView('grid')}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-bold text-zinc-700 dark:text-zinc-300 transition-all"
                          >
                            <Icon name="grid_view" className="text-sm text-orange-500" />
                            <span>Voltar à Grade</span>
                          </button>
                        </div>
                      </div>

                      <DaySummaryCard
                        selectedDayIdx={selectedDayIdx}
                        employees={employees}
                        currentMY={currentMY}
                        customHolidays={customHolidays}
                        jornadaSettings={jornadaSettings}
                      />
                    </div>
                  </div>
                );
              }
              case 'analysis':
               if (isReadOnly) {
                 return (
                   <div className="h-full flex flex-col items-center justify-center p-8 text-center animate-fade-in">
                     <div className="w-16 h-16 bg-amber-100 dark:bg-amber-950/40 text-amber-600 rounded-2xl flex items-center justify-center mb-4 shadow-sm">
                       <Icon name="lock" className="text-3xl" />
                     </div>
                     <h3 className="text-lg font-black text-zinc-800 dark:text-zinc-100 mb-1">Acesso Exclusivo da Gestão</h3>
                     <p className="text-zinc-500 dark:text-zinc-400 text-xs max-w-sm mb-6">
                       O painel analítico de cobertura de equipe é reservado aos administradores da loja.
                     </p>
                     <button onClick={() => setCurrentView('grid')} className="px-5 py-2.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-xl font-bold text-xs text-zinc-700 dark:text-zinc-200 transition-colors">
                       Voltar para a Escala
                     </button>
                   </div>
                 );
               }
               return (
                 <AnalysisPanel 
                   employees={employees} 
                   currentMY={currentMY} 
                   customHolidays={customHolidays} 
                   jornadaSettings={jornadaSettings}
                   onClose={() => setCurrentView('grid')} 
                   onUpdateShift={(empId, dayIdx, shift) => {
                     if (isReadOnly) return;
                     setEmployees(prev => prev.map(emp => {
                       if (emp.id !== empId) return emp;
                       const sfs = [...(emp.shifts[monthKey] || [])];
                       sfs[dayIdx] = shift;
                       return { ...emp, shifts: { ...emp.shifts, [monthKey]: sfs } };
                     }));
                   }}
                   onUpdateHour={(empId, dayIdx, hour) => {
                     if (isReadOnly) return;
                     setEmployees(prev => prev.map(emp => {
                       if (emp.id !== empId) return emp;
                       const hrs = [...(emp.dailyHours[monthKey] || [])];
                       hrs[dayIdx] = hour;
                       return { ...emp, dailyHours: { ...emp.dailyHours, [monthKey]: hrs } };
                     }));
                   }}
                 />
               );
             case 'team':
               return (
                 <TeamView 
                   employees={employees} 
                   isReadOnly={isReadOnly}
                   onUpdateEmployee={onUpdateEmployee}
                   onDeleteEmployee={onDeleteEmployee}
                   onAddEmployee={onAddEmployee}
                   onClose={() => setCurrentView('grid')}
                   initialEditingEmpId={editingTeamEmpId}
                   onClearInitialEditingEmp={() => setEditingTeamEmpId(null)}
                 />
               );
             case 'data':
               return (
                 <DataManager 
                   syncStatus={syncStatus} 
                   employees={employees} 
                   setEmployees={setEmployees} 
                   validatedMonths={validatedMonths}
                   setValidatedMonths={setValidatedMonths}
                   officialSnapshots={officialSnapshots}
                   setOfficialSnapshots={setOfficialSnapshots}
                   jornadaSettings={jornadaSettings}
                   setJornadaSettings={setJornadaSettings}
                   customHolidays={customHolidays}
                   setCustomHolidays={setCustomHolidays}
                   deletedNationalHolidays={deletedNationalHolidays}
                   setDeletedNationalHolidays={setDeletedNationalHolidays}
                   monthNotes={monthNotes}
                   setMonthNotes={setMonthNotes}
                   trackingStartDate={trackingStartDate}
                   setTrackingStartDate={setTrackingStartDate}
                   sectionAssignments={sectionAssignments}
                   setSectionAssignments={setSectionAssignments}
                   protectedDaysMap={protectedDaysMap}
                   setProtectedDaysMap={setProtectedDaysMap}
                   auditLogs={auditLogs}
                   setAuditLogs={setAuditLogs}
                   onExportScheduleCsv={handleExportScheduleCsv}
                   onClose={() => setCurrentView('grid')} 
                   role={auth.role}
                 />
               );

             case 'feriados':
               return (
                 <div className="max-w-xl mx-auto mt-6">
                   <HolidayManager 
                     year={currentMY.year}
                     customHolidays={customHolidays}
                     deletedNationalHolidays={deletedNationalHolidays}
                     isReadOnly={isReadOnly}
                     onAdd={onAddHoliday}
                     onRemove={onRemoveHoliday}
                     onEdit={onEditHoliday}
                     trackingStartDate={trackingStartDate}
                     onUpdateTrackingStartDate={setTrackingStartDate}
                     onViewWorkedHolidays={() => setCurrentView('worked-holidays')}
                     onClose={() => setCurrentView('grid')} 
                   />
                 </div>
               );
             case 'worked-holidays':
               return (
                 <WorkedHolidaysList
                   employees={employees}
                   currentMY={currentMY}
                   customHolidays={customHolidays}
                   holidayCredits={holidayCredits}
                   deletedNationalHolidays={deletedNationalHolidays}
                   validatedMonths={validatedMonths}
                   trackingStartDate={trackingStartDate}
                   onUpdateTrackingStartDate={setTrackingStartDate}
                   onClose={() => setCurrentView('grid')}
                 />
               );
             case 'cleaning':
               return (
                 <CleaningSchedule
                   employees={employees}
                   currentMY={currentMY}
                   customHolidays={customHolidays}
                   deletedNationalHolidays={deletedNationalHolidays}
                   onClose={() => setCurrentView('grid')}
                 />
               );
             case 'patrol':
               return (
                 <PatrolSchedule
                   employees={employees}
                   currentMY={currentMY}
                   customHolidays={customHolidays}
                   jornadaSettings={jornadaSettings}
                   onClose={() => setCurrentView('grid')}
                 />
               );
             case 'sections':
               return (
                 <SectionManager
                   employees={employees}
                   currentMY={currentMY}
                   assignments={sectionAssignments[monthKey] || { Q1: {}, Q2: {} }}
                   onUpdateAssignments={(newData) => setSectionAssignments(prev => ({ ...prev, [monthKey]: newData }))}
                   jornadaSettings={jornadaSettings}
                   onClose={() => setCurrentView('grid')}
                 />
               );
             /*
             case 'activities':
               return (
                 <EssentialActivities
                   currentMY={currentMY}
                   customHolidays={customHolidays}
                   onClose={() => setCurrentView('grid')}
                 />
               );
             case 'routine':
               return (
                 <DailyRoutine
                   currentMY={currentMY}
                   customHolidays={customHolidays}
                   onClose={() => setCurrentView('grid')}
                 />
               );
             case 'notices':
               return (
                 <OperationalNotices
                   onClose={() => setCurrentView('grid')}
                 />
               );
             */
             case 'jornada':
               return (
                 <div className="max-w-4xl mx-auto mt-6">
                   <JornadaManager 
                     settings={jornadaSettings}
                     onUpdate={setJornadaSettings}
                     onClose={() => setCurrentView('grid')}
                     isReadOnly={isReadOnly}
                   />
                 </div>
               );
             case 'requests':
                if (isReadOnly) {
                  return (
                    <div className="h-full flex flex-col items-center justify-center p-8 text-center animate-fade-in">
                      <div className="w-16 h-16 bg-rose-100 dark:bg-rose-950/40 text-rose-600 rounded-2xl flex items-center justify-center mb-4 shadow-sm">
                        <Icon name="lock" className="text-3xl" />
                      </div>
                      <h3 className="text-lg font-black text-zinc-800 dark:text-zinc-100 mb-1">Privacidade Protegida</h3>
                      <p className="text-zinc-500 dark:text-zinc-400 text-xs max-w-sm mb-6">
                        O mural geral de solicitações é exclusivo para a gestão da loja. Para consultar e enviar seus próprios pedidos com privacidade, acesse seu Cartão Individual.
                      </p>
                      <button onClick={() => setCurrentView('grid')} className="px-5 py-2.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-xl font-bold text-xs text-zinc-700 dark:text-zinc-200 transition-colors">
                        Voltar para a Escala
                      </button>
                    </div>
                  );
                }
                return (
                 <RequestManager
                   employees={employees}
                   currentMY={currentMY}
                   onUpdateEmployee={onUpdateEmployee}
                   isReadOnly={isReadOnly}
                   onClose={() => setCurrentView('grid')}
                 />
               );
             default:
               return null;
           }
         })()}
       </main>


       {/* Feriados Modal removed in favor of view */}

       {showHelp && <HelpCenter onClose={() => setShowHelp(false)} />}
       

       {showCreateMonthModal && createMonthTargetMY && (
         <CreateMonthModal
           isOpen={showCreateMonthModal}
           onClose={() => setShowCreateMonthModal(false)}
           targetMY={createMonthTargetMY}
           onConfirm={handleConfirmCreateMonth}
         />
       )}

       {selectedEmployeeForCard && (
         <EmployeeScheduleCard 
           employees={employees}
           employee={employees.find(e => e.id === selectedEmployeeForCard.id) || selectedEmployeeForCard}
           currentMY={currentMY}
           customHolidays={customHolidays}
           holidayCredits={holidayCredits[selectedEmployeeForCard.id] || []}
           onUpdateEmployee={onUpdateEmployee}
           isAdmin={auth.role === 'admin'}
           isValidated={isValidated}
           initialTab={employeeCardInitialTab}
           initialDate={employeeCardInitialDate}
           auditLogs={auditLogs}
           onLockSession={() => {
             setAuthenticatedEmployeeId(null);
             setSelectedEmployeeForCard(null);
           }}
           onEditEmployeeData={(empId) => {
             setSelectedEmployeeForCard(null);
             setEditingTeamEmpId(empId);
             setCurrentView('team');
           }}
           onClose={() => setSelectedEmployeeForCard(null)}
         />
       )}

       {/* Day Detail Modal */}
       {showDayDetail && (
         <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-zinc-900/40 dark:bg-zinc-950/60 backdrop-blur-sm animate-fade-in">
           <div className="bg-white dark:bg-zinc-900 rounded-[2.5rem] w-full max-w-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 flex flex-col max-h-[90vh] overflow-hidden">
             <div className="px-8 py-6 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between sticky top-0 bg-white dark:bg-zinc-900 z-10 no-print">
               <div className="flex items-center gap-4">
                 <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-xl flex items-center justify-center">
                   <Icon name="event_available" className="text-xl" />
                 </div>
                 <div>
                   <h4 className="text-lg font-black text-zinc-800 dark:text-zinc-100 uppercase tracking-tight">Escala do Dia</h4>
                   <div className="flex items-center gap-2">
                     <button 
                       onClick={() => setSelectedDayIdx(prev => Math.max(0, prev - 1))}
                       className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-zinc-400"
                     >
                       <Icon name="chevron_left" />
                     </button>
                     <p className="text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">{selectedDayIdx + 1}/{currentMY.month + 1}/{currentMY.year}</p>
                     <button 
                       onClick={() => setSelectedDayIdx(prev => Math.min(30, prev + 1))}
                       className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-zinc-400"
                     >
                       <Icon name="chevron_right" />
                     </button>
                   </div>
                 </div>
               </div>
               <div className="flex items-center gap-2">
                 <button 
                   onClick={() => handleExportDayImage('day-detail-screenshot', selectedDayIdx)}
                   className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-md active:scale-95"
                   title="Baixar Imagem"
                 >
                   <Icon name="download" className="text-sm" /> Baixar Imagem
                 </button>
                 <button 
                   onClick={() => handleShareWhatsApp(selectedDayIdx)}
                   className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-md active:scale-95"
                 >
                   <Icon name="content_copy" className="text-sm" /> Copiar Texto
                 </button>
                 <button onClick={() => setShowDayDetail(false)} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors text-zinc-400">
                   <Icon name="close" />
                 </button>
               </div>
             </div>
             <div className="flex-1 overflow-y-auto p-8 custom-scrollbar bg-white dark:bg-zinc-900">
               <div id="day-detail-screenshot" className="bg-white dark:bg-zinc-900">
                 <DaySummaryCard 
                   selectedDayIdx={selectedDayIdx} 
                   employees={employees} 
                   currentMY={currentMY} 
                   customHolidays={customHolidays} 
                   jornadaSettings={jornadaSettings}
                 />
               </div>
             </div>
           </div>
         </div>
       )}

       {/* Modulador da Escala Diária (WhatsApp) */}
       {waModal.show && (
         <DailyScheduleModulatorModal
           isOpen={waModal.show}
           onClose={() => setWaModal(prev => ({ ...prev, show: false }))}
           dayIdx={waModal.dayIdx}
           currentMY={currentMY}
           employees={employees}
           customHolidays={customHolidays}
           deletedNationalHolidays={deletedNationalHolidays}
           jornadaSettings={activeJornadaSettings}
           tacticalDisplayMode={tacticalDisplayMode}
           onSaveDayPositions={handleSaveDayPositions}
         />
       )}

       {/* Floating Manager Toolbar for Mobile */}
       {!isReadOnly && currentView === 'grid' && (
         <div className="hidden lg:flex fixed bottom-6 left-1/2 -tranzinc-x-1/2 z-[100] items-center gap-2 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-xl border border-zinc-200 dark:border-zinc-800 rounded-full p-2 shadow-2xl shadow-black/20">
            <button 
             onClick={() => setIsEditable(!isEditable)}
             className={`flex items-center gap-2 px-4 py-3 rounded-2xl text-[11px] font-black uppercase transition-all ${isEditable ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300'}`}
            >
              <Icon name={isEditable ? 'save' : 'edit'} className="text-base" />
              {isEditable ? 'Salvar' : 'Editar'}
            </button>
            
            <div className="w-px h-8 bg-zinc-200 dark:bg-zinc-800 mx-1" />
            
            <button 
             onClick={() => handleShareWhatsApp(selectedDayIdx)}
             className="flex items-center justify-center w-12 h-12 rounded-2xl bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 active:scale-90 transition-all"
             title="Copiar WhatsApp"
            >
              <Icon name="content_copy" className="text-xl" />
            </button>
            
            <button 
             onClick={() => window.print()}
             className="flex items-center justify-center w-12 h-12 rounded-2xl bg-zinc-900 dark:bg-zinc-700 text-white shadow-lg shadow-zinc-900/20 active:scale-90 transition-all"
             title="Imprimir"
            >
              <Icon name="print" className="text-xl" />
            </button>
         </div>
       )}
       </div>

        {showInconsistencyModal && (
          <InconsistencyModal
            isOpen={showInconsistencyModal}
            onClose={() => setShowInconsistencyModal(false)}
            employees={employees}
            currentMY={currentMY}
            today={new Date()}
            onSelectDay={(idx) => {
              setSelectedDayIdx(idx);
              setCurrentView('grid');
            }}
            onApplyFix={(empId, dayIdx, shift) => {
              handleUpdateShift(empId, dayIdx, shift);
            }}
            onApplyBulkFixes={(updates) => {
              handleUpdateShifts(updates);
            }}
          />
        )}

        {showPresetModal && (
          <PresetOptionsModal
            isOpen={showPresetModal}
            onClose={() => setShowPresetModal(false)}
            employees={employees}
            currentMY={currentMY}
            initialEmployeeId={presetInitialEmpId}
            onApply={handleApplyGranularPresets}
          />
        )}

        {showDiffModal && (
          <ScheduleDiffModal
            isOpen={showDiffModal}
            onClose={() => setShowDiffModal(false)}
            snapshot={officialSnapshots[monthKey]}
            diffs={scheduleDiffs}
            currentMY={currentMY}
            auditLogs={auditLogs}
            onSelectDay={(idx) => {
              setSelectedDayIdx(idx);
              setCurrentView('grid');
            }}
          />
        )}

        {pendingAuditAction && (
          <AuditJustificationModal
            isOpen={!!pendingAuditAction}
            impacts={pendingAuditAction.impacts}
            onConfirm={pendingAuditAction.onConfirm}
            onCancel={() => setPendingAuditAction(null)}
          />
        )}

        <PrintableSchedule 
          employees={employees} 
          currentMY={currentMY} 
          customHolidays={customHolidays} 
          monthNotes={monthNotes[monthKey] || ''}
          jornadaSettings={jornadaSettings}
        />

        {/* Barra de Navegação Inferior Mobile (< lg) */}
        <MobileNavBar
          currentView={currentView}
          onViewChange={(v) => {
            setCurrentView(v);
            setIsMobileMenuOpen(false);
          }}
          pendingRequestsCount={pendingRequestsCount}
          inconsistencyCount={activeInconsistencies.length}
          onOpenMenu={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          onGoToToday={handleGoToToday}
          isReadOnly={isReadOnly}
          viewerModeType={viewerModeType}
          onToggleViewerMode={() => setViewerModeType(prev => prev === 'personal' ? 'grid' : 'personal')}
        />

        <SyncBlockingOverlay syncStatus={syncStatus} />
      </>
    );
};

export default App;
