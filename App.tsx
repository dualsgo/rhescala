
import React, { useState, useMemo, useCallback } from 'react';
import { useDialog } from './contexts/DialogContext';
import { useLocalStorage, useLocalPreference, useSyncStatus } from './hooks/useLocalStorage';
import { generateYearSchedule, applyMonthUpdate, applyRulesSync, applyFullRotation, getTargetHours } from './hooks/useScheduleEngine';
import { calculateLunchSchedule } from './hooks/useLunchEngine';
import { calculateTacticalPositions } from './hooks/useTacticalEngine';
import { Sidebar } from './components/Sidebar';
import { Icon } from './components/Icon';
import { DaySummaryCard } from './components/DaySummaryCard';
import { ShiftGrid } from './components/ShiftGrid';
import { TeamView } from './components/TeamView';
import { AnalysisPanel } from './components/AnalysisPanel';
import { CalendarView } from './components/CalendarView';
import { HolidayManager } from './components/HolidayManager';
import { HolidayCreditPanel } from './components/HolidayCreditPanel';
import { AlertsPanel } from './components/AlertsPanel';
import { MonthlyPrintView } from './components/MonthlyPrintView';
import { APPRENTICE_WORK_PERIOD, PLACEHOLDER_EMPLOYEE, PLACEHOLDER_EMPLOYEE_ID, buildHolidaySet, SHIFT_HOURS } from './constants';
import { ShiftTemplateManager } from './components/ShiftTemplateManager';

import { Employee, ShiftType, MonthYear, Holiday, EmployeeCargo, ChangeLogEntry, ShiftTemplate } from './types';
import { HistoryPanel } from './components/HistoryPanel';


const months = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

const App: React.FC = () => {
  const [employees, setEmployees, forceSyncEmployees] = useLocalStorage<Employee[]>('riHappyEmployeesData', [PLACEHOLDER_EMPLOYEE]);
  const [customHolidays, setCustomHolidays, forceSyncHolidays] = useLocalStorage<Holiday[]>('riHappyCustomHolidays', []);
  const syncStatus = useSyncStatus();
  const [showHolidayManager, setShowHolidayManager] = useState(false);
  const [showShiftManager, setShowShiftManager] = useState(false);
  const [showPrintView, setShowPrintView] = useState(false);
  const [shiftTemplates, setShiftTemplates] = useLocalStorage<ShiftTemplate[]>('riHappyShiftTemplates', [
    { id: 't1', name: 'Padrão', type: 'weekday', hours: SHIFT_HOURS.WEEKDAY, isActive: true },
    { id: 't2', name: 'Padrão', type: 'sunday', hours: SHIFT_HOURS.SUNDAY, isActive: true },
    { id: 't3', name: 'Padrão', type: 'holiday', hours: SHIFT_HOURS.HOLIDAY, isActive: true }
  ]);

  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [currentView, setCurrentView] = useState<'team' | 'analysis' | 'grid' | 'calendar' | 'alerts' | 'config'>('grid');
  const [currentMY, setCurrentMY] = useState<MonthYear>({ month: new Date().getMonth(), year: new Date().getFullYear() });
  const [selectedDayIdx, setSelectedDayIdx] = useState(new Date().getDate() - 1);
  const [showDayDetail, setShowDayDetail] = useState(false);
  const [waModal, setWaModal] = useState<{ show: boolean; text: string }>({ show: false, text: '' });
  
  // Grid States 
  const [isEditable, setIsEditable] = useState(false);
  const [allowRetroactive, setAllowRetroactive] = useState(false);
  const [isGridLocked, setIsGridLocked] = useState(true); 
  const [isZenMode, setIsZenMode] = useState(true); 
  const [showHolidayCredit, setShowHolidayCredit] = useState(false);  // Filters
  const [filter, setFilter] = useState<'all' | 'sunday' | 'holiday' | 'week' | 'today' | 'tomorrow' | 'day'>('all');
  const [selectedWeek, setSelectedWeek] = useState(1);
  
  // History
  const [changeLogs, setChangeLogs] = useLocalStorage<ChangeLogEntry[]>('escalaChangeLogs', []);
  const [showHistory, setShowHistory] = useState(false);

  const { showDialog } = useDialog();

  const today = useMemo(() => new Date(), []);
  const monthKey = `${currentMY.year}-${String(currentMY.month + 1).padStart(2, '0')}`;
  const daysInMonth = new Date(currentMY.year, currentMY.month + 1, 0).getDate();
  const weeksInMonth = Math.ceil(daysInMonth / 7);

  const WEEKDAY_ABBR = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB'];
  const days = Array.from({ length: daysInMonth }, (_, i) => {
    const d = new Date(currentMY.year, currentMY.month, i + 1);
    return { num: i + 1, weekday: WEEKDAY_ABBR[d.getDay()] };
  });

  const onNextMonth = () => setCurrentMY(prev => prev.month === 11 ? { month: 0, year: prev.year + 1 } : { ...prev, month: prev.month + 1 });
  const onPrevMonth = () => setCurrentMY(prev => prev.month === 0 ? { month: 11, year: prev.year - 1 } : { ...prev, month: prev.month - 1 });

  const addLog = useCallback((action: string, details: string, type: 'edit' | 'auto' | 'system' = 'edit') => {
    const newLog: ChangeLogEntry = {
      id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toLocaleString('pt-BR'),
      user: 'Gestor',
      action,
      details,
      type
    };
    setChangeLogs(prev => [...prev.slice(-99), newLog]); // Mantém os últimos 100 registros
  }, [setChangeLogs]);

  // Cloud Sync Protection
  React.useEffect(() => {
    const handleConflict = async (e: any) => {
      const { resolve } = e.detail;
      const choice = await showDialog({
        title: '⚠️ Conflito de Sincronização',
        message: 'A planilha contém uma versão mais recente que a sua. Qual versão você deseja manter?',
        confirmText: 'Baixar da Planilha',
        cancelText: 'Manter Local',
        type: 'confirm'
      });
      resolve(choice === true);
    };

    const handlePersistentError = async (e: any) => {
      if (e.detail.key !== 'riHappyEmployeesData') return;
      const choice = await showDialog({
        title: '⚠️ Planilha Offline',
        message: 'Sincronização falhou. Baixe um backup para segurança.',
        confirmText: 'Baixar Backup',
        cancelText: 'Pular',
        type: 'confirm'
      });
      if (choice === true) {
        const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(e.detail.data);
        const a = document.createElement('a'); a.setAttribute('href', dataStr); a.setAttribute('download', `escala_backup_emergencia_${Date.now()}.json`);
        document.body.appendChild(a); a.click(); a.remove();
      }
    };
    window.addEventListener('sync-conflict', handleConflict);
    window.addEventListener('sync-persistent-error', handlePersistentError);
    return () => {
      window.removeEventListener('sync-conflict', handleConflict);
      window.removeEventListener('sync-persistent-error', handlePersistentError);
    };
  }, [showDialog]);

  // Auto-generate month
  React.useEffect(() => {
    if (!Array.isArray(employees) || (employees.length <= 1 && (employees[0]?.id === PLACEHOLDER_EMPLOYEE_ID || !employees[0]))) return;
    const hasData = employees.some(e => e && e.status === 'active' && e.shifts[monthKey] && e.shifts[monthKey].length > 0);
    if (!hasData) {
      const updated = applyMonthUpdate(employees, currentMY.year, currentMY.month, customHolidays);
      setEmployees(prev => {
        if (!Array.isArray(prev)) return prev;
        return prev.map(emp => {
          const empUpdated = updated[emp.id];
          if (!empUpdated) return emp;
          return { ...emp, shifts: { ...emp.shifts, [monthKey]: empUpdated.shifts }, dailyHours: { ...emp.dailyHours, [monthKey]: empUpdated.hours } };
        });
      });
    }
  }, [currentMY, monthKey, customHolidays, setEmployees, employees]); 

  // Clamp selectedDayIdx
  React.useEffect(() => {
    if (selectedDayIdx >= daysInMonth) {
      setSelectedDayIdx(daysInMonth - 1);
    }
  }, [currentMY, daysInMonth, selectedDayIdx]);
  const syncRules = useCallback(async () => {
    if (!Array.isArray(employees)) return;
    const updated = applyRulesSync(employees, currentMY.year, currentMY.month, customHolidays);
    setEmployees(prev => {
      if (!Array.isArray(prev)) return prev;
      return prev.map(emp => {
        const empUpdated = updated[emp.id];
        if (!empUpdated) return emp;
        return { ...emp, shifts: { ...emp.shifts, [monthKey]: empUpdated.shifts }, dailyHours: { ...emp.dailyHours, [monthKey]: empUpdated.hours } };
      });
    });
    addLog('Sincronizar Regras', 'Dados de colaboradores (férias, folgas fixas) atualizados na grade.', 'system');
  }, [currentMY, employees, customHolidays, monthKey, setEmployees, addLog]);

  const runFullRotation = useCallback(async () => {
    if (!Array.isArray(employees)) return;
    const confirmed = await showDialog({
      type: 'confirm',
      message: 'Deseja realizar o SORTEIO da escala? Isso irá recalcular os domingos e revezamentos, preservando apenas as folgas absolutas.',
    });
    if (!confirmed) return;
    const updated = applyFullRotation(employees, currentMY.year, currentMY.month, customHolidays);
    setEmployees(prev => {
      if (!Array.isArray(prev)) return prev;
      return prev.map(emp => {
        const empUpdated = updated[emp.id];
        if (!empUpdated) return emp;
        return { ...emp, shifts: { ...emp.shifts, [monthKey]: empUpdated.shifts }, dailyHours: { ...emp.dailyHours, [monthKey]: empUpdated.hours } };
      });
    });
    addLog('Sorteio de Escala', 'Revezamentos de domingos e regras 6x1 recalculados.', 'auto');
  }, [currentMY, employees, customHolidays, monthKey, showDialog, setEmployees, addLog]);


  const updateShift = (empId: string, dayIdx: number, newShift: ShiftType) => {
    const emp = employees.find(e => e.id === empId);
    if (emp) {
        addLog('Alteração Manual', `${emp.name.split(' ')[0]}: Dia ${dayIdx + 1} alterado para ${newShift}`, 'edit');
    }
    setEmployees(prev => prev.map(emp => {
      if (emp.id !== empId) return emp;
      const current = emp.shifts[monthKey] || Array(31).fill('T');
      const updated = [...current]; updated[dayIdx] = newShift;
      return { ...emp, shifts: { ...emp.shifts, [monthKey]: updated } };
    }));
  };

  const selectDayAndFilter = (idx: number) => {
    setSelectedDayIdx(idx);
  };


  const updateShifts = (updates: { empId: string, dayIdx: number, newShift: ShiftType }[]) => {
    setEmployees(prev => {
      let nextList = [...prev];
      for (const update of updates) {
        nextList = nextList.map(emp => {
          if (emp.id !== update.empId) return emp;
          const current = emp.shifts[monthKey] || Array(31).fill('T');
          const updated = [...current]; updated[update.dayIdx] = update.newShift;
          return { ...emp, shifts: { ...emp.shifts, [monthKey]: updated } };
        });
      }
      return nextList;
    });
  };

  const updateEmployeeDailyHour = (empId: string, dayIdx: number, newHour: string) => {
    const emp = employees.find(e => e.id === empId);
    if (emp) {
        if (dayIdx === -1) {
            addLog('Alteração de Horário Base', `${emp.name.split(' ')[0]}: Horário base alterado para ${newHour}`, 'edit');
        } else {
            addLog('Alteração de Horário', `${emp.name.split(' ')[0]}: Horário do dia ${dayIdx + 1} para ${newHour}`, 'edit');
        }
    }
    setEmployees(prev => prev.map(emp => {
      if (emp.id !== empId) return emp;
      
      if (dayIdx === -1) {
          // If -1 is passed, change the base work period rather than a single day overriding.
          return { ...emp, workPeriod: newHour, dailyHours: { ...emp.dailyHours, [monthKey]: [] } };
      }

      const current = emp.dailyHours[monthKey] || Array(31).fill(emp.workPeriod);
      const updated = [...current]; updated[dayIdx] = newHour;
      return { ...emp, dailyHours: { ...emp.dailyHours, [monthKey]: updated } };
    }));
  };

  const addHoliday = (h: Omit<Holiday, 'id'>) => setCustomHolidays(prev => [...prev, { ...h, id: `custom-${Date.now()}` }]);
  const removeHoliday = (id: string) => setCustomHolidays(prev => prev.filter(h => h.id !== id));
  const handleUpdateEmployee = (id: string, data: Partial<Employee>) => setEmployees(prev => prev.map(e => e.id === id ? { ...e, ...data } : e));
  const handleDeleteEmployee = (id: string) => setEmployees(prev => prev.filter(e => e.id !== id));
  const addEmployee = (name: string, isYoung: boolean, courseDay: string, cargo: EmployeeCargo, birthday: string) => {
    const newEmp: Employee = { id: `emp-${Date.now()}`, name, isYoungApprentice: isYoung, courseDay, cargo, birthday, status: 'active', statusColor: 'bg-green-500', shifts: {}, dailyHours: {}, workPeriod: isYoung ? '10h às 16h20' : '10h às 18h20', preferredDayOff: 'Segunda-feira', shiftName: 'T' };
    setEmployees(prev => [...prev, newEmp]);
  };

  const shareWhatsApp = (dayIdx: number) => {
    const d = new Date(currentMY.year, currentMY.month, dayIdx + 1);
    const fullDayName = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'][d.getDay()];
    const monthName = months[currentMY.month];
    
    const legendText = `📍 Posicionamento\n🟦 P1 Caixa\n🟩 P2 Porta\n🟧 P3 Salão\n🟪 P4 Coringa\n\n`;
    const formattedDayName = fullDayName.charAt(0).toUpperCase() + fullDayName.slice(1);
    let text = `📅 Escala ${formattedDayName} ${String(dayIdx + 1).padStart(2, '0')}/${String(currentMY.month + 1).padStart(2, '0')}\n\n${legendText}`;

    const workingEmployees = employees.filter(emp => {
        if (emp.status !== 'active') return false;
        const shift = emp.shifts[monthKey]?.[dayIdx] || 'F';
        return shift === 'T';
    });

    // Group by hours
    const groups: Record<string, typeof workingEmployees> = {};
    const hSet = buildHolidaySet(currentMY.year, customHolidays);
    const dateStr = `${currentMY.year}-${String(currentMY.month + 1).padStart(2, '0')}-${String(dayIdx + 1).padStart(2, '0')}`;
    const isHoliday = hSet.has(dateStr);

    workingEmployees.forEach(emp => {
        const hour = (emp.dailyHours?.[monthKey]?.[dayIdx]) || emp.workPeriod || '10h às 18h20';
        if (!groups[hour]) groups[hour] = [];
        groups[hour].push(emp);
    });

    // Sort hours (Abertura first, then others)
    const sortedHours = Object.keys(groups).sort();
    
    // Get Lunch times
    const isSunday = d.getDay() === 0;
    const lunchSlots = calculateLunchSchedule(employees, dayIdx, isSunday, isHoliday, monthKey);
    const getLunchTime = (empId: string) => {
        const slot = lunchSlots.find(s => s.employees.some(e => e.id === empId));
        return slot ? slot.time : '';
    };
    
    const groupEmpsCount = { 'Abertura': 0, 'Intermediário': 0, 'Fechamento': 0 };
    sortedHours.forEach(h => {
        const isA = h.startsWith('07') || h.startsWith('08') || h.startsWith('09') || h.startsWith('10');
        const isF = h.includes('22') || h.includes('21') || h.includes('20');
        const gl = isA ? 'Abertura' : isF ? 'Fechamento' : 'Intermediário';
        groupEmpsCount[gl] += groups[h].length;
    });
    
    let maxTurno = 'Abertura';
    if (groupEmpsCount['Fechamento'] > groupEmpsCount[maxTurno]) maxTurno = 'Fechamento';
    if (groupEmpsCount['Intermediário'] > groupEmpsCount[maxTurno]) maxTurno = 'Intermediário';

    let rankAbertura = 1;
    let rankFechamento = 1;
    let rankIntermediario = 1;
    let assignedP4M = false;

    // Build a position map using the tactical engine (respects preferredPositions)
    const hSet2 = buildHolidaySet(currentMY.year, customHolidays);
    const isHoliday2 = hSet2.has(dateStr);
    const tacticalAllocs = calculateTacticalPositions(employees, dayIdx, monthKey, '12h', isSunday, isHoliday2);
    const positionMap: Record<string, string> = {};
    tacticalAllocs.forEach(a => { positionMap[a.id] = a.position; });

    sortedHours.forEach((hour) => {
        const emps = groups[hour];
        const isAbertura = hour.startsWith('07') || hour.startsWith('08') || hour.startsWith('09') || hour.startsWith('10');
        const isFechamento = hour.includes('22') || hour.includes('21') || hour.includes('20');
        const groupLabel = isAbertura ? 'Abertura' : isFechamento ? 'Fechamento' : 'Intermediário';
        
        // Format range: "13:00 às 22:00" -> "13h às 22h" OR "10h às 18h20" (preserves existing h)
        const formattedHourRange = hour.replace(/:/g, 'h').replace(/h00\b/g, 'h');
        
        text += `⏰ ${groupLabel} ${formattedHourRange}\n`;
        emps.forEach(e => {
            const firstName = e.name.split(' ')[0];
            const formattedName = firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();
            const emojiMap: Record<string, string> = { 'P1': '🟦', 'P2': '🟩', 'P3': '🟧', 'P4': '🟪', 'P5+': '⬜', 'Estoque': '📦' };
            
            // Use tactical engine result first, then preferredPositions[0], then legacy tacticalPosition
            let posKey = positionMap[e.id] || (e.preferredPositions?.[0]) || e.tacticalPosition;
            if (!posKey) {
                if (e.cargo === 'Estoquista') posKey = 'Estoque';
                else {
                    let rankRef = groupLabel === 'Abertura' ? rankAbertura : groupLabel === 'Fechamento' ? rankFechamento : rankIntermediario;
                    
                    if (rankRef === 1) posKey = 'P1';
                    else if (rankRef === 2) posKey = 'P2';
                    else if (groupLabel === maxTurno && !assignedP4M) {
                        posKey = 'P4';
                        assignedP4M = true;
                    } else {
                        posKey = 'P3';
                    }

                    if (groupLabel === 'Abertura') rankAbertura++;
                    else if (groupLabel === 'Fechamento') rankFechamento++;
                    else rankIntermediario++;
                }
            }
            
            const posEmoji = (emojiMap[posKey] || '') + ' ';
            const lunchTime = getLunchTime(e.id);
            const lunchText = lunchTime ? ` (almoço ${lunchTime})` : '';
            text += `${posEmoji}${formattedName}${lunchText}\n`;
        });
        text += `\n`;
    });

    // Add Absences and Time Off
    const absences = employees.filter(e => {
        if (e.isHidden || e.status !== 'active') return false;
        let s = (e.shifts[monthKey] || [])[dayIdx] || 'F';
        // Vacation check
        const ds = `${currentMY.year}-${String(currentMY.month + 1).padStart(2, '0')}-${String(dayIdx + 1).padStart(2, '0')}`;
        if (e.vacationStart && e.vacationEnd && ds >= e.vacationStart && ds <= e.vacationEnd) s = 'FE';
        return s === 'F' || s === 'FF';
    });

    if (absences.length > 0) {
        text += `🏖️ Folga\n`;
        absences.forEach(a => {
            const name = a.name.split(' ')[0];
            const formattedName = name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
            text += `${formattedName}\n`;
        });
        text += `\n`;
    }

    if (workingEmployees.length === 0) {
        text = `📅 Escala - ${fullDayName}, ${dayIdx + 1} de ${monthName}\n\nNenhum colaborador escalado para este dia.`;
    }

    setWaModal({ show: true, text });
  };

  const handleToggleZenMode = () => {
    if (!isZenMode) {
      setIsZenMode(true);
      setIsEditable(false);
    } else {
      setIsZenMode(false);
    }
  };

  const handleToggleLock = async () => {
    if (isGridLocked) {
      const confirmation = await showDialog({
        type: 'prompt',
        message: 'Para DESTRAVAR as edições, digite a SENHA:',
        confirmText: 'Desbloquear',
        cancelText: 'Cancelar'
      });
      if (confirmation === '1234') {
        setIsGridLocked(false);
        addLog('Sistema', 'Grade de horários DESBLOQUEADA para edições', 'system');
      } else if (confirmation !== null) {
        await showDialog({ type: 'alert', message: 'Senha incorreta!' });
      }
    } else {
      setIsGridLocked(true);
      setIsEditable(false);
      addLog('Sistema', 'Grade de horários TRANCADA', 'system');
    }
  };

  return (
    <div className={`min-h-screen flex flex-col sm:flex-row bg-slate-50 dark:bg-slate-950 transition-colors overflow-hidden ${showPrintView ? 'print:block' : ''}`}>
      {!isZenMode && (
        <div className="no-print contents">
          <Sidebar 
            currentView={currentView}
            onViewChange={setCurrentView}
            currentMY={currentMY}
            onNextMonth={onNextMonth}
            onPrevMonth={onPrevMonth}
            employees={employees}
            customHolidays={customHolidays}
            syncStatus={syncStatus}
            onForceSync={async () => { await forceSyncEmployees(); await forceSyncHolidays(); }}
            onImportClick={() => fileInputRef.current?.click()}
            isGridLocked={isGridLocked}
            onToggleLock={handleToggleLock}
            isEditable={isEditable}
            onToggleEdit={() => { if (!isGridLocked) setIsEditable(!isEditable); }}
            allowRetroactive={allowRetroactive}
            onToggleRetroactive={() => setAllowRetroactive(!allowRetroactive)}
            onSyncRules={syncRules}
            onSortSchedule={runFullRotation}
            onShowHolidayManager={() => setShowHolidayManager(true)}
            onShowShiftManager={() => setShowShiftManager(true)}
            onShowPrintView={() => setShowPrintView(true)}
            onOpenAnalysis={() => setCurrentView('analysis')}
            onShowHolidayCredit={() => setShowHolidayCredit(true)}
            isZenMode={isZenMode}
            onToggleZen={handleToggleZenMode}
            
            filter={filter}
            onFilterChange={(f) => { setFilter(f); }}
            selectedWeek={selectedWeek}
            onWeekChange={setSelectedWeek}
            weeksInMonth={weeksInMonth}
            daysInMonth={daysInMonth}
            selectedDayIdx={selectedDayIdx}
            onSelectDay={selectDayAndFilter}
            onShareWhatsApp={shareWhatsApp}
            days={days}
            today={today}
            onUpdateShift={updateShift}
            onUpdateShifts={updateShifts}
          />
        </div>
      )}

      <div className={`flex-1 flex flex-col min-w-0 h-screen relative bg-slate-50 dark:bg-slate-950 no-print`}>
        
        {/* Zen Mode Top Menu */}
        {isZenMode && (
          <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-8 shrink-0 shadow-sm animate-slide-down">
             <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                   <div className="w-8 h-8 bg-orange-500 text-white rounded-lg flex items-center justify-center shadow-md">
                      <Icon name="visibility" className="text-lg" fill />
                   </div>
                   <span className="text-xs font-black uppercase tracking-widest text-slate-400">Modo de Exibição</span>
                </div>
                <div className="h-6 w-px bg-slate-200 dark:bg-slate-800" />
                <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-800/50 rounded-xl p-1 border border-slate-100 dark:border-slate-800">
                    <button onClick={onPrevMonth} className="p-2 hover:bg-white dark:hover:bg-slate-700 rounded-lg transition-all text-slate-400 hover:text-orange-500"><Icon name="chevron_left" /></button>
                    <span className="px-4 text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest min-w-[140px] text-center">
                      {months[currentMY.month]} {currentMY.year}
                    </span>
                    <button onClick={onNextMonth} className="p-2 hover:bg-white dark:hover:bg-slate-700 rounded-lg transition-all text-slate-400 hover:text-orange-500"><Icon name="chevron_right" /></button>
                </div>

                <div className="h-6 w-px bg-slate-200 dark:bg-slate-800" />

                <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-800/50 rounded-xl p-1 border border-slate-100 dark:border-slate-800">
                   <button 
                      onClick={() => setCurrentView('grid')}
                      className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all flex items-center gap-2 ${currentView === 'grid' ? 'bg-white dark:bg-slate-700 text-orange-600 shadow-md scale-105' : 'text-slate-400 hover:text-slate-600'}`}
                   >
                      <Icon name="table_rows" className="text-sm" fill={currentView === 'grid'} /> Grade
                   </button>
                   <button 
                      onClick={() => setCurrentView('calendar')}
                      className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all flex items-center gap-2 ${currentView === 'calendar' ? 'bg-white dark:bg-slate-700 text-orange-600 shadow-md scale-105' : 'text-slate-400 hover:text-slate-600'}`}
                   >
                      <Icon name="calendar_view_month" className="text-sm" fill={currentView === 'calendar'} /> Calendário
                   </button>
                </div>

                {currentView === 'grid' && (
                  <>
                    <div className="h-6 w-px bg-slate-200 dark:bg-slate-800" />
                    <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-800/50 rounded-xl p-1 border border-slate-100 dark:border-slate-800">
                        <button onClick={() => { setFilter('all'); }} className={`px-2 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${filter === 'all' ? 'bg-orange-500 text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>Mês</button>
                        <button onClick={() => setFilter('today')} className={`px-2 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${filter === 'today' ? 'bg-orange-500 text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>Hoje</button>
                        <button onClick={() => setFilter('tomorrow')} className={`px-2 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${filter === 'tomorrow' ? 'bg-orange-500 text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>Amanhã</button>
                        <button onClick={() => setFilter('sunday')} className={`px-2 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${filter === 'sunday' ? 'bg-orange-500 text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>Dom</button>
                        <button onClick={() => setFilter('holiday')} className={`px-2 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${filter === 'holiday' ? 'bg-orange-500 text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>Fer</button>
                        <button onClick={() => setFilter('week')} className={`px-2 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${filter === 'week' ? 'bg-orange-500 text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>Sem</button>
                     </div>
                     <div className="h-6 w-px bg-slate-200 dark:bg-slate-800 mx-1" />

                    {filter === 'week' && (
                       <div className="flex items-center gap-1 bg-orange-50 dark:bg-orange-950/20 rounded-xl p-1 border border-orange-100 dark:border-orange-900/40 animate-fade-in">
                          {Array.from({ length: weeksInMonth }, (_, i) => (
                             <button key={i} onClick={() => setSelectedWeek(i+1)} className={`w-7 h-7 rounded-lg text-[9px] font-black transition-all ${selectedWeek === i+1 ? 'bg-orange-500 text-white shadow-sm' : 'text-orange-600 hover:bg-orange-100'}`}>{i+1}</button>
                          ))}
                       </div>
                    )}
                  </>
                )}
             </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 group cursor-help mr-2">
                   <Icon name="info" className="text-orange-500 text-sm" />
                   <span className="text-[10px] font-bold text-slate-400 group-hover:text-slate-600 transition-colors uppercase">Clique na grade para detalhes</span>
                </div>

                <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                  <button 
                    onClick={() => { if (!isGridLocked) setIsEditable(!isEditable); }}
                    disabled={isGridLocked}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${isEditable ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'} ${isGridLocked ? 'opacity-40 cursor-not-allowed' : ''}`}
                    title={isGridLocked ? "Desbloqueie para editar" : (isEditable ? "Salvar Alterações" : "Ativar Edição")}
                  >
                    <Icon name={isEditable ? 'save' : 'edit_square'} className="text-sm" /> {isEditable ? 'Salvar' : 'Editar'}
                  </button>

                  <button 
                    onClick={() => shareWhatsApp(selectedDayIdx)}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-[10px] font-black uppercase hover:bg-green-700 transition-all shadow-md active:scale-95"
                    title={`Compartilhar Dia ${selectedDayIdx + 1}`}
                  >
                    <Icon name="send" className="text-sm" /> WhatsApp
                  </button>
                </div>

                <div className="h-6 w-px bg-slate-200 dark:bg-slate-800 mx-1" />

                <button 
                  onClick={() => setIsZenMode(false)}
                  className="flex items-center gap-2 px-6 py-2 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-xl text-[10px] font-black uppercase hover:bg-slate-800 dark:hover:bg-white transition-all shadow-lg active:scale-95"
                >
                   <Icon name="exit_to_app" className="text-sm" /> Sair
                </button>
             </div>
          </header>
        )}

        <main className={`flex-1 overflow-hidden relative ${isZenMode ? 'p-0' : 'p-4 sm:p-6 lg:p-8 overflow-y-auto'}`}>
          {currentView === 'grid' && (
            <div className={`h-full ${isZenMode ? 'w-full' : 'max-w-[1600px] mx-auto animate-fade-in'}`}>
              <ShiftGrid 
                currentMY={currentMY}
                shiftTemplates={shiftTemplates}
                employees={employees}
                today={today}
                customHolidays={customHolidays}
                onUpdateShift={updateShift}
                onUpdateShifts={updateShifts}
                onUpdateEmployeeDailyHour={updateEmployeeDailyHour}
                onUpdateEmployee={handleUpdateEmployee}
                onOpenAnalysis={() => setCurrentView('analysis')}
                isEditable={isEditable}
                setIsEditable={setIsEditable}
                isGridLocked={isGridLocked}
                setIsGridLocked={setIsGridLocked}
                allowRetroactive={allowRetroactive}
                setAllowRetroactive={setAllowRetroactive}
                onShowHolidayManager={() => setShowHolidayManager(true)}
                onShowShiftManager={() => setShowShiftManager(true)}
                onShowPrintView={() => setShowPrintView(true)}
                onSelectDay={selectDayAndFilter}
                onOpenDayDetail={(idx) => { selectDayAndFilter(idx); setShowDayDetail(true); }}
                onShareWhatsApp={shareWhatsApp}
                filter={filter}
                selectedWeek={selectedWeek}
                isZenMode={isZenMode}
                onExitZen={() => setIsZenMode(false)}
              />
            </div>
          )}

          {currentView === 'calendar' && (
            <div className={`${isZenMode ? 'w-full h-full p-8' : 'max-w-[1200px] mx-auto'} animate-fade-in h-fit overflow-y-auto max-h-full`}>
              <CalendarView
                employees={employees}
                currentMY={currentMY}
                onNextMonth={onNextMonth}
                onPrevMonth={onPrevMonth}
                customHolidays={customHolidays}
                today={today}
                onOpenDayDetail={(idx) => { setSelectedDayIdx(idx); setShowDayDetail(true); }}
              />
            </div>
          )}

          {/* ... other views remain as p-4 sm:p-6 lg:p-8 via the main className ternary */}
          {currentView === 'team' && (
            <div className="max-w-[1400px] mx-auto animate-fade-in">
               <TeamView employees={employees} onUpdateEmployee={handleUpdateEmployee} onDeleteEmployee={handleDeleteEmployee} onAddEmployee={addEmployee} />
            </div>
          )}

           {currentView === 'analysis' && (
            <AnalysisPanel 
                employees={employees} 
                currentMY={currentMY} 
                customHolidays={customHolidays} 
                onClose={() => setCurrentView('grid')} 
                isEditable={isEditable}
                isGridLocked={isGridLocked}
                onUpdateShift={updateShift}
            />
          )}
          
          {currentView === 'alerts' && (
            <div className="max-w-[1400px] mx-auto animate-fade-in h-screen">
               <AlertsPanel 
                  employees={employees} 
                  currentMY={currentMY} 
                  customHolidays={customHolidays}
                  today={today}
                  onSelectDay={(idx) => { setSelectedDayIdx(idx); setCurrentView('grid'); }}
                  onApplyFix={updateShift}
                  onApplyBulkFixes={updateShifts}
                  onClose={() => setCurrentView('grid')}
               />
            </div>
          )}
          {currentView === 'config' && (
            <div className="max-w-[1400px] mx-auto animate-fade-in h-[calc(100vh-100px)] flex flex-col">
               <ShiftTemplateManager 
                  templates={shiftTemplates} 
                  onUpdate={setShiftTemplates} 
                  onClose={() => setCurrentView('grid')} 
                  isTabMode={true}
               />
            </div>
          )}
        </main>
      </div>

      {showHolidayManager && (
        <HolidayManager 
          year={currentMY.year} 
          customHolidays={customHolidays.filter(h => h?.date?.startsWith(`${currentMY.year}`))} 
          onAdd={addHoliday} 
          onRemove={removeHoliday} 
          onReset={() => setCustomHolidays([])}
          onClose={() => setShowHolidayManager(false)} 
        />
      )}

      {showDayDetail && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] w-full max-w-4xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh] overflow-hidden">
             <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between sticky top-0 bg-white dark:bg-slate-900 z-10">
               <div className="flex items-center gap-4"><div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center"><Icon name="event_note" className="text-xl" /></div><h4 className="text-lg font-black text-slate-800 uppercase">Detalhes do Dia</h4></div>
               <div className="flex items-center gap-2">
                 <button onClick={() => shareWhatsApp(selectedDayIdx)} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-xl text-xs font-black uppercase hover:bg-green-700 transition-all"><Icon name="send" className="text-sm" /> WhatsApp</button>
                 <button onClick={() => setShowDayDetail(false)} className="p-2 hover:bg-slate-100 rounded-full"><Icon name="close" /></button>
               </div>
             </div>
             <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                 <DaySummaryCard 
                    selectedDayIdx={selectedDayIdx} 
                    employees={employees} 
                    currentMY={currentMY} 
                    customHolidays={customHolidays} 
                    isEditable={isEditable}
                    isGridLocked={isGridLocked}
                    onUpdateShift={updateShift}
                 />
             </div>
          </div>
        </div>
      )}

      {waModal.show && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 max-w-lg w-full shadow-2xl">
            <h4 className="text-xl font-extrabold mb-4">Escala Diária</h4>
            <textarea readOnly value={waModal.text} className="w-full h-64 p-4 bg-slate-50 border border-slate-200 rounded-xl mb-4" />
            <button onClick={() => setWaModal({ show: false, text: '' })} className="w-full py-3 bg-slate-100 rounded-xl font-bold">Fechar</button>
          </div>
        </div>
      )}

      {showHolidayCredit && ( 
        <HolidayCreditPanel 
          employees={employees} 
          currentMY={currentMY}
          customHolidays={customHolidays}
          onApplyFix={updateShift}
          onClose={() => setShowHolidayCredit(false)} 
        /> 
      )}

      {showHistory && (
        <HistoryPanel 
          logs={changeLogs} 
          onClose={() => setShowHistory(false)} 
          onClear={() => setChangeLogs([])} 
        />
      )}

       {showShiftManager && (
        <ShiftTemplateManager 
           templates={shiftTemplates} 
           onUpdate={setShiftTemplates} 
           onClose={() => setShowShiftManager(false)} 
        />
      )}

       {showPrintView && (
        <MonthlyPrintView 
          employees={employees} 
          currentMY={currentMY} 
          customHolidays={customHolidays} 
          onClose={() => setShowPrintView(false)} 
        />
      )}

      <input 
        type="file" 
        ref={fileInputRef} 
        hidden 
        accept=".json" 
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = async (event) => {
            try {
              const data = JSON.parse(event.target?.result as string);
              if (data.employees) {
                setEmployees(data.employees);
                addLog('Sistema', 'Backup de Colaboradores Importado', 'system');
              }
              if (data.holidays) {
                setCustomHolidays(data.holidays);
                addLog('Sistema', 'Backup de Feriados Importado', 'system');
              }
              await showDialog({ type: 'alert', message: 'Backup importado com sucesso!' });
            } catch (err) {
              console.error('Erro ao importar backup:', err);
              showDialog({ type: 'alert', message: 'Falha ao processar arquivo JSON.' });
            }
          };
          reader.readAsText(file);
          e.target.value = ''; // Reset input to allow re-importing the same file
        }} 
      />
    </div>
  );
};

export default App;
