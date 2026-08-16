
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useDialog } from './contexts/DialogContext';
import { useLocalStorage, useLocalPreference, useSyncStatus } from './hooks/useLocalStorage';
import { 
  generateYearSchedule, 
  applyMonthUpdate, 
  applyHoursOnly,
  applyFolgasOnly,
  applyTacticalOnly,
  detectScheduleDiffs,
  resolveTacticalDay, 
  calculateLunches, 
  getShiftClassification, 
  findSundayViolations, 
  isWorkingShift, 
  distributeTacticalPositions, 
  optimizePeakWeek 
} from './hooks/useScheduleEngine';

import { Header } from './components/Header';
import { copyToClipboard } from './src/utils/clipboard';
import { toPng } from 'html-to-image';

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
import { PLACEHOLDER_EMPLOYEE, PLACEHOLDER_EMPLOYEE_ID, SHIFT_HOURS, buildHolidaySet, getDefaultHourForDay, getNationalHolidays, DEFAULT_JORNADA_SETTINGS, getShortName } from './constants';
import { Employee, MonthYear, Holiday, JornadaSettings, OfficialScheduleSnapshot, ScheduleDiffItem } from './types';
import { HelpCenter } from './components/HelpCenter';
import { JornadaManager } from './components/JornadaManager';
import { EmployeeScheduleCard } from './components/EmployeeScheduleCard';
import { RequestManager } from './components/RequestManager';
import { InconsistencyModal } from './components/InconsistencyModal';
import { detectInconsistencies } from './components/InconsistencyPanel';
import { SyncBlockingOverlay } from './components/SyncBlockingOverlay';
import { PresetOptionsModal } from './components/PresetOptionsModal';
import { ScheduleDiffModal } from './components/ScheduleDiffModal';

const App: React.FC = () => {
  const [employees, setEmployees] = useLocalStorage<Employee[]>('riHappyEmployeesData', [PLACEHOLDER_EMPLOYEE]);
  const [jornadaSettings, setJornadaSettings] = useLocalStorage<JornadaSettings>('riHappyJornadaSettings', DEFAULT_JORNADA_SETTINGS);

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

  const monthKey = `${currentMY.year}-${String(currentMY.month + 1).padStart(2, '0')}`;

  const scheduleDiffs = useMemo(
    () => detectScheduleDiffs(officialSnapshots[monthKey], employees, currentMY),
    [officialSnapshots, employees, currentMY, monthKey]
  );

  const activeInconsistencies = useMemo(
    () => detectInconsistencies(employees, currentMY.year, currentMY.month, new Date()),
    [employees, currentMY]
  );
  const [filter, setFilter] = useState<'all' | 'sunday' | 'holiday' | 'week'>('all');
  const [isDarkMode] = useLocalPreference<boolean>('riHappyDarkMode', false);
  const { showDialog } = useDialog();
  const [waModal, setWaModal] = useState<{ show: boolean, text: string }>({ show: false, text: '' });
  const [showHelp, setShowHelp] = useState(false);
  const [selectedEmployeeForCard, setSelectedEmployeeForCard] = useState<Employee | null>(null);
  const [auth, setAuth] = useState<{ isAuthenticated: boolean, role: 'admin' | 'viewer' }>({ isAuthenticated: false, role: 'viewer' });
  const [authenticatedEmployeeId, setAuthenticatedEmployeeId] = useState<string | null>(null);
  
  const isReadOnly = auth.role === 'viewer';
  const isValidated = validatedMonths[monthKey] || false;
  
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
        createSnapshot = choice;
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

  const allHolidayCredits = useHolidayCredits(employees, customHolidays, currentMY.year, trackingStartDate);
  
  // For Viewers, we only show holiday credits that come from VALIDATED months
  const holidayCredits = useMemo(() => {
    if (!isReadOnly) return allHolidayCredits;
    
    const filtered: Record<string, any[]> = {};
    Object.keys(allHolidayCredits).forEach(empId => {
      const credits = allHolidayCredits[empId] || [];
      filtered[empId] = credits.filter(credit => {
        if (!credit.holidayDate) return false;
        const [y, m] = credit.holidayDate.split('-');
        const key = `${y}-${m}`;
        return validatedMonths[key] === true;
      });
    });
    return filtered;
  }, [allHolidayCredits, isReadOnly, validatedMonths]);

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

  const onAddEmployee = useCallback((name: string, isYoung: boolean, courseDay: string, cargo: any, birthday: string, contractType?: 'CLT' | 'Sazonal', jornada?: '6x1' | '5x2') => {
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

  const onUpdateEmployeeDailyHour = useCallback((empId: string, dayIdx: number, newHour: string) => {
    setEmployees(prev => prev.map(emp => {
      if (emp.id !== empId) return emp;
      const hours = [...(emp.dailyHours[monthKey] || [])];
      hours[dayIdx] = newHour;
      return { ...emp, dailyHours: { ...emp.dailyHours, [monthKey]: hours } };
    }));
  }, [monthKey, setEmployees]);

  const onUpdateTacticalPosition = useCallback((empId: string, dayIdx: number, newPos: string | null) => {
    setEmployees(prev => {
      const monthKey = `${currentMY.year}-${String(currentMY.month + 1).padStart(2, '0')}`;
      const activeEmps = prev.filter(e => !e.isHidden && e.status === 'active');
      
      // 1. Identify target employee and their group
      const targetEmp = prev.find(e => e.id === empId);
      if (!targetEmp) return prev;
      
      const targetHour = targetEmp.dailyHours[monthKey]?.[dayIdx] || targetEmp.workPeriod;
      const date = new Date(currentMY.year, currentMY.month, dayIdx + 1);
      const isSunday = date.getDay() === 0;
      const targetGroup = getShiftClassification(targetHour, isSunday);

      // 2. Get current resolved positions for this group
      const isHoliday = buildHolidaySet(currentMY.year, customHolidays, deletedNationalHolidays).has(`${currentMY.year}-${String(currentMY.month + 1).padStart(2, '0')}-${String(dayIdx + 1).padStart(2, '0')}`);
      const resolved = resolveTacticalDay(activeEmps, monthKey, dayIdx, isHoliday, isSunday, jornadaSettings);
      
      const oldPos = targetEmp.tacticalPositions?.[monthKey]?.[dayIdx] || resolved[empId];

      return prev.map(emp => {
        // If it's the employee we are editing
        if (emp.id === empId) {
          const positions = [...(emp.tacticalPositions?.[monthKey] || [])];
          positions[dayIdx] = newPos;
          return { ...emp, tacticalPositions: { ...emp.tacticalPositions, [monthKey]: positions } };
        }

        // If it's another employee, check if they are in the same group and had the 'newPos'
        const empHour = emp.dailyHours[monthKey]?.[dayIdx] || emp.workPeriod;
        const empGroup = getShiftClassification(empHour, isSunday);
        
        if (empGroup === targetGroup && newPos !== 'AUTO') {
          const empCurrentPos = emp.tacticalPositions?.[monthKey]?.[dayIdx] || resolved[emp.id];
          if (empCurrentPos === newPos) {
            // Swap: Give them the old position of the target employee
            const positions = [...(emp.tacticalPositions?.[monthKey] || [])];
            positions[dayIdx] = oldPos;
            return { ...emp, tacticalPositions: { ...emp.tacticalPositions, [monthKey]: positions } };
          }
        }

        return emp;
      });
    });
  }, [currentMY, customHolidays]);

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
      const updatedShifts = applyFolgasOnly(employees, currentMY.year, currentMY.month, empId, customHolidays, deletedNationalHolidays, activeJornadaSettings);
      setEmployees(prev => prev.map(emp => {
        if (updatedShifts[emp.id]) {
          return { ...emp, shifts: { ...emp.shifts, [monthKey]: updatedShifts[emp.id] } };
        }
        return emp;
      }));
      showDialog({ title: 'Sucesso', message: 'Folgas e rotação de domingos recalculadas com sucesso! Horários customizados foram preservados.' });
    } else if (applyMode === 'tactical_only') {
      const updatedPositions = applyTacticalOnly(employees, currentMY.year, currentMY.month, customHolidays, deletedNationalHolidays, activeJornadaSettings);
      setEmployees(prev => prev.map(emp => {
        if (updatedPositions[emp.id]) {
          return { ...emp, tacticalPositions: { ...emp.tacticalPositions, [monthKey]: updatedPositions[emp.id] } };
        }
        return emp;
      }));
      showDialog({ title: 'Sucesso', message: 'Posições táticas (P1 a P4 e Estoque) redistribuídas com sucesso!' });
    } else if (applyMode === 'full') {
      const updatedData = applyMonthUpdate(employees, currentMY.year, currentMY.month, customHolidays, deletedNationalHolidays, activeJornadaSettings);
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
      showDialog({ title: 'Sucesso', message: 'Redefinição geral completa aplicada com sucesso!' });
    }
  }, [employees, currentMY, monthKey, customHolidays, deletedNationalHolidays, activeJornadaSettings, setEmployees, showDialog]);

  const handleApplyFolgas = (targetMY = currentMY, targetKey = monthKey) => {
    // We now use applyMonthUpdate which does a full sweep of folgas and hours resetting.
    const updatedData = applyMonthUpdate(employees, targetMY.year, targetMY.month, customHolidays, deletedNationalHolidays, jornadaSettings);
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
      const updatedData = applyMonthUpdate(employees, targetMY.year, targetMY.month, customHolidays, deletedNationalHolidays, jornadaSettings);
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

  const handleShareWhatsApp = useCallback((dayIdx: number) => {
    try {
      const weekdaysFull = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
      const date = new Date(currentMY.year, currentMY.month, dayIdx + 1);
      const weekdayName = weekdaysFull[date.getDay()];
      const dateFormatted = `${String(dayIdx + 1).padStart(2, '0')}/${String(currentMY.month + 1).padStart(2, '0')}`;
      
      const dateStr = `${currentMY.year}-${String(currentMY.month + 1).padStart(2, '0')}-${String(dayIdx + 1).padStart(2, '0')}`;
      const isHoliday = buildHolidaySet(currentMY.year, customHolidays, deletedNationalHolidays).has(dateStr);
      const isSunday = date.getDay() === 0;

      let text = `📅 *Escala ${weekdayName} ${dateFormatted}*\n`;
      if (isHoliday) {
        text += `⏱️ Jornada 5h45 + 15 min. pausa\n`;
      }
      text += `\n`;

      const groups: Record<string, any[]> = {};
      const folgas: string[] = [];

      const activeEmps = (employees || []).filter(e => e && !e.isHidden && e.status === 'active');
      const resolvedPositions = resolveTacticalDay(activeEmps, monthKey, dayIdx, isHoliday, isSunday, activeJornadaSettings);
      
      activeEmps.forEach(e => {
        const shift = e.shifts?.[monthKey]?.[dayIdx] || 'T';
        
        if (shift === 'F' || (typeof shift === 'string' && shift.startsWith('FF'))) {
          folgas.push(`${getShortName(e.name, activeEmps)} (${shift})`);
          return;
        }
        
        if (!isWorkingShift(shift)) return; // Ignore FE, C, etc.

        const hour = e.dailyHours?.[monthKey]?.[dayIdx] || getDefaultHourForDay(e, isHoliday, isSunday);
        let pos = e.tacticalPositions?.[monthKey]?.[dayIdx];
        if (!pos || pos === 'AUTO') {
          if (shift !== 'T') pos = shift;
          else pos = resolvedPositions[e.id];
        }
        const posEmoji = pos === 'P1' ? '🟥' : pos === 'P2' ? '🟨' : pos === 'P3' ? '🟩' : pos === 'P4' ? '🟦' : pos === 'ESTQ' ? '📦' : '🔹';
        
        if (!groups[hour]) groups[hour] = [];
        groups[hour].push({ ...e, firstName: getShortName(e.name, activeEmps), posEmoji, pos });
      });

      const hourOrder = isHoliday ? ['12h às 18h', '13h às 19h', '14h às 20h', '15h às 21h'] : 
                        isSunday ? ['12h às 20h', '13h às 21h'] :
                        ['10h às 16h15', '10h às 18h20', '12h às 20h20', '13h40 às 22h'];

      Object.keys(groups).sort((a, b) => {
        const idxA = hourOrder.indexOf(a);
        const idxB = hourOrder.indexOf(b);
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        return a.localeCompare(b);
      }).forEach(hour => {
        const members = groups[hour];
        const shiftName = getShiftClassification(hour, isSunday, activeJornadaSettings);
        const isOpening = shiftName === 'Abertura';

        text += `⏰ *${shiftName} ${hour}*\n`;
        const lunches = calculateLunches(members, isHoliday, isSunday, isOpening, activeJornadaSettings) || [];

        members.forEach((m, idx) => {
          const lunchTime = lunches[idx] || '13h';
          text += `${m.posEmoji} ${m.firstName} (almoço ${lunchTime})\n`;
        });
        text += '\n';
      });

      if (folgas.length > 0) {
        text += `Folgas: ${folgas.join(', ')}\n`;
      }

      const workingEmps = activeEmps.filter(e => isWorkingShift(e.shifts?.[monthKey]?.[dayIdx] || 'T'));
      if (workingEmps.length > 0) {
        const empsWithPos = workingEmps.map(e => {
          const shift = e.shifts?.[monthKey]?.[dayIdx] || 'T';
          const hour = e.dailyHours?.[monthKey]?.[dayIdx] || getDefaultHourForDay(e, isHoliday, isSunday);
          const shiftName = getShiftClassification(hour, isSunday, activeJornadaSettings);
          let pos = e.tacticalPositions?.[monthKey]?.[dayIdx];
          if (!pos || pos === 'AUTO') {
            if (shift !== 'T') pos = shift;
            else pos = resolvedPositions[e.id];
          }
          return { ...e, shiftName, pos };
        });

        const getPriority = (pos: string) => {
          if (pos === 'P3') return 1;
          if (pos === 'P1') return 2;
          if (pos === 'P4') return 3;
          return 4;
        };

        const pickDigital = (group: any[], excludeIds: string[] = [], seedOffset: number = 0) => {
          let available = group.filter(e => !excludeIds.includes(e.id));
          if (available.length === 0) available = group;
          if (available.length === 0) return null;
          const minPriority = Math.min(...available.map(e => getPriority(e.pos)));
          const candidates = available.filter(e => getPriority(e.pos) === minPriority);
          candidates.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
          const digitalIdx = (dayIdx * 7 + currentMY.month * 11 + seedOffset) % Math.max(1, candidates.length);
          return candidates[digitalIdx];
        };

        const turno1 = empsWithPos.filter(e => e.shiftName === 'Abertura');
        const turno2 = empsWithPos.filter(e => e.shiftName !== 'Abertura');

        let digital1 = pickDigital(turno1);
        let digital2 = pickDigital(turno2);
        
        if (!digital1 && turno2.length > 1) {
          const remaining = turno2.filter(e => e.id !== digital2?.id);
          digital1 = pickDigital(remaining);
        } else if (!digital2 && turno1.length > 1) {
          const remaining = turno1.filter(e => e.id !== digital1?.id);
          digital2 = pickDigital(remaining);
        }

        text += `\n📱 *Digital (WhatsApp da Loja)*\n`;
        const digitals = [digital1, digital2].filter(Boolean);
        if (digitals.length > 0) {
          digitals.forEach(d => {
            text += `• ${d.shiftName}: ${getShortName(d.name, activeEmps)}\n`;
          });
        } else {
          text += `• Responsável: Não definido\n`;
        }

        const excludeForRetiradas = [digital1?.id, digital2?.id].filter(Boolean) as string[];
        let retirada1 = pickDigital(turno1, excludeForRetiradas, 3);
        let retirada2 = pickDigital(turno2, excludeForRetiradas, 3);

        if (!retirada1 && turno2.length > 1) {
          const remaining = turno2.filter(e => e.id !== retirada2?.id);
          retirada1 = pickDigital(remaining, excludeForRetiradas, 3);
        } else if (!retirada2 && turno1.length > 1) {
          const remaining = turno1.filter(e => e.id !== retirada1?.id);
          retirada2 = pickDigital(remaining, excludeForRetiradas, 3);
        }

        text += `\n🛍️ *Retiradas Online*\n`;
        const retiradas = [retirada1, retirada2].filter(Boolean);
        if (retiradas.length > 0) {
          retiradas.forEach(r => {
            text += `• ${r.shiftName}: ${getShortName(r.name, activeEmps)}\n`;
          });
        } else {
          text += `• Responsável: Não definido\n`;
        }
      }

      if (isHoliday) {
        text += `\n⚠️ *Aviso:* Pausa para almoço 1 colaborador por vez. Saída permitida somente após o retorno do outro. Primeira saída 14h30\n`;
      }

      setWaModal({ show: true, text });
    } catch (err: any) {
      console.error('Erro ao gerar escala para WhatsApp:', err);
      showDialog({
        title: 'Erro de Geração',
        message: `Ocorreu um erro ao gerar o texto da escala para WhatsApp: ${err?.message || String(err)}`,
        type: 'alert'
      });
    }
  }, [currentMY, employees, monthKey, customHolidays, deletedNationalHolidays, activeJornadaSettings, showDialog]);

  const handleShareApoioWhatsApp = useCallback((dayIdx: number) => {
    try {
      const dateStr = `${currentMY.year}-${String(currentMY.month + 1).padStart(2, '0')}-${String(dayIdx + 1).padStart(2, '0')}`;
      const isHoliday = buildHolidaySet(currentMY.year, customHolidays, deletedNationalHolidays).has(dateStr);
      const date = new Date(currentMY.year, currentMY.month, dayIdx + 1);
      const isSunday = date.getDay() === 0;

      let text = `🛠️ *Apoio Operacional*\n\n`;

      text += `📍 *Posicionamento Diário*\n`;
      text += `🟥 *P1 – Caixa*\n`;
      text += `• Só deixa o posto quando houver rendição.\n`;
      text += `• Sem filas: não ficar parado. Adiantar saquinhos de presente e alinhar produtos próximos.\n\n`;
      
      text += `🟨 *P2 – Porta*\n`;
      text += `• Foco 100% no fluxo. Tocar o sino em ondas de clientes.\n`;
      text += `• Quando assumir rendição, retornar imediatamente ao posto de origem depois.\n\n`;
      
      text += `🟩 *P3 – Salão / Anfitrião*\n`;
      text += `• Largar qualquer tarefa de arrumação imediatamente se visualizar um cliente.\n`;
      text += `• 2º nível de apoio ao caixa (acionado quando P4 não der conta).\n\n`;

      text += `🟦 *P4 – Suporte Flexível*\n`;
      text += `• Atendimento digital (WhatsApp da loja), precificação e abastecimento (só sem clientes).\n`;
      text += `• 1º nível de apoio ao caixa: largar tudo e ir se o sino tocar.\n\n`;

      text += `⚡ *Dança de Cobertura*\n`;
      text += `• Ida p/ Caixa: Vai o P4 > P3 > P2 (emergência extrema).\n`;
      text += `• Retorno: P2 > P3 > P4.\n\n`;

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

      const p1Abertura = allWorkingEmps.find(m => m.pos === 'P1' && m.shiftName === 'Abertura');
      const p1Fechamento = allWorkingEmps.find(m => m.pos === 'P1' && (m.shiftName === 'Fechamento' || m.shiftName === 'Intermediário'));

      if (p1Abertura && p1Fechamento) {
        text += `🤝 *Revezamento (P1)*\n`;
        text += `• O(a) ${p1Fechamento.firstName} (Fechamento) rende o almoço do(a) ${p1Abertura.firstName} (Abertura). Quando o(a) ${p1Abertura.firstName} retornar, o(a) ${p1Fechamento.firstName} almoça.\n`;
        text += `• Quando ambos presentes, o(a) ${p1Abertura.firstName} tem prioridade no P1, e o(a) ${p1Fechamento.firstName} atua no P3/P4.\n\n`;
      }

      text += `*Tempo Ocioso:* P1 abastece o balcão/saquinhos. Se tiver muitos no P3, foquem em arrumar a seção e abastecer no baixo fluxo.\n`;

      setWaModal({ show: true, text });
    } catch (err: any) {
      console.error('Erro ao gerar apoio para WhatsApp:', err);
      showDialog({
        title: 'Erro de Geração',
        message: `Ocorreu um erro ao gerar o texto de apoio: ${err?.message || String(err)}`,
        type: 'alert'
      });
    }
  }, [currentMY, employees, monthKey, customHolidays, deletedNationalHolidays, activeJornadaSettings, showDialog]);

  const handleCreateMonth = () => {
    const nextDate = new Date(currentMY.year, currentMY.month + 1, 1);
    const nextMY = { month: nextDate.getMonth(), year: nextDate.getFullYear() };
    const nextKey = `${nextMY.year}-${String(nextMY.month + 1).padStart(2, '0')}`;
    
    setCurrentMY(nextMY);
    
    // Apply logic directly to next month parameters
    handleApplyFolgas(nextMY, nextKey);
    setTimeout(() => {
      handleSortearDomingo(nextMY, nextKey, true); // Skip confirm for "Create Month" flow
    }, 200);
  };

  const handleDistributePositions = () => {
    showDialog({
      title: 'Distribuir Posições',
      message: 'Deseja substituir turnos "T" por posições táticas (P1-P4) para este mês? Suas folgas não serão alteradas.',
      type: 'confirm'
    }).then(ok => {
      if (ok) {
        const updatedShifts = distributeTacticalPositions(employees, currentMY, customHolidays, deletedNationalHolidays, jornadaSettings);
        setEmployees(prev => prev.map(emp => {
          if (updatedShifts[emp.id]) {
            return {
              ...emp,
              shifts: { ...emp.shifts, [monthKey]: updatedShifts[emp.id].shifts }
            };
          }
          return emp;
        }));
        showDialog({ title: 'Sucesso', message: 'Posições distribuídas com sucesso!', type: 'alert' });
      }
    });
  };

  const handleOptimizePeakWeek = () => {
    showDialog({
      title: '🎄 Otimização da Semana de Pico (Natal 18-24/12)',
      message: 'Esta operação reorganiza as folgas entre os dias 18 e 24 de Dezembro para manter 100% da equipe trabalhando nos dias 22, 23 e 24, escalonando a folga semanal entre os dias 18 e 21 sem nenhuma violação da regra 6x1 da CLT. Deseja aplicar?',
      type: 'confirm'
    }).then(ok => {
      if (ok) {
        const peakResult = optimizePeakWeek(employees, monthKey, 18, 24, [22, 23, 24]);
        setEmployees(prev => prev.map(emp => {
          if (peakResult[emp.id]) {
            return {
              ...emp,
              shifts: { ...emp.shifts, [monthKey]: peakResult[emp.id].shifts }
            };
          }
          return emp;
        }));
        showDialog({ title: 'Sucesso', message: 'Semana de Natal otimizada com 100% da equipe presente nos dias 22, 23 e 24!', type: 'alert' });
      }
    });
  };


  if (!auth.isAuthenticated) {
    return <Login onLogin={(role) => setAuth({ isAuthenticated: true, role })} />;
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
              onDistributePositions={handleDistributePositions}
              showNotes={showNotes}
              onToggleNotes={() => setShowNotes(!showNotes)}
              onLogout={() => setAuth({ isAuthenticated: false, role: 'viewer' })}
              onSwitchRole={() => {
                if (auth.role === 'admin') {
                  setAuth(prev => ({ ...prev, role: 'viewer' }));
                } else {
                  // If switching from viewer to admin, we must logout to force password entry
                  setAuth({ isAuthenticated: false, role: 'viewer' });
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
            />

       <main className="flex-1 overflow-hidden p-2 sm:p-4">
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
                   isReadOnly={isReadOnly}
                   isEditable={isEditable}
                   allowRetroactive={allowRetroactive}
                   showNotes={showNotes}
                   onCloseNotes={() => setShowNotes(false)}
                   resolvedPositions={selectedDayResolvedPositions}
                   onSelectDay={setSelectedDayIdx}
                   onUpdateShift={(empId, d, s) => {
                     if (isReadOnly) return;
                     setEmployees(prev => prev.map(emp => {
                       if (emp.id !== empId) return emp;
                       const sfs = [...(emp.shifts[monthKey] || [])];
                       sfs[d] = s;
                       return { ...emp, shifts: { ...emp.shifts, [monthKey]: sfs } };
                     }));
                   }}
                   onUpdateShifts={(updates) => {
                     if (isReadOnly) return;
                     setEmployees(prev => prev.map(emp => {
                       const empU = updates.filter(u => u.empId === emp.id);
                       if (empU.length === 0) return emp;
                       const sfs = [...(emp.shifts[monthKey] || [])];
                       empU.forEach(u => { sfs[u.dayIdx] = u.newShift; });
                       return { ...emp, shifts: { ...emp.shifts, [monthKey]: sfs } };
                     }));
                   }}
                   onUpdateEmployeeDailyHour={(empId, dayIdx, newHour) => {
                     if (isReadOnly) return;
                     onUpdateEmployeeDailyHour(empId, dayIdx, newHour);
                   }}
                   onUpdateTacticalPosition={(empId, dayIdx, newPos) => {
                     if (isReadOnly) return;
                     onUpdateTacticalPosition(empId, dayIdx, newPos);
                   }}
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
                   onOpenPresetForEmployee={(empId) => {
                     setPresetInitialEmpId(empId);
                     setShowPresetModal(true);
                   }}
                   onOpenEmployeeCard={async (emp) => {
                     if (auth.role === 'admin' || authenticatedEmployeeId === emp.id) {
                       setSelectedEmployeeForCard(emp);
                     } else {
                       // Request employee password
                       const password = await showDialog({
                         type: 'prompt',
                         title: `Acesso Individual: ${emp.name}`,
                         message: 'Digite sua senha pessoal para acessar seus dados e enviar pedidos.'
                       });

                       if (password === emp.password || (!emp.password && password === '1234')) {
                         setAuthenticatedEmployeeId(emp.id);
                         setSelectedEmployeeForCard(emp);
                       } else if (password !== null) {
                         showDialog({ title: 'Erro', message: 'Senha individual incorreta.', type: 'alert' });
                       }
                     }
                   }}
                 />
               );
             case 'analysis':
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
               return (
                 <RequestManager
                   employees={employees}
                   currentMY={currentMY}
                   onUpdateEmployee={onUpdateEmployee}
                   isReadOnly={isReadOnly}
                 />
               );
             default:
               return null;
           }
         })()}
       </main>


       {/* Feriados Modal removed in favor of view */}

       {showHelp && <HelpCenter onClose={() => setShowHelp(false)} />}

       {selectedEmployeeForCard && (
         <EmployeeScheduleCard 
           employees={employees}
           employee={employees.find(e => e.id === selectedEmployeeForCard.id) || selectedEmployeeForCard}
           currentMY={currentMY}
           customHolidays={customHolidays}
           holidayCredits={holidayCredits[selectedEmployeeForCard.id] || []}
           onUpdateEmployee={onUpdateEmployee}
           isAdmin={auth.role === 'admin'}
           isValidated={isReadOnly}
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
                 />
               </div>
             </div>
           </div>
         </div>
       )}

       {/* WhatsApp Modal */}
       {waModal.show && (
         <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/40 dark:bg-slate-950/60 backdrop-blur-sm animate-fade-in">
           <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 max-w-lg w-full shadow-2xl border border-slate-200 dark:border-slate-800">
             <div className="flex justify-between items-center mb-6">
               <h4 className="text-xl font-extrabold flex items-center gap-2 text-slate-900 dark:text-slate-100">
                 <Icon name="chat" className="text-green-600 dark:text-green-500" /> Escala Diária
               </h4>
               <button onClick={() => setWaModal({ show: false, text: '' })} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-400">
                 <Icon name="close" />
               </button>
             </div>
             <textarea
               onChange={(e) => setWaModal(prev => ({ ...prev, text: e.target.value }))}
               className="w-full h-80 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-4 text-sm font-medium focus:ring-2 focus:ring-green-500/50 resize-none whitespace-pre-wrap text-slate-900 dark:text-slate-100"
               value={waModal.text}
             />
             <div className="mt-6 flex gap-3">
               <button
                 onClick={async () => { 
                   const copied = await copyToClipboard(waModal.text); 
                   if (copied) {
                     await showDialog({ message: 'Texto da escala copiado com sucesso! Você já pode colar no WhatsApp.' }); 
                   } else {
                     await showDialog({ message: 'Não foi possível copiar automaticamente. Por favor, selecione e copie o texto no campo acima.', type: 'alert' }); 
                   }
                   setWaModal({ show: false, text: '' });
                 }}
                 className="flex-1 bg-green-600 dark:bg-green-700 text-white font-extrabold py-3 rounded-xl shadow-lg flex items-center justify-center gap-2 hover:bg-green-700 dark:hover:bg-green-800 transition-all active:scale-95"
               >
                 <Icon name="content_copy" /> Copiar Escala
               </button>
             </div>
           </div>
         </div>
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
            const monthKeyStr = `${currentMY.year}-${String(currentMY.month + 1).padStart(2, '0')}`;
            setEmployees(prev => prev.map(emp => {
              if (emp.id !== empId) return emp;
              const sfs = [...(emp.shifts[monthKeyStr] || [])];
              sfs[dayIdx] = shift;
              return { ...emp, shifts: { ...emp.shifts, [monthKeyStr]: sfs } };
            }));
          }}
          onApplyBulkFixes={(updates) => {
            const monthKeyStr = `${currentMY.year}-${String(currentMY.month + 1).padStart(2, '0')}`;
            setEmployees(prev => prev.map(emp => {
              const empUpdates = updates.filter(u => u.empId === emp.id);
              if (empUpdates.length === 0) return emp;
              const sfs = [...(emp.shifts[monthKeyStr] || [])];
              empUpdates.forEach(u => {
                sfs[u.dayIdx] = u.newShift;
              });
              return { ...emp, shifts: { ...emp.shifts, [monthKeyStr]: sfs } };
            }));
          }}
        />

        <PresetOptionsModal
          isOpen={showPresetModal}
          onClose={() => setShowPresetModal(false)}
          employees={employees}
          currentMY={currentMY}
          initialEmployeeId={presetInitialEmpId}
          onApply={handleApplyGranularPresets}
        />

        <ScheduleDiffModal
          isOpen={showDiffModal}
          onClose={() => setShowDiffModal(false)}
          snapshot={officialSnapshots[monthKey]}
          diffs={scheduleDiffs}
          currentMY={currentMY}
          onSelectDay={(idx) => {
            setSelectedDayIdx(idx);
            setCurrentView('grid');
          }}
        />

        <PrintableSchedule 
          employees={employees} 
          currentMY={currentMY} 
          customHolidays={customHolidays} 
          monthNotes={monthNotes[monthKey] || ''}
        />

        <SyncBlockingOverlay syncStatus={syncStatus} />
      </>
    );
};

export default App;
