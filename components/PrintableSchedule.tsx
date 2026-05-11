import React, { useMemo } from 'react';
import { Employee, MonthYear, Holiday } from '../types';
import { buildHolidaySet, getNationalHolidays } from '../constants';

interface PrintableScheduleProps {
  employees: Employee[];
  currentMY: MonthYear;
  customHolidays: Holiday[];
  monthNotes?: string;
}

export const PrintableSchedule: React.FC<PrintableScheduleProps> = ({ employees, currentMY, customHolidays, monthNotes }) => {
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

  // Atestados
  const onMedicalLeave = activeEmployees.filter(e => {
    if (!e.atestadoStart || !e.atestadoEnd) return false;
    const start = new Date(e.atestadoStart + 'T00:00:00');
    const end = new Date(e.atestadoEnd + 'T00:00:00');
    const startM = start.getMonth();
    const endM = end.getMonth();
    const startY = start.getFullYear();
    const endY = end.getFullYear();
    return (currentMY.year === startY && currentMY.month === startM) || (currentMY.year === endY && currentMY.month === endM);
  });

  // Férias
  const onVacation = activeEmployees.filter(e => {
    if (!e.vacationStart || !e.vacationEnd) return false;
    const start = new Date(e.vacationStart + 'T00:00:00');
    const end = new Date(e.vacationEnd + 'T00:00:00');
    const startM = start.getMonth();
    const endM = end.getMonth();
    const startY = start.getFullYear();
    const endY = end.getFullYear();
    return (currentMY.year === startY && currentMY.month === startM) || (currentMY.year === endY && currentMY.month === endM);
  });

  // Aniversariantes do mês
  const birthdaysInMonth = activeEmployees.filter(e => {
    if (!e.birthday) return false;
    const parts = e.birthday.split('-');
    if (parts.length === 3) {
      return parseInt(parts[1], 10) === currentMY.month + 1;
    }
    return false;
  }).sort((a, b) => {
    return parseInt(a.birthday.split('-')[2], 10) - parseInt(b.birthday.split('-')[2], 10);
  });

  // Feriados do mês (Nacionais + Customizados)
  const holidaysInMonth = useMemo(() => {
    const allHolidays = [...getNationalHolidays(currentMY.year), ...customHolidays];
    return allHolidays.filter(h => {
      const d = new Date(h.date + 'T00:00:00');
      return d.getFullYear() === currentMY.year && d.getMonth() === currentMY.month;
    }).sort((a, b) => a.date.localeCompare(b.date));
  }, [currentMY, customHolidays]);

  return (
    <div id="printable-team-calendar" className="hidden print:block w-full bg-white text-black font-sans" style={{ minHeight: '100vh', pageBreakInside: 'avoid' }}>
      <style>{`
        @media print {
          @page { size: A4 landscape; margin: 8mm; }
          body { background: white !important; -webkit-print-color-adjust: exact; margin: 0; padding: 0; }
          * { box-sizing: border-box; }
        }
      `}</style>
      
      <div className="flex justify-between items-end mb-3">
        <div>
          <h1 className="text-[28px] font-black tracking-tight leading-none mb-1">ESCALA DE REVEZAMENTO 6 POR 1</h1>
          <h2 className="text-[12px] font-black">{monthName} {currentMY.year}</h2>
        </div>
        <div className="text-[10px] font-bold">
          Gerado em {new Date().toLocaleDateString('pt-BR')}, {new Date().toLocaleTimeString('pt-BR')}
        </div>
      </div>

      <table className="w-full border-collapse border-2 border-black mb-4" style={{ fontSize: '9px' }}>
        <thead>
          <tr>
            <th className="border border-black p-1 text-left w-32 uppercase">Colaborador</th>
            <th className="border border-black p-1 text-center w-24 uppercase">Horário</th>
            {days.map(d => (
              <th key={d.num} className="border border-black p-0.5 w-6 text-center">
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
                const display = (shift === 'T' || shift === 'N/A') ? '' : (shift === 'AT' ? '+' : (shift.startsWith('FF') ? 'FF' : shift));
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

      <div className="grid grid-cols-2 gap-4 text-[9px] mb-3">
        {/* Bloco 1: INFORMAÇÕES */}
        <div className="border-2 border-black p-2 flex flex-col">
          <h3 className="font-black uppercase mb-1.5 text-[11px] border-b border-black text-center pb-0.5">INFORMAÇÕES E AVISOS</h3>
          <div className="grid grid-cols-3 gap-2 flex-1">
            <div className="border border-black p-1 flex flex-col">
              <h4 className="font-black text-[8px] bg-gray-200 text-center py-0.5 mb-1 uppercase">Férias programadas</h4>
              <div className="space-y-0.5 flex-1">
                {onVacation.length > 0 ? onVacation.map(e => {
                  const s = e.vacationStart!.split('-').reverse().join('/');
                  const end = e.vacationEnd!.split('-').reverse().join('/');
                  return <div key={e.id} className="text-[7px] font-bold uppercase">{e.name.split(' ')[0]}: {s.substring(0,5)} A {end.substring(0,5)}</div>;
                }) : <div className="text-[7px] font-medium text-center">Nenhuma Férias</div>}
              </div>
            </div>
            <div className="border border-black p-1 flex flex-col">
              <h4 className="font-black text-[8px] bg-gray-200 text-center py-0.5 mb-1 uppercase">Atestados / Retornos</h4>
              <div className="space-y-0.5 flex-1">
                {onMedicalLeave.length > 0 ? onMedicalLeave.map(e => {
                  const retDate = new Date(e.atestadoEnd! + 'T00:00:00');
                  retDate.setDate(retDate.getDate() + 1);
                  const retStr = retDate.toLocaleDateString('pt-BR').substring(0,5);
                  return <div key={e.id} className="text-[7px] font-bold uppercase">{e.name.split(' ')[0]}: RETORNO {retStr}</div>;
                }) : <div className="text-[7px] font-medium text-center">Nenhum Atestado</div>}
              </div>
            </div>
            <div className="border border-black p-1 flex flex-col">
              <h4 className="font-black text-[8px] bg-gray-200 text-center py-0.5 mb-1 uppercase">Aniversariantes</h4>
              <div className="space-y-0.5 flex-1">
                {birthdaysInMonth.length > 0 ? birthdaysInMonth.map(e => (
                  <div key={e.id} className="text-[8px] font-bold uppercase">Dia {e.birthday.split('-')[2]} - {e.name.split(' ')[0]}</div>
                )) : <div className="text-[8px] font-medium text-center">Nenhum no mês</div>}
              </div>
            </div>
            <div className="border border-black p-1 flex flex-col">
              <h4 className="font-black text-[8px] bg-gray-200 text-center py-0.5 mb-1 uppercase">Feriados no mês</h4>
              <div className="space-y-0.5 flex-1">
                {holidaysInMonth.length > 0 ? holidaysInMonth.map(h => (
                  <div key={h.id} className="text-[8px] font-bold uppercase">{h.date.split('-').reverse().join('/').substring(0,5)} - {h.name}</div>
                )) : <div className="text-[8px] font-medium text-center">Nenhum Feriado</div>}
              </div>
            </div>
          </div>
        </div>

        {/* Bloco 2: REGRAS E ALMOÇOS */}
        <div className="border-2 border-black p-2 flex flex-col">
          <h3 className="font-black uppercase mb-1.5 text-[11px] border-b border-black text-center pb-0.5">REGRAS DE ALMOÇO E POSIÇÕES</h3>
          <div className="grid grid-cols-3 gap-2 flex-1">
            <div className="border border-black p-1">
               <h4 className="font-black text-[8px] bg-gray-200 text-center py-0.5 mb-1 uppercase">Almoços (Seg a Sáb)</h4>
               <div className="text-[8px] font-black space-y-0.5">
                 <div className="flex justify-between border-b border-gray-300"><span>12h45</span> <span>Aprendiz</span></div>
                 <div className="flex justify-between border-b border-gray-300"><span>13h00</span> <span>Máx. 1 Colaborador</span></div>
                 <div className="flex justify-between border-b border-gray-300"><span>13h30</span> <span>Máx. 1 Colaborador</span></div>
                 <div className="flex justify-between border-b border-gray-300"><span>14h00</span> <span>Máx. 2 Colaboradores</span></div>
                 <div className="flex justify-between border-b border-gray-300"><span>15h00</span> <span>Máx. 2 Colaboradores</span></div>
                 <div className="flex justify-between border-b border-gray-300"><span>16h00</span> <span>Máx. 2 Colaboradores</span></div>
                 <div className="flex justify-between border-b border-gray-300"><span>16h30</span> <span>Máx. 1 Colaborador</span></div>
                 <div className="flex justify-between"><span>17h00</span> <span>Máx. 1 Colaborador</span></div>
               </div>
            </div>
            <div className="border border-black p-1">
               <h4 className="font-black text-[8px] bg-gray-200 text-center py-0.5 mb-1 uppercase">Almoços (Domingo)</h4>
               <div className="text-[8px] font-black space-y-0.5">
                 <div className="flex justify-between border-b border-gray-300"><span>13h00</span> <span>Máx. 1 Colaborador</span></div>
                 <div className="flex justify-between border-b border-gray-300"><span>13h30</span> <span>Máx. 1 Colaborador</span></div>
                 <div className="flex justify-between border-b border-gray-300"><span>14h00</span> <span>Máx. 2 Colaboradores</span></div>
                 <div className="flex justify-between border-b border-gray-300"><span>15h00</span> <span>Máx. 2 Colaboradores</span></div>
                 <div className="flex justify-between border-b border-gray-300"><span>16h00</span> <span>Máx. 2 Colaboradores</span></div>
                 <div className="flex justify-between border-b border-gray-300"><span>16h30</span> <span>Máx. 1 Colaborador</span></div>
                 <div className="flex justify-between"><span>17h00</span> <span>Máx. 1 Colaborador</span></div>
               </div>
            </div>
            <div className="flex flex-col gap-1.5">
               <div className="border border-black p-1">
                 <h4 className="font-black text-[8px] bg-gray-200 text-center py-0.5 mb-1 uppercase">Posições Táticas</h4>
                 <div className="text-[8px] font-bold space-y-1">
                     <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-red-400 border border-black"></div><span>P1 (Caixa)</span></div>
                     <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-amber-400 border border-black"></div><span>P2 (Porta/Entrada)</span></div>
                     <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-green-400 border border-black"></div><span>P3 (Salão)</span></div>
                     <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-blue-400 border border-black"></div><span>P4 (Flexível)</span></div>
                      <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-slate-400 border border-black"></div><span>ESTQ (Estoque)</span></div>
                 </div>
               </div>
               <div className="text-[7.5px] font-black italic border border-black p-1 bg-gray-100 flex-1 flex items-center justify-center text-center leading-tight">
                 * FERIADOS: PAUSAS DE 15 MINUTOS, UM COLABORADOR POR VEZ A PARTIR DE 14H.
               </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bloco 3: RECADOS */}
      <div className="border-2 border-black p-2 flex flex-col">
        <h3 className="font-black uppercase mb-1 text-[11px] border-b border-black pb-0.5 text-center">RECADOS IMPORTANTES</h3>
        <div className="text-[10px] font-bold p-1 whitespace-pre-wrap leading-tight h-16">
          {monthNotes || ''}
        </div>
      </div>
      
    </div>
  );
};
