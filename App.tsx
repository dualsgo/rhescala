
import React, { useState, useMemo, useCallback } from 'react';
import { useDialog } from './contexts/DialogContext';
import { useLocalStorage } from './hooks/useLocalStorage';
import { generateYearSchedule, applyMonthUpdate } from './hooks/useScheduleEngine';
import { Header } from './components/Header';
import { Icon } from './components/Icon';
import { DaySummaryCard } from './components/DaySummaryCard';
import { ShiftGrid } from './components/ShiftGrid';
import { TeamView } from './components/TeamView';
import { AnalysisPanel } from './components/AnalysisPanel';
import { HolidayManager } from './components/HolidayManager';
import { APPRENTICE_WORK_PERIOD, PLACEHOLDER_EMPLOYEE, PLACEHOLDER_EMPLOYEE_ID, buildHolidaySet } from './constants';

import { Employee, ShiftType, MonthYear, Holiday, EmployeeCargo } from './types';

const CURRENT_YEAR = new Date().getFullYear(); // 2026

const App: React.FC = () => {
  const [employees, setEmployees, forceSyncEmployees] = useLocalStorage<Employee[]>('riHappyEmployeesData', [PLACEHOLDER_EMPLOYEE]);
  const [customHolidays, setCustomHolidays, forceSyncHolidays] = useLocalStorage<Holiday[]>('riHappyCustomHolidays', []);
  const [showHolidayManager, setShowHolidayManager] = useState(false);

  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [currentView, setCurrentView] = useState<'team' | 'analysis' | 'grid'>('grid');
  const [currentMY, setCurrentMY] = useState<MonthYear>({ month: new Date().getMonth(), year: new Date().getFullYear() });
  const [selectedDayIdx, setSelectedDayIdx] = useState(new Date().getDate() - 1);
  const [showDayDetail, setShowDayDetail] = useState(false);
  const [waModal, setWaModal] = useState<{ show: boolean; text: string }>({ show: false, text: '' });
  const [isDarkMode, setIsDarkMode] = useLocalStorage<boolean>('riHappyDarkMode', false);
  const { showDialog } = useDialog();

  const today = useMemo(() => new Date(), []); // Actual "today"
  const monthKey = `${currentMY.year}-${String(currentMY.month + 1).padStart(2, '0')}`;

  // Apply dark mode class
  React.useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  // Auto-generate month if it's completely empty
  React.useEffect(() => {
    // Se a lista de funcionários ainda é o placeholder ou está carregando dados, não gera nada
    if (employees.length <= 1 && (employees[0]?.id === PLACEHOLDER_EMPLOYEE_ID || !employees[0])) return;

    // Check if the current month has any generated data for active employees
    const hasData = employees.some(e => e.status === 'active' && e.shifts[monthKey] && e.shifts[monthKey].length > 0);
    
    // Só gera se não tiver dados e NÃO estivermos em processo de sincronização inicial
    if (!hasData) {
      console.log(`🪄 Auto-gerando escala para ${monthKey}...`);
      const updated = applyMonthUpdate(employees, currentMY.year, currentMY.month, customHolidays);
      setEmployees(prev => prev.map(emp => {
        const empUpdated = updated[emp.id];
        if (!empUpdated) return emp;
        return {
          ...emp,
          shifts: { ...emp.shifts, [monthKey]: empUpdated.shifts },
          dailyHours: { ...emp.dailyHours, [monthKey]: empUpdated.hours },
        };
      }));
    }
  }, [currentMY, monthKey, customHolidays, setEmployees]); 
  // Removi 'employees' das dependências para evitar loop infinito e marcação de 'dirty' constante

  // ─── Update month (smart refresh) ──────────────────────────────────────────
  const resetMonth = useCallback(async () => {
    const monthsNames = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
    const activeRegular = employees.filter(e => e.status === 'active' && !e.isYoungApprentice);

    const maxRest = Math.max(0, activeRegular.length - 5);
    const sundayRotationStatus = maxRest === 0
      ? `⚠️ ${activeRegular.length} CLT(s) — todos trabalham domingos (mínimo de 5 em loja)`
      : `🔄 ${activeRegular.length} CLTs — ${maxRest} folga(s)/domingo em alternância (máx. 2 seguidos)`;

    const confirmed = await showDialog({
      type: 'confirm',
      message: `Deseja auto-preencher folgas e horários para ${monthsNames[currentMY.month]} ${currentMY.year}?

✅ Domingos — nova lógica:
• ${sundayRotationStatus}
• Quem trabalhou mais domingos seguidos tem prioridade de folga
• Considera o último domingo do mês anterior (retro-análise)
• Máximo 2 domingos seguidos por colaborador

✅ Dias de semana:
• Folgas preferenciais aplicadas na semana
• Horários padrão aplicados
• Feriados, férias e dias de curso dos Aprendizes

⚠️ Atenção: Esta ação reescreve todo o mês. Edições manuais feitas anteriormente para este mês serão apagadas.`,
    });
    if (!confirmed) return;

    const updated = applyMonthUpdate(
      employees,
      currentMY.year,
      currentMY.month,
      customHolidays
    );

    setEmployees(prev => prev.map(emp => {
      const empUpdated = updated[emp.id];
      if (!empUpdated) return emp;
      return {
        ...emp,
        shifts: { ...emp.shifts, [monthKey]: empUpdated.shifts },
        dailyHours: { ...emp.dailyHours, [monthKey]: empUpdated.hours },
      };
    }));
  }, [currentMY, employees, customHolidays, monthKey, showDialog, setEmployees]);

  // ─── Shift/hour updates ───────────────────────────────────────────────────
  const updateShift = (empId: string, dayIdx: number, newShift: ShiftType) => {
    setEmployees(prev => prev.map(emp => {
      if (emp.id !== empId) return emp;
      const current = emp.shifts[monthKey] || Array(31).fill('T');
      const updated = [...current];
      updated[dayIdx] = newShift;
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
          const updated = [...current];
          updated[update.dayIdx] = update.newShift;
          return { ...emp, shifts: { ...emp.shifts, [monthKey]: updated } };
        });
      }
      return nextList;
    });
  };

  const updateEmployeeDailyHour = (empId: string, dayIdx: number, newHour: string) => {
    setEmployees(prev => prev.map(emp => {
      if (emp.id !== empId) return emp;
      const current = emp.dailyHours[monthKey] || Array(31).fill(emp.workPeriod);
      const updated = [...current];
      updated[dayIdx] = newHour;
      return { ...emp, dailyHours: { ...emp.dailyHours, [monthKey]: updated } };
    }));
  };

  // ─── Holiday management ───────────────────────────────────────────────────
  const addHoliday = (h: Omit<Holiday, 'id'>) => {
    const newHoliday: Holiday = { ...h, id: `custom-${Date.now()}` };
    setCustomHolidays(prev => [...prev, newHoliday]);
  };

  const removeHoliday = (id: string) => {
    setCustomHolidays(prev => prev.filter(h => h.id !== id));
  };

  // ─── Import/export ────────────────────────────────────────────────────────
  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (Array.isArray(data)) {
          setEmployees(data);
          await showDialog({ type: 'alert', message: 'Backup restaurado com sucesso!' });
        }
      } catch {
        await showDialog({ type: 'alert', message: 'Erro ao ler o arquivo de backup.' });
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  // ─── WhatsApp share ───────────────────────────────────────────────────────
  const shareWhatsApp = (dayIdx: number) => {
    const weekdaysFull = ['domingo','segunda-feira','terça-feira','quarta-feira','quinta-feira','sexta-feira','sábado'];
    const months = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
    const date = new Date(currentMY.year, currentMY.month, dayIdx + 1);
    const weekdayName = weekdaysFull[date.getDay()];
    // Capitalise first letter of weekday
    const weekdayLabel = weekdayName.charAt(0).toUpperCase() + weekdayName.slice(1);

    const dateStr = `${currentMY.year}-${String(currentMY.month + 1).padStart(2, '0')}-${String(dayIdx + 1).padStart(2, '0')}`;
    const isHoliday = buildHolidaySet(currentMY.year, customHolidays).has(dateStr);

    // Header
    let text = `📅 Escala - ${weekdayLabel}, ${dayIdx + 1} de ${months[currentMY.month]}${isHoliday ? ' (🏴 FERIADO)' : ''}\n\n`;


    // Group working employees by shift label or hour
    const shiftGroups: { label: string; range: string; members: { name: string; hour: string }[] }[] = isHoliday 
      ? [
          { label: 'Abertura (H)', range: '12h às 18h', members: [] },
          { label: 'Interm. 1 (H)', range: '13h às 19h', members: [] },
          { label: 'Interm. 2 (H)', range: '14h às 20h', members: [] },
          { label: 'Fechamento (H)', range: '15h às 21h', members: [] },
        ]
      : [
          { label: 'Abertura',     range: '10h às 18h20', members: [] },
          { label: 'Intermediário',range: '12h às 20h20', members: [] },
          { label: 'Fechamento',   range: '13h40 às 22h', members: [] },
        ];

    const absent: { name: string; code: string }[] = [];

    employees.forEach(e => {
      if (e.id === PLACEHOLDER_EMPLOYEE_ID) return;
      const shift = (e.shifts[monthKey] || [])[dayIdx];
      const hour  = (e.dailyHours[monthKey] || [])[dayIdx] || e.workPeriod || '';
      const firstName = e.name.split(' ')[0];

      if (shift === 'T' || shift === 'FF') {
        const matchingGroup = shiftGroups.find(g => hour.includes(g.range.split(' ')[0]));
        if (matchingGroup) {
          matchingGroup.members.push({ name: firstName, hour });
        } else {
          // Fallback: add to the first group if no match
          shiftGroups[0].members.push({ name: firstName, hour });
        }
      } else if (shift === 'F') {
        absent.push({ name: firstName, code: 'F' });
      } else if (shift === 'FE') {
        absent.push({ name: firstName, code: 'FE' });
      } else if (shift === 'C') {
        absent.push({ name: firstName, code: 'C' });
      }
    });

    // Emit each shift group
    shiftGroups.forEach(g => {
      if (g.members.length === 0) return;
      text += `⏰ ${g.label} (${g.range})\n`;
      // Sort alphabetically by name
      g.members.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
      g.members.forEach(m => {
        text += `⚪ ${m.name} - ${m.hour}\n`;
      });
      text += '\n';
    });


    // Ausências footer
    if (absent.length > 0) {
      const absentLabels: Record<string, string> = { F: 'F', FE: 'FE', C: 'C' };
      const absentStr = absent
        .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
        .map(a => `${a.name} (${absentLabels[a.code]})`)
        .join(', ');
      text += `Ausências e Folgas:\n${absentStr}\n\n`;
    }

    text += `Se identificarem inconsistências, favor acionar imediatamente para correção!`;

    setWaModal({ show: true, text });
  };


  // ─── Employee CRUD ────────────────────────────────────────────────────────
  const addEmployee = useCallback((name: string, isYoung: boolean, courseDay: string, cargo: EmployeeCargo = 'Auxiliar de Loja', birthday: string = '') => {
    const newEmp: Employee = {
      id: Date.now().toString(),
      name: name.toUpperCase(),
      isYoungApprentice: isYoung,
      courseDay: isYoung ? courseDay : undefined,
      status: 'active',
      statusColor: '#' + Math.floor(Math.random() * 16777215).toString(16),
      shifts: {},
      dailyHours: {},
      workPeriod: isYoung ? APPRENTICE_WORK_PERIOD : '10h às 18h20',
      cargo: isYoung ? undefined : cargo,
      preferredDayOff: 'Segunda-feira',
      shiftName: 'Abertura',
      hiredAt: new Date().toISOString().split('T')[0],
      birthday,
      isHidden: false,
    };

    // Add the employee and generate their schedule atomically in a single update.
    // We use the functional form of setEmployees so we always get the latest list.
    setEmployees(prev => {
      // Se a lista só contém o placeholder, substitui em vez de adicionar
      const isOnlyPlaceholder = prev.length === 1 && prev[0].id === PLACEHOLDER_EMPLOYEE_ID;
      const updatedList = isOnlyPlaceholder ? [newEmp] : [...prev, newEmp];

      // Generate schedule for the new employee using the full (updated) team list
      const now = today;
      const generated = generateYearSchedule(
        updatedList,
        now.getFullYear(),
        now.getMonth(),
        CURRENT_YEAR,
        customHolidays
      );

      // Apply generated shifts only to the new employee (others already have data)
      return updatedList.map(emp => {
        if (emp.id !== newEmp.id) return emp;
        const empGenerated = generated[emp.id];
        if (!empGenerated) return emp;
        return {
          ...emp,
          shifts: { ...emp.shifts, ...Object.fromEntries(Object.entries(empGenerated).map(([mk, v]) => [mk, (v as { shifts: ShiftType[]; hours: string[] }).shifts])) },
          dailyHours: { ...emp.dailyHours, ...Object.fromEntries(Object.entries(empGenerated).map(([mk, v]) => [mk, (v as { shifts: ShiftType[]; hours: string[] }).hours])) },
        };
      });
    });
  }, [today, customHolidays, setEmployees]);

  const handleDeleteEmployee = useCallback((id: string) => {
    setEmployees(prev => {
      const remaining = prev.filter(e => e.id !== id);
      // Se ficou vazio, restaura o placeholder genérico para evitar crash
      return remaining.length === 0 ? [PLACEHOLDER_EMPLOYEE] : remaining;
    });
  }, [setEmployees]);

  const handleUpdateEmployee = (id: string, data: Partial<Employee>) => {
    const updatedData = { ...data };
    if (updatedData.name) updatedData.name = updatedData.name.toUpperCase();
    setEmployees(prev => prev.map(e => e.id === id ? { ...e, ...updatedData } : e));
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header
        currentView={currentView}
        onViewChange={setCurrentView}
        currentMY={currentMY}
        employees={employees}
        customHolidays={customHolidays}
        onImportClick={() => fileInputRef.current?.click()}
        onForceSync={async () => {
          await forceSyncEmployees();
          await forceSyncHolidays();
        }}
        isDarkMode={isDarkMode}
        onDarkModeToggle={() => setIsDarkMode(prev => !prev)}
      />

      {/* Holiday Manager Modal */}
      {showHolidayManager && (
        <HolidayManager
          year={currentMY.year}
          customHolidays={customHolidays.filter(h => h?.date?.startsWith(`${currentMY.year}`))}
          onAdd={addHoliday}
          onRemove={removeHoliday}
          onClose={() => setShowHolidayManager(false)}
        />
      )}

      {/* Day Detail Modal */}
      {showDayDetail && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/40 dark:bg-slate-950/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] w-full max-w-4xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh] overflow-hidden">
            <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between sticky top-0 bg-white dark:bg-slate-900 z-10">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded-xl flex items-center justify-center">
                  <Icon name="event_note" className="text-xl" />
                </div>
                <div>
                  <h4 className="text-lg font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">Detalhes do Dia</h4>
                  <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Resumo Operacional e Pausas Sugeridas</p>
                </div>
              </div>
              <button 
                onClick={() => setShowDayDetail(false)} 
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors order-last ml-2"
              >
                <Icon name="close" className="text-slate-400 dark:text-slate-500" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar bg-slate-50/50 dark:bg-slate-900/50">
              <DaySummaryCard
                selectedDayIdx={selectedDayIdx}
                employees={employees}
                currentMY={currentMY}
                customHolidays={customHolidays}
              />
            </div>
            <div className="p-6 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex justify-end">
               <button 
                onClick={() => setShowDayDetail(false)}
                className="px-8 py-3 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-black rounded-2xl hover:bg-indigo-600 dark:hover:bg-white transition-all shadow-xl active:scale-95"
               >
                 Fechar Resumo
               </button>
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
                onClick={async () => { navigator.clipboard.writeText(waModal.text); await showDialog({ message: 'Copiado!' }); }}
                className="flex-1 bg-green-600 dark:bg-green-700 text-white font-extrabold py-3 rounded-xl shadow-lg flex items-center justify-center gap-2 hover:bg-green-700 dark:hover:bg-green-600 transition-all active:scale-95"
              >
                <Icon name="content_copy" /> Copiar para WhatsApp
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8 transition-colors flex-1 flex flex-col">
        {currentView === 'grid' ? (
          <ShiftGrid
            employees={employees}
            currentMY={currentMY}
            selectedDayIdx={selectedDayIdx}
            today={today}
            customHolidays={customHolidays}
            onOpenAnalysis={() => setCurrentView('analysis')}
            onSelectDay={setSelectedDayIdx}
            onOpenDayDetail={(idx) => {
              setSelectedDayIdx(idx);
              setShowDayDetail(true);
            }}
            onUpdateShift={updateShift}
            onUpdateShifts={updateShifts}
            onUpdateEmployeeDailyHour={updateEmployeeDailyHour}
            onShareWhatsApp={shareWhatsApp}
            onResetMonth={async () => {
              const confirmed = await showDialog({
                type: 'confirm',
                message: 'Isso irá limpar todas as folgas e horas extras deste mês. Continuar?'
              });
              if (confirmed) resetMonth();
            }}
            onShowHolidayManager={() => setShowHolidayManager(true)}
            onNextMonth={() => setCurrentMY(prev => prev.month === 11 ? { month: 0, year: prev.year + 1 } : { ...prev, month: prev.month + 1 })}
            onPrevMonth={() => setCurrentMY(prev => prev.month === 0 ? { month: 11, year: prev.year - 1 } : { ...prev, month: prev.month - 1 })}
          />
        ) : currentView === 'analysis' ? (
            <AnalysisPanel
              employees={employees}
              currentMY={currentMY}
              customHolidays={customHolidays}
              onClose={() => setCurrentView('grid')}
            />
        ) : currentView === 'team' ? (
          <div className="animate-fade-in">
             <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2rem] p-8 shadow-sm">
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded-2xl flex items-center justify-center">
                            <Icon name="groups" className="text-2xl" />
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight">Gestão da Equipe</h3>
                            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-0.5">Cadastre, edite e remova colaboradores</p>
                        </div>
                    </div>
                    <button
                      onClick={() => addEmployee('', false, '', 'Auxiliar de Loja', '')}
                      className="bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-800 dark:hover:bg-white transition-all shadow-lg active:scale-95 flex items-center gap-2"
                    >
                      <Icon name="person_add" className="text-sm" /> Adicionar
                    </button>
                </div>
                <TeamView
                  employees={employees}
                  onUpdateEmployee={handleUpdateEmployee}
                  onDeleteEmployee={handleDeleteEmployee}
                  onAddEmployee={addEmployee}
                />
             </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
             <Icon name="grid_view" className="text-6xl mb-4 opacity-20" />
             <p className="font-black uppercase tracking-widest">Acesse a Escala para começar</p>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
