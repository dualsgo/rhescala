import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useDialog } from '../../contexts/DialogContext';
import { useLocalStorage, useLocalPreference, useSyncStatus } from '../../hooks/useLocalStorage';
import { useScheduleFilters } from '../../hooks/useScheduleFilters';
import {
  applyMonthUpdate,
  applyHoursOnly,
  applyFolgasOnly,
  generateCleanMonthSchedule,
  detectScheduleDiffs,
  resolveTacticalDay,
  optimizeProtectedDays,
} from '../../hooks/useScheduleEngine';

import { ShiftGrid } from '../../components/ShiftGrid';
import { TeamView } from '../../components/TeamView';
import { HolidayManager } from '../../components/HolidayManager';
import { JornadaManager } from '../../components/JornadaManager';
import { InconsistencyModal } from '../../components/InconsistencyModal';
import { detectInconsistencies } from '../../components/InconsistencyPanel';
import { PresetOptionsModal } from '../../components/PresetOptionsModal';
import { ProtectedDaysModal } from '../../components/ProtectedDaysModal';
import { CreateMonthModal } from '../../components/CreateMonthModal';
import { SyncBlockingOverlay } from '../../components/SyncBlockingOverlay';
import { Icon } from '../../components/Icon';
import { Login } from './LoginDrive';
import { DataManager } from './DataManagerDrive';

import { useHolidayCredits } from '../../hooks/useHolidayCredits';
import { useHolidayHandlers } from '../../hooks/useHolidayHandlers';
import { useScheduleCommands } from '../../hooks/useScheduleCommands';
import { migrateLegacyEmployeeData } from '../../src/services/scheduleMigrationService';
import { STORAGE_KEYS } from '../../src/infrastructure/storage/storageKeys';
import { getAuthSession, setAuthSession, AuthSession } from '../../src/infrastructure/storage/sessionAuthAdapter';
import { executeManualSave, determineSaveFeedback } from '../../src/infrastructure/storage/persistenceCoordinator';
import { downloadScheduleCsv } from '../../src/utils/exportScheduleCsv';
import { generateOperationalNotice } from '../../src/services/operationalNoticeService';
import { copyToClipboard } from '../../src/utils/clipboard';
import {
  PLACEHOLDER_EMPLOYEE,
  PLACEHOLDER_EMPLOYEE_ID,
  buildHolidaySet,
  DEFAULT_JORNADA_SETTINGS,
  getDefaultProtectedDays,
  isEmployeeHiddenInMonth,
} from '../../constants';
import {
  Employee,
  MonthYear,
  Holiday,
  JornadaSettings,
  OfficialScheduleSnapshot,
  TacticalDisplayMode,
  ProtectedDaysConfig,
  ProtectedDaysMap,
  AuditLogEntry,
} from '../../types';

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

export const AppDriveLite: React.FC = () => {
  const { showDialog } = useDialog();
  const syncStatus = useSyncStatus();

  // Estados persistidos no Google Drive
  const [employees, setEmployees] = useLocalStorage<Employee[]>(STORAGE_KEYS.employees, [PLACEHOLDER_EMPLOYEE]);
  const [jornadaSettings, setJornadaSettings] = useLocalStorage<JornadaSettings>(STORAGE_KEYS.jornadaSettings, DEFAULT_JORNADA_SETTINGS);
  const [customHolidays, setCustomHolidays] = useLocalStorage<Holiday[]>(STORAGE_KEYS.customHolidays, []);
  const [deletedNationalHolidays, setDeletedNationalHolidays] = useLocalStorage<string[]>(STORAGE_KEYS.deletedNationalHolidays, []);
  const [monthNotes, setMonthNotes] = useLocalStorage<Record<string, string>>(STORAGE_KEYS.monthNotes, {});
  const [trackingStartDate, setTrackingStartDate] = useLocalStorage<string>(STORAGE_KEYS.trackingStart, `${new Date().getFullYear()}-01-01`);
  const [officialSnapshots, setOfficialSnapshots] = useLocalStorage<Record<string, OfficialScheduleSnapshot>>(STORAGE_KEYS.officialSnapshots, {});
  const [protectedDaysMap, setProtectedDaysMap] = useLocalStorage<ProtectedDaysMap>(STORAGE_KEYS.protectedDays, {});
  const [validatedMonths, setValidatedMonths] = useLocalStorage<Record<string, boolean>>(STORAGE_KEYS.validatedMonths, {});
  const [auditLogs, setAuditLogs] = useLocalStorage<AuditLogEntry[]>(STORAGE_KEYS.auditLogs, []);

  // Preferências visuais locais
  const [isDarkMode, setIsDarkMode] = useLocalPreference<boolean>(STORAGE_KEYS.darkMode, false);
  const [tacticalDisplayMode, setTacticalDisplayMode] = useLocalPreference<TacticalDisplayMode>(STORAGE_KEYS.tacticalDisplayMode, 'roles');
  const [densityMode, setDensityMode] = useLocalPreference<'clean' | 'audit'>('rhescala_cycle_badges_mode', 'clean');

  // Navegação e autenticação
  const [auth, setAuth] = useState<AuthSession>(() => getAuthSession());
  const updateAuth = useCallback((next: AuthSession | ((prev: AuthSession) => AuthSession)) => {
    setAuth((prev) => {
      const resolved = typeof next === 'function' ? next(prev) : next;
      setAuthSession(resolved);
      return resolved;
    });
  }, []);

  const [currentView, setCurrentView] = useState<'grid' | 'team' | 'jornada' | 'feriados' | 'data'>('grid');
  const [currentMY, setCurrentMY] = useState<MonthYear>({ month: new Date().getMonth(), year: new Date().getFullYear() });
  const [selectedDayIdx, setSelectedDayIdx] = useState<number>(new Date().getDate() - 1);
  const [isEditable, setIsEditable] = useState<boolean>(true);
  const [showNotes, setShowNotes] = useState<boolean>(false);
  const [editingTeamEmpId, setEditingTeamEmpId] = useState<string | null>(null);
  const [highlightedEmpId, setHighlightedEmpId] = useState<string>('');

  // Modais de lógica
  const [showCreateMonthModal, setShowCreateMonthModal] = useState(false);
  const [createMonthTargetMY, setCreateMonthTargetMY] = useState<MonthYear | null>(null);
  const [showProtectedModal, setShowProtectedModal] = useState(false);
  const [showPresetModal, setShowPresetModal] = useState(false);
  const [presetInitialEmpId, setPresetInitialEmpId] = useState<string | null>(null);
  const [showInconsistencyModal, setShowInconsistencyModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const {
    filter,
    contractFilter,
    onlyWorkingToday,
    selectedGroup,
    setFilter,
    setContractFilter,
    setOnlyWorkingToday,
    setSelectedGroup,
  } = useScheduleFilters();

  const activeJornadaSettings = useMemo<JornadaSettings>(() => ({
    ...DEFAULT_JORNADA_SETTINGS,
    ...jornadaSettings,
    shiftHours: {
      ...DEFAULT_JORNADA_SETTINGS.shiftHours,
      ...(jornadaSettings?.shiftHours || {}),
    },
    lunchRules: {
      ...DEFAULT_JORNADA_SETTINGS.lunchRules,
      ...(jornadaSettings?.lunchRules || {}),
    },
  }), [jornadaSettings]);

  const monthKey = `${currentMY.year}-${String(currentMY.month + 1).padStart(2, '0')}`;
  const isReadOnly = auth.role === 'viewer';
  const isValidated = Boolean(validatedMonths[monthKey]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode);
  }, [isDarkMode]);

  useEffect(() => {
    if (isReadOnly && currentView !== 'grid') {
      setCurrentView('grid');
    }
  }, [isReadOnly, currentView]);

  useEffect(() => {
    const maxDayIdx = new Date(currentMY.year, currentMY.month + 1, 0).getDate() - 1;
    setSelectedDayIdx((prev) => Math.min(Math.max(0, prev), Math.max(0, maxDayIdx)));
  }, [currentMY.year, currentMY.month]);

  useEffect(() => {
    const { employees: migrated, hasChanged } = migrateLegacyEmployeeData(employees);
    if (hasChanged) setEmployees(migrated);
  }, [employees, setEmployees]);

  const holidayCredits = useHolidayCredits(
    employees,
    customHolidays,
    currentMY.year,
    trackingStartDate,
    deletedNationalHolidays,
    validatedMonths
  );

  const { onAddHoliday, onRemoveHoliday, onEditHoliday } = useHolidayHandlers({
    setCustomHolidays,
    setDeletedNationalHolidays,
  });

  // Na versão enxuta focada em lógica/grade, edições pós-oficialização aplicam direto sem modal pesado
  const handleDirectAuditBypass = useCallback((action: { onConfirm: (j: string) => void } | null) => {
    if (action) action.onConfirm('Ajuste direto na grade');
  }, []);

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
    isValidated: false, // Permite edição fluida pelo gestor
    setAuditLogs,
    setPendingAuditAction: handleDirectAuditBypass as any,
    customHolidays,
    deletedNationalHolidays,
    jornadaSettings: activeJornadaSettings,
  });

  const activeInconsistencies = useMemo(
    () => detectInconsistencies(employees, currentMY.year, currentMY.month, new Date()),
    [employees, currentMY]
  );

  const scheduleDiffs = useMemo(
    () => detectScheduleDiffs(officialSnapshots[monthKey], employees, currentMY),
    [officialSnapshots, employees, currentMY, monthKey]
  );

  const activeProtectedDays = useMemo<ProtectedDaysConfig>(
    () => protectedDaysMap[monthKey] ?? getDefaultProtectedDays(currentMY.month),
    [protectedDaysMap, monthKey, currentMY.month]
  );

  // Salvamento manual imediato (Ctrl+S ou botão)
  const handleManualSave = useCallback(async () => {
    if (isSaving || isReadOnly) return;
    setIsSaving(true);
    try {
      const saveResult = await executeManualSave({
        employees,
        jornadaSettings: activeJornadaSettings,
        customHolidays,
        deletedNationalHolidays,
        monthNotes,
        trackingStartDate,
        officialSnapshots,
        protectedDaysMap,
        sectionAssignments: {},
        validatedMonths,
        auditLogs,
      });
      const feedback = determineSaveFeedback(saveResult);
      if (feedback.status !== 'full_success') {
        showDialog({ title: feedback.title || 'Aviso', message: feedback.message || '', type: 'alert' });
      }
    } finally {
      setIsSaving(false);
    }
  }, [
    isSaving, isReadOnly, employees, activeJornadaSettings, customHolidays,
    deletedNationalHolidays, monthNotes, trackingStartDate, officialSnapshots,
    protectedDaysMap, validatedMonths, auditLogs, showDialog,
  ]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleManualSave();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleManualSave]);

  // Operações de Equipe
  const onUpdateEmployee = useCallback((empId: string, data: Partial<Employee>) => {
    setEmployees((prev) => prev.map((emp) => (emp.id === empId ? { ...emp, ...data } : emp)));
  }, [setEmployees]);

  const onDeleteEmployee = useCallback((empId: string) => {
    setEmployees((prev) => prev.filter((emp) => emp.id !== empId));
  }, [setEmployees]);

  const onAddEmployee = useCallback((
    name: string,
    isYoung: boolean,
    courseDay: string,
    cargo: any,
    birthday: string,
    contractType?: 'CLT' | 'Sazonal',
    jornada?: '6x1' | '5x2',
    hiredAt?: string,
    firedAt?: string,
    secondaryRole?: 'Caixa' | 'Pacote' | 'Vendas' | 'Apoio'
  ) => {
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
    setEmployees((prev) => [...prev.filter((e) => e.id !== PLACEHOLDER_EMPLOYEE_ID), newEmp]);
  }, [setEmployees]);

  // Operações de Lógica de Escala
  const handleCreateMonth = useCallback(() => {
    const nextDate = new Date(currentMY.year, currentMY.month + 1, 1);
    setCreateMonthTargetMY({ month: nextDate.getMonth(), year: nextDate.getFullYear() });
    setShowCreateMonthModal(true);
  }, [currentMY]);

  const handleConfirmCreateMonth = useCallback((mode: 'suggested_retro' | 'all_working') => {
    if (!createMonthTargetMY) return;
    const targetKey = `${createMonthTargetMY.year}-${String(createMonthTargetMY.month + 1).padStart(2, '0')}`;
    const updated = generateCleanMonthSchedule(
      employees,
      createMonthTargetMY.year,
      createMonthTargetMY.month,
      customHolidays,
      deletedNationalHolidays,
      activeJornadaSettings,
      protectedDaysMap[targetKey],
      mode
    );
    setEmployees(updated);
    setCurrentMY(createMonthTargetMY);
    showDialog({
      title: 'Escala Criada',
      message: `Mês ${MONTH_NAMES[createMonthTargetMY.month]}/${createMonthTargetMY.year} gerado com sucesso!`,
      type: 'alert',
    });
  }, [createMonthTargetMY, employees, customHolidays, deletedNationalHolidays, activeJornadaSettings, protectedDaysMap, setEmployees, showDialog]);

  const handleApplyGranularPresets = useCallback((options: {
    scope: 'all' | 'single';
    targetEmpId?: string;
    applyMode: 'hours_only' | 'folgas_only' | 'full';
  }) => {
    const empId = options.scope === 'single' ? options.targetEmpId : undefined;

    if (options.applyMode === 'hours_only') {
      const updatedHours = applyHoursOnly(employees, currentMY.year, currentMY.month, empId, customHolidays, deletedNationalHolidays, activeJornadaSettings);
      setEmployees((prev) => prev.map((emp) => (updatedHours[emp.id] ? { ...emp, dailyHours: { ...emp.dailyHours, [monthKey]: updatedHours[emp.id] } } : emp)));
      showDialog({ title: 'Horários Aplicados', message: 'Horários padrão recalculados preservando folgas.' });
    } else if (options.applyMode === 'folgas_only') {
      const updatedShifts = applyFolgasOnly(employees, currentMY.year, currentMY.month, empId, customHolidays, deletedNationalHolidays, activeJornadaSettings, protectedDaysMap[monthKey]);
      setEmployees((prev) => prev.map((emp) => (updatedShifts[emp.id] ? { ...emp, shifts: { ...emp.shifts, [monthKey]: updatedShifts[emp.id] } } : emp)));
      showDialog({ title: 'Folgas Recalculadas', message: 'Folgas e rotação de domingos recalculadas conforme CLT e dias protegidos.' });
    } else {
      const updatedData = applyMonthUpdate(employees, currentMY.year, currentMY.month, customHolidays, deletedNationalHolidays, activeJornadaSettings, protectedDaysMap[monthKey], 'suggested_retro', empId);
      setEmployees((prev) => prev.map((emp) => {
        if (empId && emp.id !== empId) return emp;
        if (!updatedData[emp.id]) return emp;
        return {
          ...emp,
          shifts: { ...emp.shifts, [monthKey]: updatedData[emp.id].shifts },
          dailyHours: { ...emp.dailyHours, [monthKey]: updatedData[emp.id].hours },
          decisionReasons: { ...(emp.decisionReasons || {}), [monthKey]: updatedData[emp.id].decisionReasons || {} },
          dailyAssignedRoles: { ...(emp.dailyAssignedRoles || {}), [monthKey]: updatedData[emp.id].dailyAssignedRoles || {} },
        };
      }));
      showDialog({ title: 'Escala Recalculada', message: 'Turnos, folgas, horários e funções aplicados com sucesso!' });
    }
  }, [employees, currentMY, monthKey, customHolidays, deletedNationalHolidays, activeJornadaSettings, protectedDaysMap, setEmployees, showDialog]);

  const handleSortearDomingo = useCallback(async () => {
    const ok = await showDialog({
      title: 'Revezamento de Domingos',
      message: 'Recalcular o revezamento de domingos e folgas deste mês respeitando o limite CLT?',
      type: 'confirm',
    });
    if (!ok) return;
    handleApplyGranularPresets({ scope: 'all', applyMode: 'full' });
  }, [showDialog, handleApplyGranularPresets]);

  const handleToggleEmployeeVisibilityInMonth = useCallback((empId: string) => {
    setEmployees((prev) =>
      prev.map((emp) => {
        if (emp.id !== empId) return emp;
        const currentlyHidden = isEmployeeHiddenInMonth(emp, monthKey);
        if (currentlyHidden) {
          const nextHiddenMonths = { ...(emp.hiddenMonths || {}) };
          delete nextHiddenMonths[monthKey];
          return {
            ...emp,
            isHidden: false,
            hiddenMonths: nextHiddenMonths,
          };
        } else {
          return {
            ...emp,
            hiddenMonths: {
              ...(emp.hiddenMonths || {}),
              [monthKey]: true,
            },
          };
        }
      })
    );
  }, [monthKey, setEmployees]);

  const handleToggleValidation = useCallback(async () => {
    const nextVal = !isValidated;
    setValidatedMonths((prev) => ({ ...prev, [monthKey]: nextVal }));
    if (nextVal) {
      const snap: OfficialScheduleSnapshot = { validatedAt: new Date().toISOString(), monthKey, shifts: {}, dailyHours: {}, tacticalPositions: {} };
      employees.forEach((emp) => {
        if (emp.shifts[monthKey]) snap.shifts[emp.id] = [...emp.shifts[monthKey]];
        if (emp.dailyHours[monthKey]) snap.dailyHours[emp.id] = [...emp.dailyHours[monthKey]];
      });
      setOfficialSnapshots((prev) => ({ ...prev, [monthKey]: snap }));
    }
  }, [isValidated, monthKey, employees, setValidatedMonths, setOfficialSnapshots]);

  const handleCopyDayWhatsApp = useCallback(async (dayIdx: number) => {
    const text = generateOperationalNotice({
      dayIdx,
      currentMY,
      employees,
      customHolidays,
      deletedNationalHolidays,
      tacticalDisplayMode,
      jornadaSettings: activeJornadaSettings,
    });
    const ok = await copyToClipboard(text);
    await showDialog({
      title: ok ? 'Copiado para WhatsApp!' : 'Aviso',
      message: ok
        ? `Resumo operacional do dia ${dayIdx + 1}/${currentMY.month + 1} copiado para a área de transferência.`
        : 'Não foi possível copiar automaticamente.',
    });
  }, [currentMY, employees, customHolidays, deletedNationalHolidays, tacticalDisplayMode, activeJornadaSettings, showDialog]);

  if (!auth.isAuthenticated) {
    return <Login onLogin={(role) => updateAuth({ isAuthenticated: true, role })} />;
  }

  const dateStr = `${currentMY.year}-${String(currentMY.month + 1).padStart(2, '0')}-${String(selectedDayIdx + 1).padStart(2, '0')}`;
  const isHoliday = buildHolidaySet(currentMY.year, customHolidays, deletedNationalHolidays).has(dateStr);
  const isSunday = new Date(currentMY.year, currentMY.month, selectedDayIdx + 1).getDay() === 0;
  const resolvedPositions = resolveTacticalDay(
    employees.filter((e) => !isEmployeeHiddenInMonth(e, monthKey) && e.status === 'active'),
    monthKey,
    selectedDayIdx,
    isHoliday,
    isSunday,
    activeJornadaSettings
  );

  return (
    <div className={`h-screen flex flex-col overflow-hidden ${isDarkMode ? 'dark bg-zinc-950 text-zinc-100' : 'bg-zinc-50 text-zinc-900'} font-sans`}>
      {/* ─── CABEÇALHO ENXUTO: NAVEGAÇÃO + LÓGICAS + CONFIGURAÇÕES ─── */}
      <header className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 px-3 py-2.5 shrink-0 z-30">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* Esquerda: Marca + Seletor de Mês */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-orange-500 text-white flex items-center justify-center font-black shadow-sm">
              <Icon name="calendar_month" className="text-lg" />
            </div>
            <span className="font-black text-sm tracking-tight hidden sm:inline">RHESCALA</span>

            <div className="flex items-center bg-zinc-100 dark:bg-zinc-800 rounded-xl p-0.5 ml-1">
              <button
                onClick={() => setCurrentMY((p) => (p.month === 0 ? { month: 11, year: p.year - 1 } : { month: p.month - 1, year: p.year }))}
                className="p-1.5 hover:bg-white dark:hover:bg-zinc-700 rounded-lg transition-colors"
                title="Mês anterior"
              >
                <Icon name="chevron_left" className="text-base" />
              </button>
              <span className="px-2.5 text-xs font-black uppercase tracking-wider min-w-[115px] text-center">
                {MONTH_NAMES[currentMY.month]} {currentMY.year}
              </span>
              <button
                onClick={() => setCurrentMY((p) => (p.month === 11 ? { month: 0, year: p.year + 1 } : { month: p.month + 1, year: p.year }))}
                className="p-1.5 hover:bg-white dark:hover:bg-zinc-700 rounded-lg transition-colors"
                title="Próximo mês"
              >
                <Icon name="chevron_right" className="text-base" />
              </button>
            </div>

            {!isReadOnly && (
              <button
                onClick={handleCreateMonth}
                className="px-2.5 py-1.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-[11px] font-black uppercase tracking-wider flex items-center gap-1 shadow-sm"
                title="Gerar próximo mês com regras CLT"
              >
                <Icon name="add_circle" className="text-sm" />
                <span className="hidden md:inline">Novo Mês</span>
              </button>
            )}
          </div>

          {/* Centro: Abas Principais (Grade e Configurações) */}
          {!isReadOnly && (
            <nav className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl overflow-x-auto">
              {[
                { id: 'grid', label: 'Grade', icon: 'grid_on' },
                { id: 'team', label: 'Equipe', icon: 'groups' },
                { id: 'jornada', label: 'Jornada', icon: 'schedule' },
                { id: 'feriados', label: 'Feriados', icon: 'celebration' },
                { id: 'data', label: 'Drive & Sistema', icon: 'cloud_sync' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setCurrentView(tab.id as any)}
                  className={`px-2.5 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider flex items-center gap-1 transition-all ${
                    currentView === tab.id
                      ? 'bg-white dark:bg-zinc-900 text-orange-600 dark:text-orange-400 shadow-sm'
                      : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                  }`}
                >
                  <Icon name={tab.icon} className="text-sm" />
                  <span>{tab.label}</span>
                </button>
              ))}
            </nav>
          )}

          {/* Direita: Ferramentas de Lógica + Status Drive + Sair */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {!isReadOnly && currentView === 'grid' && (
              <>
                <button
                  onClick={() => {
                    setPresetInitialEmpId(null);
                    setShowPresetModal(true);
                  }}
                  className="px-2.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-black uppercase tracking-wider flex items-center gap-1"
                  title="Aplicar Folgas, Horários ou Escala Completa"
                >
                  <Icon name="auto_awesome" className="text-sm" />
                  <span className="hidden xl:inline">Motor / Presets</span>
                </button>

                <button
                  onClick={() => setShowProtectedModal(true)}
                  className="px-2.5 py-1.5 rounded-xl bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 hover:bg-amber-500/25 text-[11px] font-black uppercase tracking-wider flex items-center gap-1"
                  title="Configurar Dias Protegidos e Picos"
                >
                  <Icon name="shield" className="text-sm" />
                  <span className="hidden xl:inline">Protegidos</span>
                </button>

                <button
                  onClick={() => setShowNotes((v) => !v)}
                  className={`px-2.5 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wider flex items-center gap-1 border ${
                    showNotes
                      ? 'bg-amber-500 text-white border-amber-600'
                      : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700'
                  }`}
                  title="Observações do Mês"
                >
                  <Icon name="sticky_note_2" className="text-sm" />
                  <span className="hidden 2xl:inline">Notas</span>
                </button>

                <button
                  onClick={() => setShowInconsistencyModal(true)}
                  className={`px-2.5 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wider flex items-center gap-1 border ${
                    activeInconsistencies.length > 0
                      ? 'bg-rose-500 text-white border-rose-600 animate-pulse'
                      : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30'
                  }`}
                  title="Auditoria e Correção Automática CLT"
                >
                  <Icon name={activeInconsistencies.length > 0 ? 'warning' : 'verified'} className="text-sm" />
                  <span>{activeInconsistencies.length} CLT</span>
                </button>

                <button
                  onClick={() => setIsEditable((v) => !v)}
                  className={`px-2.5 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wider flex items-center gap-1 border ${
                    isEditable
                      ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 border-transparent'
                      : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700'
                  }`}
                  title="Habilitar/Bloquear edição direta nas células"
                >
                  <Icon name={isEditable ? 'lock_open' : 'lock'} className="text-sm" />
                  <span className="hidden sm:inline">{isEditable ? 'Editável' : 'Travado'}</span>
                </button>

                <button
                  onClick={handleToggleValidation}
                  className={`px-2.5 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wider flex items-center gap-1 border ${
                    isValidated
                      ? 'bg-emerald-600 text-white border-emerald-700'
                      : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700'
                  }`}
                  title="Alternar entre Rascunho e Escala Oficial (visível para Viewer)"
                >
                  <Icon name={isValidated ? 'check_circle' : 'pending'} className="text-sm" />
                  <span className="hidden md:inline">{isValidated ? 'Oficial' : 'Rascunho'}</span>
                </button>
              </>
            )}

            {!isReadOnly && (
              <button
                onClick={handleManualSave}
                disabled={isSaving}
                className="p-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-emerald-500/20 text-zinc-700 dark:text-zinc-300 flex items-center gap-1 px-2 text-[11px] font-bold"
                title={`Status Drive: ${syncStatus.state} (Clique ou Ctrl+S para salvar agora)`}
              >
                <Icon
                  name={syncStatus.state === 'syncing' || isSaving ? 'sync' : syncStatus.state === 'error' ? 'cloud_off' : 'cloud_done'}
                  className={`text-base ${
                    syncStatus.state === 'syncing' || isSaving
                      ? 'text-blue-500 animate-spin'
                      : syncStatus.state === 'error'
                      ? 'text-rose-500'
                      : 'text-emerald-500'
                  }`}
                />
              </button>
            )}

            <button
              onClick={() => setIsDarkMode((d) => !d)}
              className="p-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700"
              title="Alternar Tema Claro/Escuro"
            >
              <Icon name={isDarkMode ? 'light_mode' : 'dark_mode'} className="text-base" />
            </button>

            <button
              onClick={() => updateAuth({ isAuthenticated: false, role: 'viewer' })}
              className="p-1.5 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20"
              title="Sair"
            >
              <Icon name="logout" className="text-base" />
            </button>
          </div>
        </div>
      </header>

      {/* ─── CONTEÚDO PRINCIPAL ─── */}
      <main className="flex-1 overflow-y-auto p-2 sm:p-4">
        {currentView === 'grid' && (
          isReadOnly && !isValidated ? (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center">
              <Icon name="construction" className="text-5xl text-amber-500 mb-4" />
              <h3 className="text-xl font-black uppercase mb-2">Escala em Construção</h3>
              <p className="text-sm text-zinc-500 max-w-sm">
                Esta escala ainda está em rascunho pela gerência. Assim que for marcada como Oficial, ficará visível aqui.
              </p>
            </div>
          ) : (
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
              onToggleOnlyWorkingToday={() => setOnlyWorkingToday((p) => !p)}
              selectedGroup={selectedGroup}
              onSelectedGroupChange={setSelectedGroup}
              isReadOnly={isReadOnly}
              isEditable={isEditable}
              allowRetroactive={true}
              showNotes={showNotes}
              onCloseNotes={() => setShowNotes(false)}
              resolvedPositions={resolvedPositions}
              onSelectDay={setSelectedDayIdx}
              onOpenEmployeeCard={(emp) => {
                if (isReadOnly) {
                  setHighlightedEmpId((prev) => (prev === emp.id ? '' : emp.id));
                  return;
                }
                setEditingTeamEmpId(emp.id);
                setCurrentView('team');
              }}
              tacticalDisplayMode={tacticalDisplayMode}
              onToggleTacticalDisplayMode={(mode) => {
                if (mode) setTacticalDisplayMode(mode);
                else setTacticalDisplayMode((p) => (p === 'off' ? 'roles' : p === 'roles' ? 'positions' : 'off'));
              }}
              onUpdateShift={handleUpdateShift}
              onUpdateShifts={handleUpdateShifts}
              onUpdateEmployeeDailyHour={onUpdateEmployeeDailyHour}
              onUpdateTacticalPosition={onUpdateTacticalPosition}
              onShareWhatsApp={handleCopyDayWhatsApp}
              onOpenDayDetail={handleCopyDayWhatsApp}
              onResetMonth={handleCreateMonth}
              onApplyFolgas={() => handleApplyGranularPresets({ scope: 'all', applyMode: 'folgas_only' })}
              onSortearDomingo={handleSortearDomingo}
              onOpenAnalysis={() => setShowInconsistencyModal(true)}
              onShowHolidayManager={() => setCurrentView('feriados')}
              onNextMonth={() => setCurrentMY((p) => (p.month === 11 ? { month: 0, year: p.year + 1 } : { month: p.month + 1, year: p.year }))}
              onPrevMonth={() => setCurrentMY((p) => (p.month === 0 ? { month: 11, year: p.year - 1 } : { month: p.month - 1, year: p.year }))}
              monthNotes={monthNotes[monthKey] || ''}
              onUpdateMonthNotes={(txt) => !isReadOnly && setMonthNotes((prev) => ({ ...prev, [monthKey]: txt }))}
              jornadaSettings={activeJornadaSettings}
              diffs={scheduleDiffs}
              onOpenPresetForEmployee={(empId) => {
                setPresetInitialEmpId(empId);
                setShowPresetModal(true);
              }}
              onExportCsv={isReadOnly ? undefined : () => downloadScheduleCsv(employees, currentMY, activeJornadaSettings)}
              highlightedEmpId={highlightedEmpId}
              onHighlightEmp={setHighlightedEmpId}
              densityMode={densityMode}
              onToggleDensityMode={() => setDensityMode((p) => (p === 'clean' ? 'audit' : 'clean'))}
              protectedDaysConfig={protectedDaysMap[monthKey]}
              onEditEmployee={(empId) => {
                if (isReadOnly) return;
                setEditingTeamEmpId(empId);
                setCurrentView('team');
              }}
              onToggleHideEmployee={isReadOnly ? undefined : handleToggleEmployeeVisibilityInMonth}
            />
          )
        )}

        {currentView === 'team' && !isReadOnly && (
          <TeamView
            employees={employees}
            isReadOnly={isReadOnly}
            onUpdateEmployee={onUpdateEmployee}
            onDeleteEmployee={onDeleteEmployee}
            onAddEmployee={onAddEmployee}
            onClose={() => setCurrentView('grid')}
            initialEditingEmpId={editingTeamEmpId}
            onClearInitialEditingEmp={() => setEditingTeamEmpId(null)}
            onOpenPresetForEmployee={(empId) => {
              setPresetInitialEmpId(empId);
              setShowPresetModal(true);
            }}
          />
        )}

        {currentView === 'jornada' && !isReadOnly && (
          <div className="max-w-4xl mx-auto mt-4">
            <JornadaManager
              settings={activeJornadaSettings}
              onUpdate={setJornadaSettings}
              onClose={() => setCurrentView('grid')}
              isReadOnly={isReadOnly}
            />
          </div>
        )}

        {currentView === 'feriados' && !isReadOnly && (
          <div className="max-w-xl mx-auto mt-4">
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
              onClose={() => setCurrentView('grid')}
            />
          </div>
        )}

        {currentView === 'data' && !isReadOnly && (
          <DataManager
            syncStatus={syncStatus}
            employees={employees}
            setEmployees={setEmployees}
            validatedMonths={validatedMonths}
            setValidatedMonths={setValidatedMonths}
            officialSnapshots={officialSnapshots}
            setOfficialSnapshots={setOfficialSnapshots}
            jornadaSettings={activeJornadaSettings}
            setJornadaSettings={setJornadaSettings}
            customHolidays={customHolidays}
            setCustomHolidays={setCustomHolidays}
            deletedNationalHolidays={deletedNationalHolidays}
            setDeletedNationalHolidays={setDeletedNationalHolidays}
            monthNotes={monthNotes}
            setMonthNotes={setMonthNotes}
            trackingStartDate={trackingStartDate}
            setTrackingStartDate={setTrackingStartDate}
            sectionAssignments={{}}
            setSectionAssignments={() => {}}
            protectedDaysMap={protectedDaysMap}
            setProtectedDaysMap={setProtectedDaysMap}
            auditLogs={auditLogs}
            setAuditLogs={setAuditLogs}
            onExportScheduleCsv={() => downloadScheduleCsv(employees, currentMY, activeJornadaSettings)}
            onClose={() => setCurrentView('grid')}
            role={auth.role}
          />
        )}
      </main>

      {/* ─── MODAIS DE LÓGICA E REGRAS CLT ─── */}
      {showCreateMonthModal && createMonthTargetMY && (
        <CreateMonthModal
          isOpen={showCreateMonthModal}
          onClose={() => setShowCreateMonthModal(false)}
          targetMY={createMonthTargetMY}
          onConfirm={handleConfirmCreateMonth}
        />
      )}

      {showProtectedModal && (
        <ProtectedDaysModal
          isOpen={showProtectedModal}
          onClose={() => setShowProtectedModal(false)}
          currentMY={currentMY}
          protectedConfig={activeProtectedDays}
          employees={employees}
          onSaveConfig={(cfg) => setProtectedDaysMap((prev) => ({ ...prev, [monthKey]: cfg }))}
          onOptimizeSchedule={(cfg) => {
            const optimized = optimizeProtectedDays(
              employees,
              monthKey,
              cfg ?? activeProtectedDays,
              customHolidays,
              deletedNationalHolidays,
              activeJornadaSettings
            );
            setEmployees((prev) =>
              prev.map((emp) => (optimized[emp.id] ? { ...emp, shifts: { ...emp.shifts, [monthKey]: optimized[emp.id].shifts } } : emp))
            );
            showDialog({ title: 'Otimização Concluída', message: 'Dias protegidos aplicados respeitando todas as travas CLT!' });
          }}
          isReadOnly={isReadOnly}
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
          onApplyFix={(empId, dayIdx, shift) => handleUpdateShift(empId, dayIdx, shift)}
          onApplyBulkFixes={(updates) => handleUpdateShifts(updates)}
        />
      )}

      <SyncBlockingOverlay syncStatus={syncStatus} />
    </div>
  );
};

export default AppDriveLite;
