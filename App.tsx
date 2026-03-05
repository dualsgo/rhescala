
import React, { useState, useMemo, useCallback } from 'react';
import { useDialog } from './contexts/DialogContext';
import { useLocalStorage } from './hooks/useLocalStorage';
import { generateYearSchedule, applyMonthUpdate } from './hooks/useScheduleEngine';
import { Header } from './components/Header';
import { Icon } from './components/Icon';
import { DaySummaryCard } from './components/DaySummaryCard';
import { ShiftGrid } from './components/ShiftGrid';
import { TeamView } from './components/TeamView';
import { HolidayManager } from './components/HolidayManager';
import { APPRENTICE_WORK_PERIOD, PLACEHOLDER_EMPLOYEE, PLACEHOLDER_EMPLOYEE_ID, buildHolidaySet } from './constants';

import { Employee, ShiftType, MonthYear, Holiday, EmployeeCargo } from './types';

const CURRENT_YEAR = new Date().getFullYear(); // 2026

const App: React.FC = () => {
  const [employees, setEmployees] = useLocalStorage<Employee[]>('riHappyEmployeesData', [PLACEHOLDER_EMPLOYEE]);
  const [customHolidays, setCustomHolidays] = useLocalStorage<Holiday[]>('riHappyCustomHolidays', []);
  const [showHolidayManager, setShowHolidayManager] = useState(false);

  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [currentView, setCurrentView] = useState<'dashboard' | 'team'>('dashboard');
  const [currentMY, setCurrentMY] = useState<MonthYear>({ month: 2, year: 2026 }); // March 2026
  const [selectedDayIdx, setSelectedDayIdx] = useState(0);
  const [waModal, setWaModal] = useState<{ show: boolean; text: string }>({ show: false, text: '' });
  const { showDialog } = useDialog();

  const today = useMemo(() => new Date(2026, 2, 15), []); // Simulated "today"
  const monthKey = `${currentMY.year}-${String(currentMY.month + 1).padStart(2, '0')}`;

  // Auto-generate month if it's completely empty
  React.useEffect(() => {
    // If we only have the placeholder, do nothing
    if (employees.length === 1 && employees[0].id === 'placeholder') return;

    // Check if the current month has any generated data for active employees
    const hasData = employees.some(e => e.status === 'active' && e.shifts[monthKey] && e.shifts[monthKey].length > 0);
    
    // If not, auto-generate and apply it silently (without breaking manual edits in other months)
    if (!hasData) {
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
  }, [currentMY, employees, monthKey, customHolidays, setEmployees]);

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
      message: `Atualizar escala de ${monthsNames[currentMY.month]} ${currentMY.year}?

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
      const current = emp.shifts[monthKey] || Array(31).fill('F');
      const updated = [...current];
      updated[dayIdx] = newShift;
      return { ...emp, shifts: { ...emp.shifts, [monthKey]: updated } };
    }));
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
      const hour  = (e.dailyHours[monthKey] || [])[dayIdx] || e.workPeriod;
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
  const addEmployee = useCallback((name: string, isYoung: boolean, courseDay: string, cargo: EmployeeCargo = 'Auxiliar de Loja') => {
    const newEmp: Employee = {
      id: Date.now().toString(),
      name,
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
    setEmployees(prev => prev.map(e => e.id === id ? { ...e, ...data } : e));
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header
        currentView={currentView}
        onViewChange={setCurrentView}
        currentMY={currentMY}
        employees={employees}
        onImportClick={() => fileInputRef.current?.click()}
      />

      {/* Holiday Manager Modal */}
      {showHolidayManager && (
        <HolidayManager
          year={currentMY.year}
          customHolidays={customHolidays.filter(h => h.date.startsWith(`${currentMY.year}`))}
          onAdd={addHoliday}
          onRemove={removeHoliday}
          onClose={() => setShowHolidayManager(false)}
        />
      )}

      {/* WhatsApp Modal */}
      {waModal.show && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl p-8 max-w-lg w-full shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h4 className="text-xl font-extrabold flex items-center gap-2 text-slate-900">
                <Icon name="chat" className="text-green-600" /> Escala Diária
              </h4>
              <button onClick={() => setWaModal({ show: false, text: '' })} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                <Icon name="close" />
              </button>
            </div>
            <textarea
              readOnly
              className="w-full h-80 bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm font-medium focus:ring-0 resize-none whitespace-pre-wrap outline-none text-slate-700"
              value={waModal.text}
            />
            <div className="mt-6 flex gap-3">
              <button
                onClick={async () => { navigator.clipboard.writeText(waModal.text); await showDialog({ message: 'Copiado!' }); }}
                className="flex-1 bg-green-600 text-white font-extrabold py-3 rounded-xl shadow-lg flex items-center justify-center gap-2 hover:bg-green-700 transition-all active:scale-95"
              >
                <Icon name="content_copy" /> Copiar para WhatsApp
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="flex-1 px-4 sm:px-6 lg:px-10 py-8 max-w-[1700px] mx-auto w-full">
        {currentView === 'dashboard' ? (
          <>

            <DaySummaryCard
              employees={employees}
              selectedDayIdx={selectedDayIdx}
              currentMY={currentMY}
              customHolidays={customHolidays}
            />


            <input type="file" accept=".json" ref={fileInputRef} className="hidden" onChange={handleImportBackup} />

            <ShiftGrid
              employees={employees}
              currentMY={currentMY}
              selectedDayIdx={selectedDayIdx}
              today={today}
              customHolidays={customHolidays}
              onSelectDay={setSelectedDayIdx}
              onUpdateShift={updateShift}
              onUpdateEmployeeDailyHour={updateEmployeeDailyHour}
              onShareWhatsApp={shareWhatsApp}
              onResetMonth={resetMonth}
              onShowHolidayManager={() => setShowHolidayManager(true)}
              onNextMonth={() => setCurrentMY(prev => {
                let m = prev.month + 1, y = prev.year;
                if (m > 11) { m = 0; y++; }
                return { month: m, year: y };
              })}
              onPrevMonth={() => setCurrentMY(prev => {
                let m = prev.month - 1, y = prev.year;
                if (m < 0) { m = 11; y--; }
                return { month: m, year: y };
              })}
            />
          </>
        ) : (
          <TeamView
            employees={employees}
            onUpdateEmployee={handleUpdateEmployee}
            onDeleteEmployee={handleDeleteEmployee}
            onAddEmployee={addEmployee}
          />
        )}
      </main>
    </div>
  );
};

export default App;
