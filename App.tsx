
import React, { useState, useMemo, useCallback } from 'react';
import { useDialog } from './contexts/DialogContext';
import { useLocalStorage, useLocalPreference, useSyncStatus } from './hooks/useLocalStorage';
import { generateYearSchedule, applyMonthUpdate } from './hooks/useScheduleEngine';
import { Header } from './components/Header';
import { ShiftGrid } from './components/ShiftGrid';
import { TeamView } from './components/TeamView';
import { AnalysisPanel } from './components/AnalysisPanel';
import { HolidayManager } from './components/HolidayManager';
import { PLACEHOLDER_EMPLOYEE, PLACEHOLDER_EMPLOYEE_ID } from './constants';
import { Employee, MonthYear, Holiday } from './types';

const App: React.FC = () => {
  const [employees, setEmployees] = useLocalStorage<Employee[]>('riHappyEmployeesData', [PLACEHOLDER_EMPLOYEE]);
  const [customHolidays, setCustomHolidays] = useLocalStorage<Holiday[]>('riHappyCustomHolidays', []);
  const syncStatus = useSyncStatus();
  const [showHolidayManager, setShowHolidayManager] = useState(false);
  const [showDayDetail, setShowDayDetail] = useState(false);
  const [currentView, setCurrentView] = useState<'grid' | 'analysis' | 'team' | 'jornada' | 'data'>('grid');
  const [currentMY, setCurrentMY] = useState<MonthYear>({ month: new Date().getMonth(), year: new Date().getFullYear() });
  const [selectedDayIdx, setSelectedDayIdx] = useState(new Date().getDate() - 1);
  const [filter, setFilter] = useState<'all' | 'sunday' | 'holiday' | 'week'>('all');
  const [isDarkMode] = useLocalPreference<boolean>('riHappyDarkMode', false);
  const { showDialog } = useDialog();

  const onUpdateEmployee = useCallback((empId: string, data: Partial<Employee>) => {
    setEmployees(prev => prev.map(emp => emp.id === empId ? { ...emp, ...data } : emp));
  }, [setEmployees]);

  const onDeleteEmployee = useCallback((empId: string) => {
    setEmployees(prev => prev.filter(emp => emp.id !== empId));
  }, [setEmployees]);

  const onAddEmployee = useCallback((name: string, isYoung: boolean, courseDay: string, cargo: any, birthday: string) => {
    const newEmp: Employee = {
      ...PLACEHOLDER_EMPLOYEE,
      id: Math.random().toString(36).substring(2, 9),
      name,
      isYoungApprentice: isYoung,
      courseDay: isYoung ? courseDay : undefined,
      cargo,
      birthday,
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

  const monthKey = useMemo(() => `${currentMY.year}-${String(currentMY.month + 1).padStart(2, '0')}`, [currentMY]);

  // Dark mode effect
  React.useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode);
  }, [isDarkMode]);

  const onUpdateEmployeeDailyHour = useCallback((empId: string, dayIdx: number, newHour: string) => {
    setEmployees(prev => prev.map(emp => {
      if (emp.id !== empId) return emp;
      const hours = [...(emp.dailyHours[monthKey] || [])];
      hours[dayIdx] = newHour;
      return { ...emp, dailyHours: { ...emp.dailyHours, [monthKey]: hours } };
    }));
  }, [monthKey, setEmployees]);

  const onUpdateTacticalPosition = useCallback((empId: string, dayIdx: number, newPos: string | null) => {
    setEmployees(prev => prev.map(emp => {
      if (emp.id !== empId) return emp;
      const positions = [...(emp.tacticalPositions?.[monthKey] || [])];
      positions[dayIdx] = newPos;
      return { ...emp, tacticalPositions: { ...emp.tacticalPositions, [monthKey]: positions } };
    }));
  }, [monthKey, setEmployees]);

  const handleApplyFolgas = () => {
    setEmployees(prev => prev.map(emp => {
      if (emp.status !== 'active') return emp;
      const shifts = [...(emp.shifts[monthKey] || [])];
      const daysInMonth = new Date(currentMY.year, currentMY.month + 1, 0).getDate();
      for (let d = 0; d < daysInMonth; d++) {
        const date = new Date(currentMY.year, currentMY.month, d + 1);
        const dow = date.toLocaleDateString('pt-BR', { weekday: 'long' });
        if (dow.toLowerCase() === emp.preferredDayOff?.toLowerCase()) {
           shifts[d] = 'F';
        }
      }
      return { ...emp, shifts: { ...emp.shifts, [monthKey]: shifts } };
    }));
  };

  const handleSortearDomingo = () => {
    // Trigger Sunday Rotation logic
    showDialog({ title: 'Sortear Domingos', message: 'Deseja realizar o sorteio dos domingos para este mês?', type: 'confirm' }).then(ok => {
      if (ok) {
        const updatedData = applyMonthUpdate(employees, currentMY.year, currentMY.month, customHolidays);
        setEmployees(prev => prev.map(emp => {
          if (updatedData[emp.id]) {
            return {
              ...emp,
              shifts: { ...emp.shifts, [monthKey]: updatedData[emp.id].shifts },
              dailyHours: { ...emp.dailyHours, [monthKey]: updatedData[emp.id].hours }
            };
          }
          return emp;
        }));
      }
    });
  };

  const handleShareWhatsApp = useCallback((dayIdx: number) => {
    const day = dayIdx + 1;
    const date = new Date(currentMY.year, currentMY.month, day);
    const weekday = date.toLocaleDateString('pt-BR', { weekday: 'long' });
    let text = `*ESCALA RI HAPPY - ${String(day).padStart(2, '0')}/${String(currentMY.month + 1).padStart(2, '0')} (${weekday})*\n\n`;
    
    const activeEmps = employees.filter(e => e.status === 'active' && !e.isHidden);
    
    text += activeEmps.map(e => {
      const shift = e.shifts[monthKey]?.[dayIdx] || 'T';
      const hour = e.dailyHours[monthKey]?.[dayIdx] || e.workPeriod;
      const pos = e.tacticalPositions?.[monthKey]?.[dayIdx];
      return `• *${e.name}*: ${shift} (${hour})${pos ? ` [${pos}]` : ''}`;
    }).join('\n');

    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  }, [currentMY, employees, monthKey]);

  const handleCreateMonth = () => {
    handleApplyFolgas();
    setTimeout(handleSortearDomingo, 500);
  };

  return (
    <div className={`min-h-screen ${isDarkMode ? 'dark bg-slate-950' : 'bg-slate-50'} transition-colors font-sans`}>
      <Header 
        currentView={currentView}
        currentMY={currentMY}
        filter={filter}
        onViewChange={setCurrentView}
        onMonthChange={setCurrentMY}
        onFilterChange={setFilter}
        onShareWhatsApp={() => handleShareWhatsApp(selectedDayIdx)}
        syncStatus={syncStatus}
      />

      <main className="max-w-[1600px] mx-auto p-4 animate-fade-in">
        {currentView === 'grid' && (
          <ShiftGrid
            employees={employees}
            currentMY={currentMY}
            selectedDayIdx={selectedDayIdx}
            today={new Date()}
            customHolidays={customHolidays}
            filter={filter}
            onSelectDay={setSelectedDayIdx}
            onUpdateShift={(empId, d, s) => {
              setEmployees(prev => prev.map(emp => {
                if (emp.id !== empId) return emp;
                const sfs = [...(emp.shifts[monthKey] || [])];
                sfs[d] = s;
                return { ...emp, shifts: { ...emp.shifts, [monthKey]: sfs } };
              }));
            }}
            onUpdateShifts={(updates) => {
              setEmployees(prev => prev.map(emp => {
                const empU = updates.filter(u => u.empId === emp.id);
                if (empU.length === 0) return emp;
                const sfs = [...(emp.shifts[monthKey] || [])];
                empU.forEach(u => { sfs[u.dayIdx] = u.newShift; });
                return { ...emp, shifts: { ...emp.shifts, [monthKey]: sfs } };
              }));
            }}
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
            onShowHolidayManager={() => setShowHolidayManager(true)}
            onNextMonth={() => {}}
            onPrevMonth={() => {}}
          />
        )}

        {currentView === 'analysis' && (
          <AnalysisPanel employees={employees} currentMY={currentMY} customHolidays={customHolidays} onClose={() => setCurrentView('grid')} />
        )}

        {currentView === 'team' && (
          <TeamView 
            employees={employees} 
            onUpdateEmployee={onUpdateEmployee}
            onDeleteEmployee={onDeleteEmployee}
            onAddEmployee={onAddEmployee}
          />
        )}

        {['jornada', 'data'].includes(currentView) && (
          <div className="bg-white dark:bg-slate-900 p-12 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl text-center max-w-2xl mx-auto mt-10">
             <div className="w-20 h-20 bg-orange-100 dark:bg-orange-900/30 text-orange-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
             </div>
             <h2 className="text-2xl font-black uppercase mb-4">{currentView === 'jornada' ? 'Configuração de Jornada' : 'Gerenciamento de Dados'}</h2>
             <p className="text-slate-500 dark:text-slate-400 mb-8">Esta funcionalidade está sendo simplificada e será integrada aqui em breve.</p>
             <button onClick={() => setCurrentView('grid')} className="px-8 py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl font-bold uppercase text-xs tracking-widest hover:scale-105 transition-transform">Voltar para Grade</button>
          </div>
        )}
      </main>

      {showDayDetail && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
              <div>
                <h2 className="text-xl font-black uppercase tracking-tight">Detalhes do Dia {selectedDayIdx + 1}</h2>
                <p className="text-xs text-slate-500 font-bold uppercase">{new Date(currentMY.year, currentMY.month, selectedDayIdx + 1).toLocaleDateString('pt-BR', { weekday: 'long' })}</p>
              </div>
              <button onClick={() => setShowDayDetail(false)} className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 transition-colors">
                <Icon name="close" />
              </button>
            </div>
            
            <div className="max-h-[60vh] overflow-y-auto p-6 custom-scrollbar">
              <div className="space-y-4">
                {employees.filter(e => e.status === 'active' && !e.isHidden).map(emp => (
                  <div key={emp.id} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                    <div className="flex flex-col">
                      <span className="text-[11px] font-black uppercase">{emp.name}</span>
                      <span className="text-[9px] font-bold text-slate-400 uppercase">{emp.workPeriod}</span>
                    </div>
                    
                    <div className="flex items-center gap-4">
                      <div className="flex flex-col gap-1">
                        <span className="text-[8px] font-black text-slate-400 uppercase">Horário</span>
                        <input 
                          type="text" 
                          value={emp.dailyHours[monthKey]?.[selectedDayIdx] || emp.workPeriod}
                          onChange={(e) => onUpdateEmployeeDailyHour(emp.id, selectedDayIdx, e.target.value)}
                          className="w-24 px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-[10px] font-bold outline-none focus:ring-2 focus:ring-orange-500"
                        />
                      </div>
                      
                      <div className="flex flex-col gap-1">
                        <span className="text-[8px] font-black text-slate-400 uppercase">Posição</span>
                        <select
                          value={emp.tacticalPositions?.[monthKey]?.[selectedDayIdx] || ''}
                          onChange={(e) => onUpdateTacticalPosition(emp.id, selectedDayIdx, e.target.value || null)}
                          className="w-24 px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-[10px] font-bold outline-none focus:ring-2 focus:ring-orange-500"
                        >
                          <option value="">Nenhum</option>
                          {Array.from({ length: 14 }, (_, i) => `P${i + 1}`).map(p => (
                            <option key={p} value={p}>{p}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="p-6 bg-slate-50 dark:bg-slate-800/30 flex justify-end">
              <button onClick={() => setShowDayDetail(false)} className="px-8 py-3 bg-orange-500 text-white rounded-xl font-black uppercase text-xs shadow-lg hover:bg-orange-600 transition-all">
                Concluído
              </button>
            </div>
          </div>
        </div>
      )}

      {showHolidayManager && (
        <HolidayManager 
          year={currentMY.year}
          customHolidays={customHolidays} 
          onAdd={onAddHoliday}
          onRemove={onRemoveHoliday}
          onClose={() => setShowHolidayManager(false)} 
        />
      )}
    </div>
  );
};

export default App;
