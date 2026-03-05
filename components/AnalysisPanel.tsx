import React, { useMemo, useState } from 'react';
import { Employee, MonthYear, Holiday } from '../types';
import { Icon } from './Icon';
import { buildHolidaySet } from '../constants';

interface AnalysisPanelProps {
  employees: Employee[];
  currentMY: MonthYear;
  customHolidays: Holiday[];
  onClose: () => void;
}

export const AnalysisPanel: React.FC<AnalysisPanelProps> = ({ employees, currentMY, customHolidays, onClose }) => {
  const [selectedEmpId, setSelectedEmpId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'stats' | 'team-calendar'>('stats');
  const monthKey = `${currentMY.year}-${(currentMY.month + 1).toString().padStart(2, '0')}`;
  
  const stats = useMemo(() => {
    // ... stats logic same as before but encapsulated properly
    const daysInMonth = new Date(currentMY.year, currentMY.month + 1, 0).getDate();

    return employees.filter(e => !e.isHidden).map(emp => {
      let worked = 0;
      let sundays = 0;
      let holidaysWorked = 0;
      let holidayCreditsSpent = 0;
      let offs = 0;
      let maxConsecutive = 0;
      let currentConsecutive = 0;
      
      const currentShifts = emp.shifts[monthKey] || [];
      const earnedCredits: string[] = [];
      const spentCredits: string[] = [];
      const hSetCurrent = buildHolidaySet(currentMY.year, customHolidays);

      for (let i = 0; i < daysInMonth; i++) {
        const date = new Date(currentMY.year, currentMY.month, i + 1);
        const shift = currentShifts[i] || 'F';
        const dateStr = `${currentMY.year}-${String(currentMY.month + 1).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`;
        const isHoliday = hSetCurrent.has(dateStr);
        const isSunday = date.getDay() === 0;

        if (shift === 'T' || shift === 'C') {
          worked++;
          currentConsecutive++;
          if (isSunday) sundays++;
          if (isHoliday) {
            holidaysWorked++;
            earnedCredits.push(dateStr);
          }
        } else {
          offs++;
          currentConsecutive = 0;
          if (shift && typeof shift === 'string' && shift.startsWith('FF')) {
            holidayCreditsSpent++;
            spentCredits.push(dateStr);
          }
        }
        if (currentConsecutive > maxConsecutive) maxConsecutive = currentConsecutive;
      }

      const balance = earnedCredits.length - spentCredits.length;

      return {
        id: emp.id,
        name: emp.name,
        emp,
        worked,
        sundays,
        holidaysWorked,
        holidayCreditsSpent,
        balance,
        earnedCredits,
        spentCredits,
        offs,
        excess: maxConsecutive > 6,
        maxConsecutive
      };
    }).sort((a, b) => b.worked - a.worked);
  }, [employees, monthKey, currentMY, customHolidays]);

  const selectedEmployee = useMemo(() => 
    stats.find(s => s.id === selectedEmpId), [stats, selectedEmpId]
  );

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-md animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-6xl overflow-hidden flex flex-col max-h-[98vh] relative">
        
        {/* Individual Calendar View Modal Overlay */}
        {selectedEmployee && (
           <div className="absolute inset-0 z-[130] bg-slate-900/20 backdrop-blur-sm flex items-center justify-center p-0 sm:p-4 animate-scale-in">
              <div className="bg-white w-full max-w-md h-full sm:h-[95%] overflow-hidden flex flex-col sm:rounded-[2.5rem] shadow-2xl border border-slate-100">
                 <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
                     <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                       <Icon name="event_note" className="text-sky-600" /> Escala Mensal
                     </h2>
                     <button onClick={() => setSelectedEmpId(null)} className="p-2 bg-slate-100 text-slate-600 rounded-full hover:bg-slate-200 transition-all flex items-center justify-center">
                       <Icon name="close" className="text-sm" />
                     </button>
                 </div>
                 <div className="flex-1 overflow-auto p-4 flex flex-col items-center bg-slate-50/10 custom-scrollbar">
                     <div id="capture-calendar" className="bg-white p-5 rounded-[1.5rem] shadow-sm border border-slate-100 w-full max-w-[340px] my-auto">
                       <div className="flex items-center justify-between mb-3">
                          <div className="max-w-[75%]">
                            <h3 className="text-base font-black text-slate-800 leading-tight truncate">{selectedEmployee.name}</h3>
                            <p className="text-slate-400 font-bold uppercase tracking-[0.1em] text-[6px] mt-0.5">Folgas Confirmadas</p>
                          </div>
                          <div className="text-right">
                            <span className="text-2xl font-black text-slate-100 block">{(currentMY.month + 1).toString().padStart(2, '0')}</span>
                            <span className="text-[7px] font-black text-slate-300 uppercase tracking-widest">{currentMY.year}</span>
                          </div>
                       </div>
                       <MonthlyCalendar employee={selectedEmployee.emp} currentMY={currentMY} customHolidays={customHolidays} />
                       <div className="mt-6 grid grid-cols-3 gap-2 pt-4 border-t border-slate-100">
                          <StatusBadge label="Status" value="OK" color="slate" />
                          <StatusBadge label="Trabalho" value={`${selectedEmployee.worked}d`} color="slate" align="center" />
                          <StatusBadge label="Folgas" value={`${selectedEmployee.offs}d`} color="orange" align="right" />
                       </div>
                     </div>
                 </div>
              </div>
           </div>
        )}

        {/* Main Header */}
        <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-white sticky top-0 z-10">
          <div>
            <h2 className="text-2xl font-extrabold text-slate-900 flex items-center gap-3">
              <Icon name="analytics" className="text-orange-600" />
              Painel de Gestão
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <div className="bg-slate-100 p-1 rounded-xl flex gap-1 no-print">
               <button 
                 onClick={() => setViewMode('stats')}
                 className={`px-4 py-1.5 rounded-lg text-xs font-extrabold flex items-center gap-2 transition-all ${viewMode === 'stats' ? 'bg-white shadow-sm text-orange-600' : 'text-slate-500 hover:text-slate-600'}`}
               >
                 <Icon name="leaderboard" className="text-sm" /> Tabela Stats
               </button>
               <button 
                 onClick={() => setViewMode('team-calendar')}
                 className={`px-4 py-1.5 rounded-lg text-xs font-extrabold flex items-center gap-2 transition-all ${viewMode === 'team-calendar' ? 'bg-white shadow-sm text-orange-600' : 'text-slate-500 hover:text-slate-600'}`}
               >
                 <Icon name="calendar_view_month" className="text-sm" /> Escala Geral
               </button>
            </div>
            {viewMode === 'team-calendar' && (
              <button 
                onClick={() => window.print()}
                className="px-4 py-1.5 bg-sky-600 text-white rounded-lg text-xs font-black flex items-center gap-2 hover:bg-sky-700 transition-all no-print shadow-sm"
              >
                <Icon name="print" className="text-sm" /> Imprimir
              </button>
            )}
            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors no-print">
              <Icon name="close" className="text-slate-400 hover:text-slate-600" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto custom-scrollbar p-6 bg-slate-50/30">
          {viewMode === 'stats' ? (
            <div className="animate-fade-in">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                <SummaryCard title="Média Dias Trab." value={(stats.reduce((acc, s) => acc + s.worked, 0) / Math.max(stats.length, 1)).toFixed(1)} icon="timer" color="sky" />
                <SummaryCard title="Saldo Total FF" value={stats.reduce((acc, s) => acc + s.balance, 0).toString()} icon="account_balance_wallet" color="emerald" />
                <SummaryCard title="Pendências FF" value={stats.filter(s => s.balance > 0).length.toString()} icon="event_repeat" color="rose" />
                <SummaryCard title="Inconsistências" value={stats.filter(s => s.excess).length.toString()} icon="warning" color="red" />
              </div>

              <div className="overflow-x-auto rounded-3xl border border-slate-200 shadow-sm bg-white">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                      <th className="p-5 pl-8">Colaborador</th>
                      <th className="p-5 text-center">Ver</th>
                      <th className="p-5 text-center">Trab.</th>
                      <th className="p-5 text-center">Dom.</th>
                      <th className="p-5 text-center">Fer.</th>
                      <th className="p-5 text-center">FF Usadas</th>
                      <th className="p-5 text-center">Saldo FF</th>
                      <th className="p-5 text-center">Conformidade</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {stats.map(s => (
                      <tr key={s.id} className="hover:bg-slate-50/30 transition-colors group">
                        <td className="p-5 pl-8">
                          <div className="flex flex-col">
                            <span className="font-extrabold text-slate-800">{s.name}</span>
                            <span className="text-[9px] text-slate-400 font-bold uppercase">Saldo Acumulado: {s.balance}d</span>
                          </div>
                        </td>
                        <td className="p-5 text-center">
                           <button onClick={() => setSelectedEmpId(s.id)} className="w-9 h-9 bg-sky-50 text-sky-600 rounded-xl hover:bg-sky-600 hover:text-white transition-all flex items-center justify-center shadow-sm">
                             <Icon name="person_search" className="text-lg" />
                           </button>
                        </td>
                        <td className="p-5 text-center font-bold text-slate-600">{s.worked}</td>
                        <td className="p-5 text-center font-bold text-orange-500">{s.sundays}</td>
                        <td className="p-5 text-center font-bold text-rose-500">{s.holidaysWorked}</td>
                        <td className="p-5 text-center font-bold text-teal-600">{s.holidayCreditsSpent}</td>
                        <td className="p-5 text-center">
                           <span className={`px-3 py-1 rounded-full text-[10px] font-black ${s.balance > 0 ? 'bg-emerald-50 text-emerald-600' : s.balance < 0 ? 'bg-red-50 text-red-600' : 'bg-slate-100 text-slate-400'}`}>
                             {s.balance > 0 ? `+${s.balance}` : s.balance}
                           </span>
                        </td>
                        <td className="p-5 text-center">
                          {s.excess ? (
                            <div className="flex items-center justify-center gap-1.5 text-red-600 font-black text-[9px] uppercase bg-red-50 py-1.5 px-3 rounded-xl mx-auto w-fit">
                              <Icon name="warning" className="text-[14px]" /> Alerta 6x1
                            </div>
                          ) : (
                            <div className="flex items-center justify-center gap-1.5 text-emerald-600 font-black text-[9px] uppercase bg-emerald-50 py-1.5 px-3 rounded-xl mx-auto w-fit">
                              <Icon name="verified" className="text-[14px]" /> OK
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="h-full animate-fade-in bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm overflow-auto">
              <TeamMonthlyCalendar employees={employees} currentMY={currentMY} customHolidays={customHolidays} />
            </div>
          )}
        </div>

        <div className="px-8 py-5 bg-white border-t border-slate-100 flex items-center justify-between">
           <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Vista operativa mensal v1.0 • Ri Happy Management</p>
           <button onClick={onClose} className="px-8 py-2.5 bg-slate-900 text-white text-xs font-black rounded-xl hover:bg-slate-800 transition-all shadow-md active:scale-95">Fechar Painel</button>
        </div>
      </div>
    </div>
  );
};

const StatusBadge: React.FC<{ label: string, value: string, color: string, align?: 'left' | 'center' | 'right' }> = ({ label, value, color, align = 'left' }) => (
  <div className={`flex flex-col ${align === 'center' ? 'items-center' : align === 'right' ? 'items-end text-right' : ''}`}>
    <span className="text-[6px] font-black text-slate-300 uppercase tracking-tighter">{label}</span>
    <span className={`text-[9px] font-extrabold ${color === 'orange' ? 'text-orange-500' : 'text-slate-600'} uppercase`}>{value}</span>
  </div>
);

const MonthlyCalendar: React.FC<{ employee: Employee, currentMY: MonthYear, customHolidays: Holiday[] }> = ({ employee, currentMY, customHolidays }) => {
  const daysInMonth = new Date(currentMY.year, currentMY.month + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentMY.year, currentMY.month, 1).getDay();
  const monthKey = `${currentMY.year}-${(currentMY.month + 1).toString().padStart(2, '0')}`;
  const shifts = employee.shifts[monthKey] || [];
  const hSet = buildHolidaySet(currentMY.year, customHolidays);

  const weekdays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  
  const cells = [];
  
  // Local helper to identify "early/excess" off
  const getIsExcessOff = (dayIdx: number) => {
    const shift = shifts[dayIdx] || 'F';
    const isOff = shift === 'F' || (typeof shift === 'string' && shift.startsWith('FF')) || shift === 'FE';
    if (!isOff) return false;

    // Check if this off was preceded by less than 6 days of work
    // We look at the previous break
    let workedBefore = 0;
    for (let j = dayIdx - 1; j >= 0; j--) {
      const prevShift = shifts[j] || 'F';
      const prevIsOff = prevShift === 'F' || (typeof prevShift === 'string' && prevShift.startsWith('FF')) || prevShift === 'FE';
      if (prevIsOff) break;
      workedBefore++;
    }
    return workedBefore < 6 && workedBefore > 0;
  };

  for (let i = 0; i < firstDayOfMonth; i++) {
    cells.push({ type: 'empty' });
  }
  for (let i = 1; i <= daysInMonth; i++) {
    const shift = shifts[i - 1] || 'F';
    const dateStr = `${currentMY.year}-${String(currentMY.month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
    const isHoliday = hSet.has(dateStr);
    
    // Logic for colors
    const isOff = shift === 'F' || (typeof shift === 'string' && shift.startsWith('FF')) || shift === 'FE';
    const isWork = shift === 'T' || shift === 'C';

    const isExcessOff = false; // logic removed per user request
    
    cells.push({ type: 'day', date: i, shift, isOff, isWork, isHoliday, isExcessOff });
  }

  return (
    <div className="w-full">
      <div className="grid grid-cols-7 gap-1 mb-1">
        {weekdays.map(wd => (
          <div key={wd} className="text-center text-[8px] font-black text-slate-400 uppercase">
            {wd}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((cell, idx) => {
          let bgColor = 'bg-slate-50/50 border-slate-100';
          let textColor = 'text-slate-400';
          let borderColor = 'border-slate-100';

          if (cell.type === 'day') {
            if (cell.isOff) {
              bgColor = 'bg-rose-50';
              borderColor = 'border-rose-200';
              textColor = 'text-rose-600';
            } else if (cell.shift === 'C') {
              bgColor = 'bg-sky-50';
              borderColor = 'border-sky-200';
              textColor = 'text-sky-600';
            } else if (cell.shift === 'T') {
              bgColor = 'bg-emerald-50';
              borderColor = 'border-emerald-200';
              textColor = 'text-emerald-600';
            }

            // Exclusive overrides for special conditions
            if (cell.isHoliday) {
              borderColor = 'border-amber-400 border-[3px]';
            }
          }

          return (
            <div 
              key={idx} 
              className={`aspect-square rounded-lg flex flex-col items-center justify-center relative border ${
                cell.type === 'empty' ? 'border-transparent' : `${bgColor} ${borderColor}`
              } ${cell.isExcessOff ? '' : ''}`}
            >
              {cell.type === 'day' && (
                <>
                  <span className={`absolute top-0.5 left-1 text-[6px] font-black opacity-40 ${textColor}`}>
                     {cell.date}
                  </span>
                  <div className="flex flex-col items-center justify-center leading-none mt-1">
                    <span className={`text-[10px] font-black ${textColor}`}>
                      {cell.shift.split(' ')[0]}
                    </span>
                    {cell.shift.startsWith('FF ') && (
                      <span className="text-[5px] font-bold opacity-70">
                        ({cell.shift.split(' ')[1]})
                      </span>
                    )}
                  </div>
                  {cell.isHoliday && (
                    <div className="absolute -top-1 -right-1 bg-amber-400 rounded-full p-0.5 shadow-sm">
                      <Icon name="event" className="text-white text-[7px]" />
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const TeamMonthlyCalendar: React.FC<{ employees: Employee[], currentMY: MonthYear, customHolidays: Holiday[] }> = ({ employees, currentMY, customHolidays }) => {
  const daysInMonth = new Date(currentMY.year, currentMY.month + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentMY.year, currentMY.month, 1).getDay();
  const monthKey = `${currentMY.year}-${(currentMY.month + 1).toString().padStart(2, '0')}`;
  const hSet = buildHolidaySet(currentMY.year, customHolidays);

  const weekdays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const cells = [];
  for (let i = 0; i < firstDayOfMonth; i++) cells.push({ type: 'empty' });
  for (let i = 1; i <= daysInMonth; i++) {
    const dateStr = `${currentMY.year}-${String(currentMY.month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
    const isHoliday = hSet.has(dateStr);
    
    // Find who is working
    const workingDayData = employees.filter(e => !e.isHidden).map(emp => {
      const shift = (emp.shifts[monthKey] || [])[i - 1] || 'F';
      const hours = (emp.dailyHours[monthKey] || [])[i - 1] || emp.workPeriod;
      const isOff = shift === 'F' || (typeof shift === 'string' && shift.startsWith('FF')) || shift === 'FE';
      const isCourse = shift === 'C';
      return { 
        name: emp.name.split(' ')[0], 
        shift, 
        hours,
        isOff, 
        isCourse 
      };
    }).filter(d => !d.isOff);

    cells.push({ type: 'day', date: i, isHoliday, dayData: workingDayData });
  }

  return (
    <div className="w-full">
       <style>{`
          @media print {
            body * { visibility: hidden; }
            #team-calendar-print-root, #team-calendar-print-root * { visibility: visible; }
            #team-calendar-print-root { position: absolute; left: 0; top: 0; width: 100%; height: 100%; background: white !important; padding: 0 !important; margin: 0 !important; }
            .no-print { display: none !important; }
            .print-border { border: 1px solid #e2e8f0 !important; }
            .print-scale { transform: scale(0.95); transform-origin: top left; }
            .print-cell-height { min-height: 85px !important; }
            @page { size: A4 landscape; margin: 5mm; }
          }
       `}</style>
       <div id="team-calendar-print-root" className="w-full print-scale">
         <div className="hidden print:block mb-4">
            <h1 className="text-xl font-black text-slate-900 uppercase">Escala Operacional Geral</h1>
            <p className="text-xs font-bold text-slate-500">{(currentMY.month +1).toString().padStart(2, '0')}/{currentMY.year}</p>
         </div>

         <div className="grid grid-cols-7 gap-1 mb-1">
          {weekdays.map(wd => (
            <div key={wd} className="text-center text-[10px] font-black text-slate-400 uppercase">{wd}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((cell, idx) => (
            <div 
              key={idx} 
              className={`min-h-[110px] print-cell-height rounded-xl border p-2 flex flex-col gap-0.5 transition-all break-inside-avoid ${
                cell.type === 'empty' ? 'border-transparent' : 
                cell.isHoliday ? 'bg-slate-100 border-slate-300 shadow-sm print-border' : 'bg-white border-slate-100 print-border'
              }`}
            >
              {cell.type === 'day' && (
                <>
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-black ${cell.isHoliday ? 'text-slate-900' : 'text-slate-400'}`}>{cell.date}</span>
                    {cell.isHoliday && <Icon name="event" className="text-slate-400 text-sm" />}
                  </div>
                   <div className="flex flex-col gap-0.5 mt-1 overflow-hidden">
                      {cell.dayData.map((d, i) => (
                        <div key={i} className={`text-[7px] font-bold flex items-center justify-between gap-1 py-0.5 border-b border-slate-50 last:border-0 text-slate-700`}>
                           <div className="flex items-center gap-1 min-w-0 flex-1">
                              <span className="truncate text-[8px] uppercase">{d.name}</span>
                              {d.isCourse && <span className="text-[6px] font-black border border-slate-300 px-0.5 rounded shrink-0">C</span>}
                           </div>
                           {!d.isOff && (
                             <span className="text-[6px] font-black opacity-60 shrink-0">
                               {d.hours.replace(' às ', '-')}
                             </span>
                           )}
                        </div>
                      ))}
                   </div>
                </>
              )}
            </div>
          ))}
        </div>
       </div>
    </div>
  );
};

const SummaryCard: React.FC<{ title: string, value: string, icon: any, color: 'sky' | 'orange' | 'rose' | 'emerald' | 'red' }> = ({ title, value, icon, color }) => {
  const colorClasses = {
    sky: 'bg-sky-100 text-sky-600',
    orange: 'bg-orange-100 text-orange-600',
    rose: 'bg-rose-100 text-rose-600',
    emerald: 'bg-emerald-100 text-emerald-600',
    red: 'bg-red-100 text-red-600'
  };

  return (
    <div className="bg-white border border-slate-200 p-5 rounded-3xl flex items-center gap-4 shadow-sm hover:shadow-md transition-all">
      <div className={`w-12 h-12 ${colorClasses[color]} rounded-2xl flex items-center justify-center shrink-0`}>
        <Icon name={icon} className="text-xl" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest truncate">{title}</p>
        <h4 className="text-xl font-black text-slate-900">{value}</h4>
      </div>
    </div>
  );
};
