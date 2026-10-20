import React, { useMemo } from 'react';
import { Employee, MonthYear, Holiday, ROLE_METADATA_MAP, normalizeEmployeeRole } from '../types';
import { 
  buildHolidaySet, 
  getNationalHolidays, 
  getShortName, 
  isEmployeeActiveInMonth, 
  isEmployeeActiveOnDay 
} from '../constants';
import { isWorkingShift } from '../hooks/useScheduleEngine';

interface PrintableScheduleProps {
  employees: Employee[];
  currentMY: MonthYear;
  customHolidays: Holiday[];
  monthNotes?: string;
}

export const PrintableSchedule: React.FC<PrintableScheduleProps> = ({ 
  employees, 
  currentMY, 
  customHolidays, 
  monthNotes 
}) => {
  const monthKey = `${currentMY.year}-${String(currentMY.month + 1).padStart(2, '0')}`;
  const daysInMonth = new Date(currentMY.year, currentMY.month + 1, 0).getDate();
  const holidaySet = buildHolidaySet(currentMY.year, customHolidays);

  const days = Array.from({ length: daysInMonth }, (_, i) => {
    const date = new Date(currentMY.year, currentMY.month, i + 1);
    const dow = date.getDay();
    const dateStr = `${currentMY.year}-${String(currentMY.month + 1).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`;
    return { num: i + 1, dow, dateStr, isHoliday: holidaySet.has(dateStr), isSunday: dow === 0 };
  });

  const sundays = days.filter(d => d.isSunday);

  const monthNames = [
    'JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO',
    'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'
  ];
  const monthName = monthNames[currentMY.month];

  const activeEmployees = useMemo(() => {
    return employees
      .filter(e => isEmployeeActiveInMonth(e, currentMY.year, currentMY.month))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, [employees, currentMY]);

  const mStartStr = `${currentMY.year}-${String(currentMY.month + 1).padStart(2, '0')}-01`;
  const mEndStr = `${currentMY.year}-${String(currentMY.month + 1).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;

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

  // Atestados
  const onMedicalLeave = activeEmployees.filter(e => {
    if (e.atestadoStart && e.atestadoEnd && e.atestadoStart <= mEndStr && e.atestadoEnd >= mStartStr) return true;
    const empShifts = e.shifts[monthKey] || [];
    return empShifts.includes('AT');
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

  // Feriados do mês
  const holidaysInMonth = useMemo(() => {
    const allHolidays = [...getNationalHolidays(currentMY.year), ...customHolidays];
    return allHolidays.filter(h => {
      const d = new Date(h.date + 'T00:00:00');
      return d.getFullYear() === currentMY.year && d.getMonth() === currentMY.month;
    }).sort((a, b) => a.date.localeCompare(b.date));
  }, [currentMY, customHolidays]);

  const generationTimestamp = new Date().toLocaleDateString('pt-BR') + ' às ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  return (
    <div id="printable-team-calendar" className="hidden print:block w-full bg-white text-black font-sans">
      <style>{`
        @media print {
          @page {
            size: A4 landscape;
            margin: 6mm 8mm;
          }
          body {
            background: white !important;
            color: black !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .print-document {
            display: block !important;
            width: 100% !important;
          }
          .print-page {
            width: 100% !important;
            height: 196mm !important;
            max-height: 196mm !important;
            min-height: 196mm !important;
            page-break-after: always !important;
            break-after: page !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
            box-sizing: border-box !important;
            overflow: hidden !important;
            padding: 2mm 0 !important;
          }
          .print-page:last-child {
            page-break-after: auto !important;
            break-after: auto !important;
          }
        }
      `}</style>

      {/* ========================================================================================= */}
      {/* PÁGINA 1: GRADE MENSAL COMPLETA                                                            */}
      {/* ========================================================================================= */}
      <section className="print-page print-page-1">
        {/* Header da Página 1 */}
        <div className="flex justify-between items-end border-b-2 border-black pb-1.5 mb-2 shrink-0">
          <div>
            <div className="flex items-center gap-3">
              <span className="text-[14px] font-black tracking-widest uppercase bg-black text-white px-2 py-0.5">
                RI HAPPY
              </span>
              <h1 className="text-[20px] font-black tracking-tight leading-none uppercase">
                ESCALA DE REVEZAMENTO 6 POR 1
              </h1>
            </div>
            <p className="text-[11px] font-bold text-gray-700 uppercase mt-0.5 tracking-wider">
              Mês Oficial: {monthName} de {currentMY.year} • Folgas e Turnos de Trabalho
            </p>
          </div>
          <div className="text-right">
            <span className="text-[10px] font-black uppercase tracking-wider block">
              Documento Oficial
            </span>
            <span className="text-[9px] font-semibold text-gray-600 block">
              Emitido em {generationTimestamp}
            </span>
          </div>
        </div>

        {/* Tabela Principal da Grade */}
        <div className="flex-1 flex flex-col justify-start overflow-hidden">
          <table className="w-full border-collapse border-2 border-black" style={{ fontSize: '8.5px' }}>
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-black p-1 text-left w-36 uppercase font-black">
                  Colaborador
                </th>
                <th className="border border-black p-1 text-center w-20 uppercase font-black">
                  Horário
                </th>
                {days.map(d => (
                  <th 
                    key={d.num} 
                    className={`border border-black p-0.5 text-center ${
                      d.isSunday ? 'bg-gray-200' : d.isHoliday ? 'bg-gray-150' : ''
                    }`}
                    style={{ width: `${66 / daysInMonth}%` }}
                  >
                    <div className="font-black text-[9px] leading-tight">{d.num}</div>
                    <div className={`text-[7.5px] font-black ${d.isSunday ? 'text-black' : 'text-gray-700'}`}>
                      {'D S T Q Q S S'[d.dow]}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {activeEmployees.map(emp => {
                const role = normalizeEmployeeRole(emp.cargo || emp.role);
                const roleMeta = ROLE_METADATA_MAP[role];
                return (
                  <tr key={emp.id} className="hover:bg-gray-50">
                    <td className="border border-black px-1.5 py-0.5 font-black uppercase truncate max-w-[140px]">
                      <div className="flex items-center justify-between gap-1 leading-tight">
                        <span className="truncate">{getShortName(emp.name, activeEmployees)}</span>
                        <span className="text-[7.5px] px-1 border border-black font-black shrink-0">
                          {roleMeta.code}
                        </span>
                      </div>
                    </td>
                    <td className="border border-black px-1 py-0.5 text-center font-bold text-[8px] whitespace-nowrap">
                      {emp.workPeriod ? emp.workPeriod.split(' ')[0] : '—'}
                    </td>
                    {days.map(d => {
                      const isOut = !isEmployeeActiveOnDay(emp, d.dateStr, monthKey, d.num - 1);
                      const shift = isOut ? 'N/A' : (emp.shifts[monthKey]?.[d.num - 1] || 'T');
                      const isWorking = isWorkingShift(shift);
                      
                      let display = '';
                      let cellClass = '';

                      if (isOut || shift === 'N/A') {
                        display = '-';
                        cellClass = 'text-gray-400 bg-gray-50';
                      } else if (shift === 'F') {
                        display = 'F';
                        cellClass = 'font-black bg-gray-100';
                      } else if (shift.startsWith('FF')) {
                        display = 'FF';
                        cellClass = 'font-black bg-gray-100';
                      } else if (shift === 'FE') {
                        display = 'FE';
                        cellClass = 'font-black bg-gray-200';
                      } else if (shift === 'AT') {
                        display = 'AT';
                        cellClass = 'font-black bg-gray-200';
                      } else if (shift === 'DO') {
                        display = 'DO';
                        cellClass = 'font-black bg-gray-200';
                      } else if (shift === 'C') {
                        display = 'C';
                        cellClass = 'font-black bg-gray-100';
                      } else if (isWorking) {
                        display = 'T';
                        cellClass = '';
                      }

                      return (
                        <td 
                          key={d.num} 
                          className={`border border-black p-0 text-center font-bold leading-tight ${cellClass} ${
                            d.isSunday && !display ? 'bg-gray-50' : ''
                          }`}
                        >
                          {display}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Rodapé da Página 1 */}
        <div className="border-t border-black pt-1.5 mt-2 flex items-center justify-between text-[9px] font-bold shrink-0">
          <div className="flex items-center gap-3">
            <span className="font-black uppercase tracking-wider">Legenda:</span>
            <span><strong>T</strong> Trabalho</span>
            <span><strong>F</strong> Folga Semanal</span>
            <span><strong>FF</strong> Compensatória Feriado</span>
            <span><strong>FE</strong> Férias</span>
            <span><strong>AT</strong> Atestado Médico</span>
            <span><strong>DO</strong> Day Off Aniversário</span>
            <span><strong>C</strong> Curso Teórico</span>
          </div>
          <div className="font-black uppercase tracking-widest text-right">
            Página 1 de 3 • Grade Mensal Oficial
          </div>
        </div>
      </section>

      {/* ========================================================================================= */}
      {/* PÁGINA 2: DEMAIS INFORMAÇÕES (DIRETRIZES, AFASTAMENTOS, ALMOÇOS E RECADOS)                */}
      {/* ========================================================================================= */}
      <section className="print-page print-page-2">
        {/* Header da Página 2 */}
        <div className="flex justify-between items-end border-b-2 border-black pb-1.5 mb-2.5 shrink-0">
          <div>
            <div className="flex items-center gap-3">
              <span className="text-[14px] font-black tracking-widest uppercase bg-black text-white px-2 py-0.5">
                RI HAPPY
              </span>
              <h2 className="text-[20px] font-black tracking-tight leading-none uppercase">
                DIRETRIZES & INFORMAÇÕES OPERACIONAIS
              </h2>
            </div>
            <p className="text-[11px] font-bold text-gray-700 uppercase mt-0.5 tracking-wider">
              Mês Oficial: {monthName} de {currentMY.year} • Procedimentos, Afastamentos e Intervalos
            </p>
          </div>
          <div className="text-right">
            <span className="text-[10px] font-black uppercase tracking-wider block">
              Diretrizes de Loja
            </span>
            <span className="text-[9px] font-semibold text-gray-600 block">
              Emitido em {generationTimestamp}
            </span>
          </div>
        </div>

        {/* Conteúdo Central da Página 2 em 4 Blocos Estruturados */}
        <div className="flex-1 grid grid-cols-2 gap-3 overflow-hidden text-[10px]">
          
          {/* Card 1: Afastamentos e Eventos */}
          <div className="border-2 border-black p-2.5 flex flex-col justify-between">
            <h3 className="font-black uppercase text-[11px] border-b-2 border-black pb-1 mb-2 text-center bg-gray-100">
              1. AFASTAMENTOS & EVENTOS DO MÊS
            </h3>
            <div className="grid grid-cols-2 gap-2 flex-1">
              
              {/* Férias */}
              <div className="border border-black p-1.5 flex flex-col">
                <h4 className="font-black text-[9.5px] bg-gray-200 text-center py-0.5 mb-1 uppercase">
                  Férias Programadas
                </h4>
                <div className="space-y-1 flex-1 overflow-hidden">
                  {onVacation.length > 0 ? onVacation.map(e => {
                    const s = e.vacationStart!.split('-').reverse().join('/');
                    const end = e.vacationEnd!.split('-').reverse().join('/');
                    return (
                      <div key={e.id} className="text-[9px] font-bold uppercase leading-tight">
                        • {getShortName(e.name, employees)}: {s.substring(0, 5)} a {end.substring(0, 5)}
                      </div>
                    );
                  }) : (
                    <div className="text-[9px] font-medium text-gray-500 italic text-center py-2">
                      Nenhuma férias no período
                    </div>
                  )}
                </div>
              </div>

              {/* Atestados */}
              <div className="border border-black p-1.5 flex flex-col">
                <h4 className="font-black text-[9.5px] bg-gray-200 text-center py-0.5 mb-1 uppercase">
                  Atestados / Licenças
                </h4>
                <div className="space-y-1 flex-1 overflow-hidden">
                  {onMedicalLeave.length > 0 ? onMedicalLeave.map(e => {
                    if (e.atestadoStart && e.atestadoEnd) {
                      const retDate = new Date(e.atestadoEnd + 'T00:00:00');
                      retDate.setDate(retDate.getDate() + 1);
                      const retStr = retDate.toLocaleDateString('pt-BR').substring(0, 5);
                      return (
                        <div key={e.id} className="text-[9px] font-bold uppercase leading-tight">
                          • {getShortName(e.name, employees)}: Retorno {retStr}
                        </div>
                      );
                    }
                    const atDays = (e.shifts[monthKey] || []).map((s, i) => s === 'AT' ? String(i + 1) : null).filter(Boolean);
                    return (
                      <div key={e.id} className="text-[9px] font-bold uppercase leading-tight">
                        • {getShortName(e.name, employees)}: Dia {atDays.join(', ')}
                      </div>
                    );
                  }) : (
                    <div className="text-[9px] font-medium text-gray-500 italic text-center py-2">
                      Nenhum atestado registrado
                    </div>
                  )}
                </div>
              </div>

              {/* Aniversariantes */}
              <div className="border border-black p-1.5 flex flex-col">
                <h4 className="font-black text-[9.5px] bg-gray-200 text-center py-0.5 mb-1 uppercase">
                  Aniversariantes (Day Off)
                </h4>
                <div className="space-y-1 flex-1 overflow-hidden">
                  {birthdaysInMonth.length > 0 ? birthdaysInMonth.map(e => (
                    <div key={e.id} className="text-[9px] font-bold uppercase leading-tight">
                      • Dia {e.birthday?.split('-')[2]} — {getShortName(e.name, employees)}
                    </div>
                  )) : (
                    <div className="text-[9px] font-medium text-gray-500 italic text-center py-2">
                      Nenhum aniversariante
                    </div>
                  )}
                </div>
              </div>

              {/* Feriados */}
              <div className="border border-black p-1.5 flex flex-col">
                <h4 className="font-black text-[9.5px] bg-gray-200 text-center py-0.5 mb-1 uppercase">
                  Feriados no Mês
                </h4>
                <div className="space-y-1 flex-1 overflow-hidden">
                  {holidaysInMonth.length > 0 ? holidaysInMonth.map(h => (
                    <div key={h.id} className="text-[9px] font-bold uppercase leading-tight">
                      • {h.date.split('-').reverse().join('/').substring(0, 5)} — {h.name}
                    </div>
                  )) : (
                    <div className="text-[9px] font-medium text-gray-500 italic text-center py-2">
                      Nenhum feriado no mês
                    </div>
                  )}
                </div>
              </div>

            </div>
          </div>

          {/* Card 2: Horários e Slots de Almoço */}
          <div className="border-2 border-black p-2.5 flex flex-col justify-between">
            <h3 className="font-black uppercase text-[11px] border-b-2 border-black pb-1 mb-2 text-center bg-gray-100">
              2. HORÁRIOS DE REFEIÇÃO / INTERVALO (ALMOÇO)
            </h3>
            
            <div className="grid grid-cols-2 gap-2 flex-1">
              <div className="border border-black p-2 flex flex-col justify-between">
                <h4 className="font-black text-[9.5px] bg-gray-200 text-center py-0.5 mb-1.5 uppercase">
                  Dias de Semana e Sábados
                </h4>
                <div className="text-[9.5px] font-bold space-y-1">
                  <div className="flex justify-between border-b border-gray-300 pb-0.5"><span>12h00</span> <span>Máx. 1 Colaborador</span></div>
                  <div className="flex justify-between border-b border-gray-300 pb-0.5"><span>13h00</span> <span>Máx. 1 Colaborador</span></div>
                  <div className="flex justify-between border-b border-gray-300 pb-0.5"><span>14h00</span> <span>Máx. 1 Colaborador</span></div>
                  <div className="flex justify-between border-b border-gray-300 pb-0.5"><span>15h00</span> <span>Máx. 1 Colaborador</span></div>
                  <div className="flex justify-between"><span>16h00</span> <span>Máx. 1 Colaborador</span></div>
                </div>
                <p className="text-[8px] text-gray-600 font-semibold mt-2 pt-1 border-t border-gray-200">
                  * 1 hora obrigatória de intervalo para jornadas de 7h20.
                </p>
              </div>

              <div className="border border-black p-2 flex flex-col justify-between">
                <h4 className="font-black text-[9.5px] bg-gray-200 text-center py-0.5 mb-1.5 uppercase">
                  Domingos Operacionais
                </h4>
                <div className="text-[9.5px] font-bold space-y-1">
                  <div className="flex justify-between border-b border-gray-300 pb-0.5"><span>14h30</span> <span>Máx. 1 Colaborador</span></div>
                  <div className="flex justify-between border-b border-gray-300 pb-0.5"><span>15h00</span> <span>Máx. 1 Colaborador</span></div>
                  <div className="flex justify-between border-b border-gray-300 pb-0.5"><span>15h30</span> <span>Máx. 1 Colaborador</span></div>
                  <div className="flex justify-between border-b border-gray-300 pb-0.5"><span>16h00</span> <span>Máx. 1 Colaborador</span></div>
                  <div className="flex justify-between border-b border-gray-300 pb-0.5"><span>16h30</span> <span>Máx. 1 Colaborador</span></div>
                  <div className="flex justify-between"><span>17h00</span> <span>Máx. 1 Colaborador</span></div>
                </div>
                <p className="text-[8px] text-gray-600 font-semibold mt-2 pt-1 border-t border-gray-200">
                  * Escalonamento estrito para manter piso e caixa cobertos.
                </p>
              </div>
            </div>
          </div>

          {/* Card 3: Funções Correlatas e Saídas */}
          <div className="border-2 border-black p-2.5 flex flex-col justify-between">
            <h3 className="font-black uppercase text-[11px] border-b-2 border-black pb-1 mb-2 text-center bg-gray-100">
              3. FUNÇÕES (CORRELATAS) & HORÁRIOS DE SAÍDA
            </h3>
            
            <div className="grid grid-cols-2 gap-2 flex-1">
              <div className="border border-black p-2 flex flex-col justify-between">
                <h4 className="font-black text-[9.5px] bg-gray-200 text-center py-0.5 mb-1.5 uppercase">
                  Horários Oficiais de Saída
                </h4>
                <div className="text-[9.5px] font-bold space-y-1.5">
                  <div className="flex justify-between border-b border-gray-300 pb-1">
                    <span>18h20</span> <span className="font-black">Saída Abertura</span>
                  </div>
                  <div className="flex justify-between border-b border-gray-300 pb-1">
                    <span>20h20</span> <span className="font-black">Saída Intermediário</span>
                  </div>
                  <div className="flex justify-between">
                    <span>22h00</span> <span className="font-black">Saída Fechamento</span>
                  </div>
                </div>
                <div className="text-[8px] font-bold border border-black p-1 bg-gray-50 mt-2 text-center leading-tight">
                  * FERIADOS: Pausas de 15 min a partir das 14h, 1 por vez.
                </div>
              </div>

              <div className="border border-black p-2 flex flex-col justify-between">
                <h4 className="font-black text-[9.5px] bg-gray-200 text-center py-0.5 mb-1.5 uppercase">
                  Funções Oficiais (Correlatas)
                </h4>
                <div className="text-[9px] font-bold space-y-1">
                  <div className="flex items-center gap-1.5">
                    <span className="w-6 text-center font-black border border-black bg-emerald-100">CX</span>
                    <span>Caixa e Checkout</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-6 text-center font-black border border-black bg-cyan-100">PC</span>
                    <span>Pacote e Embalagem</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-6 text-center font-black border border-black bg-indigo-100">AP</span>
                    <span>Apoio / Reposição</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-6 text-center font-black border border-black bg-orange-100">VEND</span>
                    <span>Vendas e Atendimento</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-6 text-center font-black border border-black bg-purple-100">FISC</span>
                    <span>Fiscalização de Salão</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-6 text-center font-black border border-black bg-amber-100">ESTQ</span>
                    <span>Estoque e Abastecimento</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Card 4: Recados & Assinatura da Gerência */}
          <div className="border-2 border-black p-2.5 flex flex-col justify-between">
            <h3 className="font-black uppercase text-[11px] border-b-2 border-black pb-1 mb-2 text-center bg-gray-100">
              4. MURAL DE RECADOS DA GERÊNCIA & CIÊNCIA
            </h3>
            
            <div className="border border-black p-2 flex-1 flex flex-col justify-between mb-2">
              <div className="text-[9.5px] font-bold p-1 whitespace-pre-wrap leading-tight text-gray-800">
                {monthNotes && monthNotes.trim().length > 0 
                  ? monthNotes 
                  : 'Nenhum recado cadastrado para este mês. Todas as regras trabalhistas (CLT) e combinados operacionais estão em pleno vigor.'}
              </div>
              <div className="text-[8px] font-bold text-gray-500 border-t border-gray-200 pt-1 mt-1">
                Conforme Art. 67 da CLT e regras internas da Ri Happy Brinquedos.
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-black text-[9px]">
              <div className="text-center">
                <div className="border-b border-black pb-6 mb-1"></div>
                <span className="font-black uppercase block">Gerência da Loja</span>
                <span className="text-[8px] text-gray-500">Visto e Homologação</span>
              </div>
              <div className="text-center">
                <div className="border-b border-black pb-6 mb-1"></div>
                <span className="font-black uppercase block">Líder Operacional</span>
                <span className="text-[8px] text-gray-500">Conferência de Turnos</span>
              </div>
            </div>
          </div>

        </div>

        {/* Rodapé da Página 2 */}
        <div className="border-t border-black pt-1.5 mt-2 flex items-center justify-between text-[9px] font-bold shrink-0">
          <div className="text-gray-600">
            Ri Happy Brinquedos • Gestão de Escalas e Rotinas Operacionais
          </div>
          <div className="font-black uppercase tracking-widest text-right">
            Página 2 de 3 • Informações e Diretrizes
          </div>
        </div>
      </section>

      {/* ========================================================================================= */}
      {/* PÁGINA 3: ESCALA DOS DOMINGOS (EM FORMA DE GRADE - FOCO SE TRABALHA OU FOLGA)              */}
      {/* ========================================================================================= */}
      <section className="print-page print-page-3">
        {/* Header da Página 3 */}
        <div className="flex justify-between items-end border-b-2 border-black pb-1.5 mb-2.5 shrink-0">
          <div>
            <div className="flex items-center gap-3">
              <span className="text-[14px] font-black tracking-widest uppercase bg-black text-white px-2 py-0.5">
                RI HAPPY
              </span>
              <h2 className="text-[20px] font-black tracking-tight leading-none uppercase">
                ESCALA EXCLUSIVA DE DOMINGOS (CLT)
              </h2>
            </div>
            <p className="text-[11px] font-bold text-gray-700 uppercase mt-0.5 tracking-wider">
              Mês Oficial: {monthName} de {currentMY.year} • Revezamento Dominical (Máx. 2 Domingos Consecutivos — Art. 67 CLT)
            </p>
          </div>
          <div className="text-right">
            <span className="text-[10px] font-black uppercase tracking-wider block bg-black text-white px-2 py-0.5">
              Escala de Domingos
            </span>
            <span className="text-[9px] font-semibold text-gray-600 block mt-0.5">
              Emitido em {generationTimestamp}
            </span>
          </div>
        </div>

        {/* Tabela Grade de Domingos */}
        <div className="flex-1 flex flex-col justify-start overflow-hidden">
          <table className="w-full border-collapse border-2 border-black" style={{ fontSize: '9px' }}>
            <thead>
              <tr className="bg-gray-200">
                <th className="border border-black p-1.5 text-left w-48 uppercase font-black">
                  Colaborador
                </th>
                <th className="border border-black p-1 text-center w-24 uppercase font-black">
                  Função
                </th>
                {sundays.map(d => (
                  <th key={d.num} className="border border-black p-1.5 text-center bg-gray-100">
                    <div className="font-black text-[11px]">DOMINGO {String(d.num).padStart(2, '0')}/{String(currentMY.month + 1).padStart(2, '0')}</div>
                    <div className="text-[8px] font-bold text-gray-600 uppercase">Dia {d.num}</div>
                  </th>
                ))}
                <th className="border border-black p-1 text-center w-20 uppercase font-black bg-gray-200">
                  Total Trab.
                </th>
                <th className="border border-black p-1 text-center w-20 uppercase font-black bg-gray-200">
                  Total Folgas
                </th>
                <th className="border border-black p-1 text-center w-28 uppercase font-black bg-gray-200">
                  Status CLT
                </th>
              </tr>
            </thead>
            <tbody>
              {activeEmployees.map(emp => {
                const role = normalizeEmployeeRole(emp.cargo || emp.role);
                const roleMeta = ROLE_METADATA_MAP[role];

                // Counts for Sundays
                let workedSundaysCount = 0;
                let offSundaysCount = 0;
                let consecutiveSundayStreak = 0;
                let maxSundayStreak = 0;

                const sundayStatuses = sundays.map(d => {
                  const isOut = !isEmployeeActiveOnDay(emp, d.dateStr, monthKey, d.num - 1);
                  const shift = isOut ? 'N/A' : (emp.shifts[monthKey]?.[d.num - 1] || 'T');
                  const isWorking = isWorkingShift(shift);

                  if (isWorking) {
                    workedSundaysCount++;
                    consecutiveSundayStreak++;
                    if (consecutiveSundayStreak > maxSundayStreak) {
                      maxSundayStreak = consecutiveSundayStreak;
                    }
                  } else {
                    consecutiveSundayStreak = 0;
                    if (shift !== 'N/A') offSundaysCount++;
                  }

                  return {
                    dayNum: d.num,
                    isOut,
                    shift,
                    isWorking,
                  };
                });

                const hasSundayViolation = maxSundayStreak >= 3;

                return (
                  <tr key={emp.id} className="hover:bg-gray-50">
                    {/* Nome do Colaborador */}
                    <td className="border border-black px-2 py-1 font-black uppercase truncate max-w-[180px]">
                      {getShortName(emp.name, activeEmployees)}
                    </td>

                    {/* Cargo / Função Oficial */}
                    <td className="border border-black px-1 py-1 text-center font-bold text-[8.5px] uppercase">
                      <span className="px-1.5 py-0.5 border border-black font-black">
                        {roleMeta.code}
                      </span>
                    </td>

                    {/* Colunas dos Domingos: FOCO EM TRABALHA OU FOLGA */}
                    {sundayStatuses.map(s => {
                      if (s.isOut || s.shift === 'N/A') {
                        return (
                          <td key={s.dayNum} className="border border-black p-1 text-center font-bold text-gray-400 bg-gray-50">
                            —
                          </td>
                        );
                      }

                      if (s.shift === 'FE') {
                        return (
                          <td key={s.dayNum} className="border border-black p-1 text-center font-black bg-gray-200">
                            FÉRIAS
                          </td>
                        );
                      }

                      if (s.shift === 'AT') {
                        return (
                          <td key={s.dayNum} className="border border-black p-1 text-center font-black bg-gray-200">
                            ATESTADO
                          </td>
                        );
                      }

                      if (s.shift === 'DO') {
                        return (
                          <td key={s.dayNum} className="border border-black p-1 text-center font-black bg-gray-200">
                            DAY OFF
                          </td>
                        );
                      }

                      if (s.isWorking) {
                        return (
                          <td key={s.dayNum} className="border border-black p-1 text-center font-black bg-gray-100">
                            <span className="block py-0.5 border border-black bg-white">
                              TRABALHA
                            </span>
                          </td>
                        );
                      }

                      return (
                        <td key={s.dayNum} className="border border-black p-1 text-center font-black">
                          <span className="block py-0.5 border border-black bg-gray-100">
                            FOLGA
                          </span>
                        </td>
                      );
                    })}

                    {/* Total de Domingos Trabalhados */}
                    <td className="border border-black px-1 py-1 text-center font-black text-[10px]">
                      {workedSundaysCount}D
                    </td>

                    {/* Total de Domingos de Folga */}
                    <td className="border border-black px-1 py-1 text-center font-black text-[10px]">
                      {offSundaysCount}D
                    </td>

                    {/* Status de Conformidade CLT */}
                    <td className={`border border-black px-1 py-1 text-center font-black text-[8.5px] uppercase ${
                      hasSundayViolation ? 'bg-black text-white' : 'text-black'
                    }`}>
                      {hasSundayViolation ? '3D SEGUIDOS' : '✓ CONFORME'}
                    </td>
                  </tr>
                );
              })}
            </tbody>

            {/* Linha de Totalização por Domingo */}
            <tfoot>
              <tr className="bg-gray-200 font-black">
                <td colSpan={2} className="border border-black px-2 py-1 uppercase text-right">
                  TOTAL PRESENTES NO DOMINGO:
                </td>
                {sundays.map(d => {
                  const workingCount = activeEmployees.filter(emp => {
                    const isOut = !isEmployeeActiveOnDay(emp, d.dateStr, monthKey, d.num - 1);
                    const shift = isOut ? 'N/A' : (emp.shifts[monthKey]?.[d.num - 1] || 'T');
                    return isWorkingShift(shift);
                  }).length;

                  return (
                    <td key={d.num} className="border border-black p-1 text-center font-black text-[10px]">
                      {workingCount} CLT
                    </td>
                  );
                })}
                <td colSpan={3} className="border border-black px-2 py-1 text-center text-[8.5px] uppercase">
                  Mínimo de Loja Respeitado
                </td>
              </tr>
            </tfoot>
          </table>

          {/* Quadro Explicativo da Lei dos Domingos */}
          <div className="mt-3 grid grid-cols-2 gap-3 text-[9.5px]">
            <div className="border-2 border-black p-2 flex flex-col justify-between">
              <div>
                <h4 className="font-black uppercase text-[10px] border-b border-black pb-0.5 mb-1 bg-gray-100 px-1">
                  Regras Legais de Revezamento de Domingo (CLT)
                </h4>
                <p className="font-bold leading-tight text-gray-800">
                  1. Nenhum colaborador poderá trabalhar 3 domingos consecutivos sob qualquer circunstância (Art. 67 da CLT).
                </p>
                <p className="font-bold leading-tight text-gray-800 mt-1">
                  2. O descanso semanal remunerado (DSR) deve coincidir com o domingo no máximo a cada 3 semanas.
                </p>
                <p className="font-bold leading-tight text-gray-800 mt-1">
                  3. A presença mínima de loja aos domingos foi distribuída de forma equitativa entre toda a equipe.
                </p>
              </div>
            </div>

            <div className="border-2 border-black p-2 flex flex-col justify-between">
              <div>
                <h4 className="font-black uppercase text-[10px] border-b border-black pb-0.5 mb-1 bg-gray-100 px-1">
                  Ciência e Homologação Dominical
                </h4>
                <div className="grid grid-cols-2 gap-3 pt-3 text-[8.5px]">
                  <div className="text-center">
                    <div className="border-b border-black pb-4 mb-1"></div>
                    <span className="font-black uppercase block">Gerente de Loja</span>
                    <span className="text-[7.5px] text-gray-500">Assinatura do Responsável</span>
                  </div>
                  <div className="text-center">
                    <div className="border-b border-black pb-4 mb-1"></div>
                    <span className="font-black uppercase block">Representante da Equipe</span>
                    <span className="text-[7.5px] text-gray-500">Ciência dos Colaboradores</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Rodapé da Página 3 */}
        <div className="border-t border-black pt-1.5 mt-2 flex items-center justify-between text-[9px] font-bold shrink-0">
          <div className="text-gray-600">
            Escala Dominical Ri Happy • Auditoria CLT de Revezamento de Domingos
          </div>
          <div className="font-black uppercase tracking-widest text-right">
            Página 3 de 3 • Escala Exclusiva de Domingos
          </div>
        </div>
      </section>
    </div>
  );
};
