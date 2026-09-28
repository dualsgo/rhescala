
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useDialog } from './contexts/DialogContext';
import { useLocalStorage, useLocalPreference, useSyncStatus } from './hooks/useLocalStorage';
import { 
  generateYearSchedule, 
  applyMonthUpdate, 
  applyHoursOnly,
  applyFolgasOnly,
  applyTacticalOnly,
  generateCleanMonthSchedule,
  detectScheduleDiffs,
  resolveTacticalDay, 
  calculateLunches, 
  getShiftClassification, 
  findSundayViolations, 
  isWorkingShift, 
  distributeTacticalPositions, 
  optimizePeakWeek,
  optimizeOctoberPeak,
  optimizeDecemberPeak,
  optimizeProtectedDays
} from './hooks/useScheduleEngine';

import { Header } from './components/Header';
import { copyToClipboard } from './src/utils/clipboard';
import { downloadScheduleCsv } from './src/utils/exportScheduleCsv';
import { toPng } from 'html-to-image';
import { apiStore, getConfiguredApiUrl } from './src/gas-api';

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
import { PLACEHOLDER_EMPLOYEE, PLACEHOLDER_EMPLOYEE_ID, SHIFT_HOURS, buildHolidaySet, getDefaultHourForDay, getNationalHolidays, DEFAULT_JORNADA_SETTINGS, getShortName, getDefaultProtectedDays, isEmployeeActiveInMonth, normalizeProtectedDaysConfig, normalizeProtectedDaysDetails, getTacticalEmoji, getTacticalLabel } from './constants';
import { Employee, MonthYear, Holiday, JornadaSettings, OfficialScheduleSnapshot, ScheduleDiffItem, TacticalDisplayMode, ProtectedDaysConfig, ProtectedDaysMap, AuditLogEntry, AuditChangeType, ShiftType } from './types';
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
import { ProtectedDaysModal } from './components/ProtectedDaysModal';
import { CreateMonthModal } from './components/CreateMonthModal';
import { DailyScheduleModulatorModal } from './components/DailyScheduleModulatorModal';
import { AuditJustificationModal, AuditImpactPreview } from './components/AuditJustificationModal';
import { classifyShiftChange, classifyHourChange, classifyTacticalChange } from './src/utils/auditUtils';
import { MobileNavBar } from './components/MobileNavBar';

const App: React.FC = () => {
  const [employees, setEmployees] = useLocalStorage<Employee[]>('riHappyEmployeesData', [PLACEHOLDER_EMPLOYEE]);
  const [jornadaSettings, setJornadaSettings] = useLocalStorage<JornadaSettings>('riHappyJornadaSettings', DEFAULT_JORNADA_SETTINGS);
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

  const [customHolidays, setCustomHolidays] = useLocalStorage<Holiday[]>('riHappyCustomHolidays', []);
  const [deletedNationalHolidays, setDeletedNationalHolidays] = useLocalStorage<string[]>('riHappyDeletedNationalHolidays', []);
  const [monthNotes, setMonthNotes] = useLocalStorage<Record<string, string>>('riHappyMonthNotes', {});
  const [trackingStartDate, setTrackingStartDate] = useLocalStorage<string>('riHappyTrackingStart', `${new Date().getFullYear()}-01-01`);
  const [officialSnapshots, setOfficialSnapshots] = useLocalStorage<Record<string, OfficialScheduleSnapshot>>('riHappyOfficialSnapshots', {});
  const [protectedDaysMap, setProtectedDaysMap] = useLocalStorage<ProtectedDaysMap>('riHappyProtectedDays', {});
  const [showProtectedModal, setShowProtectedModal] = useState(false);
  
  const syncStatus = useSyncStatus();
  const [showHolidayManager, setShowHolidayManager] = useState(false);
  const [showDayDetail, setShowDayDetail] = useState(false);
  const [showPresetModal, setShowPresetModal] = useState(false);
  const [presetInitialEmpId, setPresetInitialEmpId] = useState<string | null>(null);
  const [showDiffModal, setShowDiffModal] = useState(false);
  const [currentView, setCurrentView] = useState<string>('grid');
  const [currentMY, setCurrentMY] = useState<MonthYear>({ month: new Date().getMonth(), year: new Date().getFullYear() });
  const [sectionAssignments, setSectionAssignments] = useLocalStorage<Record<string, any>>('riHappySectionAssignments', {});
  const [validatedMonths, setValidatedMonths] = useLocalStorage<Record<string, boolean>>('riHappyValidatedMonths', {});
  const [selectedDayIdx, setSelectedDayIdx] = useState(new Date().getDate() - 1);
  const [showInconsistencyModal, setShowInconsistencyModal] = useState(false);
  const [viewerModeType, setViewerModeType] = useLocalStorage<'personal' | 'grid'>('rhescala_viewer_mode_type', 'grid');
  const [viewerSelectedEmpId, setViewerSelectedEmpId] = useLocalStorage<string>('rhescala_viewer_selected_emp_id', '');
  const [auditLogs, setAuditLogs] = useLocalStorage<AuditLogEntry[]>('rhescala_audit_logs', []);
  const [pendingAuditAction, setPendingAuditAction] = useState<{
    impacts: AuditImpactPreview[];
    onConfirm: (justification: string) => void;
  } | null>(null);
  const [auth, setAuth] = useState<{ isAuthenticated: boolean, role: 'admin' | 'viewer' }>(() => {
    try {
      const saved = sessionStorage.getItem('rhescala_auth_session');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed.isAuthenticated === 'boolean' && (parsed.role === 'admin' || parsed.role === 'viewer')) {
          return parsed;
        }
      }
    } catch (e) {}
    return { isAuthenticated: false, role: 'viewer' };
  });

  const updateAuth = useCallback((newAuth: { isAuthenticated: boolean, role: 'admin' | 'viewer' } | ((prev: { isAuthenticated: boolean, role: 'admin' | 'viewer' }) => { isAuthenticated: boolean, role: 'admin' | 'viewer' })) => {
    setAuth(prev => {
      const next = typeof newAuth === 'function' ? newAuth(prev) : newAuth;
      try {
        if (next.isAuthenticated) {
          sessionStorage.setItem('rhescala_auth_session', JSON.stringify(next));
        } else {
          sessionStorage.removeItem('rhescala_auth_session');
        }
      } catch (e) {}
      return next;
    });
  }, []);
  const [filter, setFilter] = useState<'all' | 'sunday' | 'holiday' | 'week'>('all');
  const [contractFilter, setContractFilter] = useState<'all' | 'clt' | 'sazonal'>('all');
  const [onlyWorkingToday, setOnlyWorkingToday] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const handleClearFilters = useCallback(() => {
    setFilter('all');
    setContractFilter('all');
    setOnlyWorkingToday(false);
    setSelectedGroup(null);
    setSearchQuery('');
  }, []);
  const [isDarkMode] = useLocalPreference<boolean>('riHappyDarkMode', false);
  const [tacticalDisplayMode, setTacticalDisplayMode] = useLocalPreference<TacticalDisplayMode>('rhescala_tactical_display_mode', 'off');
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

  const activeProtectedDays = useMemo<ProtectedDaysConfig>(() => {
    return protectedDaysMap[monthKey] ?? getDefaultProtectedDays(currentMY.month);
  }, [protectedDaysMap, monthKey, currentMY.month]);

  const handleSaveProtectedConfig = useCallback((newConfig: ProtectedDaysConfig) => {
    if (auth.role === 'viewer') return;
    setProtectedDaysMap(prev => ({
      ...prev,
      [monthKey]: newConfig
    }));
  }, [auth.role, monthKey, setProtectedDaysMap]);

  const handleToggleProtectDay = useCallback((dayNum: number) => {
    if (auth.role === 'viewer') return;
    setProtectedDaysMap(prev => {
      const currentDetails = normalizeProtectedDaysDetails(prev[monthKey] ?? getDefaultProtectedDays(currentMY.month));
      const copy = { ...currentDetails };
      if (copy[dayNum] !== undefined) {
        delete copy[dayNum];
      } else {
        copy[dayNum] = { dayNum, maxFolgas: 0 };
      }
      return { ...prev, [monthKey]: copy };
    });
  }, [auth.role, monthKey, currentMY.month, setProtectedDaysMap]);
  
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
      // 1. Gravação síncrona imediata no localStorage para proteção instantânea contra perda
      window.localStorage.setItem('riHappyEmployeesData', JSON.stringify(employees));
      window.localStorage.setItem('riHappyJornadaSettings', JSON.stringify(jornadaSettings));
      window.localStorage.setItem('riHappyCustomHolidays', JSON.stringify(customHolidays));
      window.localStorage.setItem('riHappyDeletedNationalHolidays', JSON.stringify(deletedNationalHolidays));
      window.localStorage.setItem('riHappyMonthNotes', JSON.stringify(monthNotes));
      window.localStorage.setItem('riHappyTrackingStart', JSON.stringify(trackingStartDate));
      window.localStorage.setItem('riHappyOfficialSnapshots', JSON.stringify(officialSnapshots));
      window.localStorage.setItem('riHappyProtectedDays', JSON.stringify(protectedDaysMap));
      window.localStorage.setItem('riHappySectionAssignments', JSON.stringify(sectionAssignments));
      window.localStorage.setItem('riHappyValidatedMonths', JSON.stringify(validatedMonths));
      window.localStorage.setItem('rhescala_audit_logs', JSON.stringify(auditLogs));

      // 2. Transmissão imediata via BroadcastChannel para outras abas abertas
      try {
        new BroadcastChannel('sync_riHappyEmployeesData').postMessage(employees);
        new BroadcastChannel('sync_riHappyValidatedMonths').postMessage(validatedMonths);
      } catch (e) {}

      // 3. Força envio imediato para a nuvem GAS caso a URL esteja configurada
      const url = getConfiguredApiUrl();
      if (url) {
        await Promise.allSettled([
          apiStore.set('riHappyEmployeesData', employees),
          apiStore.set('riHappyValidatedMonths', validatedMonths),
          apiStore.set('riHappyProtectedDays', protectedDaysMap),
          apiStore.set('riHappyMonthNotes', monthNotes),
          apiStore.set('riHappyOfficialSnapshots', officialSnapshots),
          apiStore.set('riHappyCustomHolidays', customHolidays),
          apiStore.set('riHappyDeletedNationalHolidays', deletedNationalHolidays),
          apiStore.set('riHappyJornadaSettings', jornadaSettings),
          apiStore.set('riHappySectionAssignments', sectionAssignments),
          apiStore.set('rhescala_audit_logs', auditLogs)
        ]);
      }

      setIsJustSaved(true);
      setTimeout(() => setIsJustSaved(false), 3000);
    } catch (err) {
      console.error('Erro ao salvar:', err);
      showDialog({
        title: 'Aviso de Sincronização',
        message: 'As alterações foram salvas com segurança no cache local deste computador, mas houve uma oscilação na conexão com o servidor/planilha.',
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
          if (emp.tacticalPositions[monthKey]) newSnapshot.tacticalPositions[emp.id] = [...emp.tacticalPositions[monthKey]];
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

  const onAddEmployee = useCallback((name: string, isYoung: boolean, courseDay: string, cargo: any, birthday: string, contractType?: 'CLT' | 'Sazonal', jornada?: '6x1' | '5x2', hiredAt?: string, firedAt?: string) => {
    let preferredDayOff = '';
    if (cargo === 'Estoquista') preferredDayOff = 'Domingo';
    if (cargo === 'Aprendiz') preferredDayOff = 'Sábado';

    const newEmp: Employee = {
      ...PLACEHOLDER_EMPLOYEE,
      id: Math.random().toString(36).substring(2, 9),
      name,
      isYoungApprentice: isYoung,
      courseDay: isYoung ? courseDay : undefined,
      contractType: contractType || 'CLT',
      jornada: jornada || '6x1',
      cargo,
      birthday,
      hiredAt: hiredAt || undefined,
      firedAt: firedAt || undefined,
      preferredDayOff,
      status: 'active',
      shifts: {},
      dailyHours: {},
      tacticalPositions: {},
    };
    setEmployees(prev => [...prev.filter(e => e.id !== PLACEHOLDER_EMPLOYEE_ID), newEmp]);
  }, [setEmployees]);

  const onAddHoliday = useCallback((h: Omit<Holiday, 'id'>) => {
    const newHoliday: Holiday = { ...h, id: Math.random().toString(36).substring(2, 9) };
    setCustomHolidays(prev => [...prev, newHoliday]);
  }, [setCustomHolidays]);

  const onRemoveHoliday = useCallback((id: string) => {
    if (id.startsWith('national-')) {
      setDeletedNationalHolidays(prev => [...prev, id]);
    } else {
      setCustomHolidays(prev => prev.filter(h => h.id !== id));
    }
  }, [setCustomHolidays, setDeletedNationalHolidays]);

  const onEditHoliday = useCallback((id: string, updatedHoliday: Omit<Holiday, 'id'>) => {
    if (id.startsWith('national-')) {
      setDeletedNationalHolidays(prev => [...prev, id]);
      onAddHoliday(updatedHoliday);
    } else {
      setCustomHolidays(prev => prev.map(h => h.id === id ? { ...h, ...updatedHoliday } : h));
    }
  }, [setDeletedNationalHolidays, onAddHoliday, setCustomHolidays]);

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
  React.useEffect(() => {
    let changed = false;
    const newEmps = employees.map(emp => {
      let empChanged = false;
      const newTactical = { ...emp.tacticalPositions };
      Object.keys(newTactical).forEach(key => {
        const row = newTactical[key];
        if (row && row.includes('ESTOQUE')) {
          newTactical[key] = row.map(v => v === 'ESTOQUE' ? 'ESTQ' : v);
          empChanged = true;
        }
      });

      const newShifts = { ...emp.shifts };
      Object.keys(newShifts).forEach(key => {
        const row = newShifts[key];
        if (row && row.includes('ESTOQUE')) {
          newShifts[key] = row.map(v => v === 'ESTOQUE' ? 'ESTQ' : v);
          empChanged = true;
        }
      });

      let pref1 = emp.preferredPosition1;
      if (pref1 === 'ESTOQUE') { pref1 = 'ESTQ'; empChanged = true; }
      
      let pref2 = emp.preferredPosition2;
      if (pref2 === 'ESTOQUE') { pref2 = 'ESTQ'; empChanged = true; }

      if (empChanged) {
        changed = true;
        return { ...emp, tacticalPositions: newTactical, shifts: newShifts, preferredPosition1: pref1, preferredPosition2: pref2 };
      }
      return emp;
    });

    if (changed) {
      setEmployees(newEmps);
    }
  }, [employees, setEmployees]);

  const handleUpdateShift = useCallback((empId: string, dayIdx: number, newShift: ShiftType) => {
    if (isReadOnly) return;
    const targetEmp = employees.find(e => e.id === empId);
    if (!targetEmp) return;

    const oldShift = targetEmp.shifts[monthKey]?.[dayIdx] || 'T';
    if (oldShift === newShift) return; // Zero falsos positivos

    const dateStr = `${String(dayIdx + 1).padStart(2, '0')}/${String(currentMY.month + 1).padStart(2, '0')}/${currentMY.year}`;
    const curHour = targetEmp.dailyHours[monthKey]?.[dayIdx] || targetEmp.workPeriod || '';

    const applyChange = (justification?: string) => {
      setEmployees(prev => prev.map(emp => {
        if (emp.id !== empId) return emp;
        const sfs = [...(emp.shifts[monthKey] || [])];
        sfs[dayIdx] = newShift;
        return { ...emp, shifts: { ...emp.shifts, [monthKey]: sfs } };
      }));

      if (justification) {
        const c = classifyShiftChange(targetEmp.name, dateStr, oldShift, newShift, curHour);
        const newLog: AuditLogEntry = {
          id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          timestamp: new Date().toISOString(),
          authorRole: 'admin',
          authorName: 'Gestor',
          empId: targetEmp.id,
          empName: targetEmp.name,
          monthKey,
          dayIdx,
          dateStr,
          changeType: c.changeType,
          beforeVal: c.beforeVal,
          afterVal: c.afterVal,
          humanDescription: c.humanDescription,
          justification,
          isPostOfficialization: true,
        };
        setAuditLogs(prev => [newLog, ...prev]);
      }
    };

    if (validatedMonths[monthKey]) {
      const c = classifyShiftChange(targetEmp.name, dateStr, oldShift, newShift, curHour);
      setPendingAuditAction({
        impacts: [{
          empId: targetEmp.id,
          empName: targetEmp.name,
          dayIdx,
          dateStr,
          beforeVal: c.beforeVal,
          afterVal: c.afterVal,
          changeType: c.changeType,
          humanDescription: c.humanDescription,
        }],
        onConfirm: (justification) => {
          applyChange(justification);
          setPendingAuditAction(null);
        }
      });
    } else {
      applyChange();
    }
  }, [isReadOnly, employees, monthKey, currentMY, validatedMonths, setEmployees, setAuditLogs]);

  const handleUpdateShifts = useCallback((updates: { empId: string; dayIdx: number; newShift: ShiftType }[]) => {
    if (isReadOnly) return;
    const effectiveUpdates = updates.filter(u => {
      const emp = employees.find(e => e.id === u.empId);
      const oldShift = emp?.shifts[monthKey]?.[u.dayIdx] || 'T';
      return oldShift !== u.newShift;
    });
    if (effectiveUpdates.length === 0) return;

    const applyChange = (justification?: string) => {
      setEmployees(prev => prev.map(emp => {
        const empU = effectiveUpdates.filter(u => u.empId === emp.id);
        if (empU.length === 0) return emp;
        const sfs = [...(emp.shifts[monthKey] || [])];
        empU.forEach(u => { sfs[u.dayIdx] = u.newShift; });
        return { ...emp, shifts: { ...emp.shifts, [monthKey]: sfs } };
      }));

      if (justification) {
        const newLogs: AuditLogEntry[] = effectiveUpdates.map(u => {
          const emp = employees.find(e => e.id === u.empId)!;
          const dateStr = `${String(u.dayIdx + 1).padStart(2, '0')}/${String(currentMY.month + 1).padStart(2, '0')}/${currentMY.year}`;
          const oldShift = emp.shifts[monthKey]?.[u.dayIdx] || 'T';
          const curHour = emp.dailyHours[monthKey]?.[u.dayIdx] || emp.workPeriod || '';
          const c = classifyShiftChange(emp.name, dateStr, oldShift, u.newShift, curHour);
          return {
            id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            timestamp: new Date().toISOString(),
            authorRole: 'admin',
            authorName: 'Gestor',
            empId: emp.id,
            empName: emp.name,
            monthKey,
            dayIdx: u.dayIdx,
            dateStr,
            changeType: c.changeType,
            beforeVal: c.beforeVal,
            afterVal: c.afterVal,
            humanDescription: c.humanDescription,
            justification,
            isPostOfficialization: true,
          };
        });
        setAuditLogs(prev => [...newLogs, ...prev]);
      }
    };

    if (validatedMonths[monthKey]) {
      const impacts = effectiveUpdates.map(u => {
        const emp = employees.find(e => e.id === u.empId)!;
        const dateStr = `${String(u.dayIdx + 1).padStart(2, '0')}/${String(currentMY.month + 1).padStart(2, '0')}/${currentMY.year}`;
        const oldShift = emp.shifts[monthKey]?.[u.dayIdx] || 'T';
        const curHour = emp.dailyHours[monthKey]?.[u.dayIdx] || emp.workPeriod || '';
        const c = classifyShiftChange(emp.name, dateStr, oldShift, u.newShift, curHour);
        return {
          empId: emp.id,
          empName: emp.name,
          dayIdx: u.dayIdx,
          dateStr,
          beforeVal: c.beforeVal,
          afterVal: c.afterVal,
          changeType: c.changeType,
          humanDescription: c.humanDescription,
        };
      });

      setPendingAuditAction({
        impacts,
        onConfirm: (justification) => {
          applyChange(justification);
          setPendingAuditAction(null);
        }
      });
    } else {
      applyChange();
    }
  }, [isReadOnly, employees, monthKey, currentMY, validatedMonths, setEmployees, setAuditLogs]);

  const onUpdateEmployeeDailyHour = useCallback((empId: string, dayIdx: number, newHour: string) => {
    if (isReadOnly) return;
    const targetEmp = employees.find(e => e.id === empId);
    if (!targetEmp) return;

    const oldHour = targetEmp.dailyHours[monthKey]?.[dayIdx] || targetEmp.workPeriod || '';
    if (oldHour === newHour) return; // Zero falsos positivos

    const dateStr = `${String(dayIdx + 1).padStart(2, '0')}/${String(currentMY.month + 1).padStart(2, '0')}/${currentMY.year}`;

    const applyChange = (justification?: string) => {
      setEmployees(prev => prev.map(emp => {
        if (emp.id !== empId) return emp;
        const hours = [...(emp.dailyHours[monthKey] || [])];
        hours[dayIdx] = newHour;
        return { ...emp, dailyHours: { ...emp.dailyHours, [monthKey]: hours } };
      }));

      if (justification) {
        const c = classifyHourChange(targetEmp.name, dateStr, oldHour, newHour);
        const newLog: AuditLogEntry = {
          id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          timestamp: new Date().toISOString(),
          authorRole: 'admin',
          authorName: 'Gestor',
          empId: targetEmp.id,
          empName: targetEmp.name,
          monthKey,
          dayIdx,
          dateStr,
          changeType: c.changeType,
          beforeVal: c.beforeVal,
          afterVal: c.afterVal,
          humanDescription: c.humanDescription,
          justification,
          isPostOfficialization: true,
        };
        setAuditLogs(prev => [newLog, ...prev]);
      }
    };

    if (validatedMonths[monthKey]) {
      const c = classifyHourChange(targetEmp.name, dateStr, oldHour, newHour);
      setPendingAuditAction({
        impacts: [{
          empId: targetEmp.id,
          empName: targetEmp.name,
          dayIdx,
          dateStr,
          beforeVal: c.beforeVal,
          afterVal: c.afterVal,
          changeType: c.changeType,
          humanDescription: c.humanDescription,
        }],
        onConfirm: (justification) => {
          applyChange(justification);
          setPendingAuditAction(null);
        }
      });
    } else {
      applyChange();
    }
  }, [isReadOnly, employees, monthKey, currentMY, validatedMonths, setEmployees, setAuditLogs]);

  const onUpdateTacticalPosition = useCallback((empId: string, dayIdx: number, newPos: string | null) => {
    if (isReadOnly) return;
    const monthKey = `${currentMY.year}-${String(currentMY.month + 1).padStart(2, '0')}`;
    const targetEmp = employees.find(e => e.id === empId);
    if (!targetEmp) return;

    const dateStr = `${String(dayIdx + 1).padStart(2, '0')}/${String(currentMY.month + 1).padStart(2, '0')}/${currentMY.year}`;
    const oldPos = targetEmp.tacticalPositions?.[monthKey]?.[dayIdx] || null;
    if (oldPos === newPos) return;

    const applyChange = (justification?: string) => {
      setEmployees(prev => {
        const activeEmps = prev.filter(e => isEmployeeActiveInMonth(e, currentMY.year, currentMY.month));
        const empHour = targetEmp.dailyHours[monthKey]?.[dayIdx] || targetEmp.workPeriod;
        const date = new Date(currentMY.year, currentMY.month, dayIdx + 1);
        const isSunday = date.getDay() === 0;
        const targetGroup = getShiftClassification(empHour, isSunday);

        const isHoliday = buildHolidaySet(currentMY.year, customHolidays, deletedNationalHolidays).has(`${currentMY.year}-${String(currentMY.month + 1).padStart(2, '0')}-${String(dayIdx + 1).padStart(2, '0')}`);
        const resolved = resolveTacticalDay(activeEmps, monthKey, dayIdx, isHoliday, isSunday, jornadaSettings);
        const resolvedOldPos = targetEmp.tacticalPositions?.[monthKey]?.[dayIdx] || resolved[empId];

        return prev.map(emp => {
          if (emp.id === empId) {
            const positions = [...(emp.tacticalPositions?.[monthKey] || [])];
            positions[dayIdx] = newPos;
            return { ...emp, tacticalPositions: { ...emp.tacticalPositions, [monthKey]: positions } };
          }

          const eHour = emp.dailyHours[monthKey]?.[dayIdx] || emp.workPeriod;
          const eGroup = getShiftClassification(eHour, isSunday);

          if (eGroup === targetGroup && newPos !== 'AUTO') {
            const empCurrentPos = emp.tacticalPositions?.[monthKey]?.[dayIdx] || resolved[emp.id];
            if (empCurrentPos === newPos) {
              const positions = [...(emp.tacticalPositions?.[monthKey] || [])];
              positions[dayIdx] = resolvedOldPos;
              return { ...emp, tacticalPositions: { ...emp.tacticalPositions, [monthKey]: positions } };
            }
          }

          return emp;
        });
      });

      if (justification) {
        const c = classifyTacticalChange(targetEmp.name, dateStr, oldPos, newPos);
        const newLog: AuditLogEntry = {
          id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          timestamp: new Date().toISOString(),
          authorRole: 'admin',
          authorName: 'Gestor',
          empId: targetEmp.id,
          empName: targetEmp.name,
          monthKey,
          dayIdx,
          dateStr,
          changeType: c.changeType,
          beforeVal: c.beforeVal,
          afterVal: c.afterVal,
          humanDescription: c.humanDescription,
          justification,
          isPostOfficialization: true,
        };
        setAuditLogs(prev => [newLog, ...prev]);
      }
    };

    if (validatedMonths[monthKey]) {
      const c = classifyTacticalChange(targetEmp.name, dateStr, oldPos, newPos);
      setPendingAuditAction({
        impacts: [{
          empId: targetEmp.id,
          empName: targetEmp.name,
          dayIdx,
          dateStr,
          beforeVal: c.beforeVal,
          afterVal: c.afterVal,
          changeType: c.changeType,
          humanDescription: c.humanDescription,
        }],
        onConfirm: (justification) => {
          applyChange(justification);
          setPendingAuditAction(null);
        }
      });
    } else {
      applyChange();
    }
  }, [isReadOnly, employees, currentMY, customHolidays, deletedNationalHolidays, jornadaSettings, validatedMonths, setEmployees, setAuditLogs]);

  const handleApplyGranularPresets = useCallback((options: {
    scope: 'all' | 'single';
    targetEmpId?: string;
    applyMode: 'hours_only' | 'folgas_only' | 'tactical_only' | 'full';
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
      const updatedShifts = applyFolgasOnly(employees, currentMY.year, currentMY.month, empId, customHolidays, deletedNationalHolidays, activeJornadaSettings, activeProtectedDays);
      setEmployees(prev => prev.map(emp => {
        if (updatedShifts[emp.id]) {
          return { ...emp, shifts: { ...emp.shifts, [monthKey]: updatedShifts[emp.id] } };
        }
        return emp;
      }));
      showDialog({ title: 'Sucesso', message: 'Folgas e rotação de domingos recalculadas com sucesso respeitando os dias protegidos/sazonais!' });
    } else if (applyMode === 'tactical_only') {
      const updatedPositions = applyTacticalOnly(employees, currentMY.year, currentMY.month, customHolidays, deletedNationalHolidays, activeJornadaSettings);
      setEmployees(prev => prev.map(emp => {
        if (updatedPositions[emp.id]) {
          return { ...emp, tacticalPositions: { ...emp.tacticalPositions, [monthKey]: updatedPositions[emp.id] } };
        }
        return emp;
      }));
      showDialog({ title: 'Sucesso', message: 'Funções da equipe (Caixa, Pacote, Reposição, Vendas, Fiscal e Estoque) redistribuídas com sucesso!' });
    } else if (applyMode === 'full') {
      const updatedData = applyMonthUpdate(employees, currentMY.year, currentMY.month, customHolidays, deletedNationalHolidays, activeJornadaSettings, activeProtectedDays);
      setEmployees(prev => prev.map(emp => {
        if (empId && emp.id !== empId) return emp;
        if (updatedData[emp.id]) {
          return {
            ...emp,
            shifts: { ...emp.shifts, [monthKey]: updatedData[emp.id].shifts },
            dailyHours: { ...emp.dailyHours, [monthKey]: updatedData[emp.id].hours }
          };
        }
        return emp;
      }));
      showDialog({ title: 'Sucesso', message: 'Redefinição geral completa aplicada com sucesso respeitando regras sazonais!' });
    }
  }, [employees, currentMY, monthKey, customHolidays, deletedNationalHolidays, activeJornadaSettings, activeProtectedDays, setEmployees, showDialog]);

  const handleApplyFolgas = (targetMY = currentMY, targetKey = monthKey) => {
    const updatedData = applyMonthUpdate(employees, targetMY.year, targetMY.month, customHolidays, deletedNationalHolidays, jornadaSettings, activeProtectedDays);
    setEmployees(prev => prev.map(emp => {
      if (updatedData[emp.id]) {
        return {
          ...emp,
          shifts: { ...emp.shifts, [targetKey]: updatedData[emp.id].shifts },
          dailyHours: { ...emp.dailyHours, [targetKey]: updatedData[emp.id].hours }
        };
      }
      return emp;
    }));
  };

  const handleSortearDomingo = (targetMY = currentMY, targetKey = monthKey, skipConfirm = false) => {
    const perform = () => {
      const updatedData = applyMonthUpdate(employees, targetMY.year, targetMY.month, customHolidays, deletedNationalHolidays, jornadaSettings, activeProtectedDays);
      setEmployees(prev => prev.map(emp => {
        if (updatedData[emp.id]) {
          return {
            ...emp,
            shifts: { ...emp.shifts, [targetKey]: updatedData[emp.id].shifts },
            dailyHours: { ...emp.dailyHours, [targetKey]: updatedData[emp.id].hours }
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

  const handleOptimizeScheduleWithProtectedDays = useCallback((configToUse?: ProtectedDaysConfig) => {
    const config = configToUse ?? activeProtectedDays;
    const optimized = optimizeProtectedDays(
      employees,
      monthKey,
      config,
      customHolidays,
      deletedNationalHolidays,
      activeJornadaSettings
    );

    setEmployees(prev => prev.map(emp => {
      if (optimized[emp.id]) {
        return {
          ...emp,
          shifts: { ...emp.shifts, [monthKey]: optimized[emp.id].shifts }
        };
      }
      return emp;
    }));

    showDialog({
      title: 'Otimização Concluída',
      message: 'Escala sazonal e dias protegidos otimizados com sucesso com 0 infrações CLT!'
    });
  }, [activeProtectedDays, employees, monthKey, customHolidays, deletedNationalHolidays, activeJornadaSettings, setEmployees, showDialog]);

  const handleOptimizePeakWeek = useCallback(() => {
    setShowProtectedModal(true);
  }, []);

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

  const handleShareApoioWhatsApp = useCallback(async (dayIdx: number) => {
    try {
      const dateStr = `${currentMY.year}-${String(currentMY.month + 1).padStart(2, '0')}-${String(dayIdx + 1).padStart(2, '0')}`;
      const isHoliday = buildHolidaySet(currentMY.year, customHolidays, deletedNationalHolidays).has(dateStr);
      const date = new Date(currentMY.year, currentMY.month, dayIdx + 1);
      const isSunday = date.getDay() === 0;
      const isRoles = tacticalDisplayMode === 'roles';

      let text = `🛠️ *Apoio Operacional*\n\n`;

      text += `📍 *Funções Diárias (Correlatas)*\n`;
      text += isRoles
        ? `🟥 *Caixa*\n`
        : `🟥 *Caixa (P1)*\n`;
      text += `• Só deixa o posto quando houver rendição.\n`;
      text += `• Sem filas: não ficar parado. Adiantar saquinhos de presente e alinhar produtos próximos.\n\n`;

      text += isRoles
        ? `🟧 *Pacote*\n`
        : `🟧 *Pacote (P1)*\n`;
      text += `• Apoio direto no balcão de embrulhos e embalagens.\n`;
      text += `• Agilizar o fluxo do caixa nos horários de maior movimento.\n\n`;
      
      text += isRoles
        ? `🟨 *Reposição / Organização*\n`
        : `🟨 *Reposição / Organização (P2)*\n`;
      text += `• Organização das seções, reposição contínua e frenteamento de gôndolas.\n`;
      text += `• Quando assumir rendição, retornar imediatamente ao posto de origem depois.\n\n`;
      
      text += isRoles
        ? `🟩 *Vendas / Atendimento*\n`
        : `🟩 *Vendas / Atendimento (P3)*\n`;
      text += `• Largar qualquer tarefa de arrumação imediatamente se visualizar um cliente.\n`;
      text += `• Foco total em consultoria, demonstração de brinquedos e encantamento.\n\n`;

      text += isRoles
        ? `🟦 *Fiscal*\n`
        : `🟦 *Fiscal (Prevenção e Entrada)*\n`;
      text += `• Recepção acolhedora, porta de loja e prevenção de perdas.\n`;
      text += `• Apoio e suporte operacional nos momentos de alta demanda.\n\n`;

      text += `⚡ *Dança de Cobertura*\n`;
      text += isRoles
        ? `• Ida p/ Caixa: Fiscal > Vendas / Atendimento > Reposição (emergência extrema).\n• Retorno: Reposição > Vendas / Atendimento > Fiscal.\n\n`
        : `• Ida p/ Caixa: Vai o Fiscal > Vendas (P3) > Reposição (P2) (emergência extrema).\n• Retorno: P2 > P3 > Fiscal.\n\n`;

      const activeEmps = (employees || []).filter(e => e && !e.isHidden && e.status === 'active');
      const resolvedPositions = resolveTacticalDay(activeEmps, monthKey, dayIdx, isHoliday, isSunday, activeJornadaSettings);
      
      const allWorkingEmps: any[] = [];
      activeEmps.forEach(e => {
        const shift = e.shifts?.[monthKey]?.[dayIdx] || 'T';
        if (!isWorkingShift(shift)) return;
        const hour = e.dailyHours?.[monthKey]?.[dayIdx] || getDefaultHourForDay(e, isHoliday, isSunday);
        const shiftName = getShiftClassification(hour, isSunday, activeJornadaSettings);
        let pos = e.tacticalPositions?.[monthKey]?.[dayIdx];
        if (!pos || pos === 'AUTO') {
          pos = (shift !== 'T') ? shift : resolvedPositions[e.id];
        }
        allWorkingEmps.push({ ...e, firstName: getShortName(e.name, activeEmps), pos, shiftName });
      });

      const p1Abertura = allWorkingEmps.find(e => (e.pos === 'P1' || e.pos === 'CX') && e.shiftName === 'Abertura');
      const p1Fechamento = allWorkingEmps.find(e => (e.pos === 'P1' || e.pos === 'CX') && e.shiftName !== 'Abertura');

      if (p1Abertura && p1Fechamento) {
        text += `🤝 *Revezamento (Caixa)*\n`;
        text += `• O(a) ${p1Fechamento.firstName} (Fechamento) rende o almoço do(a) ${p1Abertura.firstName} (Abertura). Quando o(a) ${p1Abertura.firstName} retornar, o(a) ${p1Fechamento.firstName} almoça.\n`;
        text += `• Quando ambos presentes, o(a) ${p1Abertura.firstName} tem prioridade no Caixa, e o(a) ${p1Fechamento.firstName} atua em Vendas/Atendimento.\n\n`;
      }

      text += `*Tempo Ocioso:* Caixa abastece o balcão/saquinhos. No salão, foquem em arrumar a seção e abastecer no baixo fluxo.\n`;

      // Legenda de Funções no rodapé do texto de Apoio
      text += `\n📋 🟥 Caixa · 🟧 Pacote · 🟨 Fiscal · 🟩 Vendas · 🟦 Apoio · 📦 Estoque\n`;

      const copied = await copyToClipboard(text);
      if (copied) {
        await showDialog({
          title: 'Apoio Operacional Copiado!',
          message: 'O roteiro de apoio operacional e funções diárias foi copiado para a área de transferência. Você já pode colá-lo no grupo do WhatsApp da loja.'
        });
      } else {
        await showDialog({
          title: 'Cópia Manual',
          message: 'Não foi possível copiar automaticamente para a área de transferência.',
          type: 'alert'
        });
      }
    } catch (err: any) {
      console.error('Erro ao gerar apoio para WhatsApp:', err);
      showDialog({
        title: 'Erro de Geração',
        message: `Ocorreu um erro ao gerar o texto de apoio: ${err?.message || String(err)}`,
        type: 'alert'
      });
    }
  }, [currentMY, employees, monthKey, customHolidays, deletedNationalHolidays, tacticalDisplayMode, activeJornadaSettings, showDialog]);

  const handleExportScheduleCsv = useCallback(() => {
    try {
      downloadScheduleCsv(employees, currentMY, activeJornadaSettings);
    } catch (err: any) {
      console.error('Erro ao exportar escala em CSV:', err);
      showDialog({
        title: 'Erro de Exportação',
        message: `Não foi possível gerar o arquivo CSV: ${err?.message || String(err)}`,
        type: 'alert'
      });
    }
  }, [employees, currentMY, activeJornadaSettings, showDialog]);

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
      activeProtectedDays,
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

  if (!auth.isAuthenticated) {
    return <Login onLogin={(role) => updateAuth({ isAuthenticated: true, role })} />;
  }

  return (
    <>
      <div className={`h-screen flex flex-col overflow-hidden ${isDarkMode ? 'dark bg-black text-white' : 'bg-slate-50'} transition-colors font-sans print:hidden`}>
        <Header 
              currentView={currentView}
              currentMY={currentMY}
              filter={filter}
              onViewChange={setCurrentView}
              onMonthChange={setCurrentMY}
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
              onOptimizePeakWeek={handleOptimizePeakWeek}
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
              onToggleTacticalDisplayMode={setTacticalDisplayMode}
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
              searchQuery={searchQuery}
              onSearchQueryChange={setSearchQuery}
              onClearFilters={handleClearFilters}
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
             case 'grid':
               if (isReadOnly && !isValidated) {
                 return (
                   <div className="h-full flex flex-col items-center justify-center p-8 text-center animate-fade-in">
                     <div className="w-24 h-24 bg-amber-100 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 rounded-[2.5rem] flex items-center justify-center mb-8 shadow-xl shadow-amber-500/10">
                       <Icon name="construction" className="text-5xl" />
                     </div>
                     <h3 className="text-2xl font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight mb-3">Escala em Construção</h3>
                     <p className="text-slate-500 dark:text-slate-400 font-bold text-sm max-w-sm leading-relaxed">
                       O gerente ainda está preparando a escala para este mês. 
                       Assim que for oficializada, você poderá visualizá-la aqui.
                     </p>
                     <div className="mt-10 flex gap-4">
                        <button onClick={() => setCurrentMY(prev => prev.month === 0 ? { month: 11, year: prev.year - 1 } : { ...prev, month: prev.month - 1 })} className="px-6 py-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">Voltar</button>
                     </div>
                   </div>
                 );
                }

                return (
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
                   searchQuery={searchQuery}
                   onSearchQueryChange={setSearchQuery}
                   isReadOnly={isReadOnly}
                   isEditable={isEditable}
                   allowRetroactive={allowRetroactive}
                   showNotes={showNotes}
                   onCloseNotes={() => setShowNotes(false)}
                   resolvedPositions={selectedDayResolvedPositions}
                   onSelectDay={setSelectedDayIdx}
                   tacticalDisplayMode={tacticalDisplayMode}
                   onToggleTacticalDisplayMode={setTacticalDisplayMode}
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
                   onNextMonth={() => setCurrentMY(prev => prev.month === 11 ? { month: 0, year: prev.year + 1 } : { ...prev, month: prev.month + 1 })}
                   onPrevMonth={() => setCurrentMY(prev => prev.month === 0 ? { month: 11, year: prev.year - 1 } : { ...prev, month: prev.month - 1 })}
                   monthNotes={monthNotes[monthKey] || ''}
                    onUpdateMonthNotes={(text) => {
                     if (isReadOnly) return;
                     setMonthNotes(prev => ({ ...prev, [monthKey]: text }));
                   }}
                   jornadaSettings={jornadaSettings}
                   diffs={scheduleDiffs}
                   protectedDays={activeProtectedDays}
                   onOpenProtectedModal={() => setShowProtectedModal(true)}
                   onToggleProtectDay={handleToggleProtectDay}
                   onOpenPresetForEmployee={(empId) => {
                     setPresetInitialEmpId(empId);
                     setShowPresetModal(true);
                   }}
                   onExportCsv={isReadOnly ? undefined : handleExportScheduleCsv}
                   highlightedEmpId=""
                   onHighlightEmp={(empId) => {
                     setViewerSelectedEmpId(empId);
                   }}
                   onOpenEmployeeCard={async (emp, tab = 'mes', initialDate) => {
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

                     if (password !== null) {
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
                   }}
                 />
                );
             case 'analysis':
               if (isReadOnly) {
                 return (
                   <div className="h-full flex flex-col items-center justify-center p-8 text-center animate-fade-in">
                     <div className="w-16 h-16 bg-amber-100 dark:bg-amber-950/40 text-amber-600 rounded-2xl flex items-center justify-center mb-4 shadow-sm">
                       <Icon name="lock" className="text-3xl" />
                     </div>
                     <h3 className="text-lg font-black text-slate-800 dark:text-slate-100 mb-1">Acesso Exclusivo da Gestão</h3>
                     <p className="text-slate-500 dark:text-slate-400 text-xs max-w-sm mb-6">
                       O painel analítico de cobertura de equipe é reservado aos administradores da loja.
                     </p>
                     <button onClick={() => setCurrentView('grid')} className="px-5 py-2.5 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 rounded-xl font-bold text-xs text-slate-700 dark:text-slate-200 transition-colors">
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
                      <h3 className="text-lg font-black text-slate-800 dark:text-slate-100 mb-1">Privacidade Protegida</h3>
                      <p className="text-slate-500 dark:text-slate-400 text-xs max-w-sm mb-6">
                        O mural geral de solicitações é exclusivo para a gestão da loja. Para consultar e enviar seus próprios pedidos com privacidade, acesse seu Cartão Individual.
                      </p>
                      <button onClick={() => setCurrentView('grid')} className="px-5 py-2.5 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 rounded-xl font-bold text-xs text-slate-700 dark:text-slate-200 transition-colors">
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
       {showProtectedModal && (
         <ProtectedDaysModal
           isOpen={showProtectedModal}
           onClose={() => setShowProtectedModal(false)}
           currentMY={currentMY}
           protectedConfig={activeProtectedDays}
           employees={employees}
           onSaveConfig={handleSaveProtectedConfig}
           onOptimizeSchedule={handleOptimizeScheduleWithProtectedDays}
           isReadOnly={isReadOnly}
         />
       )}

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
           onClose={() => setSelectedEmployeeForCard(null)}
         />
       )}

       {/* Day Detail Modal */}
       {showDayDetail && (
         <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/40 dark:bg-slate-950/60 backdrop-blur-sm animate-fade-in">
           <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] w-full max-w-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh] overflow-hidden">
             <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between sticky top-0 bg-white dark:bg-slate-900 z-10 no-print">
               <div className="flex items-center gap-4">
                 <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-xl flex items-center justify-center">
                   <Icon name="event_available" className="text-xl" />
                 </div>
                 <div>
                   <h4 className="text-lg font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">Escala do Dia</h4>
                   <div className="flex items-center gap-2">
                     <button 
                       onClick={() => setSelectedDayIdx(prev => Math.max(0, prev - 1))}
                       className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400"
                     >
                       <Icon name="chevron_left" />
                     </button>
                     <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">{selectedDayIdx + 1}/{currentMY.month + 1}/{currentMY.year}</p>
                     <button 
                       onClick={() => setSelectedDayIdx(prev => Math.min(30, prev + 1))}
                       className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400"
                     >
                       <Icon name="chevron_right" />
                     </button>
                   </div>
                 </div>
               </div>
               <div className="flex items-center gap-2">
                 <button 
                   onClick={async () => {
                     const el = document.getElementById('day-detail-screenshot');
                     if (el) {
                       const dataUrl = await toPng(el, { 
                         backgroundColor: '#ffffff', 
                         pixelRatio: 2,
                         style: { 
                           padding: '30px', 
                           borderRadius: '32px',
                           transform: 'scale(0.9)',
                           transformOrigin: 'center'
                         } 
                       });
                       const link = document.createElement('a');
                       const date = `${String(selectedDayIdx + 1).padStart(2, '0')}-${String(currentMY.month + 1).padStart(2, '0')}`;
                       link.download = `escala-dia-${date}.png`;
                       link.href = dataUrl;
                       link.click();
                     }
                   }}
                   className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-md active:scale-95"
                   title="Baixar Imagem"
                 >
                   <Icon name="download" className="text-sm" /> Baixar Imagem
                 </button>
                 <button 
                   onClick={() => handleShareWhatsApp(selectedDayIdx)}
                   className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-md active:scale-95"
                 >
                   <Icon name="content_copy" className="text-sm" /> Copiar Texto
                 </button>
                 <button onClick={() => setShowDayDetail(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-400">
                   <Icon name="close" />
                 </button>
               </div>
             </div>
             <div className="flex-1 overflow-y-auto p-8 custom-scrollbar bg-white dark:bg-slate-900">
               <div id="day-detail-screenshot" className="bg-white dark:bg-slate-900">
                 <DaySummaryCard 
                   selectedDayIdx={selectedDayIdx} 
                   employees={employees} 
                   currentMY={currentMY} 
                   customHolidays={customHolidays} 
                   jornadaSettings={jornadaSettings}
                   isProtected={activeProtectedDays[selectedDayIdx + 1] !== undefined}
                   maxFolgas={typeof activeProtectedDays[selectedDayIdx + 1] === 'number' ? (activeProtectedDays[selectedDayIdx + 1] as number) : (activeProtectedDays[selectedDayIdx + 1] as any)?.maxFolgas ?? 0}
                   onOpenProtectedModal={() => setShowProtectedModal(true)}
                   onToggleProtectDay={() => handleToggleProtectDay(selectedDayIdx + 1)}
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
         <div className="lg:hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-2 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-xl border border-slate-200 dark:border-zinc-800 rounded-full p-2 shadow-2xl shadow-black/20">
            <button 
             onClick={() => setIsEditable(!isEditable)}
             className={`flex items-center gap-2 px-4 py-3 rounded-2xl text-[10px] font-black uppercase transition-all ${isEditable ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-slate-300'}`}
            >
              <Icon name={isEditable ? 'save' : 'edit'} className="text-base" />
              {isEditable ? 'Salvar' : 'Editar'}
            </button>
            
            <div className="w-px h-8 bg-slate-200 dark:bg-zinc-800 mx-1" />
            
            <button 
             onClick={() => handleShareWhatsApp(selectedDayIdx)}
             className="flex items-center justify-center w-12 h-12 rounded-2xl bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 active:scale-90 transition-all"
             title="Copiar WhatsApp"
            >
              <Icon name="content_copy" className="text-xl" />
            </button>
            
            <button 
             onClick={() => window.print()}
             className="flex items-center justify-center w-12 h-12 rounded-2xl bg-slate-900 dark:bg-slate-700 text-white shadow-lg shadow-slate-900/20 active:scale-90 transition-all"
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
        />

        <SyncBlockingOverlay syncStatus={syncStatus} />
      </>
    );
};

export default App;
