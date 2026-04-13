
import React, { useMemo } from 'react';
import { Employee, MonthYear, Holiday, ShiftType } from '../types';
import { buildHolidaySet, getNationalHolidays } from '../constants';
import { calculateLunchSchedule } from '../hooks/useLunchEngine';

interface MonthlyPrintViewProps {
  employees: Employee[];
  currentMY: MonthYear;
  customHolidays: Holiday[];
  onClose: () => void;
}

export const MonthlyPrintView: React.FC<MonthlyPrintViewProps> = ({ employees, currentMY, customHolidays, onClose }) => {
  const monthKey = `${currentMY.year}-${String(currentMY.month + 1).padStart(2, '0')}`;
  const daysInMonth = new Date(currentMY.year, currentMY.month + 1, 0).getDate();
  const holidaySet = buildHolidaySet(currentMY.year, customHolidays);
  const weekdays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  const days = Array.from({ length: daysInMonth }, (_, i) => {
    const d = new Date(currentMY.year, currentMY.month, i + 1);
    const dateStr = `${currentMY.year}-${String(currentMY.month + 1).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`;
    return {
      num: i + 1,
      weekday: weekdays[d.getDay()],
      isSunday: d.getDay() === 0,
      isHoliday: holidaySet.has(dateStr)
    };
  });

  const activeEmps = useMemo(() => employees.filter(e => !e.isHidden && e.status === 'active')
    .sort((a, b) => (a.workPeriod || '').localeCompare(b.workPeriod || '')), [employees]);

  const birthdays = useMemo(() => {
    return employees.filter(e => {
        if (!e.birthday) return false;
        const [,, dMonth] = e.birthday.split('-'); // YYYY-MM-DD
        const bMonth = parseInt(e.birthday.split('-')[1]) - 1;
        return bMonth === currentMY.month;
    }).sort((a,b) => {
        const dA = parseInt(a.birthday?.split('-')[2] || '0');
        const dB = parseInt(b.birthday?.split('-')[2] || '0');
        return dA - dB;
    });
  }, [employees, currentMY]);

  const vacations = useMemo(() => {
    return employees.filter(e => {
        if (!e.vacationStart) return false;
        const vStart = new Date(e.vacationStart);
        return vStart.getMonth() === currentMY.month && vStart.getFullYear() === currentMY.year;
    });
  }, [employees, currentMY]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-[200] bg-white flex flex-col p-0 overflow-auto print:absolute print:inset-0">
      <div className="flex items-center justify-between p-8 bg-slate-50 border-b print:hidden">
        <div className="flex items-center gap-3">
            <h2 className="text-xl font-black uppercase text-slate-800">ESCALA DE REVEZAMENTO 6 POR 1</h2>
            <span className="text-xs font-bold text-slate-400">A4 PAISAGEM</span>
        </div>
        <div className="flex gap-4">
            <button onClick={handlePrint} className="px-6 py-2 bg-slate-900 text-white rounded-xl font-black uppercase text-[10px] hover:bg-slate-800 transition-all flex items-center gap-2">
                Imprimir / PDF
            </button>
            <button onClick={onClose} className="px-6 py-2 bg-slate-100 text-slate-600 rounded-xl font-black uppercase text-[10px] hover:bg-slate-200 transition-all">
                Fechar
            </button>
        </div>
      </div>

      <div className="bg-white p-4 mx-auto w-full max-w-[297mm] print:p-0 print:m-0 print:w-auto">
        <style>{`
          @media print {
            @page { size: landscape; margin: 5mm; }
            body { background: white !important; }
            .no-print { display: none !important; }
            * { color: black !important; border-color: #000 !important; background-color: transparent !important; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid black !important; }
          }
           .print-table th, .print-table td { border: 1px solid #000; padding: 4px; font-size: 8px; text-transform: uppercase; font-weight: 800; }
           .lunch-table th, .lunch-table td { border: 1px solid #000; padding: 2px 4px; font-size: 7px; }
        `}</style>
        
        <header className="flex justify-between items-end mb-4 font-black">
            <div>
                <h1 className="text-2xl uppercase tracking-tighter">ESCALA DE REVEZAMENTO 6 POR 1</h1>
                <p className="text-[10px] uppercase">{['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'][currentMY.month]} {currentMY.year}</p>
            </div>
            <div className="text-right text-[10px]">
                <p>Gerado em {new Date().toLocaleString('pt-BR')}</p>
            </div>
        </header>

        <div className="w-full h-px bg-black mb-4" />

        {/* MAIN SCALE TABLE */}
        <table className="w-full print-table mb-6">
            <thead>
                <tr className="bg-slate-50">
                    <th className="text-left w-[120px]">Colaborador</th>
                    <th className="w-[80px]">Horário</th>
                    {days.map(d => (
                        <th key={d.num} className={`text-center ${d.isSunday || d.isHoliday ? 'bg-slate-100' : ''}`}>
                            {d.num}<br/><span className="text-[6px]">{d.weekday}</span>
                        </th>
                    ))}
                </tr>
            </thead>
            <tbody>
                {activeEmps.map(emp => (
                    <tr key={emp.id}>
                        <td className="font-bold">{emp.name.split(' ')[0]}</td>
                        <td className="text-center font-bold text-[7px]">{emp.workPeriod}</td>
                        {days.map((_, dayIdx) => {
                            let shift = (emp.shifts[monthKey] || [])[dayIdx] || 'F';
                            const dateStr = `${currentMY.year}-${String(currentMY.month + 1).padStart(2, '0')}-${String(dayIdx + 1).padStart(2, '0')}`;
                            if (emp.vacationStart && emp.vacationEnd && dateStr >= emp.vacationStart && dateStr <= emp.vacationEnd) shift = 'FE';
                            
                            // Em branco if working (T), show code for others
                            const displayShift = (shift === 'T') ? '' : 
                                                 (shift === 'FE') ? 'FE' : 
                                                 (shift === 'FF') ? 'FF' : 
                                                 (shift === 'C') ? 'C' : 'F';
                            
                            return (
                                <td key={dayIdx} className="text-center">
                                    {displayShift}
                                </td>
                            );
                        })}
                    </tr>
                ))}
            </tbody>
        </table>

        <div className="w-full h-px bg-black mb-4" />

        <div className="flex flex-col mb-4">
           <h4 className="text-[10px] font-black uppercase mb-1">Ausências e folgas:</h4>
           <div className="border border-black p-4 min-h-[40px] text-[8px] font-bold text-slate-500 italic">
              * Verifique as datas individuais na grade acima para detalhes de Folgas (F) e Folgas Feriado (FF).
           </div>
        </div>

        <div className="grid grid-cols-2 gap-8 mb-6">
                {/* LUNCH SCHEDULES - WEEKDAY */}
                <section>
                    <h3 className="text-[9px] font-black uppercase mb-2 border-b-2 border-black inline-block">Sugestão de Almoços (Seg-Sáb)</h3>
                    <div className="grid grid-cols-1 gap-1">
                        {(() => {
                            const firstMonday = days.find(d => d.weekday === 'Seg')?.num ? (days.find(d => d.weekday === 'Seg')!.num - 1) : 0;
                            const slots = calculateLunchSchedule(employees, firstMonday, false, false, monthKey);
                            return slots.map((s, i) => (
                                <div key={i} className="flex gap-2 text-[8px] font-bold">
                                    <span className="font-black border border-black px-1 min-w-[35px] text-center">{s.time}</span>
                                    <span>{s.employees.map(e => e.name).join(', ')}</span>
                                </div>
                            ));
                        })()}
                    </div>
                </section>

                {/* LUNCH SCHEDULES - SUNDAY */}
                <section>
                    <h3 className="text-[9px] font-black uppercase mb-2 border-b-2 border-black inline-block">Sugestão de Almoços (Domingo)</h3>
                    <div className="grid grid-cols-1 gap-1">
                        {(() => {
                            const firstSunday = days.find(d => d.isSunday)?.num ? (days.find(d => d.isSunday)!.num - 1) : 0;
                            const slots = calculateLunchSchedule(employees, firstSunday, true, false, monthKey);
                            return slots.map((s, i) => (
                                <div key={i} className="flex gap-2 text-[8px] font-bold">
                                    <span className="font-black border border-black px-1 min-w-[35px] text-center">{s.time}</span>
                                    <span>{s.employees.map(e => e.name).join(', ')}</span>
                                </div>
                            ));
                        })()}
                    </div>
                </section>
            </div>
            
            <p className="text-[6px] uppercase mt-2 italic font-black">* Feriados: Pausas de 15 minutos, um colaborador por vez sequencialmente as 13h.</p>

            {/* ADDITIONAL INFO */}
            <section className="space-y-4 mt-6">
                {birthdays.length > 0 && (
                    <div className="border border-black p-3 rounded-xl">
                        <h4 className="text-[9px] font-black uppercase mb-2 flex items-center gap-2">🍰 Aniversariantes do Mês</h4>
                        <div className="flex flex-wrap gap-x-4 gap-y-1">
                            {birthdays.map(e => (
                                <p key={e.id} className="text-[8px] font-bold uppercase">{e.birthday?.split('-')[2]}/{e.birthday?.split('-')[1]} - {e.name}</p>
                            ))}
                        </div>
                    </div>
                )}

                {vacations.length > 0 && (
                    <div className="border border-black p-3 rounded-xl">
                        <h4 className="text-[9px] font-black uppercase mb-2 flex items-center gap-2">🌴 Programação de Férias</h4>
                        <div className="flex flex-col gap-1">
                            {vacations.map(e => (
                                <p key={e.id} className="text-[8px] font-bold uppercase">{e.name}: {new Date(e.vacationStart!).toLocaleDateString('pt-BR')} a {e.vacationEnd ? new Date(e.vacationEnd).toLocaleDateString('pt-BR') : '30 dias'}</p>
                            ))}
                        </div>
                    </div>
                )}
            </section>
        </div>

        <footer className="mt-12 pt-8 border-t-2 border-dashed border-slate-300 flex justify-center gap-24 no-print h-32">
            <div className="w-[200px] border-t border-black text-center pt-1 text-[8px] font-bold uppercase">Assinatura Gerência</div>
            <div className="w-[200px] border-t border-black text-center pt-1 text-[8px] font-bold uppercase">Data de Divulgação</div>
        </footer>
      </div>
    );
  };
