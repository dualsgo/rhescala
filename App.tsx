
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
  const [currentView, setCurrentView] = useState<'grid' | 'analysis' | 'team' | 'jornada' | 'data'>('grid');
  const [currentMY, setCurrentMY] = useState<MonthYear>({ month: new Date().getMonth(), year: new Date().getFullYear() });
  const [selectedDayIdx, setSelectedDayIdx] = useState(new Date().getDate() - 1);
  const [filter, setFilter] = useState<'all' | 'sunday' | 'holiday' | 'week'>('all');
  const [isDarkMode] = useLocalPreference<boolean>('riHappyDarkMode', false);
  const { showDialog } = useDialog();

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
           const updated = applyMonthUpdate(employees, currentMY.year, currentMY.month, customHolidays);
           setEmployees(updated);
        }
     });
  };

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
        onShareWhatsApp={() => {
           const text = `Escala Ri Happy - ${currentMY.month + 1}/${currentMY.year}\nConsulte o painel para detalhes.`;
           window.open(`https://wa.me/?text=${encodeURIComponent(text)}`);
        }}
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
            onShareWhatsApp={() => {}}
            onOpenDayDetail={() => {}}
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
          <TeamView employees={employees} onUpdateEmployees={setEmployees} onClose={() => setCurrentView('grid')} />
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

      {showHolidayManager && <HolidayManager holidays={customHolidays} onUpdateHolidays={setCustomHolidays} onClose={() => setShowHolidayManager(false)} />}
    </div>
  );
};

export default App;
