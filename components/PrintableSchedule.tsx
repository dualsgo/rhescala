import React, { useMemo } from 'react';
import { Employee, MonthYear, Holiday } from '../types';
import { buildHolidaySet, getNationalHolidays, getShortName, isEmployeeActiveInMonth, isEmployeeActiveOnDay } from '../constants';

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
    return employees.filter(e => isEmployeeActiveInMonth(e, currentMY.year, currentMY.month)).sort((a, b) => a.name.localeCompare(b.name));
  }, [employees, currentMY]);

  const mStartStr = `${currentMY.year}-${String(currentMY.month + 1).padStart(2, '0')}-01`;
  const mEndStr = `${currentMY.year}-${String(currentMY.month + 1).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;

  // Atestados
  const onMedicalLeave = activeEmployees.filter(e => {
    if (e.atestadoStart && e.atestadoEnd && e.atestadoStart <= mEndStr && e.atestadoEnd >= mStartStr) return true;
    const empShifts = e.shifts[monthKey] || [];
    return empShifts.includes('AT');
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
    return parseInt(a.birthday!.split('-')[2], 10) - parseInt(b.birthday!.split('-')[2], 10);
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
                {getShortName(emp.name, activeEmployees)}
              </td>
              <td className="border border-black px-1 py-1 text-center font-black uppercase">
                {emp.workPeriod || ''}
              </td>
              {days.map(d => {
                const isOut = !isEmployeeActiveOnDay(emp, d.dateStr, monthKey, d.num - 1);
                const shift = isOut ? 'N/A' : (emp.shifts[monthKey]?.[d.num - 1] || 'T');
                const isWorking = shift === 'T' || ['P1', 'PC', 'P2', 'P3', 'P4', 'ESTQ'].includes(shift);
                const display = (isOut || shift === 'N/A') ? '-' : (isWorking ? '' : (shift === 'AT' ? '+' : (shift.startsWith('FF') ? 'FF' : shift)));
                return (
                  <td key={d.num} className={`border border-black p-1 text-center font-black ${(isOut || shift === 'N/A') ? 'text-gray-400 bg-gray-50' : ''}`}>
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
          <div className="grid grid-cols-2 gap-2 flex-1">
            <div className="border border-black p-1 flex flex-col">
              <h4 className="font-black text-[8px] bg-gray-200 text-center py-0.5 mb-1 uppercase">Férias programadas</h4>
              <div className="space-y-0.5 flex-1">
                {onVacation.length > 0 ? onVacation.map(e => {
                  const s = e.vacationStart!.split('-').reverse().join('/');
                  const end = e.vacationEnd!.split('-').reverse().join('/');
                  return <div key={e.id} className="text-[7px] font-bold uppercase">{getShortName(e.name, employees)}: {s.substring(0,5)} A {end.substring(0,5)}</div>;
                }) : <div className="text-[7px] font-medium text-center">Nenhuma Férias</div>}
              </div>
            </div>
            <div className="border border-black p-1 flex flex-col">
              <h4 className="font-black text-[8px] bg-gray-200 text-center py-0.5 mb-1 uppercase">Atestados / Retornos</h4>
              <div className="space-y-0.5 flex-1">
                {onMedicalLeave.length > 0 ? onMedicalLeave.map(e => {
                  if (e.atestadoStart && e.atestadoEnd) {
                    const retDate = new Date(e.atestadoEnd + 'T00:00:00');
                    retDate.setDate(retDate.getDate() + 1);
                    const retStr = retDate.toLocaleDateString('pt-BR').substring(0,5);
                    return <div key={e.id} className="text-[7px] font-bold uppercase">{getShortName(e.name, employees)}: RETORNO {retStr}</div>;
                  }
                  const atDays = (e.shifts[monthKey] || []).map((s, i) => s === 'AT' ? String(i + 1) : null).filter(Boolean);
                  return <div key={e.id} className="text-[7px] font-bold uppercase">{getShortName(e.name, employees)}: DIA {atDays.join(', ')}</div>;
                }) : <div className="text-[7px] font-medium text-center">Nenhum Atestado</div>}
              </div>
            </div>
            <div className="border border-black p-1 flex flex-col">
              <h4 className="font-black text-[8px] bg-gray-200 text-center py-0.5 mb-1 uppercase">Aniversariantes</h4>
              <div className="space-y-0.5 flex-1">
                {birthdaysInMonth.length > 0 ? birthdaysInMonth.map(e => (
                  <div key={e.id} className="text-[8px] font-bold uppercase">Dia {e.birthday?.split('-')[2]} - {getShortName(e.name, employees)}</div>
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

        {/* Bloco 2: REGRAS E HORÁRIOS DE ALMOÇO */}
        <div className="border-2 border-black p-2 flex flex-col justify-between">
          <h3 className="font-black uppercase mb-1 text-[11px] border-b border-black pb-0.5 text-center">HORÁRIOS DE REFEIÇÃO / ALMOÇO</h3>
          
          <div className="grid grid-cols-2 gap-2 mt-1">
            <div className="border border-black p-1">
               <h4 className="font-black text-[8px] bg-gray-200 text-center py-0.5 mb-1 uppercase">Dias de Semana e Sábados</h4>
               <div className="text-[8px] font-bold space-y-0.5">
                 <div className="flex justify-between border-b border-gray-300"><span>12h00</span> <span>Máx. 1 Colaborador</span></div>
                 <div className="flex justify-between border-b border-gray-300"><span>13h00</span> <span>Máx. 1 Colaborador</span></div>
                 <div className="flex justify-between border-b border-gray-300"><span>14h00</span> <span>Máx. 1 Colaborador</span></div>
                 <div className="flex justify-between border-b border-gray-300"><span>15h00</span> <span>Máx. 1 Colaborador</span></div>
                 <div className="flex justify-between"><span>16h00</span> <span>Máx. 1 Colaborador</span></div>
               </div>
            </div>

            <div className="border border-black p-1">
               <h4 className="font-black text-[8px] bg-gray-200 text-center py-0.5 mb-1 uppercase">Domingos</h4>
               <div className="text-[8px] font-bold space-y-0.5">
                 <div className="flex justify-between border-b border-gray-300"><span>14h30</span> <span>Máx. 1 Colaborador</span></div>
                 <div className="flex justify-between border-b border-gray-300"><span>15h00</span> <span>Máx. 1 Colaborador</span></div>
                 <div className="flex justify-between border-b border-gray-300"><span>15h30</span> <span>Máx. 1 Colaborador</span></div>
                 <div className="flex justify-between border-b border-gray-300"><span>16h00</span> <span>Máx. 1 Colaborador</span></div>
                 <div className="flex justify-between border-b border-gray-300"><span>16h30</span> <span>Máx. 1 Colaborador</span></div>
                 <div className="flex justify-between"><span>17h00</span> <span>Máx. 1 Colaborador</span></div>
               </div>
            </div>
          </div>
        </div>
      </div>

      {/* FOOTER 2: FUNÇÕES DA EQUIPE E RECADOS */}
      <div className="grid grid-cols-2 gap-4 text-[9px]">
        {/* Bloco: FUNÇÕES DA EQUIPE */}
        <div className="border-2 border-black p-2 flex flex-col justify-between">
           <h3 className="font-black uppercase mb-1 text-[11px] border-b border-black pb-0.5 text-center">FUNÇÕES DA EQUIPE (CORRELATAS) & OBSERVAÇÕES</h3>
           <div className="grid grid-cols-2 gap-2 mt-1">
             <div className="border border-black p-1">
                <h4 className="font-black text-[8px] bg-gray-200 text-center py-0.5 mb-1 uppercase">Horários de Saída</h4>
                <div className="text-[8px] font-bold space-y-0.5">
                  <div className="flex justify-between border-b border-gray-300"><span>18h20</span> <span>Saída Abertura</span></div>
                  <div className="flex justify-between border-b border-gray-300"><span>20h20</span> <span>Saída Intermediário</span></div>
                  <div className="flex justify-between"><span>22h00</span> <span>Saída Fechamento</span></div>
                </div>
             </div>
             <div className="flex flex-col gap-1.5">
                <div className="border border-black p-1">
                  <h4 className="font-black text-[8px] bg-gray-200 text-center py-0.5 mb-1 uppercase">Funções (Correlatas)</h4>
                  <div className="text-[8px] font-bold space-y-1">
                      <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-red-400 border border-black"></div><span>CX (Caixa)</span></div>
                      <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-orange-400 border border-black"></div><span>PC (Pacote)</span></div>
                      <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-amber-400 border border-black"></div><span>REP (Reposição/Org.)</span></div>
                      <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-green-400 border border-black"></div><span>VEND (Vendas/Atendimento)</span></div>
                      <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-blue-400 border border-black"></div><span>FISC (Fiscal)</span></div>
                       <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-slate-400 border border-black"></div><span>ESTQ (Estoque)</span></div>
                  </div>
                </div>
                <div className="text-[7.5px] font-black italic border border-black p-1 bg-gray-100 flex-1 flex items-center justify-center text-center leading-tight">
                  * FERIADOS: PAUSAS DE 15 MINUTOS, UM COLABORADOR POR VEZ A PARTIR DE 14H.
                </div>
             </div>
           </div>
        </div>

        {/* Bloco: RECADOS */}
        <div className="border-2 border-black p-2 flex flex-col">
          <h3 className="font-black uppercase mb-1 text-[11px] border-b border-black pb-0.5 text-center">RECADOS IMPORTANTES</h3>
          <div className="text-[10px] font-bold p-1 whitespace-pre-wrap leading-tight flex-1">
            {monthNotes && monthNotes.trim().length > 0 ? monthNotes : 'Nenhum recado cadastrado para este mês.'}
          </div>
        </div>
      </div>
    </div>
  );
};
