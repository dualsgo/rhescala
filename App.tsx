
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Employee, MonthYear, Holiday, ShiftType } from './types';
import { Sidebar } from './components/Sidebar';
import { ShiftGrid } from './components/ShiftGrid';
import { AnalysisPanel } from './components/AnalysisPanel';
import { HolidayManager } from './components/HolidayManager';
import { DaySummaryCard } from './components/DaySummaryCard';
import { HolidayCreditPanel } from './components/HolidayCreditPanel';
import { Icon } from './components/Icon';
import { useDialog } from './contexts/DialogContext';
import { MOCK_EMPLOYEES, buildHolidaySet, getNationalHolidays, PLACEHOLDER_EMPLOYEE_ID } from './constants';
import { isGasEnvironment, gasStore } from './src/gas-api';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

function useSyncedData<T>(key: string, defaultValue: T): [T, React.Dispatch<React.SetStateAction<T>>, boolean] {
  const [value, setValue] = useState<T>(defaultValue);
  const [isSyncing, setIsSyncing] = useState(false);
  const isInitialMount = useRef(true);

  // Initial load
  useEffect(() => {
    const loadData = async () => {
      setIsSyncing(true);
      const local = localStorage.getItem(key);
      if (local) setValue(JSON.parse(local));

      if (isGasEnvironment) {
        try {
          const remote = await gasStore.get(key);
          if (remote) {
            setValue(remote);
            localStorage.setItem(key, JSON.stringify(remote));
          }
        } catch (e) { console.error("GAS Load Fail", e); }
      }
      setIsSyncing(false);
    };
    loadData();
  }, [key]);

  // Save on change
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    localStorage.setItem(key, JSON.stringify(value));
    
    if (isGasEnvironment) {
      const save = async () => {
        try {
          setIsSyncing(true);
          await gasStore.set(key, value);
        } catch (e) { console.error("GAS Save Fail", e); }
        finally { setIsSyncing(false); }
      };
      const t = setTimeout(save, 1000); // Debounce
      return () => clearTimeout(t);
    }
  }, [key, value]);

  return [value, setValue, isSyncing];
}

function useLocalPreference<T>(key: string, defaultValue: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    const stored = localStorage.getItem(key);
    return stored !== null ? JSON.parse(stored) : defaultValue;
  });
  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);
  return [value, setValue];
}

const App: React.FC = () => {
  const [employees, setEmployees, isSyncingEmp] = useSyncedData<Employee[]>('riHappyEmployees', MOCK_EMPLOYEES);
  const [currentMY, setCurrentMY] = useState<MonthYear>({ month: new Date().getMonth(), year: new Date().getFullYear() });
  const [currentView, setCurrentView] = useState<'grid' | 'analysis' | 'credits'>('grid');
  const [showHolidayManager, setShowHolidayManager] = useState(false);
  const [customHolidays, setCustomHolidays, isSyncingHol] = useSyncedData<Holiday[]>('riHappyCustomHolidays', []);
  const [selectedDayIdx, setSelectedDayIdx] = useState(new Date().getDate() - 1);
  const [showDayDetail, setShowDayDetail] = useState(false);
  const [waModal, setWaModal] = useState<{ show: boolean; text: string }>({ show: false, text: '' });
  const [isLocked, setIsLocked] = useLocalPreference<boolean>('riHappyGridLocked', true);
  const [isEditable, setIsEditable] = useState(false);
  const [isMinimized, setIsMinimized] = useLocalPreference<boolean>('riHappySidebarMinimized', false);
  const [sortConfig, setSortConfig] = useState<{ key: 'name' | 'workPeriod'; direction: 'asc' | 'desc' } | null>(null);
  const [hideOffOnSelectedDay, setHideOffOnSelectedDay] = useState(false);
  const [viewMode, setViewMode] = useState<'table' | 'calendar'>('table');
  const { showDialog } = useDialog();

  const today = useMemo(() => new Date(), []);
  const monthKey = `${currentMY.year}-${String(currentMY.month + 1).padStart(2, '0')}`;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const updateShift = useCallback((empId: string, dayIdx: number, newShift: ShiftType) => {
    setEmployees(prev => prev.map(emp => {
      if (emp.id !== empId) return emp;
      const currentShifts = [...(emp.shifts[monthKey] || Array(31).fill('T'))];
      currentShifts[dayIdx] = newShift;
      return { ...emp, shifts: { ...emp.shifts, [monthKey]: currentShifts } };
    }));
  }, [monthKey, setEmployees]);

  const updateShifts = useCallback((empId: string, updates: { dayIdx: number; shift: ShiftType }[]) => {
    setEmployees(prev => prev.map(emp => {
      if (emp.id !== empId) return emp;
      const currentShifts = [...(emp.shifts[monthKey] || Array(31).fill('T'))];
      updates.forEach(({ dayIdx, shift }) => { currentShifts[dayIdx] = shift; });
      return { ...emp, shifts: { ...emp.shifts, [monthKey]: currentShifts } };
    }));
  }, [monthKey, setEmployees]);

  const updateEmployeeDailyHour = useCallback((empId: string, dayIdx: number, newHour: string) => {
    setEmployees(prev => prev.map(emp => {
      if (emp.id !== empId) return emp;
      const currentHours = [...(emp.dailyHours[monthKey] || Array(31).fill(emp.workPeriod))];
      currentHours[dayIdx] = newHour;
      return { ...emp, dailyHours: { ...emp.dailyHours, [monthKey]: currentHours } };
    }));
  }, [monthKey, setEmployees]);

  const addHoliday = useCallback((h: Omit<Holiday, 'id'>) => {
    const newH = { ...h, id: `custom-${currentMY.year}-${Date.now()}` };
    setCustomHolidays(prev => [...prev, newH]);
  }, [currentMY, setCustomHolidays]);

  const removeHoliday = useCallback((id: string) => {
    setCustomHolidays(prev => prev.filter(h => h.id !== id));
  }, [setCustomHolidays]);

  const handleApplyFF = useCallback((empId: string, dayIdx: number, holidayName: string) => {
    const formattedDate = `${String(dayIdx + 1).padStart(2, '0')}/${String(currentMY.month + 1).padStart(2, '0')}`;
    setEmployees(prev => prev.map(emp => {
      if (emp.id !== empId) return emp;
      const shifts = [...(emp.shifts[monthKey] || Array(31).fill('T'))];
      shifts[dayIdx] = `FF ${formattedDate}`; // Applying FF with date suffix as requested
      return { ...emp, shifts: { ...emp.shifts, [monthKey]: shifts } };
    }));
    showDialog({ message: `Folga de Feriado (${holidayName}) aplicada com sucesso!` });
  }, [currentMY, monthKey, setEmployees, showDialog]);

  const handleToggleLock = useCallback(async (locked: boolean) => {
    if (!locked) {
      const code = await showDialog({ type: 'prompt', message: 'Digite o código de acesso para destravar (1234):' });
      if (code === '1234') {
        setIsLocked(false);
        setIsEditable(true);
      } else {
        await showDialog({ message: 'Código incorreto!' });
      }
    } else {
      setIsLocked(true);
      setIsEditable(false);
    }
  }, [showDialog, setIsLocked, setIsEditable]);

  const handleExportPDF = useCallback(() => {
    const doc = new jsPDF('l', 'mm', 'a4');
    const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    const daysInMonth = new Date(currentMY.year, currentMY.month + 1, 0).getDate();
    const headers = [['Colaborador', ...Array.from({ length: daysInMonth }, (_, i) => (i + 1).toString())]];
    
    const body = employees.filter(e => !e.isHidden).map(emp => {
      const shifts = emp.shifts[monthKey] || Array(31).fill('T');
      return [emp.name, ...shifts.slice(0, daysInMonth)];
    });

    autoTable(doc, {
      head: headers,
      body: body,
      startY: 25,
      styles: { fontSize: 7, cellPadding: 1, halign: 'center' },
      columnStyles: { 0: { halign: 'left', fontStyle: 'bold', cellWidth: 35 } },
      didDrawPage: (data) => {
        doc.setFontSize(16);
        doc.text(`Escala Ri Happy - ${months[currentMY.month]} ${currentMY.year}`, data.settings.margin.left, 15);
      }
    });

    // Final signature and legend can be more detailed
    doc.save(`escala_${monthKey}.pdf`);
  }, [currentMY, employees, monthKey]);

  const handleBackup = async () => {
    const choice = await showDialog({
      type: 'confirm',
      message: 'Deseja exportar um backup (Sim) ou importar um existente (Não)?',
    });
    if (choice === true) {
       const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(employees));
       const a = document.createElement('a');
       a.setAttribute('href', dataStr);
       a.setAttribute('download', `backup_${Date.now()}.json`);
       a.click();
    } else if (choice === false) {
       fileInputRef.current?.click();
    }
  };

  const handleUpdateFromTeam = useCallback(async () => {
    const confirmed = await showDialog({
      type: 'confirm',
      message: `Deseja ATUALIZAR a escala com base nas regras de cada colaborador (Folga Fixa e Curso)?
      
⚠️ Diferente do "Auto Preencher", esta ação:
• NÃO altera os domingos (mantém o rodízio atual).
• Apenas reaplica as folgas semanais e dias de curso.
• Ideal para quando você alterou o cargo ou folga preferencial de alguém.`,
    });
    if (!confirmed) return;

    const daysInMonth = new Date(currentMY.year, currentMY.month + 1, 0).getDate();
    const weekdaysFull = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];

    setEmployees(prev => prev.map(emp => {
      const currentShifts = [...(emp.shifts[monthKey] || Array(31).fill('T'))];
      const currentHours = [...(emp.dailyHours[monthKey] || Array(31).fill(emp.workPeriod))];

      for (let d = 0; d < daysInMonth; d++) {
        const date = new Date(currentMY.year, currentMY.month, d + 1);
        const dayName = weekdaysFull[date.getDay()];
        const isSunday = date.getDay() === 0;

        if (emp.isYoungApprentice && emp.courseDay === dayName) {
           currentShifts[d] = 'C';
           currentHours[d] = emp.workPeriod;
        } else if (emp.preferredDayOff === dayName && !isSunday) {
           currentShifts[d] = 'F';
        } else if (currentShifts[d] === 'F' && emp.preferredDayOff !== dayName && !isSunday) {
           currentShifts[d] = 'T';
        }
      }

      return {
        ...emp,
        shifts: { ...emp.shifts, [monthKey]: currentShifts },
        dailyHours: { ...emp.dailyHours, [monthKey]: currentHours },
      };
    }));
  }, [currentMY, employees, monthKey, showDialog, setEmployees]);

  const resetMonth = useCallback(async () => {
    const monthsNames = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
    const confirmed = await showDialog({ 
      type: 'confirm', 
      message: `Deseja AUTO PREENCHER toda a escala de ${monthsNames[currentMY.month]}? \n⚠️ Isso irá sobrescrever as folgas atuais mas manterá Férias e Feriados.` 
    });
    if (!confirmed) return;

    const daysInMonth = new Date(currentMY.year, currentMY.month + 1, 0).getDate();
    const weekdaysFull = ['domingo','segunda-feira','terça-feira','quarta-feira','quinta-feira','sexta-feira','sábado'];
    const holidaySet = buildHolidaySet(currentMY.year, customHolidays);

    setEmployees(prev => {
      const activeClt = prev.filter(e => !e.isYoungApprentice && e.status === 'active');
      let sundayRotationStart = 0; 

      return prev.map(emp => {
        if (emp.status !== 'active') return emp;
        const newShifts = Array(31).fill('T');
        const newHours = Array(31).fill(emp.workPeriod);

        for (let d = 0; d < daysInMonth; d++) {
          const date = new Date(currentMY.year, currentMY.month, d + 1);
          const dayName = weekdaysFull[date.getDay()];
          const isSun = date.getDay() === 0;
          const ds = `${currentMY.year}-${String(currentMY.month+1).padStart(2,'0')}-${String(d+1).padStart(2,'0')}`;

          if (emp.vacationStart && ds >= emp.vacationStart && ds <= (emp.vacationEnd || '')) {
            newShifts[d] = 'FE';
          } else if (emp.birthday === ds.substring(5)) {
            newShifts[d] = 'F';
          } else if (emp.isYoungApprentice) {
             if (holidaySet.has(ds)) newShifts[d] = 'F';
             else if (isSun || date.getDay() === 6) newShifts[d] = 'F';
             else if (emp.courseDay === dayName) { newShifts[d] = 'C'; }
          } else {
             if (isSun) {
               const sunCount = 0; // Simple rotation logic simplified here
               newShifts[d] = (d % 14 === 0) ? 'T' : 'F'; // Placeholder rotation
             } else if (emp.preferredDayOff === dayName) {
               newShifts[d] = 'F';
             }
          }
        }
        return { ...emp, shifts: { ...emp.shifts, [monthKey]: newShifts }, dailyHours: { ...emp.dailyHours, [monthKey]: newHours } };
      });
    });
  }, [currentMY, customHolidays, monthKey, showDialog, setEmployees]);

  const shareWhatsApp = (dayIdx: number) => {
    const months = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
    const weekdaysFull = ['domingo','segunda-feira','terça-feira','quarta-feira','quinta-feira','sexta-feira','sábado'];
    const date = new Date(currentMY.year, currentMY.month, dayIdx + 1);
    const weekdayName = weekdaysFull[date.getDay()];
    const weekdayLabel = weekdayName.charAt(0).toUpperCase() + weekdayName.slice(1);
    const dateStr = `${currentMY.year}-${String(currentMY.month + 1).padStart(2, '0')}-${String(dayIdx + 1).padStart(2, '0')}`;
    const isHoliday = buildHolidaySet(currentMY.year, customHolidays).has(dateStr);

    let textOut = `✨ *ESCADA DO DIA - ${weekdayLabel.toUpperCase()}* ✨\n`;
    textOut += `📅 ${dayIdx + 1} de ${months[currentMY.month].toUpperCase()}${isHoliday ? ' (🚩 FERIADO)' : ''}\n`;
    textOut += `------------------------------------------\n\n`;

    const shiftGroups = isHoliday 
      ? [
          { label: 'OP. ABERTURA (H)', range: '12h às 18h', members: [] as any[] },
          { label: 'OP. INTERMEDIÁRIO (H)', range: '13h às 19h', members: [] as any[] },
          { label: 'OP. INTERMEDIÁRIO 2 (H)', range: '14h às 20h', members: [] as any[] },
          { label: 'OP. FECHAMENTO (H)', range: '15h às 21h', members: [] as any[] },
        ]
      : [
          { label: '🌞 ABERTURA',     range: '10h às 18h20', members: [] as any[] },
          { label: '⛅ INTERMEDIÁRIO',range: '12h às 20h20', members: [] as any[] },
          { label: '🌙 FECHAMENTO',   range: '13h40 às 22h', members: [] as any[] },
        ];

    const absent: { name: string; code: string }[] = [];

    employees.filter(e => !e.isHidden).forEach(e => {
      if (e.id === PLACEHOLDER_EMPLOYEE_ID) return;
      const shift = (e.shifts[monthKey] || [])[dayIdx] || 'T';
      const hour  = (e.dailyHours[monthKey] || [])[dayIdx] || e.workPeriod || '';
      const firstName = e.name.split(' ')[0];

      if (shift === 'T' || shift.startsWith('FF')) {
        const matchingGroup = shiftGroups.find(g => hour.includes(g.range.split(' ')[0]));
        if (matchingGroup) {
          matchingGroup.members.push({ name: firstName, hour });
        } else {
          shiftGroups[0].members.push({ name: firstName, hour });
        }
      } else if (['F', 'FE', 'C'].includes(shift)) {
        absent.push({ name: firstName, code: shift === 'F' ? 'Folga' : shift === 'FE' ? 'Férias' : 'Curso' });
      }
    });

    shiftGroups.forEach(g => {
      if (g.members.length === 0) return;
      textOut += `*${g.label}* (${g.range})\n`;
      g.members.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')).forEach(m => {
        textOut += `• ${m.name}\n`;
      });
      textOut += '\n';
    });

    if (absent.length > 0) {
      textOut += `------------------------------------------\n`;
      textOut += `*FORA DE ESCALA:*\n`;
      absent.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')).forEach(a => {
        textOut += `• ${a.name} (${a.code})\n`;
      });
      textOut += '\n';
    }

    textOut += `_Favor confirmar leitura no grupo._ 🤝`;
    setWaModal({ show: true, text: textOut });
  };

  return (
    <div className="flex h-screen bg-[#f8fafc] text-[#0f172a] font-sans selection:bg-orange-100 selection:text-orange-900 overflow-hidden">
      <input 
        type="file" 
        ref={fileInputRef} 
        style={{ display: 'none' }} 
        accept=".json" 
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = (ev) => {
            try {
              const data = JSON.parse(ev.target?.result as string);
              setEmployees(data);
              showDialog({ message: 'Backup importado com sucesso!' });
            } catch(err) {
              showDialog({ message: 'Erro ao importar backup.' });
            }
          };
          reader.readAsText(file);
        }}
      />

      <Sidebar 
        currentView={currentView}
        setCurrentView={setCurrentView}
        currentMY={currentMY}
        setCurrentMY={setCurrentMY}
        onPDF={handleExportPDF}
        onBackup={handleBackup}
        onAutoFill={resetMonth}
        onUpdateFromTeam={handleUpdateFromTeam}
        onHolidayManager={() => setShowHolidayManager(true)}
        onOpenCredits={() => setCurrentView('credits')}
        isLocked={isLocked}
        onToggleLock={handleToggleLock}
        isEditable={isEditable}
        onToggleEdit={() => setIsEditable(!isEditable)}
        isMenuMinimized={isMinimized}
        setIsMenuMinimized={setIsMinimized}
      />

      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        
        {/* GAS Sync Status Indicator */}
        {(isSyncingEmp || isSyncingHol) && isGasEnvironment && (
           <div className="fixed bottom-6 right-6 z-[200] bg-white border border-slate-200 px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-slide-up border-b-4 border-b-emerald-500">
              <div className="w-5 h-5 flex items-center justify-center relative">
                 <Icon name="sync" className="text-emerald-500 animate-spin" />
              </div>
              <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Sincronizando com Planilha...</span>
           </div>
        )}
        {showHolidayManager && (
          <HolidayManager
            year={currentMY.year}
            customHolidays={customHolidays.filter(h => h?.date?.startsWith(`${currentMY.year}`))}
            onAdd={addHoliday}
            onRemove={removeHoliday}
            onClose={() => setShowHolidayManager(false)}
          />
        )}

        {showDayDetail && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-[2.5rem] w-full max-w-2xl shadow-2xl border border-slate-200 flex flex-col max-h-[90vh] overflow-hidden">
              <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white z-10 no-print">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center">
                    <Icon name="event_available" className="text-xl" />
                  </div>
                  <div>
                    <h4 className="text-lg font-black text-slate-800 uppercase tracking-tight">Escala do Dia</h4>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{selectedDayIdx + 1}/{currentMY.month + 1}/{currentMY.year}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => shareWhatsApp(selectedDayIdx)}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-md active:scale-95"
                  >
                    <Icon name="chat" className="text-sm" /> WhatsApp
                  </button>
                  <button onClick={() => setShowDayDetail(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                    <Icon name="close" className="text-slate-400" />
                  </button>
                </div>
              </div>
              <div id="day-detail-screenshot" className="flex-1 overflow-y-auto p-8 custom-scrollbar bg-white">
                <DaySummaryCard selectedDayIdx={selectedDayIdx} employees={employees} currentMY={currentMY} customHolidays={customHolidays} />
              </div>
              <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-center no-print">
                 <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest italic">Dica: Capture um print desta tela para postar no grupo</p>
              </div>
            </div>
          </div>
        )}

        {waModal.show && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-[2rem] p-8 max-w-lg w-full shadow-2xl border border-slate-200">
              <div className="flex justify-between items-center mb-6">
                <h4 className="text-xl font-extrabold flex items-center gap-3 text-slate-900 uppercase tracking-tight">
                  <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center"><Icon name="chat" /></div> Texto Informativo
                </h4>
                <button onClick={() => setWaModal({ show: false, text: '' })} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400">
                  <Icon name="close" />
                </button>
              </div>
              <textarea
                readOnly
                className="w-full h-80 bg-slate-50 border border-slate-200 rounded-2xl p-6 text-xs font-bold focus:ring-0 resize-none whitespace-pre-wrap outline-none text-slate-700 leading-relaxed"
                value={waModal.text}
              />
              <div className="mt-6 flex gap-3">
                <button
                  onClick={async () => { navigator.clipboard.writeText(waModal.text); await showDialog({ message: 'Texto copiado com sucesso!' }); }}
                  className="flex-1 bg-emerald-600 text-white font-black py-4 rounded-2xl shadow-xl flex items-center justify-center gap-2 hover:bg-emerald-700 transition-all active:scale-95 uppercase text-[10px] tracking-widest"
                >
                  <Icon name="content_copy" /> Copiar para o WhatsApp
                </button>
              </div>
            </div>
          </div>
        )}

        <main className="flex-1 overflow-hidden p-4 sm:p-6 lg:p-8">
          {currentView === 'grid' ? (
            <ShiftGrid
              employees={employees}
              currentMY={currentMY}
              selectedDayIdx={selectedDayIdx}
              today={today}
              customHolidays={customHolidays}
              onOpenAnalysis={() => setCurrentView('analysis')}
              isLocked={isLocked}
              onToggleLock={handleToggleLock}
              isEditable={isEditable}
              onToggleEdit={() => setIsEditable(!isEditable)}
              onSelectDay={setSelectedDayIdx}
              onOpenDayDetail={(idx) => { setSelectedDayIdx(idx); setShowDayDetail(true); }}
              onUpdateShift={updateShift}
              onUpdateShifts={updateShifts}
              onUpdateEmployeeDailyHour={updateEmployeeDailyHour}
              onShareWhatsApp={shareWhatsApp}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              sortConfig={sortConfig}
              onSortChange={setSortConfig}
              hideOffOnSelectedDay={hideOffOnSelectedDay}
              onToggleHideOff={() => setHideOffOnSelectedDay(!hideOffOnSelectedDay)}
            />
          ) : currentView === 'analysis' ? (
            <AnalysisPanel
              employees={employees}
              currentMY={currentMY}
              customHolidays={customHolidays}
              onClose={() => setCurrentView('grid')}
              onUpdateShift={updateShift}
              onUpdateHour={updateEmployeeDailyHour}
            />
          ) : (
            <div className="h-full flex flex-col gap-6 animate-fade-in overflow-y-auto pr-2 custom-scrollbar">
               <div className="flex justify-between items-center bg-white px-8 py-6 rounded-3xl border border-slate-200">
                  <div className="flex items-center gap-4">
                     <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center font-black text-xl">FF</div>
                     <div>
                        <h2 className="text-xl font-black text-slate-900 uppercase">Gestão de Compensação de Feriados</h2>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Analise e aplique folgas por feriados trabalhados</p>
                     </div>
                  </div>
                  <button onClick={() => setCurrentView('grid')} className="px-6 py-2 bg-slate-100 text-slate-600 rounded-xl text-[10px] font-black uppercase hover:bg-slate-200 transition-all font-black">Fechar Painel</button>
               </div>
               <HolidayCreditPanel
                 employees={employees}
                 currentMY={currentMY}
                 customHolidays={customHolidays}
                 onApplyFF={handleApplyFF}
               />
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default App;
