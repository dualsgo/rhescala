
import React from 'react';
import { Employee, MonthYear, Holiday, ShiftType, AuditLogEntry } from '../types';
import { Icon } from './Icon';
import { HolidayCredit } from '../hooks/useHolidayCredits';
import { isWorkingShift } from '../hooks/useScheduleEngine';
import { buildHolidaySet, getShortName, isEmployeeActiveInMonth } from '../constants';

interface EmployeeScheduleCardProps {
  employees?: Employee[];
  employee: Employee;
  currentMY: MonthYear;
  customHolidays: Holiday[];
  holidayCredits: HolidayCredit[];
  onUpdateEmployee?: (empId: string, data: Partial<Employee>) => void;
  isAdmin?: boolean;
  isValidated?: boolean;
  onClose: () => void;
  onLockSession?: () => void;
  initialTab?: 'mes' | 'atual' | 'pedidos' | 'atestado' | 'historico';
  initialDate?: string;
  auditLogs?: AuditLogEntry[];
}

export const EmployeeScheduleCard: React.FC<EmployeeScheduleCardProps> = ({
  employees,
  employee,
  currentMY,
  customHolidays,
  holidayCredits,
  onUpdateEmployee,
  isAdmin,
  isValidated,
  onClose,
  onLockSession,
  initialTab = 'mes',
  initialDate,
  auditLogs = [],
}) => {
  const [newRequest, setNewRequest] = React.useState('');
  const [selectedRequestDate, setSelectedRequestDate] = React.useState('');
  const [showSubmitFeedback, setShowSubmitFeedback] = React.useState(false);
  const effectiveInitialTab = (!isAdmin && initialTab === 'atestado') ? 'mes' : initialTab;
  const [activeTab, setActiveTab] = React.useState<'mes' | 'atual' | 'pedidos' | 'atestado' | 'historico'>(effectiveInitialTab);
  const [requestType, setRequestType] = React.useState<'folga_aviso' | 'troca_turno'>('folga_aviso');
  const [targetEmployeeId, setTargetEmployeeId] = React.useState('');

  const [atestadoStartInput, setAtestadoStartInput] = React.useState(initialDate || employee.atestadoStart || '');
  const [atestadoDurationInput, setAtestadoDurationInput] = React.useState<number>(() => {
    if (employee.atestadoStart && employee.atestadoEnd) {
      const s = new Date(employee.atestadoStart + 'T00:00:00').getTime();
      const e = new Date(employee.atestadoEnd + 'T00:00:00').getTime();
      return Math.max(1, Math.round((e - s) / 86400000) + 1);
    }
    return 1;
  });
  const [atestadoSaveFeedback, setAtestadoSaveFeedback] = React.useState(false);

  React.useEffect(() => {
    if (initialTab) {
      setActiveTab((!isAdmin && initialTab === 'atestado') ? 'mes' : initialTab);
    }
  }, [initialTab, isAdmin]);

  React.useEffect(() => {
    setAtestadoStartInput(initialDate || employee.atestadoStart || '');
    if (employee.atestadoStart && employee.atestadoEnd) {
      const s = new Date(employee.atestadoStart + 'T00:00:00').getTime();
      const e = new Date(employee.atestadoEnd + 'T00:00:00').getTime();
      setAtestadoDurationInput(Math.max(1, Math.round((e - s) / 86400000) + 1));
    } else {
      setAtestadoDurationInput(1);
    }
  }, [employee.id, employee.atestadoStart, employee.atestadoEnd, initialDate]);

  const addDaysStr = (dateStr: string, days: number): string => {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
  };

  const handleSaveAtestado = () => {
    if (!onUpdateEmployee) return;
    if (!atestadoStartInput || atestadoDurationInput <= 0) {
      handleClearAtestado();
      return;
    }
    const endDate = addDaysStr(atestadoStartInput, atestadoDurationInput - 1);
    const startObj = new Date(atestadoStartInput + 'T00:00:00');
    const endObj = new Date(endDate + 'T00:00:00');
    
    const newShifts = { ...(employee.shifts || {}) };
    let current = new Date(startObj.getFullYear(), startObj.getMonth(), 1);
    
    while (current <= endObj) {
      const mKey = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`;
      const shiftsArr = [...(newShifts[mKey] || [])];
      const daysInM = new Date(current.getFullYear(), current.getMonth() + 1, 0).getDate();
      if (shiftsArr.length === 0) {
        for (let i = 0; i < daysInM; i++) shiftsArr[i] = 'T';
      }
      for (let d = 1; d <= daysInM; d++) {
        const dStr = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        if (dStr >= atestadoStartInput && dStr <= endDate) {
          shiftsArr[d - 1] = 'AT';
        } else if (shiftsArr[d - 1] === 'AT') {
          shiftsArr[d - 1] = 'T';
        }
      }
      newShifts[mKey] = shiftsArr;
      current.setMonth(current.getMonth() + 1);
    }

    onUpdateEmployee(employee.id, {
      atestadoStart: atestadoStartInput,
      atestadoEnd: endDate,
      shifts: newShifts
    });

    setAtestadoSaveFeedback(true);
    setTimeout(() => setAtestadoSaveFeedback(false), 3000);
  };

  const handleClearAtestado = () => {
    if (!onUpdateEmployee) return;
    const newShifts = { ...(employee.shifts || {}) };
    let hasChanges = false;
    for (const [mKey, shiftArr] of Object.entries(newShifts)) {
      if (Array.isArray(shiftArr) && shiftArr.includes('AT')) {
        newShifts[mKey] = shiftArr.map(s => s === 'AT' ? 'T' : s);
        hasChanges = true;
      }
    }
    const updates: Partial<Employee> = { atestadoStart: '', atestadoEnd: '' };
    if (hasChanges) updates.shifts = newShifts;
    onUpdateEmployee(employee.id, updates);

    setAtestadoStartInput('');
    setAtestadoDurationInput(1);
    setAtestadoSaveFeedback(true);
    setTimeout(() => setAtestadoSaveFeedback(false), 3000);
  };

  const monthKey = `${currentMY.year}-${String(currentMY.month + 1).padStart(2, '0')}`;
  const daysInMonth = new Date(currentMY.year, currentMY.month + 1, 0).getDate();
  const holidaySet = buildHolidaySet(currentMY.year, customHolidays);

  const shifts = (employee.shifts || {})[monthKey] || [];
  const hours = (employee.dailyHours || {})[monthKey] || [];

  const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

  const pendingCredits = holidayCredits.filter(c => c.status === 'pending');
  const scheduledCredits = holidayCredits.filter(c => c.status === 'scheduled');

  const myAuditLogs = React.useMemo(() => {
    if (!auditLogs || auditLogs.length === 0) return [];
    return auditLogs
      .filter(log => log.empId === employee.id)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [auditLogs, employee.id]);

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-white dark:bg-black w-full max-w-2xl rounded-[2.5rem] shadow-2xl border border-slate-200 dark:border-zinc-800 flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-300">
        
        {/* Header */}
        <div className="shrink-0 px-8 py-6 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between bg-white dark:bg-black z-10">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded-2xl flex items-center justify-center text-xl font-black shadow-sm">
              {employee.name.substring(0, 2).toUpperCase()}
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight leading-tight">{employee.name}</h3>
              <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">{employee.cargo || 'Colaborador'} • {months[currentMY.month]} {currentMY.year}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!isAdmin && onLockSession && (
              <button 
                type="button"
                onClick={onLockSession}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 hover:bg-rose-50 hover:border-rose-200 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-300 text-slate-600 dark:text-slate-300 text-xs font-bold transition-all shadow-xs"
                title="Bloquear sessão individual e exigir senha no próximo acesso"
              >
                <Icon name="lock" className="text-sm text-orange-500" />
                <span className="hidden sm:inline">Bloquear</span>
              </button>
            )}
            <button 
              onClick={onClose}
              className="w-10 h-10 rounded-full hover:bg-slate-100 dark:hover:bg-zinc-900 flex items-center justify-center text-slate-400 transition-colors"
            >
              <Icon name="close" className="text-2xl" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="shrink-0 flex border-b border-slate-100 dark:border-zinc-800 px-8 overflow-x-auto custom-scrollbar">
          <button 
            onClick={() => setActiveTab('mes')}
            className={`px-4 py-4 text-[11px] font-black uppercase tracking-widest border-b-2 transition-all whitespace-nowrap ${activeTab === 'mes' ? 'border-orange-500 text-orange-600' : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
          >
            Escala do Mês
          </button>
          <button 
            onClick={() => setActiveTab('atual')}
            className={`px-4 py-4 text-[11px] font-black uppercase tracking-widest border-b-2 transition-all whitespace-nowrap ${activeTab === 'atual' ? 'border-orange-500 text-orange-600' : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
          >
            Escala Atual
          </button>
          <button 
            onClick={() => setActiveTab('pedidos')}
            className={`px-4 py-4 text-[11px] font-black uppercase tracking-widest border-b-2 transition-all whitespace-nowrap ${activeTab === 'pedidos' ? 'border-orange-500 text-orange-600' : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
          >
            Solicitações
          </button>
          <button 
            onClick={() => setActiveTab('historico')}
            className={`px-4 py-4 text-[11px] font-black uppercase tracking-widest border-b-2 transition-all whitespace-nowrap flex items-center gap-1.5 ${activeTab === 'historico' ? 'border-orange-500 text-orange-600' : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
          >
            <Icon name="history_edu" className="text-sm" />
            <span>Histórico</span>
            {myAuditLogs.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-orange-500 text-white text-[9px] font-black shadow-xs">
                {myAuditLogs.length}
              </span>
            )}
          </button>
          {isAdmin && (
            <button 
              onClick={() => setActiveTab('atestado')}
              className={`px-4 py-4 text-[11px] font-black uppercase tracking-widest border-b-2 transition-all whitespace-nowrap flex items-center gap-1.5 ${activeTab === 'atestado' ? 'border-orange-500 text-orange-600' : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
            >
              <Icon name="medical_services" className="text-sm text-rose-500" />
              Atestado Médico
            </button>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          
          {activeTab === 'mes' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in">
            
            {/* Calendar Section */}
            <div className="space-y-4">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <Icon name="calendar_month" className="text-orange-500" /> Sua Escala do Mês
              </h4>
              
              <div className="grid grid-cols-7 gap-1">
                {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => (
                  <div key={i} className="text-center text-[9px] font-black text-slate-300 py-1 uppercase">{d}</div>
                ))}
                {(() => {
                  const firstDay = new Date(currentMY.year, currentMY.month, 1).getDay();
                  const grid = [];
                  for (let i = 0; i < firstDay; i++) grid.push(<div key={`pad-${i}`} />);
                  for (let d = 1; d <= daysInMonth; d++) {
                    const shift = shifts[d - 1] || 'T';
                    const isWorking = isWorkingShift(shift);
                    const isToday = new Date().getDate() === d && new Date().getMonth() === currentMY.month && new Date().getFullYear() === currentMY.year;
                    
                    let bgClass = 'bg-slate-50 dark:bg-zinc-900/50 text-slate-400';
                    let borderClass = 'border-transparent';
                    
                    if (shift === 'F') bgClass = 'bg-rose-100 text-rose-600 dark:bg-rose-900/40';
                    else if (shift === 'AT') bgClass = 'bg-rose-100 text-rose-600 dark:bg-rose-950/60 dark:text-rose-300';
                    else if (shift.startsWith('FF')) bgClass = 'bg-amber-100 text-amber-600 dark:bg-amber-900/40';
                    else if (shift === 'FE') bgClass = 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40';
                    else if (shift === 'DO') bgClass = 'bg-fuchsia-600 text-white shadow-md';
                    else if (isWorking) bgClass = 'bg-indigo-600 text-white shadow-md';
                    
                    if (isToday) borderClass = 'border-orange-500 ring-2 ring-orange-500/20';

                    grid.push(
                      <div 
                        key={d} 
                        className={`aspect-square rounded-xl flex flex-col items-center justify-center text-[11px] font-black transition-all border-2 ${bgClass} ${borderClass}`}
                      >
                        <span>{d}</span>
                        {shift !== 'T' && shift !== 'F' && <span className="text-[7px] opacity-70 leading-none mt-0.5">{
                          (shift === 'FE' && employee.vacationStart && employee.vacationEnd) ? (() => {
                            const fullDate = `${currentMY.year}-${String(currentMY.month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                            if (fullDate >= employee.vacationStart && fullDate <= employee.vacationEnd) {
                               const s = new Date(employee.vacationStart + 'T00:00:00').getTime();
                               const e = new Date(employee.vacationEnd + 'T00:00:00').getTime();
                               const c = new Date(fullDate + 'T00:00:00').getTime();
                               const total = Math.round((e - s) / 86400000) + 1;
                               const cur = Math.round((c - s) / 86400000) + 1;
                               return `FE ${cur}/${total}`;
                            }
                            return 'FE';
                          })() : (shift === 'AT') ? (() => {
                            if (employee.atestadoStart && employee.atestadoEnd) {
                              const fullDate = `${currentMY.year}-${String(currentMY.month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                              if (fullDate >= employee.atestadoStart && fullDate <= employee.atestadoEnd) {
                                 const s = new Date(employee.atestadoStart + 'T00:00:00').getTime();
                                 const e = new Date(employee.atestadoEnd + 'T00:00:00').getTime();
                                 const c = new Date(fullDate + 'T00:00:00').getTime();
                                 const total = Math.round((e - s) / 86400000) + 1;
                                 const cur = Math.round((c - s) / 86400000) + 1;
                                 return `AT ${cur}/${total}`;
                              }
                            }
                            return 'AT';
                          })() : (shift.startsWith('FF') ? 'FF' : shift)
                        }</span>}
                      </div>
                    );
                  }
                  return grid;
                })()}
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                <div className="flex items-center gap-1.5 px-2 py-1 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg">
                  <div className="w-2 h-2 rounded-full bg-indigo-600" />
                  <span className="text-[9px] font-bold text-indigo-600 dark:text-indigo-400 uppercase">Trabalha</span>
                </div>
                <div className="flex items-center gap-1.5 px-2 py-1 bg-rose-50 dark:bg-rose-900/20 rounded-lg">
                  <div className="w-2 h-2 rounded-full bg-rose-500" />
                  <span className="text-[9px] font-bold text-rose-500 dark:text-rose-400 uppercase">Folga</span>
                </div>
                <div className="flex items-center gap-1.5 px-2 py-1 bg-rose-50 dark:bg-rose-950/40 rounded-lg">
                  <div className="w-2 h-2 rounded-full bg-rose-400" />
                  <span className="text-[9px] font-bold text-rose-600 dark:text-rose-400 uppercase">Atestado</span>
                </div>
                <div className="flex items-center gap-1.5 px-2 py-1 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                  <div className="w-2 h-2 rounded-full bg-amber-500" />
                  <span className="text-[9px] font-bold text-amber-500 dark:text-amber-400 uppercase">Feriado</span>
                </div>
              </div>
            </div>

            {/* Details Section */}
            <div className="space-y-6">
              
              {/* Holiday Credits */}
              <div className="space-y-4">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <Icon name="history" className="text-emerald-500" /> Feriados e Folgas Especiais
                </h4>
                
                <div className="space-y-2">
                  {pendingCredits.length > 0 ? (
                    pendingCredits.map((c, i) => (
                      <div key={i} className="flex items-center justify-between p-3 bg-amber-50 dark:bg-amber-900/20 rounded-2xl border border-amber-100 dark:border-amber-800/50">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 rounded-lg flex items-center justify-center">
                            <Icon name="event_available" className="text-lg" />
                          </div>
                          <div>
                            <p className="text-[11px] font-black text-slate-800 dark:text-slate-100 uppercase">{c.holidayName}</p>
                            <p className="text-[9px] font-bold text-amber-600 uppercase tracking-tighter">Pendente de Agendamento</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] font-black text-slate-400 uppercase">{c.holidayDate.split('-').reverse().slice(0, 2).join('/')}</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-4 bg-slate-50 dark:bg-zinc-900/50 rounded-2xl border border-dashed border-slate-200 dark:border-zinc-800 text-center">
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Nenhum feriado pendente</p>
                    </div>
                  )}

                  {scheduledCredits.map((c, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl border border-emerald-100 dark:border-emerald-800/50">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 rounded-lg flex items-center justify-center">
                          <Icon name="check_circle" className="text-lg" />
                        </div>
                        <div>
                          <p className="text-[11px] font-black text-slate-800 dark:text-slate-100 uppercase">{c.holidayName}</p>
                          <p className="text-[9px] font-bold text-emerald-600 uppercase tracking-tighter">Agendado para {c.offDate?.split('-').reverse().slice(0, 2).join('/')}</p>
                        </div>
                      </div>
                      <Icon name="done_all" className="text-emerald-500" />
                    </div>
                  ))}
                </div>
              </div>

              {/* Quick Info */}
              <div className="p-5 bg-slate-950 dark:bg-zinc-900 rounded-3xl text-white shadow-lg space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
                    <Icon name="schedule" className="text-xl" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-white/50 uppercase tracking-widest">Carga Horária Base</p>
                    <p className="text-sm font-black uppercase">{employee.workPeriod || '44h Semanais'}</p>
                  </div>
                </div>
                <div className="h-px bg-white/10" />
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
                    <Icon name="celebration" className="text-xl" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-white/50 uppercase tracking-widest">Preferência de Folga</p>
                    <p className="text-sm font-black uppercase text-orange-400">{employee.preferredDayOff || 'Variável'}</p>
                  </div>
                </div>
              </div>

            </div>
          </div>
          )}

          {/* List of Shifts for the month */}
          {activeTab === 'atual' && (
            <div className="space-y-4 animate-fade-in">
            <div className="flex items-center justify-between px-2">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <Icon name="format_list_bulleted" className="text-indigo-500" /> Sua Escala Atual
              </h4>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {Array.from({ length: daysInMonth }, (_, i) => {
                const d = i + 1;
                const shift = shifts[i] || 'T';
                const hour = hours[i] || employee.workPeriod;
                const date = new Date(currentMY.year, currentMY.month, d);
                const dow = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'][date.getDay()];
                const isSun = date.getDay() === 0;
                const isHol = holidaySet.has(`${currentMY.year}-${String(currentMY.month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
                const fullDate = `${currentMY.year}-${String(currentMY.month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                const hasReq = (employee.requests || []).find(r => r.date === fullDate);

                if (shift === 'N/A') return null;

                return (
                  <div 
                    key={d} 
                    className={`flex items-center justify-between p-3 rounded-2xl border transition-all ${
                      isSun ? 'bg-rose-50/30 border-rose-100' : 
                      isHol ? 'bg-amber-50/30 border-amber-100' : 
                      'bg-slate-50/30 border-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex flex-col items-center justify-center w-10 h-10 bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-slate-100 dark:border-zinc-800">
                        <span className="text-[8px] font-black text-slate-300 uppercase leading-none">{dow.substring(0, 3)}</span>
                        <span className={`text-sm font-black ${isSun ? 'text-rose-500' : 'text-slate-700 dark:text-slate-200'}`}>{d}</span>
                      </div>
                      <div>
                        <p className={`text-[11px] font-black uppercase ${shift === 'F' ? 'text-rose-600' : (typeof shift === 'string' && shift.startsWith('FF')) ? 'text-amber-600' : 'text-slate-800 dark:text-slate-100'}`}>
                          {shift === 'T' ? 'Trabalha' : shift === 'F' ? 'Folga' : (typeof shift === 'string' && shift.startsWith('FF')) ? 'Folga Feriado' : shift === 'FE' ? (() => {
                            if (employee.vacationStart && employee.vacationEnd && fullDate >= employee.vacationStart && fullDate <= employee.vacationEnd) {
                              const s = new Date(employee.vacationStart + 'T00:00:00').getTime();
                              const e = new Date(employee.vacationEnd + 'T00:00:00').getTime();
                              const c = new Date(fullDate + 'T00:00:00').getTime();
                              const total = Math.round((e - s) / 86400000) + 1;
                              const cur = Math.round((c - s) / 86400000) + 1;
                              return `Férias (${cur}/${total})`;
                            }
                            return 'Férias';
                          })() : shift === 'AT' ? (() => {
                            if (employee.atestadoStart && employee.atestadoEnd && fullDate >= employee.atestadoStart && fullDate <= employee.atestadoEnd) {
                              const s = new Date(employee.atestadoStart + 'T00:00:00').getTime();
                              const e = new Date(employee.atestadoEnd + 'T00:00:00').getTime();
                              const c = new Date(fullDate + 'T00:00:00').getTime();
                              const total = Math.round((e - s) / 86400000) + 1;
                              const cur = Math.round((c - s) / 86400000) + 1;
                              return `Atestado (${cur}/${total})`;
                            }
                            return 'Atestado';
                          })() : shift === 'C' ? 'Curso' : shift === 'DO' ? 'Aniversário' : shift}
                        </p>
                        <div className="flex items-center gap-2">
                           <p className="text-[9px] font-bold text-slate-400 uppercase">{isWorkingShift(shift) ? hour : '---'}</p>
                           {hasReq && (
                             <span className={`w-1.5 h-1.5 rounded-full ${hasReq.status === 'granted' ? 'bg-emerald-500' : hasReq.status === 'seen' ? 'bg-blue-500' : 'bg-orange-500 animate-pulse'}`} />
                           )}
                        </div>
                      </div>
                    </div>
                    {isWorkingShift(shift) ? (
                      <div className="px-3 py-1 bg-indigo-100 dark:bg-indigo-900/40 rounded-full">
                        <span className="text-[9px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">Presente</span>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
          )}

          {/* Mural de Pedidos / Recados */}
          {activeTab === 'pedidos' && (
            <div className="space-y-6 animate-fade-in">
            <div className="flex items-center justify-between">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <Icon name="add_circle" className="text-orange-500" /> Nova Solicitação
              </h4>
            </div>

            {onUpdateEmployee ? (
              <div className="p-5 bg-slate-50 dark:bg-zinc-900/50 rounded-[2rem] border border-slate-200 dark:border-zinc-800 space-y-4">
                
                {/* Tipo de Pedido */}
                <div className="flex bg-slate-100 dark:bg-zinc-950 p-1 rounded-2xl gap-1 w-full max-w-sm">
                  <button 
                    onClick={() => setRequestType('folga_aviso')}
                    className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${requestType === 'folga_aviso' ? 'bg-white dark:bg-zinc-800 text-orange-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                    Folga / Aviso
                  </button>
                  <button 
                    onClick={() => setRequestType('troca_turno')}
                    className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${requestType === 'troca_turno' ? 'bg-white dark:bg-zinc-800 text-purple-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                    Troca de Turno
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                   <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Data Desejada</label>
                      <input 
                        type="date"
                        className="w-full bg-slate-100 dark:bg-zinc-950 border-none rounded-xl px-4 py-3 text-xs font-bold outline-none ring-1 ring-slate-200 dark:ring-zinc-800 focus:ring-2 focus:ring-orange-500 transition-all"
                        value={selectedRequestDate}
                        onChange={(e) => setSelectedRequestDate(e.target.value)}
                      />
                   </div>
                   {requestType === 'folga_aviso' ? (
                     <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Justificativa (Breve)</label>
                        <input 
                          type="text"
                          className="w-full bg-slate-100 dark:bg-zinc-950 border-none rounded-xl px-4 py-3 text-xs font-bold outline-none ring-1 ring-slate-200 dark:ring-zinc-800 focus:ring-2 focus:ring-orange-500 transition-all"
                          placeholder="Ex: Consulta médica"
                          value={newRequest}
                          onChange={(e) => setNewRequest(e.target.value)}
                        />
                     </div>
                   ) : (
                     <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Trocar com quem?</label>
                        <select 
                          className="w-full bg-slate-100 dark:bg-zinc-950 border-none rounded-xl px-4 py-3 text-xs font-bold outline-none ring-1 ring-slate-200 dark:ring-zinc-800 focus:ring-2 focus:ring-orange-500 transition-all text-slate-700 dark:text-slate-300"
                          value={targetEmployeeId}
                          onChange={(e) => setTargetEmployeeId(e.target.value)}
                        >
                          <option value="">-- Selecione o Colega --</option>
                          {(employees || [])
                            .filter(e => e.id !== employee.id && isEmployeeActiveInMonth(e, currentMY.year, currentMY.month))
                            .map(e => (
                              <option key={e.id} value={e.id}>{e.name.toUpperCase()}</option>
                          ))}
                        </select>
                     </div>
                   )}
                </div>
                
                <div className="flex items-center justify-between gap-4 pt-2">
                  <p className="text-[9px] text-slate-400 font-bold italic leading-tight max-w-[60%]">
                    {requestType === 'folga_aviso' 
                      ? '* Esta é uma solicitação sujeita a análise e não garante a folga até que o gestor a valide na escala oficial.'
                      : '* A troca só será validada após a confirmação do gestor. Avise seu colega!'}
                  </p>
                  <button 
                    disabled={(!newRequest.trim() && requestType === 'folga_aviso') || (!targetEmployeeId && requestType === 'troca_turno') || !selectedRequestDate}
                    onClick={() => {
                      const updated = [
                        ...(employee.requests || []).filter(r => r.date !== selectedRequestDate),
                        { 
                          date: selectedRequestDate, 
                          text: requestType === 'troca_turno' ? `Gostaria de trocar meu turno com ${getShortName((employees || []).find(e => e.id === targetEmployeeId)?.name, employees)}.` : newRequest.trim(), 
                          status: 'pending' as const,
                          createdAt: new Date().toISOString(),
                          type: requestType,
                          targetEmployeeId: requestType === 'troca_turno' ? targetEmployeeId : undefined
                        }
                      ];
                      onUpdateEmployee(employee.id, { requests: updated });
                      setNewRequest('');
                      setSelectedRequestDate('');
                      setTargetEmployeeId('');
                      setShowSubmitFeedback(true);
                      setTimeout(() => setShowSubmitFeedback(false), 8000);
                    }}
                    className={`whitespace-nowrap px-6 py-3 text-white rounded-xl text-[10px] font-black uppercase transition-all shadow-md active:scale-95 disabled:opacity-50 ${requestType === 'troca_turno' ? 'bg-purple-600 hover:bg-purple-700' : 'bg-orange-500 hover:bg-orange-600'}`}
                  >
                    Enviar Pedido
                  </button>
                </div>

                {/* Aviso de Análise Operacional */}
                {showSubmitFeedback && (
                  <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-2xl animate-fade-in">
                    <div className="flex gap-3">
                      <div className="w-8 h-8 bg-blue-500 text-white rounded-lg flex items-center justify-center shrink-0">
                        <Icon name="info" className="text-lg" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest">Solicitação Enviada!</p>
                        <p className="text-[11px] font-bold text-blue-800 dark:text-blue-300 leading-relaxed">
                          Sua solicitação foi enviada e será analisada durante a criação da escala. Ela será atendida sempre que possível, desde que não onere a operação da loja.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 text-center">
                 <p className="text-[10px] font-bold text-slate-400 uppercase italic">Acesse com sua senha para enviar solicitações.</p>
              </div>
            )}

            {/* List existing requests */}
            <div className="space-y-4">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 px-2">
                <Icon name="history" className="text-slate-400" /> Suas Solicitações
              </h4>
              <div className="space-y-3">
                {(employee.requests || []).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')).map((req, i) => (
                  <div className={`p-4 rounded-2xl border shadow-sm relative group transition-all ${
                    req.status === 'granted' && (isAdmin || isValidated) ? 'bg-emerald-50 border-emerald-100' :
                    req.status === 'refused' && (isAdmin || isValidated) ? 'bg-red-50 border-red-100' :
                    req.status === 'seen' && (isAdmin || isValidated) ? 'bg-blue-50 border-blue-100' :
                    'bg-white dark:bg-black border-slate-100 dark:border-zinc-800'
                  }`}>
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`text-[9px] font-black px-2 py-0.5 rounded-lg uppercase tracking-widest ${
                        req.status === 'granted' && (isAdmin || isValidated) ? 'bg-emerald-100 text-emerald-700' :
                        req.status === 'refused' && (isAdmin || isValidated) ? 'bg-red-100 text-red-700' :
                        req.status === 'seen' && (isAdmin || isValidated) ? 'bg-blue-100 text-blue-700' :
                        'bg-orange-100 text-orange-700'
                      }`}>
                        {(req.date || '').split('-').reverse().join('/')}
                      </span>
                      {req.type === 'troca_turno' && (
                        <span className="text-[8px] font-black px-2 py-0.5 rounded-lg uppercase tracking-widest bg-purple-100 text-purple-700 border border-purple-200">
                          Troca de Turno
                        </span>
                      )}
                      <span className="text-[8px] font-black text-slate-400 uppercase">
                        {req.status === 'granted' && (isAdmin || isValidated) ? 'Pedido Aprovado' : 
                         req.status === 'refused' && (isAdmin || isValidated) ? 'Pedido Recusado' : 
                         req.status === 'seen' && (isAdmin || isValidated) ? 'Gestor Ciente (Aviso)' : 
                         'Em Análise (Pendente)'}
                      </span>
                    </div>
                    <span className="text-[8px] font-bold text-slate-400 uppercase">
                      {(() => {
                        try {
                          return req.createdAt ? new Date(req.createdAt).toLocaleDateString('pt-BR') : '---';
                        } catch (e) {
                          return '---';
                        }
                      })()}
                    </span>
                  </div>
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-200 leading-relaxed pr-8">{req.text}</p>
                  
                  {req.feedback && (isAdmin || isValidated) && (
                    <div className="mt-3 p-2 bg-slate-50 dark:bg-zinc-900 rounded-lg border border-slate-100 dark:border-zinc-800">
                      <p className="text-[9px] font-black uppercase text-slate-400 mb-0.5">Justificativa do Gerente:</p>
                      <p className="text-[10px] font-bold text-slate-600 dark:text-slate-300 italic">{req.feedback}</p>
                    </div>
                  )}
                  
                  {isAdmin && onUpdateEmployee && req.status === 'pending' && (
                    <div className="mt-4 flex flex-wrap gap-2 pt-3 border-t border-slate-100 dark:border-zinc-800">
                      <p className="w-full text-[9px] font-black uppercase text-slate-400">Ação do Gestor:</p>
                      
                      <button 
                        onClick={() => {
                          if(window.confirm('Isto marcará o dia como Folga (F) na escala oficial. Confirmar?')) {
                            const [year, month, day] = (req.date || '').split('-');
                            if (year && month && day) {
                              const mKey = `${year}-${month}`;
                              const dIdx = parseInt(day, 10) - 1;
                              const newShifts = [...(employee.shifts[mKey] || Array(31).fill('T'))];
                              newShifts[dIdx] = 'F';

                              const updated = (employee.requests || []).map(r => 
                                (r.createdAt === req.createdAt) 
                                  ? { ...r, status: 'granted' as const, feedback: 'Folga Oficial (F) concedida e lançada na escala.' } : r
                              );
                              onUpdateEmployee(employee.id, { requests: updated, shifts: { ...employee.shifts, [mKey]: newShifts } });
                            }
                          }
                        }}
                        className="px-3 py-1.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 rounded-lg text-[9px] font-black uppercase transition-colors flex items-center gap-1 shadow-sm"
                      >
                        <Icon name="event_available" className="text-[11px]" /> Dar Folga (F)
                      </button>

                      {req.type === 'troca_turno' && req.targetEmployeeId && (
                        <button 
                          onClick={() => {
                            if(window.confirm('Isto trocará automaticamente os turnos, horários e posições dos dois colaboradores neste dia. Confirmar?')) {
                              const [year, month, day] = (req.date || '').split('-');
                              if (year && month && day) {
                                const mKey = `${year}-${month}`;
                                const dIdx = parseInt(day, 10) - 1;
                                
                                const targetEmp = (employees || []).find(e => e.id === req.targetEmployeeId);
                                if (targetEmp) {
                                  // Get current values
                                  const myShift = (employee.shifts[mKey] || [])[dIdx] || 'T';
                                  const myHour = (employee.dailyHours[mKey] || [])[dIdx] || employee.workPeriod;
                                  const myPos = (employee.tacticalPositions?.[mKey] || [])[dIdx] || null;
                                  
                                  const theirShift = (targetEmp.shifts[mKey] || [])[dIdx] || 'T';
                                  const theirHour = (targetEmp.dailyHours[mKey] || [])[dIdx] || targetEmp.workPeriod;
                                  const theirPos = (targetEmp.tacticalPositions?.[mKey] || [])[dIdx] || null;
                                  
                                  // Set target employee values to mine
                                  const newTargetShifts = [...(targetEmp.shifts[mKey] || Array(31).fill('T'))];
                                  newTargetShifts[dIdx] = myShift;
                                  const newTargetHours = [...(targetEmp.dailyHours[mKey] || [])];
                                  newTargetHours[dIdx] = myHour;
                                  const newTargetPos = [...(targetEmp.tacticalPositions?.[mKey] || [])];
                                  newTargetPos[dIdx] = myPos;
                                  
                                  onUpdateEmployee(targetEmp.id, { 
                                    shifts: { ...targetEmp.shifts, [mKey]: newTargetShifts },
                                    dailyHours: { ...targetEmp.dailyHours, [mKey]: newTargetHours },
                                    tacticalPositions: { ...targetEmp.tacticalPositions, [mKey]: newTargetPos }
                                  });
                                  
                                  // Set my values to theirs
                                  const newMyShifts = [...(employee.shifts[mKey] || Array(31).fill('T'))];
                                  newMyShifts[dIdx] = theirShift;
                                  const newMyHours = [...(employee.dailyHours[mKey] || [])];
                                  newMyHours[dIdx] = theirHour;
                                  const newMyPos = [...(employee.tacticalPositions?.[mKey] || [])];
                                  newMyPos[dIdx] = theirPos;
                                  
                                  const updated = (employee.requests || []).map(r => 
                                    (r.createdAt === req.createdAt) 
                                      ? { ...r, status: 'granted' as const, feedback: `Troca de turno com ${getShortName(targetEmp.name, employees)} efetuada na escala.` } : r
                                  );
                                  onUpdateEmployee(employee.id, { 
                                    requests: updated, 
                                    shifts: { ...employee.shifts, [mKey]: newMyShifts },
                                    dailyHours: { ...employee.dailyHours, [mKey]: newMyHours },
                                    tacticalPositions: { ...employee.tacticalPositions, [mKey]: newMyPos }
                                  });
                                }
                              }
                            }
                          }}
                          className="px-3 py-1.5 bg-purple-100 hover:bg-purple-200 text-purple-700 rounded-lg text-[9px] font-black uppercase transition-colors flex items-center gap-1 shadow-sm"
                        >
                          <Icon name="swap_horiz" className="text-[11px]" /> Efetuar Troca (Auto)
                        </button>
                      )}

                      <button 
                        onClick={() => {
                          const msg = window.prompt('Justificativa da aprovação (ex: Liberado mais cedo):', 'Pedido aprovado.');
                          if (msg !== null) {
                            const updated = (employee.requests || []).map(r => 
                              (r.createdAt === req.createdAt) 
                                ? { ...r, status: 'granted' as const, feedback: msg } : r
                            );
                            onUpdateEmployee(employee.id, { requests: updated });
                          }
                        }}
                        className="px-3 py-1.5 bg-teal-100 hover:bg-teal-200 text-teal-700 rounded-lg text-[9px] font-black uppercase transition-colors flex items-center gap-1 shadow-sm"
                      >
                        <Icon name="check_circle" className="text-[11px]" /> Aprovar (Outro)
                      </button>

                      <button 
                        onClick={() => {
                          const updated = (employee.requests || []).map(r => 
                            (r.createdAt === req.createdAt) 
                              ? { ...r, status: 'seen' as const, feedback: 'Gestor ciente do aviso.' } : r
                          );
                          onUpdateEmployee(employee.id, { requests: updated });
                        }}
                        className="px-3 py-1.5 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg text-[9px] font-black uppercase transition-colors flex items-center gap-1 shadow-sm"
                      >
                        <Icon name="visibility" className="text-[11px]" /> Ciente (Aviso)
                      </button>

                      <button 
                        onClick={() => {
                          const justification = window.prompt('Por que este pedido está sendo recusado?');
                          if (justification !== null) {
                            const updated = (employee.requests || []).map(r => 
                              (r.createdAt === req.createdAt) 
                                ? { ...r, status: 'refused' as const, feedback: justification.trim() || undefined } : r
                            );
                            onUpdateEmployee(employee.id, { requests: updated });
                          }
                        }}
                        className="px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg text-[9px] font-black uppercase transition-colors flex items-center gap-1 shadow-sm"
                      >
                        <Icon name="cancel" className="text-[11px]" /> Recusar
                      </button>
                    </div>
                  )}
                  
                  <div className="absolute top-4 right-4 flex items-center gap-2">
                    {isAdmin && onUpdateEmployee && req.status !== 'pending' && (
                       <button 
                        title="Desfazer e voltar para pendente"
                        onClick={() => {
                          const updated = (employee.requests || []).map(r => 
                            (r.createdAt === req.createdAt) 
                              ? { ...r, status: 'pending' as const, feedback: undefined } : r
                          );
                          onUpdateEmployee(employee.id, { requests: updated });
                        }}
                        className="p-1.5 text-slate-300 hover:text-blue-500 transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <Icon name="undo" className="text-sm" />
                      </button>
                    )}
                    <button 
                      title="Excluir Pedido"
                      onClick={() => {
                        const updated = (employee.requests || []).filter(r => r.createdAt !== req.createdAt);
                        onUpdateEmployee?.(employee.id, { requests: updated });
                      }}
                      className="p-1.5 text-slate-300 hover:text-rose-500 transition-colors"
                    >
                      <Icon name="delete" className="text-sm" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          </div>
          )}

          {activeTab === 'historico' && (
            <div className="space-y-6 animate-fade-in">
              <div className="bg-gradient-to-r from-orange-500/10 via-amber-500/10 to-transparent border border-orange-200/60 dark:border-orange-900/40 p-5 rounded-2xl flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-orange-500/20 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0">
                  <Icon name="history_edu" className="text-2xl" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight">
                    Histórico de Alterações na Escala
                  </h4>
                  <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mt-0.5">
                    Registro de todas as mudanças realizadas após a oficialização da escala, com justificativas e horários de alteração.
                  </p>
                </div>
              </div>

              {myAuditLogs.length === 0 ? (
                <div className="p-12 text-center flex flex-col items-center justify-center rounded-3xl bg-slate-50 dark:bg-zinc-900/50 border border-dashed border-slate-200 dark:border-zinc-800">
                  <div className="w-16 h-16 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-3">
                    <Icon name="check_circle" className="text-3xl" />
                  </div>
                  <h5 className="text-sm font-black text-slate-800 dark:text-slate-200 uppercase tracking-wide">
                    Nenhuma Alteração Registrada
                  </h5>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium max-w-sm mt-1">
                    Sua escala permanece exatamente conforme a versão original oficializada, sem alterações posteriores.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                      {myAuditLogs.length} alteraç{myAuditLogs.length === 1 ? 'ão registrada' : 'ões registradas'} (Mais recentes primeiro)
                    </span>
                  </div>

                  {myAuditLogs.map((log) => {
                    const dateFormatted = new Date(log.timestamp).toLocaleString('pt-BR', {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    });

                    return (
                      <div
                        key={log.id}
                        className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 shadow-sm space-y-3 hover:border-orange-200 dark:hover:border-zinc-700 transition-colors"
                      >
                        {/* Header: Dia da escala e quando foi modificado */}
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-zinc-800/80 pb-2.5">
                          <div className="flex items-center gap-2">
                            <span className="px-2.5 py-1 rounded-xl bg-orange-100 dark:bg-orange-950/50 text-orange-700 dark:text-orange-300 font-black text-xs uppercase tracking-wider">
                              📅 Dia {log.dateStr}
                            </span>
                            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                              {log.humanDescription}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 text-[11px] text-slate-400 dark:text-slate-500 font-medium">
                            <Icon name="schedule" className="text-xs" />
                            <span>{dateFormatted} por {log.authorName || 'Gestor'}</span>
                          </div>
                        </div>

                        {/* Antes e Depois */}
                        <div className="flex items-center gap-3 text-xs font-semibold flex-wrap">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-black uppercase text-slate-400">Antes:</span>
                            <span className="px-2.5 py-1 rounded-lg bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 font-black border border-rose-200 dark:border-rose-900/50 line-through opacity-85">
                              {log.beforeVal}
                            </span>
                          </div>

                          <Icon name="arrow_forward" className="text-xs text-slate-400 shrink-0" />

                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-black uppercase text-slate-400">Depois:</span>
                            <span className="px-2.5 py-1 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-black border border-emerald-200 dark:border-emerald-900/50 shadow-xs">
                              {log.afterVal}
                            </span>
                          </div>
                        </div>

                        {/* Justificativa */}
                        <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800/50 border border-slate-100 dark:border-zinc-800 flex items-start gap-2">
                          <Icon name="comment" className="text-xs text-orange-500 shrink-0 mt-0.5" />
                          <div className="text-xs">
                            <span className="font-black text-slate-500 dark:text-slate-400 uppercase text-[10px] mr-1.5">
                              Motivo:
                            </span>
                            <span className="font-semibold text-slate-800 dark:text-slate-200">
                              "{log.justification}"
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === 'atestado' && isAdmin && (
            <div className="space-y-6 animate-fade-in">
              <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 p-5 rounded-2xl flex items-start gap-3">
                <Icon name="medical_services" className="text-rose-500 text-2xl shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-black text-rose-900 dark:text-rose-200 uppercase tracking-tight">Lançamento de Atestado Médico</h4>
                  <p className="text-xs font-medium text-rose-700 dark:text-rose-300 mt-1">
                    Ao salvar o atestado, os dias correspondentes serão automaticamente marcados como <strong className="font-bold uppercase">AT (Atestado)</strong> na escala do colaborador, justificando as ausências e interrompendo a contagem do limite 6x1.
                  </p>
                </div>
              </div>

              {employee.atestadoStart && employee.atestadoEnd && (
                <div className="bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-4 rounded-2xl flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="w-3 h-3 rounded-full bg-rose-500 inline-block animate-pulse" />
                    <div>
                      <p className="text-[10px] font-black uppercase text-slate-400">Atestado Ativo Cadastrado</p>
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-100">
                        {new Date(employee.atestadoStart + 'T00:00:00').toLocaleDateString('pt-BR')} até {new Date(employee.atestadoEnd + 'T00:00:00').toLocaleDateString('pt-BR')}
                      </p>
                      <p className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 mt-0.5">
                        Retorno previsto ao trabalho: {new Date(addDaysStr(employee.atestadoEnd, 1) + 'T00:00:00').toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                  </div>
                  {onUpdateEmployee && (
                    <button
                      onClick={handleClearAtestado}
                      className="px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 dark:bg-red-950/60 dark:hover:bg-red-900 dark:text-red-300 text-xs font-extrabold rounded-xl transition-all"
                    >
                      Remover Atestado
                    </button>
                  )}
                </div>
              )}

              <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-6 rounded-2xl space-y-4 shadow-sm">
                <h4 className="text-xs font-black uppercase text-slate-700 dark:text-slate-200 tracking-wider">Novo / Editar Atestado</h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Data de Início do Atestado</label>
                    <input
                      type="date"
                      value={atestadoStartInput}
                      onChange={(e) => setAtestadoStartInput(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Duração (Dias)</label>
                    <input
                      type="number"
                      min={1}
                      max={180}
                      value={atestadoDurationInput}
                      onChange={(e) => setAtestadoDurationInput(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                </div>

                {atestadoStartInput && atestadoDurationInput > 0 && (
                  <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 p-3 rounded-xl text-xs font-medium text-amber-900 dark:text-amber-200 flex flex-col gap-1">
                    <p>
                      <strong>Período:</strong> {new Date(atestadoStartInput + 'T00:00:00').toLocaleDateString('pt-BR')} até {new Date(addDaysStr(atestadoStartInput, atestadoDurationInput - 1) + 'T00:00:00').toLocaleDateString('pt-BR')} ({atestadoDurationInput} dia{atestadoDurationInput > 1 ? 's' : ''})
                    </p>
                    <p className="text-emerald-700 dark:text-emerald-400 font-bold">
                      Data de Retorno: {new Date(addDaysStr(atestadoStartInput, atestadoDurationInput) + 'T00:00:00').toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                )}

                {onUpdateEmployee && (
                  <div className="pt-2 flex items-center justify-between">
                    {atestadoSaveFeedback ? (
                      <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                        <Icon name="check_circle" className="text-sm" /> Atestado atualizado com sucesso na escala!
                      </span>
                    ) : <div />}

                    <button
                      onClick={handleSaveAtestado}
                      disabled={!atestadoStartInput}
                      className="px-5 py-2.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white rounded-xl font-black text-xs uppercase tracking-wider transition-all shadow-md flex items-center gap-2"
                    >
                      <Icon name="save" className="text-sm" />
                      Salvar Atestado na Escala
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-6 bg-slate-50 dark:bg-zinc-900/50 border-t border-slate-100 dark:border-zinc-800 flex gap-3">
          <button 
            onClick={() => window.print()}
            className="flex-1 py-3.5 bg-slate-900 dark:bg-slate-700 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2"
          >
            <Icon name="print" /> Imprimir Minha Escala
          </button>
          <button 
            onClick={onClose}
            className="px-8 py-3.5 bg-white dark:bg-black border border-slate-200 dark:border-zinc-800 text-slate-500 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all active:scale-95"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
