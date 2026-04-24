
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
  const [waModal, setWaModal] = useState<{ show: boolean, text: string }>({ show: false, text: '' });

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
    const weekdaysFull = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    const date = new Date(currentMY.year, currentMY.month, dayIdx + 1);
    const weekdayName = weekdaysFull[date.getDay()];
    const dateFormatted = `${String(dayIdx + 1).padStart(2, '0')}/${String(currentMY.month + 1).padStart(2, '0')}`;
    
    const dateStr = `${currentMY.year}-${String(currentMY.month + 1).padStart(2, '0')}-${String(dayIdx + 1).padStart(2, '0')}`;
    const isHoliday = buildHolidaySet(currentMY.year, customHolidays).has(dateStr);
    const isSunday = date.getDay() === 0;

    let text = `📅 *Escala ${weekdayName} ${dateFormatted}*\n\n`;

    text += `📍 *Posicionamento*\n`;
    text += `🟥 P1 Caixa\n`;
    text += `🟨 P2 Porta\n`;
    text += `🟩 P3 Salão\n`;
    text += `🟦 P4 Flexível\n\n`;

    // Group members by their work hours
    const groups: Record<string, any[]> = {};
    const absent: string[] = [];

    const activeEmps = employees.filter(e => !e.isHidden && e.status === 'active');
    
    activeEmps.forEach(e => {
      const shift = e.shifts[monthKey]?.[dayIdx] || 'T';
      if (shift !== 'T' && !shift.startsWith('FF')) {
        const codeMap: any = { 'F': 'Folga', 'FE': 'Férias', 'C': 'Curso' };
        absent.push(`• ${e.name.split(' ')[0]} (${codeMap[shift] || shift})`);
        return;
      }

      const hour = e.dailyHours[monthKey]?.[dayIdx] || e.workPeriod;
      const pos = e.tacticalPositions?.[monthKey]?.[dayIdx];
      const posEmoji = pos === 'P1' ? '🟥' : pos === 'P2' ? '🟨' : pos === 'P3' ? '🟩' : pos === 'P4' ? '🟦' : pos === 'ESTOQUE' ? '📦' : '🔹';
      
      if (!groups[hour]) groups[hour] = [];
      groups[hour].push({ ...e, firstName: e.name.split(' ')[0], posEmoji, pos });
    });

    // Define turn order for sorting
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
      const isApprenticeShift = hour === '10h às 16h15';
      const isOpening = parseInt(hour.split('h')[0]) <= 11;
      const isClosing = parseInt(hour.split('h')[0]) >= 13;

      text += `⏰ *${isOpening ? 'Abertura' : isClosing ? 'Fechamento' : 'Intermediário'} ${hour}*\n`;
      
      // Lunch distribution logic
      const openingLunchSlots = ['13h', '13h30', '14h'];
      const closingLunchSlots = ['15h', '15h30', '16h', '16h30', '17h'];
      let lunchIdx = 0;

      members.forEach((m, idx) => {
        let lunch = '';
        if (m.isYoungApprentice) {
          lunch = '12h45';
        } else if (m.cargo === 'Estoquista') {
          lunch = 'Flexível';
        } else if (isHoliday) {
          lunch = '15 min';
        } else {
          if (isOpening) {
            lunch = openingLunchSlots[Math.floor(lunchIdx / 2) % openingLunchSlots.length];
            lunchIdx++;
          } else {
            lunch = closingLunchSlots[lunchIdx % closingLunchSlots.length];
            lunchIdx++;
          }
        }
        text += `${m.posEmoji} ${m.firstName} (almoço ${lunch})\n`;
      });
      text += '\n';
    });

    if (absent.length > 0) {
      text += `------------------------------------------\n`;
      text += `*FORA DE ESCALA:*\n`;
      absent.sort().forEach(a => text += a + '\n');
    }

    setWaModal({ show: true, text });
  }, [currentMY, employees, monthKey, customHolidays]);

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
              selectedDayIdx={selectedDayIdx}
            />

      <main className="max-w-[1600px] mx-auto p-4 animate-fade-in">
        {currentView === 'grid' ? (
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
            onNextMonth={() => setCurrentMY(prev => prev.month === 11 ? { month: 0, year: prev.year + 1 } : { ...prev, month: prev.month + 1 })}
            onPrevMonth={() => setCurrentMY(prev => prev.month === 0 ? { month: 11, year: prev.year - 1 } : { ...prev, month: prev.month - 1 })}
          />
        ) : currentView === 'analysis' ? (
          <AnalysisPanel employees={employees} currentMY={currentMY} customHolidays={customHolidays} onClose={() => setCurrentView('grid')} />
        ) : null}

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


      {showHolidayManager && (
        <HolidayManager 
          year={currentMY.year}
          customHolidays={customHolidays} 
          onAdd={onAddHoliday}
          onRemove={onRemoveHoliday}
          onClose={() => setShowHolidayManager(false)} 
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
                  onClick={() => handleShareWhatsApp(selectedDayIdx)}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-md active:scale-95"
                >
                  <Icon name="chat" className="text-sm" /> WhatsApp
                </button>
                <button onClick={() => setShowDayDetail(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-400">
                  <Icon name="close" />
                </button>
              </div>
            </div>
            <div id="day-detail-screenshot" className="flex-1 overflow-y-auto p-8 custom-scrollbar bg-white dark:bg-slate-900">
              <DaySummaryCard 
                selectedDayIdx={selectedDayIdx} 
                employees={employees} 
                currentMY={currentMY} 
                customHolidays={customHolidays} 
              />
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
                  await showDialog({ message: 'Copiado!' }); 
                  window.open(`https://wa.me/?text=${encodeURIComponent(waModal.text)}`, '_blank');
                }}
                className="flex-1 bg-green-600 dark:bg-green-700 text-white font-extrabold py-3 rounded-xl shadow-lg flex items-center justify-center gap-2 hover:bg-green-700 dark:hover:bg-green-600 transition-all active:scale-95"
              >
                <Icon name="content_copy" /> Copiar e Abrir WhatsApp
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
