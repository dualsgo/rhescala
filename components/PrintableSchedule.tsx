import React, { useMemo } from 'react';
import { Employee, MonthYear, Holiday } from '../types';
import { buildHolidaySet } from '../constants';

interface PrintableScheduleProps {
  employees: Employee[];
  currentMY: MonthYear;
  customHolidays: Holiday[];
}

export const PrintableSchedule: React.FC<PrintableScheduleProps> = ({ employees, currentMY, customHolidays }) => {
  const monthKey = `${currentMY.year}-${String(currentMY.month + 1).padStart(2, '0')}`;
  const daysInMonth = new Date(currentMY.year, currentMY.month + 1, 0).getDate();
  const holidaySet = buildHolidaySet(currentMY.year, customHolidays);

  const days = Array.from({ length: daysInMonth }, (_, i) => {
    const date = new Date(currentMY.year, currentMY.month, i + 1);
    const dow = date.getDay();
    const dateStr = `${currentMY.year}-${String(currentMY.month + 1).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`;
    return { num: i + 1, dow, dateStr, isHoliday: holidaySet.has(dateStr), isSunday: dow === 0 };
  });

  const monthNames = ['JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO', 'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'];
  const monthName = monthNames[currentMY.month];

  const activeEmployees = useMemo(() => {
    return employees.filter(e => e.status === 'active' && !e.isHidden).sort((a, b) => a.name.localeCompare(b.name));
  }, [employees]);

  // Férias
  const onVacation = activeEmployees.filter(e => {
    if (!e.vacationStart || !e.vacationEnd) return false;
    const startM = new Date(e.vacationStart + 'T00:00:00').getMonth();
    const endM = new Date(e.vacationEnd + 'T00:00:00').getMonth();
    const startY = new Date(e.vacationStart + 'T00:00:00').getFullYear();
    const endY = new Date(e.vacationEnd + 'T00:00:00').getFullYear();
    return (currentMY.year === startY && currentMY.month === startM) || (currentMY.year === endY && currentMY.month === endM);
  });

  // Lunch Suggestions logic (Seg-Sáb)
  const lunchWeekday = useMemo(() => {
    const groups: Record<string, string[]> = {
      '12h45': [], '14h': [], '15h': [], '16h': [], '17h': [], 'Flexível': []
    };
    let closingIndex = 0;
    
    activeEmployees.forEach(emp => {
      const firstName = (emp.name || '').split(' ')[0].toUpperCase();
      if (emp.isYoungApprentice) {
        groups['12h45'].push(firstName);
      } else if (emp.cargo?.toUpperCase() === 'ESTOQUISTA') {
        groups['Flexível'].push(firstName);
      } else if (emp.workPeriod?.startsWith('10h')) {
        groups['14h'].push(firstName);
      } else if (emp.workPeriod?.startsWith('12h')) {
        groups['15h'].push(firstName);
      } else {
        // Fechamento (13h40)
        if (closingIndex % 2 === 0) groups['16h'].push(firstName);
        else groups['17h'].push(firstName);
        closingIndex++;
      }
    });
    return groups;
  }, [activeEmployees]);

  // Lunch Suggestions logic (Domingo)
  const lunchSunday = useMemo(() => {
    const groups: Record<string, string[]> = {
      '14h': [], '15h': [], '16h': [], '17h': []
    };
    let idx = 0;
    const slots = ['14h', '15h', '16h', '17h'];
    
    activeEmployees.forEach(emp => {
      if (emp.isYoungApprentice) return; // Não trabalha domingo
      const firstName = (emp.name || '').split(' ')[0].toUpperCase();
      if (emp.cargo?.toUpperCase() === 'ESTOQUISTA') return; // Flexivel/nao listado
      
      if (emp.workPeriod?.startsWith('10h')) {
        groups['14h'].push(firstName);
      } else if (emp.workPeriod?.startsWith('12h')) {
        groups['15h'].push(firstName);
      } else {
        groups[slots[2 + (idx % 2)]].push(firstName);
        idx++;
      }
    });
    return groups;
  }, [activeEmployees]);

  return (
    <div id="printable-team-calendar" className="hidden print:block w-full bg-white text-black font-sans" style={{ minHeight: '100vh', pageBreakInside: 'avoid' }}>
      <style>{`
        @media print {
          @page { size: A4 landscape; margin: 8mm; }
          body { background: white !important; -webkit-print-color-adjust: exact; margin: 0; padding: 0; }
          * { box-sizing: border-box; }
        }
      `}</style>
      
      <div className="flex justify-between items-end mb-4">
        <div>
          <h1 className="text-[28px] font-black tracking-tight leading-none mb-1">ESCALA DE REVEZAMENTO 6 POR 1</h1>
          <h2 className="text-[12px] font-black">{monthName} {currentMY.year}</h2>
        </div>
        <div className="text-[10px] font-bold">
          Gerado em {new Date().toLocaleDateString('pt-BR')}, {new Date().toLocaleTimeString('pt-BR')}
        </div>
      </div>

      <table className="w-full border-collapse border-2 border-black mb-6" style={{ fontSize: '9px' }}>
        <thead>
          <tr>
            <th className="border border-black p-1 text-left w-32 uppercase">Colaborador</th>
            <th className="border border-black p-1 text-center w-24 uppercase">Horário</th>
            {days.map(d => (
              <th key={d.num} className="border border-black p-1 w-6 text-center">
                <div className="font-black text-[11px]">{d.num}</div>
                <div className="text-[7px] font-bold">{'DOM SEG TER QUA QUI SEX SAB'.split(' ')[d.dow]}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {activeEmployees.map(emp => (
            <tr key={emp.id}>
              <td className="border border-black px-1.5 py-1 truncate max-w-[120px] font-black uppercase">
                {(emp.name || '').split(' ')[0]}
              </td>
              <td className="border border-black px-1 py-1 text-center font-black uppercase">
                {emp.workPeriod || ''}
              </td>
              {days.map(d => {
                const shift = emp.shifts[monthKey]?.[d.num - 1] || 'T';
                // Regra: se for 'T', vazio. Se não, mostra o shift.
                const display = (shift === 'T' || shift === 'N/A') ? '' : shift;
                return (
                  <td key={d.num} className="border border-black p-1 text-center font-black">
                    {display}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      <div className="grid grid-cols-2 gap-6 text-[10px] mb-6">
        {/* Box 1 */}
        <div>
          <h3 className="font-black uppercase mb-1.5 text-[11px]">Ausências e Folgas:</h3>
          <div className="border border-black p-3 min-h-[50px] flex items-center">
            <span className="italic font-medium">* Verifique as datas individuais na grade acima para detalhes de Folgas (F) e Folgas Feriado (FF).</span>
          </div>
        </div>

        {/* Box 2 */}
        <div>
          <h3 className="font-black uppercase mb-1.5 text-[11px]">Posicionamento Tático (Legenda):</h3>
          <div className="border border-black p-3 min-h-[50px] grid grid-cols-2 gap-2">
             <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-red-400"></div>
                <span className="font-medium">P1 (Caixa)</span>
             </div>
             <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-amber-400"></div>
                <span className="font-medium">P2 (Porta/Entrada)</span>
             </div>
             <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-green-400"></div>
                <span className="font-medium">P3 (Salão)</span>
             </div>
             <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-blue-400"></div>
                <span className="font-medium">P4 (Coringa/Flexível)</span>
             </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6 text-[10px] mb-2">
        {/* Box 3 */}
        <div>
          <h3 className="font-black uppercase mb-1.5 text-[11px] border-b-2 border-black inline-block">Sugestão de Almoços (Seg-Sáb)</h3>
          <div className="mt-2 space-y-1.5">
             {Object.entries(lunchWeekday).filter(([_, names]) => names.length > 0).map(([time, names]) => (
                <div key={time} className="flex">
                   <div className="w-12 font-black border border-black text-center px-1 py-0.5">{time}</div>
                   <div className="ml-3 font-medium uppercase py-0.5">{names.join(', ')}</div>
                </div>
             ))}
          </div>
        </div>

        {/* Box 4 */}
        <div>
          <h3 className="font-black uppercase mb-1.5 text-[11px] border-b-2 border-black inline-block">Sugestão de Almoços (Domingo)</h3>
          <div className="mt-2 space-y-1.5">
             {Object.entries(lunchSunday).filter(([_, names]) => names.length > 0).map(([time, names]) => (
                <div key={time} className="flex">
                   <div className="w-12 font-black border border-black text-center px-1 py-0.5">{time}</div>
                   <div className="ml-3 font-medium uppercase py-0.5">{names.join(', ')}</div>
                </div>
             ))}
          </div>
        </div>
      </div>

      <div className="mb-6">
        <span className="text-[8px] italic font-bold">* FERIADOS: PAUSAS DE 15 MINUTOS, UM COLABORADOR POR VEZ SEQUENCIALMENTE AS 13H.</span>
      </div>

      {/* Box 5 */}
      <div>
        <div className="border border-black p-3 rounded-xl">
           <h3 className="font-black uppercase mb-2 text-[11px] flex items-center gap-2">
             🌴 Programação de Férias
           </h3>
           <div className="space-y-1">
              {onVacation.length > 0 ? onVacation.map(e => {
                const s = e.vacationStart!.split('-').reverse().join('/');
                const end = e.vacationEnd!.split('-').reverse().join('/');
                return <div key={e.id} className="font-bold uppercase text-[10px]">{e.name.split(' ')[0]} : {s} A {end}</div>;
              }) : (
                <div className="font-medium text-[10px]">NENHUMA FÉRIAS PROGRAMADA</div>
              )}
           </div>
        </div>
      </div>
      
    </div>
  );
};
