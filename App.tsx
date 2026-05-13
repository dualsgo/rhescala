
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useDialog } from './contexts/DialogContext';
import { useLocalStorage, useLocalPreference, useSyncStatus } from './hooks/useLocalStorage';
import { generateYearSchedule, applyMonthUpdate, resolveTacticalDay, calculateLunches, getShiftClassification, findSundayViolations, isWorkingShift, distributeTacticalPositions } from './hooks/useScheduleEngine';


import { Header } from './components/Header';
import { toPng } from 'html-to-image';

import { ShiftGrid } from './components/ShiftGrid';
import { TeamView } from './components/TeamView';
import { AnalysisPanel } from './components/AnalysisPanel';
import { HolidayManager } from './components/HolidayManager';
import { DaySummaryCard } from './components/DaySummaryCard';
import { DataManager } from './components/DataManager';
import { WorkedHolidaysList } from './components/WorkedHolidaysList';
import { CleaningSchedule } from './components/CleaningSchedule';
import { EssentialActivities } from './components/EssentialActivities';
import { DailyRoutine } from './components/DailyRoutine';
import { OperationalNotices } from './components/OperationalNotices';
import { Icon } from './components/Icon';
import { Login } from './components/Login';
import { PrintableSchedule } from './components/PrintableSchedule';
import { useHolidayCredits } from './hooks/useHolidayCredits';
import { PLACEHOLDER_EMPLOYEE, PLACEHOLDER_EMPLOYEE_ID, SHIFT_HOURS, buildHolidaySet, getDefaultHourForDay, getNationalHolidays, DEFAULT_JORNADA_SETTINGS } from './constants';
import { Employee, MonthYear, Holiday, JornadaSettings } from './types';
import { HelpCenter } from './components/HelpCenter';
import { JornadaManager } from './components/JornadaManager';
import { EmployeeScheduleCard } from './components/EmployeeScheduleCard';

const App: React.FC = () => {
  const [employees, setEmployees] = useLocalStorage<Employee[]>('riHappyEmployeesData', [PLACEHOLDER_EMPLOYEE]);
  const [jornadaSettings, setJornadaSettings] = useLocalStorage<JornadaSettings>('riHappyJornadaSettings', DEFAULT_JORNADA_SETTINGS);

  const [customHolidays, setCustomHolidays] = useLocalStorage<Holiday[]>('riHappyCustomHolidays', []);
  const [monthNotes, setMonthNotes] = useLocalStorage<Record<string, string>>('riHappyMonthNotes', {});
  const [trackingStartDate, setTrackingStartDate] = useLocalStorage<string>('riHappyTrackingStart', `${new Date().getFullYear()}-01-01`);
  const syncStatus = useSyncStatus();
  const [showHolidayManager, setShowHolidayManager] = useState(false);
  const [showDayDetail, setShowDayDetail] = useState(false);
  const [currentView, setCurrentView] = useState<'grid' | 'analysis' | 'team' | 'jornada' | 'data' | 'feriados' | 'worked-holidays' | 'cleaning' | 'activities' | 'routine' | 'notices'>('grid');
  const [currentMY, setCurrentMY] = useState<MonthYear>({ month: new Date().getMonth(), year: new Date().getFullYear() });
  const [validatedMonths, setValidatedMonths] = useLocalStorage<Record<string, boolean>>('riHappyValidatedMonths', {});
  const [selectedDayIdx, setSelectedDayIdx] = useState(new Date().getDate() - 1);
  const [filter, setFilter] = useState<'all' | 'sunday' | 'holiday' | 'week'>('all');
  const [isDarkMode] = useLocalPreference<boolean>('riHappyDarkMode', false);
  const { showDialog } = useDialog();
  const [waModal, setWaModal] = useState<{ show: boolean, text: string }>({ show: false, text: '' });
  const [showHelp, setShowHelp] = useState(false);
  const [selectedEmployeeForCard, setSelectedEmployeeForCard] = useState<Employee | null>(null);
  const [auth, setAuth] = useState<{ isAuthenticated: boolean, role: 'admin' | 'viewer' }>({ isAuthenticated: false, role: 'viewer' });
  const [authenticatedEmployeeId, setAuthenticatedEmployeeId] = useState<string | null>(null);
  
  const monthKey = `${currentMY.year}-${String(currentMY.month + 1).padStart(2, '0')}`;
  
  const isReadOnly = auth.role === 'viewer';
  const isValidated = validatedMonths[monthKey] || false;
  
  const onToggleValidation = useCallback(async () => {
    const newVal = !isValidated;
    const confirmed = await showDialog({
      title: newVal ? 'Oficializar Escala' : 'Retornar para Rascunho',
      message: newVal 
        ? `Deseja oficializar a escala de ${new Date(currentMY.year, currentMY.month).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}? Ela ficará visível para toda a equipe.`
        : 'A escala voltará ao modo rascunho e ficará oculta para a equipe. Continuar?',
      type: 'confirm'
    });
    if (confirmed) {
      setValidatedMonths(prev => ({ ...prev, [monthKey]: newVal }));
    }
  }, [isValidated, monthKey, currentMY, setValidatedMonths, showDialog]);

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

  const onUpdateEmployee = useCallback((empId: string, data: Partial<Employee>) => {
    setEmployees(prev => prev.map(emp => emp.id === empId ? { ...emp, ...data } : emp));
  }, [setEmployees]);

  const sundayViolations = useMemo(() => findSundayViolations(employees, currentMY), [employees, currentMY]);

  const onDeleteEmployee = useCallback((empId: string) => {
    setEmployees(prev => prev.filter(emp => emp.id !== empId));
  }, [setEmployees]);

  const onAddEmployee = useCallback((name: string, isYoung: boolean, courseDay: string, cargo: any, birthday: string) => {
    let preferredDayOff = '';
    if (cargo === 'Estoquista') preferredDayOff = 'Domingo';
    if (cargo === 'Aprendiz') preferredDayOff = 'Sábado';

    const newEmp: Employee = {
      ...PLACEHOLDER_EMPLOYEE,
      id: Math.random().toString(36).substring(2, 9),
      name,
      isYoungApprentice: isYoung,
      courseDay: isYoung ? courseDay : undefined,
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
    setCustomHolidays(prev => prev.filter(h => h.id !== id));
  }, [setCustomHolidays]);

  const [isEditable, setIsEditable] = useState(false);
  const [allowRetroactive, setAllowRetroactive] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  
  const canGoNext = useMemo(() => {
    const today = new Date();
    const isCurrentOrPast = new Date(currentMY.year, currentMY.month, 1) < new Date(today.getFullYear(), today.getMonth(), 1);
    
    // Admins can go to next month (to prepare it)
    // Viewers are locked to current/past months
    if (isReadOnly) return isCurrentOrPast;
    
    const limitDate = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    const targetDate = new Date(currentMY.year, currentMY.month, 1);
    return targetDate < limitDate;
  }, [currentMY, isReadOnly]);

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
      const isHoliday = buildHolidaySet(currentMY.year, customHolidays).has(`${currentMY.year}-${String(currentMY.month + 1).padStart(2, '0')}-${String(dayIdx + 1).padStart(2, '0')}`);
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

  const handleApplyFolgas = (targetMY = currentMY, targetKey = monthKey) => {
    setEmployees(prev => prev.map(emp => {
      if (emp.status !== 'active') return emp;
      const shifts = [...(emp.shifts[targetKey] || [])];
      const daysInMonth = new Date(targetMY.year, targetMY.month + 1, 0).getDate();
      for (let d = 0; d < daysInMonth; d++) {
        const date = new Date(targetMY.year, targetMY.month, d + 1);
        const dow = date.toLocaleDateString('pt-BR', { weekday: 'long' });
        if (dow.toLowerCase() === emp.preferredDayOff?.toLowerCase()) {
           shifts[d] = 'F';
        }
      }
      return { ...emp, shifts: { ...emp.shifts, [targetKey]: shifts } };
    }));
  };

  const handleSortearDomingo = (targetMY = currentMY, targetKey = monthKey, skipConfirm = false) => {
    const perform = () => {
      const updatedData = applyMonthUpdate(employees, targetMY.year, targetMY.month, customHolidays, jornadaSettings);
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
    const weekdaysFull = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    const date = new Date(currentMY.year, currentMY.month, dayIdx + 1);
    const weekdayName = weekdaysFull[date.getDay()];
    const dateFormatted = `${String(dayIdx + 1).padStart(2, '0')}/${String(currentMY.month + 1).padStart(2, '0')}`;
    
    const dateStr = `${currentMY.year}-${String(currentMY.month + 1).padStart(2, '0')}-${String(dayIdx + 1).padStart(2, '0')}`;
    const isHoliday = buildHolidaySet(currentMY.year, customHolidays).has(dateStr);
    const isSunday = date.getDay() === 0;

    let text = `📅 *Escala ${weekdayName} ${dateFormatted}*\n`;
    if (isHoliday) {
      text += `⏱️ Jornada 5h45 + 15 min. pausa\n`;
    }
    text += `\n📍 *Posicionamento*\n`;
    text += `🟥 P1 Caixa\n`;
    text += `🟨 P2 Porta\n`;
    text += `🟩 P3 Salão\n`;
    text += `🟦 P4 Flexível\n\n`;

    const groups: Record<string, any[]> = {};
    const folgas: string[] = [];

    const activeEmps = employees.filter(e => !e.isHidden && e.status === 'active');
    const resolvedPositions = resolveTacticalDay(activeEmps, monthKey, dayIdx, isHoliday, isSunday, jornadaSettings);
    
    activeEmps.forEach(e => {
      const shift = e.shifts[monthKey]?.[dayIdx] || 'T';

      
      if (shift === 'F' || shift.startsWith('FF')) {
        folgas.push(`${e.name.split(' ')[0]} (${shift})`);
        return;
      }
      
      if (!isWorkingShift(shift)) return; // Ignore FE, C, etc.



      const hour = e.dailyHours[monthKey]?.[dayIdx] || getDefaultHourForDay(e, isHoliday, isSunday);
      let pos = e.tacticalPositions?.[monthKey]?.[dayIdx];
      if (!pos || pos === 'AUTO') {
        // If the shift itself is a position, use it
        if (shift !== 'T') {
          pos = shift;
        } else {
          pos = resolvedPositions[e.id];
        }
      }
      const posEmoji = pos === 'P1' ? '🟥' : pos === 'P2' ? '🟨' : pos === 'P3' ? '🟩' : pos === 'P4' ? '🟦' : pos === 'ESTQ' ? '📦' : '🔹';

      
      if (!groups[hour]) groups[hour] = [];
      groups[hour].push({ ...e, firstName: e.name.split(' ')[0], posEmoji, pos });
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
      const shiftName = getShiftClassification(hour, isSunday);
      const isOpening = shiftName === 'Abertura';

      text += `⏰ *${shiftName} ${hour}*\n`;
      const lunches = calculateLunches(members, isHoliday, isSunday, isOpening, jornadaSettings);

      members.forEach((m, idx) => {
        text += `${m.posEmoji} ${m.firstName} (almoço ${lunches[idx]})\n`;
      });
      text += '\n';
    });

    if (folgas.length > 0) {
      text += `Folgas: ${folgas.join(', ')}\n`;
    }

    if (isHoliday) {
      text += `\n⚠️ *Aviso:* Pausa para almoço 1 colaborador por vez. Saída permitida somente após o retorno do outro. Primeira saída 14h30\n`;
    }

    setWaModal({ show: true, text });
  }, [currentMY, employees, monthKey, customHolidays]);

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
        const updatedShifts = distributeTacticalPositions(employees, currentMY, customHolidays, jornadaSettings);
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
            />

      <main className="flex-1 overflow-hidden p-2 sm:p-4">
        {(() => {
          const dateStr = `${currentMY.year}-${String(currentMY.month + 1).padStart(2, '0')}-${String(selectedDayIdx + 1).padStart(2, '0')}`;
          const isHoliday = buildHolidaySet(currentMY.year, customHolidays).has(dateStr);
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
                       <button onClick={() => setCurrentMY(prev => prev.month === 0 ? { month: 11, year: prev.year - 1 } : { ...prev, month: prev.month - 1 })} className="px-6 py-3 bg-slate-100 dark:bg-zinc-900 text-slate-600 dark:text-slate-300 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all">Ver Mês Anterior</button>
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
                    isReadOnly={isReadOnly}
                    onAdd={onAddHoliday}
                    onRemove={onRemoveHoliday}
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
            /*
            case 'cleaning':
              return (
                <CleaningSchedule
                  employees={employees}
                  currentMY={currentMY}
                  customHolidays={customHolidays}
                  onClose={() => setCurrentView('grid')}
                />
              );
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
            default:
              return null;
          }
        })()}
      </main>


      {/* Feriados Modal removed in favor of view */}
      {waModal.show && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
           <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800">
              <h3 className="text-sm font-black uppercase text-slate-800 dark:text-slate-100 mb-4">Texto para WhatsApp</h3>
              <textarea readOnly value={waModal.text} className="w-full h-64 bg-slate-50 dark:bg-slate-800 border-none rounded-xl p-4 text-xs font-mono outline-none" />
              <div className="flex gap-2 mt-4">
                <button onClick={() => { navigator.clipboard.writeText(waModal.text); setWaModal({ show: false, text: '' }); }} className="flex-1 py-3 bg-green-600 text-white rounded-xl text-[11px] font-black uppercase">Copiar e Fechar</button>
                <button onClick={() => setWaModal({ show: false, text: '' })} className="px-6 py-3 bg-slate-100 dark:bg-slate-800 text-slate-400 rounded-xl text-[11px] font-black uppercase">Fechar</button>
              </div>
           </div>
        </div>
      )}

      {showHelp && <HelpCenter onClose={() => setShowHelp(false)} />}

      {selectedEmployeeForCard && (
        <EmployeeScheduleCard 
          employee={employees.find(e => e.id === selectedEmployeeForCard.id) || selectedEmployeeForCard}
          currentMY={currentMY}
          customHolidays={customHolidays}
          holidayCredits={holidayCredits[selectedEmployeeForCard.id] || []}
          onUpdateEmployee={onUpdateEmployee}
          isAdmin={auth.role === 'admin'}
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
              readOnly
              className="w-full h-80 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-4 text-sm font-medium focus:ring-0 resize-none whitespace-pre-wrap outline-none text-slate-700 dark:text-slate-300"
              value={waModal.text}
            />
            <div className="mt-6 flex gap-3">
              <button
                onClick={async () => { 
                  navigator.clipboard.writeText(waModal.text); 
                  await showDialog({ message: 'Texto da escala copiado!' }); 
                  setWaModal({ show: false, text: '' });
                }}
                className="flex-1 bg-green-600 dark:bg-green-700 text-white font-extrabold py-3 rounded-xl shadow-lg flex items-center justify-center gap-2 hover:bg-green-700 dark:hover:bg-green-600 transition-all active:scale-95"
              >
                <Icon name="content_copy" /> Copiar Escala
              </button>
            </div>
          </div>
      {/* Floating Manager Toolbar for Mobile */}
      {!isReadOnly && currentView === 'grid' && (
        <div className="lg:hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-2 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-xl border border-slate-200 dark:border-zinc-800 p-2 rounded-3xl shadow-2xl animate-in slide-in-from-bottom-10 duration-500 ring-1 ring-black/5 dark:ring-white/10">
           <button 
            onClick={() => setIsEditable(!isEditable)}
            className={`flex items-center gap-2 px-4 py-3 rounded-2xl text-[10px] font-black uppercase transition-all ${isEditable ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}`}
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

      <PrintableSchedule 
        employees={employees} 
        currentMY={currentMY} 
        customHolidays={customHolidays} 
        monthNotes={monthNotes[monthKey] || ''}
      />
    </>
  );
};

export default App;
