
import React, { useState, useMemo, useCallback } from 'react';
import { useDialog } from './contexts/DialogContext';
import { useLocalStorage, useLocalPreference, useSyncStatus } from './hooks/useLocalStorage';
import { generateYearSchedule, applyMonthUpdate, applyRulesSync, applyFullRotation } from './hooks/useScheduleEngine';
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
  const [currentView, setCurrentView] = useState<'team' | 'analysis' | 'grid' | 'calendar' | 'alerts'>('grid');
  const [currentMY, setCurrentMY] = useState<MonthYear>({ month: new Date().getMonth(), year: new Date().getFullYear() });
  const [selectedDayIdx, setSelectedDayIdx] = useState(new Date().getDate() - 1);
  const [showDayDetail, setShowDayDetail] = useState(false);
  const [waModal, setWaModal] = useState<{ show: boolean; text: string }>({ show: false, text: '' });
  
  // Grid States 
  const [isEditable, setIsEditable] = useState(false);
  const [allowRetroactive, setAllowRetroactive] = useState(false);
  const [isGridLocked, setIsGridLocked] = useState(true); 
  const [isZenMode, setIsZenMode] = useState(false); 
  const [showHolidayCredit, setShowHolidayCredit] = useState(false);
  
  // Filters
  const [filter, setFilter] = useState<'all' | 'sunday' | 'holiday' | 'week'>('all');
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
    if (employees.length <= 1 && (employees[0]?.id === PLACEHOLDER_EMPLOYEE_ID || !employees[0])) return;
    const hasData = employees.some(e => e.status === 'active' && e.shifts[monthKey] && e.shifts[monthKey].length > 0);
    if (!hasData) {
      const updated = applyMonthUpdate(employees, currentMY.year, currentMY.month, customHolidays);
      setEmployees(prev => prev.map(emp => {
        const empUpdated = updated[emp.id];
        if (!empUpdated) return emp;
        return { ...emp, shifts: { ...emp.shifts, [monthKey]: empUpdated.shifts }, dailyHours: { ...emp.dailyHours, [monthKey]: empUpdated.hours } };
      }));
    }
  }, [currentMY, monthKey, customHolidays, setEmployees, employees]); 

  const syncRules = useCallback(async () => {
    const updated = applyRulesSync(employees, currentMY.year, currentMY.month, customHolidays);
    setEmployees(prev => prev.map(emp => {
      const empUpdated = updated[emp.id];
      if (!empUpdated) return emp;
      return { ...emp, shifts: { ...emp.shifts, [monthKey]: empUpdated.shifts }, dailyHours: { ...emp.dailyHours, [monthKey]: empUpdated.hours } };
    }));
    addLog('Sincronizar Regras', 'Dados de colaboradores (férias, folgas fixas) atualizados na grade.', 'system');
  }, [currentMY, employees, customHolidays, monthKey, setEmployees, addLog]);

  const runFullRotation = useCallback(async () => {
    const confirmed = await showDialog({
      type: 'confirm',
      message: 'Deseja realizar o SORTEIO da escala? Isso irá recalcular os domingos e revezamentos, preservando apenas as folgas absolutas.',
    });
    if (!confirmed) return;
    const updated = applyFullRotation(employees, currentMY.year, currentMY.month, customHolidays);
    setEmployees(prev => prev.map(emp => {
      const empUpdated = updated[emp.id];
      if (!empUpdated) return emp;
      return { ...emp, shifts: { ...emp.shifts, [monthKey]: empUpdated.shifts }, dailyHours: { ...emp.dailyHours, [monthKey]: empUpdated.hours } };
    }));
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
        addLog('Alteração de Horário', `${emp.name.split(' ')[0]}: Horário do dia ${dayIdx + 1} para ${newHour}`, 'edit');
    }
    setEmployees(prev => prev.map(emp => {
      if (emp.id !== empId) return emp;
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
    
    let text = `📅 Escala - ${fullDayName}, ${dayIdx + 1} de ${monthName}\n\n`;

    const workingEmployees = employees.filter(emp => {
        if (emp.status !== 'active') return false;
        const shift = emp.shifts[monthKey]?.[dayIdx] || 'F';
        return shift === 'T';
    });

    // Group by hours
    const groups: Record<string, typeof workingEmployees> = {};
    workingEmployees.forEach(emp => {
        const hour = emp.dailyHours[monthKey]?.[dayIdx] || emp.workPeriod;
        if (!groups[hour]) groups[hour] = [];
        groups[hour].push(emp);
    });

    // Sort hours (Abertura first, then others)
    const sortedHours = Object.keys(groups).sort();

    sortedHours.forEach((hour) => {
        const emps = groups[hour];
        const isAbertura = hour.startsWith('07') || hour.startsWith('08') || hour.startsWith('09') || hour.startsWith('10');
        const isFechamento = hour.includes('22') || hour.includes('21') || hour.includes('20');
        const groupLabel = isAbertura ? 'Abertura' : isFechamento ? 'Fechamento' : 'Intermediário';
        
        text += `⏰ ${groupLabel} (${hour})\n`;
        emps.forEach(e => {
            const firstName = e.name.split(' ')[0];
            text += `${firstName} - ${hour}\n`;
        });
        text += `\n`;
    });

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
            onFilterChange={setFilter}
            selectedWeek={selectedWeek}
            onWeekChange={setSelectedWeek}
            weeksInMonth={weeksInMonth}
            daysInMonth={daysInMonth}
            selectedDayIdx={selectedDayIdx}
            onSelectDay={setSelectedDayIdx}
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
             </div>

             <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 group cursor-help">
                   <Icon name="info" className="text-orange-500 text-sm" />
                   <span className="text-[10px] font-bold text-slate-400 group-hover:text-slate-600 transition-colors uppercase">Clique na grade para detalhes diários</span>
                </div>
                <button 
                  onClick={() => setIsZenMode(false)}
                  className="flex items-center gap-2 px-6 py-2 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-xl text-[10px] font-black uppercase hover:bg-slate-800 dark:hover:bg-white transition-all shadow-lg active:scale-95"
                >
                   <Icon name="exit_to_app" className="text-sm" /> Sair da Vista
                </button>
             </div>
          </header>
        )}

        <main className={`flex-1 overflow-hidden relative ${isZenMode ? 'p-0' : 'p-4 sm:p-6 lg:p-8 overflow-y-auto'}`}>
          {currentView === 'grid' && (
            <div className={`h-full ${isZenMode ? 'w-full' : 'max-w-[1600px] mx-auto animate-fade-in'}`}>
              <ShiftGrid 
                currentMY={currentMY}
                employees={employees}
                today={today}
                customHolidays={customHolidays}
                onUpdateShift={updateShift}
                onUpdateShifts={updateShifts}
                onUpdateEmployeeDailyHour={updateEmployeeDailyHour}
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
                onSelectDay={setSelectedDayIdx}
                onOpenDayDetail={(idx) => { setSelectedDayIdx(idx); setShowDayDetail(true); }}
                onShareWhatsApp={shareWhatsApp}
                filter={filter}
                selectedWeek={selectedWeek}
                isZenMode={isZenMode}
                onExitZen={() => setIsZenMode(false)}
              />
            </div>
          )}

          {currentView === 'calendar' && (
            <div className="max-w-[1200px] mx-auto animate-fade-in h-fit overflow-y-auto max-h-full">
              <CalendarView
                employees={employees}
                currentMY={currentMY}
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
