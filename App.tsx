
import React, { useState, useMemo } from 'react';
import { useDialog } from './contexts/DialogContext';
import { useLocalStorage } from './hooks/useLocalStorage';
import { Header } from './components/Header';
import { Icon } from './components/Icon';
import { DaySummaryCard } from './components/DaySummaryCard';
import { ShiftGrid } from './components/ShiftGrid';
import { ActionToolbar } from './components/ActionToolbar';
import { TeamView } from './components/TeamView';
import { MOCK_EMPLOYEES, SHIFT_HOURS } from './constants';
import { Employee, ShiftType, MonthYear } from './types';

const App: React.FC = () => {
  const [employees, setEmployees] = useLocalStorage<Employee[]>('riHappyEmployeesData', MOCK_EMPLOYEES);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [currentView, setCurrentView] = useState<'dashboard' | 'team'>('dashboard');
  const [currentMY, setCurrentMY] = useState<MonthYear>({ month: 2, year: 2026 }); // March 2026
  const [selectedDayIdx, setSelectedDayIdx] = useState(0);
  const [waModal, setWaModal] = useState<{ show: boolean, text: string }>({ show: false, text: '' });
  const { showDialog } = useDialog();
  
  const today = useMemo(() => new Date(2026, 2, 15), []); // Simulated "today" for demonstration
  const monthKey = `${currentMY.year}-${currentMY.month.toString().padStart(2, '0')}`;

  const updateShift = (empId: string, dayIdx: number, newShift: ShiftType) => {
    setEmployees(prev => prev.map(emp => {
      if (emp.id === empId) {
        const currentMonthShifts = emp.shifts[monthKey] || Array(31).fill('F');
        const updatedShifts = [...currentMonthShifts];
        updatedShifts[dayIdx] = newShift;
        return { ...emp, shifts: { ...emp.shifts, [monthKey]: updatedShifts } };
      }
      return emp;
    }));
  };

  const updateEmployeeDailyHour = (empId: string, dayIdx: number, newHour: string) => {
    setEmployees(prev => prev.map(emp => {
      if (emp.id === empId) {
          const currentMonthHours = emp.dailyHours[monthKey] || Array(31).fill(emp.workPeriod);
          const updatedHours = [...currentMonthHours];
          updatedHours[dayIdx] = newHour;
          return { ...emp, dailyHours: { ...emp.dailyHours, [monthKey]: updatedHours } };
      }
      return emp;
    }));
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (Array.isArray(data)) {
          setEmployees(data);
          await showDialog({
            type: 'alert',
            message: 'Backup restaurado com sucesso!'
          });
        }
      } catch (error) {
        await showDialog({
          type: 'alert',
          message: 'Erro ao ler o arquivo de backup. Verifique se o formato está correto.'
        });
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  const resetMonth = async () => {
    const confirmed = await showDialog({
      type: 'confirm',
      message: "Deseja apagar os lançamentos manuais deste mês e retornar ao estado original?"
    });
    if (confirmed) {
      const daysInMonth = new Date(currentMY.year, currentMY.month + 1, 0).getDate();
      setEmployees(prev => prev.map(emp => ({
        ...emp,
        shifts: { ...emp.shifts, [monthKey]: Array(daysInMonth).fill('F') },
        dailyHours: { ...emp.dailyHours, [monthKey]: Array(daysInMonth).fill(emp.workPeriod) }
      })));
    }
  };

  const generateNextMonth = async () => {
    let nextMonth = currentMY.month + 1;
    let nextYear = currentMY.year;
    if (nextMonth > 11) { nextMonth = 0; nextYear++; }
    
    const targetKey = `${nextYear}-${nextMonth.toString().padStart(2, '0')}`;
    const daysInTargetMonth = new Date(nextYear, nextMonth + 1, 0).getDate();
    const weekdays = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
    const monthsNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

    let totalWorkDays = 0;
    let totalOffDays = 0;

    const newShiftsMap: Record<string, ShiftType[]> = {};
    const newHoursMap: Record<string, string[]> = {};

    employees.forEach((emp, index) => {
      const shifts = Array.from({ length: daysInTargetMonth }, (_, dayIdx) => {
        const date = new Date(nextYear, nextMonth, dayIdx + 1);
        const dayOfWeek = date.getDay();
        
        if (emp.isYoungApprentice) {
          if (dayOfWeek === 0 || dayOfWeek === 6) { totalOffDays++; return 'F' as ShiftType; }
          if (weekdays[dayOfWeek] === emp.courseDay) return 'C' as ShiftType;
        } else {
          if (weekdays[dayOfWeek] === emp.preferredDayOff) { totalOffDays++; return 'F' as ShiftType; }

          if (dayOfWeek === 0) { // Sunday Rotation
            const weekNum = Math.floor(dayIdx / 7);
            const isWorking = (index + weekNum) % 2 === 0;
            if (isWorking) { totalWorkDays++; return 'T' as ShiftType; }
            totalOffDays++; return 'F' as ShiftType;
          }
        }

        totalWorkDays++;
        return 'T' as ShiftType;
      });

      const hours = Array.from({ length: daysInTargetMonth }, (_, dayIdx) => {
        const date = new Date(nextYear, nextMonth, dayIdx + 1);
        if (date.getDay() === 0) return SHIFT_HOURS.SUNDAY[0]; 
        return emp.workPeriod;
      });

      newShiftsMap[emp.id] = shifts;
      newHoursMap[emp.id] = hours;
    });

    const summaryText = `Escala Automática - ${monthsNames[nextMonth]} ${nextYear}:
- Previsão de Dias de Trabalho: ${totalWorkDays}
- Aplicação de Folgas Padrão e Rotação de Domingos.

Deseja confirmar a geração para o PRÓXIMO MÊS (${monthsNames[nextMonth]})? O mês atual será preservado.`;

    const confirmed = await showDialog({
      type: 'confirm',
      message: summaryText
    });

    if (confirmed) {
      setEmployees(prev => prev.map(emp => ({
        ...emp,
        shifts: { ...emp.shifts, [targetKey]: newShiftsMap[emp.id] },
        dailyHours: { ...emp.dailyHours, [targetKey]: newHoursMap[emp.id] }
      })));
      // Auto navigate to the generated month
      setCurrentMY({ month: nextMonth, year: nextYear });
      setSelectedDayIdx(0);
    }
  };

  const shareWhatsApp = (dayIdx: number) => {
    const weekdays = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
    const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    const date = new Date(currentMY.year, currentMY.month, dayIdx + 1);
    
    let text = `📅 *ESCALA RI HAPPY - ${weekdays[date.getDay()].toUpperCase()}*\n📍 ${dayIdx + 1} de ${months[date.getMonth()]} de ${currentMY.year}\n\n`;

    const uniqueHours = Array.from(new Set(employees.filter(e => {
        const s = (e.shifts[monthKey] || [])[dayIdx];
        return s === 'T' || s === 'FF';
    }).map(e => (e.dailyHours[monthKey] || [])[dayIdx] || e.workPeriod))).sort();

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

    const mShiftsGetter = (e: Employee) => (e.shifts[monthKey] || [])[dayIdx];
    const off = employees.filter(e => ['F', 'FE', 'C'].includes(mShiftsGetter(e)));
    if (off.length > 0) {
      text += `━━━━━━━━━━━━━━━\n🌴 *FOLGA / CURSO / FÉRIAS*\n`;
      off.forEach(e => {
        const shift = mShiftsGetter(e);
        const label = shift === 'FE' ? 'Férias' : shift === 'C' ? 'Curso' : 'Folga';
        const emoji = shift === 'FE' ? '🟣' : shift === 'C' ? '📘' : '⚪';
        text += `${emoji} ${e.name} (${label})\n`;
      });
    }
    setWaModal({ show: true, text });
  };

  const addEmployee = (name: string, isYoung: boolean, courseDay: string) => {
    const newEmp: Employee = {
      id: Date.now().toString(),
      name,
      isYoungApprentice: isYoung,
      courseDay: isYoung ? courseDay : undefined,
      status: 'active',
      statusColor: '#' + Math.floor(Math.random()*16777215).toString(16),
      shifts: {},
      dailyHours: {},
      workPeriod: '10h às 18h20',
      preferredDayOff: 'Segunda-feira',
      shiftName: 'Abertura'
    };
    setEmployees(prev => [...prev, newEmp]);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header currentView={currentView} onViewChange={setCurrentView} currentMY={currentMY} />
      
      {waModal.show && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl p-8 max-w-lg w-full shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h4 className="text-xl font-extrabold flex items-center gap-2 text-slate-900"><Icon name="chat" className="text-green-600" /> Escala Diária</h4>
              <button onClick={() => setWaModal({ show: false, text: '' })} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><Icon name="close" /></button>
            </div>
            <textarea readOnly className="w-full h-80 bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm font-medium focus:ring-0 resize-none whitespace-pre-wrap outline-none text-slate-700" value={waModal.text} />
            <div className="mt-6 flex gap-3">
              <button onClick={async () => { navigator.clipboard.writeText(waModal.text); await showDialog({message: 'Copiado para a área de transferência!'}); }} className="flex-1 bg-green-600 text-white font-extrabold py-3 rounded-xl shadow-lg flex items-center justify-center gap-2 hover:bg-green-700 transition-all active:scale-95">
                <Icon name="content_copy" /> Copiar para WhatsApp
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="flex-1 px-4 sm:px-6 lg:px-10 py-8 max-w-[1700px] mx-auto w-full">
        {currentView === 'dashboard' ? (
          <>
            <div className="mb-8 animate-fade-in flex flex-col sm:flex-row sm:items-end justify-between gap-6">
              <div>
                <h1 className="text-4xl lg:text-5xl font-extrabold text-slate-900 tracking-tight mb-2">Painel de <span className="text-orange-500">Escalas</span></h1>
                <p className="text-sm font-bold text-slate-400">Gerencie turnos, visualize presença e envie escalas diárias.</p>
              </div>
            </div>
            
            <DaySummaryCard 
              employees={employees} 
              selectedDayIdx={selectedDayIdx} 
              currentMY={currentMY} 
            />

            <ActionToolbar 
              employees={employees}
              currentMY={currentMY}
              onImportClick={() => fileInputRef.current?.click()}
            />

            <input 
              type="file" 
              accept=".json" 
              ref={fileInputRef} 
              className="hidden" 
              onChange={handleImportBackup} 
            />

            <ShiftGrid 
              employees={employees} 
              currentMY={currentMY}
              selectedDayIdx={selectedDayIdx}
              today={today}
              onSelectDay={setSelectedDayIdx}
              onUpdateShift={updateShift} 
              onUpdateEmployeeDailyHour={updateEmployeeDailyHour}
              onShareWhatsApp={shareWhatsApp}
              onGenerateNextMonth={generateNextMonth}
              onResetMonth={resetMonth}
              onNextMonth={() => setCurrentMY(prev => { let m = prev.month+1; let y = prev.year; if(m>11){m=0;y++} return {month:m,year:y} })}
              onPrevMonth={() => setCurrentMY(prev => { let m = prev.month-1; let y = prev.year; if(m<0){m=11;y--} return {month:m,year:y} })}
            />
          </>
        ) : (
          <TeamView 
            employees={employees} 
            onUpdateEmployee={(id, data) => setEmployees(prev => prev.map(e => e.id === id ? {...e, ...data} : e))}
            onDeleteEmployee={(id) => setEmployees(prev => prev.filter(e => e.id !== id))} 
            onAddEmployee={addEmployee}
          />
        )}
      </main>
    </div>
  );
};

export default App;
