
import React, { useState, useMemo, useCallback } from 'react';
import { useDialog } from './contexts/DialogContext';
import { useLocalStorage } from './hooks/useLocalStorage';
import { generateYearSchedule } from './hooks/useScheduleEngine';
import { Header } from './components/Header';
import { Icon } from './components/Icon';
import { DaySummaryCard } from './components/DaySummaryCard';
import { ShiftGrid } from './components/ShiftGrid';
import { TeamView } from './components/TeamView';
import { HolidayManager } from './components/HolidayManager';
import { MOCK_EMPLOYEES, APPRENTICE_WORK_PERIOD } from './constants';
import { Employee, ShiftType, MonthYear, Holiday } from './types';

const CURRENT_YEAR = new Date().getFullYear(); // 2026

const App: React.FC = () => {
  const [employees, setEmployees] = useLocalStorage<Employee[]>('riHappyEmployeesData', MOCK_EMPLOYEES);
  const [customHolidays, setCustomHolidays] = useLocalStorage<Holiday[]>('riHappyCustomHolidays', []);
  const [showHolidayManager, setShowHolidayManager] = useState(false);

  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [currentView, setCurrentView] = useState<'dashboard' | 'team'>('dashboard');
  const [currentMY, setCurrentMY] = useState<MonthYear>({ month: 2, year: 2026 }); // March 2026
  const [selectedDayIdx, setSelectedDayIdx] = useState(0);
  const [waModal, setWaModal] = useState<{ show: boolean; text: string }>({ show: false, text: '' });
  const { showDialog } = useDialog();

  const today = useMemo(() => new Date(2026, 2, 15), []); // Simulated "today"
  const monthKey = `${currentMY.year}-${currentMY.month.toString().padStart(2, '0')}`;



  // ─── Manual "Generate next month" ────────────────────────────────────────
  const generateNextMonth = useCallback(async () => {
    let nextMonth = currentMY.month + 1;
    let nextYear = currentMY.year;
    if (nextMonth > 11) { nextMonth = 0; nextYear++; }

    if (nextYear > CURRENT_YEAR) {
      await showDialog({ type: 'alert', message: 'Geração automática limitada a 31/12 do ano vigente.' });
      return;
    }

    const monthsNames = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

    const activeRegular = employees.filter(e => e.status === 'active' && !e.isYoungApprentice);
    const activeApprentices = employees.filter(e => e.status === 'active' && e.isYoungApprentice);

    const summaryText = `Gerar escala automática para ${monthsNames[nextMonth]} ${nextYear}?

👥 ${activeRegular.length} colaboradores CLT + ${activeApprentices.length} Jovens Aprendizes
📅 Feriados nacionais considerados automaticamente
🔄 Rotação de domingos baseada no time atual

Esta ação substituirá qualquer escala existente para este mês.`;

    const confirmed = await showDialog({ type: 'confirm', message: summaryText });
    if (!confirmed) return;

    const generated = generateYearSchedule(
      employees,
      nextYear,
      nextMonth,
      nextYear,
      customHolidays
    );

    const targetKey = `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}`;

    setEmployees(prev => prev.map(emp => {
      const empGen = generated[emp.id];
      if (!empGen || !empGen[targetKey]) return emp;
      return {
        ...emp,
        shifts: { ...emp.shifts, [targetKey]: empGen[targetKey].shifts },
        dailyHours: { ...emp.dailyHours, [targetKey]: empGen[targetKey].hours },
      };
    }));

    setCurrentMY({ month: nextMonth, year: nextYear });
    setSelectedDayIdx(0);
  }, [currentMY, employees, customHolidays, showDialog, setEmployees]);

  // ─── Reset month ─────────────────────────────────────────────────────────
  const resetMonth = useCallback(async () => {
    const confirmed = await showDialog({
      type: 'confirm',
      message: 'Deseja regenerar a escala deste mês automaticamente? As edições manuais serão perdidas.',
    });
    if (!confirmed) return;

    const generated = generateYearSchedule(
      employees,
      currentMY.year,
      currentMY.month,
      currentMY.year,
      customHolidays
    );

    setEmployees(prev => prev.map(emp => {
      const empGen = generated[emp.id];
      if (!empGen || !empGen[monthKey]) return emp;
      return {
        ...emp,
        shifts: { ...emp.shifts, [monthKey]: empGen[monthKey].shifts },
        dailyHours: { ...emp.dailyHours, [monthKey]: empGen[monthKey].hours },
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
    const weekdays = ['domingo','segunda-feira','terça-feira','quarta-feira','quinta-feira','sexta-feira','sábado'];
    const months = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
    const date = new Date(currentMY.year, currentMY.month, dayIdx + 1);

    let text = `📅 *ESCALA RI HAPPY - ${weekdays[date.getDay()].toUpperCase()}*\n📍 ${dayIdx + 1} de ${months[date.getMonth()]} de ${currentMY.year}\n\n`;

    const uniqueHours = Array.from(new Set(
      employees
        .filter(e => { const s = (e.shifts[monthKey] || [])[dayIdx]; return s === 'T' || s === 'FF'; })
        .map(e => (e.dailyHours[monthKey] || [])[dayIdx] || e.workPeriod)
    )).sort();

    uniqueHours.forEach(h => {
      const empsInHour = employees.filter(e => {
        const s = (e.shifts[monthKey] || [])[dayIdx];
        const hForDay = (e.dailyHours[monthKey] || [])[dayIdx] || e.workPeriod;
        return (s === 'T' || s === 'FF') && hForDay === h;
      });
      if (empsInHour.length > 0) {
        text += `⏰ *${h}*\n`;
        empsInHour.forEach(e => text += `• ${e.name}\n`);
        text += `\n`;
      }
    });

    const off = employees.filter(e => ['F', 'FE', 'C'].includes((e.shifts[monthKey] || [])[dayIdx]));
    if (off.length > 0) {
      text += `━━━━━━━━━━━━━━━\n🌴 *FOLGA / CURSO / FÉRIAS*\n`;
      off.forEach(e => {
        const shift = (e.shifts[monthKey] || [])[dayIdx];
        const label = shift === 'FE' ? 'Férias' : shift === 'C' ? 'Curso' : 'Folga';
        const emoji = shift === 'FE' ? '🟣' : shift === 'C' ? '📘' : '⚪';
        text += `${emoji} ${e.name} (${label})\n`;
      });
    }
    setWaModal({ show: true, text });
  };

  // ─── Employee CRUD ────────────────────────────────────────────────────────
  const addEmployee = useCallback((name: string, isYoung: boolean, courseDay: string) => {
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
      preferredDayOff: 'Segunda-feira',
      shiftName: 'Abertura',
      hiredAt: new Date().toISOString().split('T')[0],
    };

    // Add the employee and generate their schedule atomically in a single update.
    // We use the functional form of setEmployees so we always get the latest list.
    setEmployees(prev => {
      const updatedList = [...prev, newEmp];

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
          shifts: { ...emp.shifts, ...Object.fromEntries(Object.entries(empGenerated).map(([mk, v]) => [mk, v.shifts])) },
          dailyHours: { ...emp.dailyHours, ...Object.fromEntries(Object.entries(empGenerated).map(([mk, v]) => [mk, v.hours])) },
        };
      });
    });
  }, [today, customHolidays, setEmployees]);

  const handleDeleteEmployee = useCallback((id: string) => {
    setEmployees(prev => prev.filter(e => e.id !== id));
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
              onGenerateNextMonth={generateNextMonth}
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
