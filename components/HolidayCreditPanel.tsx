
import React, { useMemo, useState } from 'react';
import { Employee, MonthYear, ShiftType, Holiday } from '../types';
import { Icon } from './Icon';
import { buildHolidaySet } from '../constants';

interface HolidayCreditPanelProps {
  employees: Employee[];
  currentMY: MonthYear;
  customHolidays: Holiday[];
  onApplyFix: (empId: string, dayIdx: number, shift: ShiftType) => void;
  onClose: () => void;
}

interface HolidayCreditItem {
  holidayDate: string;
  holidayName: string;
  empId: string;
  empName: string;
  suggestedDayIdx: number;
  suggestedDayLabel: string;
}

const WEEKDAY_NAMES = [
  'Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira',
  'Quinta-feira', 'Sexta-feira', 'Sábado',
];

export const HolidayCreditPanel: React.FC<HolidayCreditPanelProps> = ({
  employees,
  currentMY,
  customHolidays,
  onApplyFix,
  onClose,
}) => {
  const monthKey = `${currentMY.year}-${String(currentMY.month + 1).padStart(2, '0')}`;
  const daysInMonth = new Date(currentMY.year, currentMY.month + 1, 0).getDate();
  const holidaySet = buildHolidaySet(currentMY.year, customHolidays);

  const credits = useMemo(() => {
    const list: HolidayCreditItem[] = [];
    
    // Get all holidays in the current month
    const holidaysInMonth: { date: string, name: string, dayIdx: number }[] = [];
    for (let d = 0; d < daysInMonth; d++) {
      const dateStr = `${currentMY.year}-${String(currentMY.month + 1).padStart(2, '0')}-${String(d + 1).padStart(2, '0')}`;
      if (holidaySet.has(dateStr)) {
        // Find holiday name
        const hName = customHolidays.find(h => h.date === dateStr)?.name || 'Feriado';
        holidaysInMonth.push({ date: dateStr, name: hName, dayIdx: d });
      }
    }

    if (holidaysInMonth.length === 0) return [];

    // For each employee working on a holiday
    employees.forEach(emp => {
      if (emp.status !== 'active' || emp.isYoungApprentice) return;

      const shifts = emp.shifts[monthKey] || [];
      
      holidaysInMonth.forEach(h => {
        if (shifts[h.dayIdx] === 'T') {
          // Suggest a day off
          let bestDayIdx = -1;
          let maxCoverage = -1;

          // Check all days in the month to find the best candidate for FF
          for (let d = 0; d < daysInMonth; d++) {
            const date = new Date(currentMY.year, currentMY.month, d + 1);
            const dow = date.getDay();
            const dateStr = `${currentMY.year}-${String(currentMY.month + 1).padStart(2, '0')}-${String(d + 1).padStart(2, '0')}`;

            // 1. Must be Weekday (Mon-Fri)
            if (dow === 0 || dow === 6) continue;
            // 2. Must not be holiday
            if (holidaySet.has(dateStr)) continue;
            // 3. Must not be preferred day off
            if (WEEKDAY_NAMES[dow] === emp.preferredDayOff) continue;
            // 4. Must not be currently off
            if ((emp.shifts[monthKey]?.[d]) === 'F' || (emp.shifts[monthKey]?.[d]) === 'FE') continue;

            // Calculate team coverage for this candidate day
            const coverage = employees.filter(e => {
              const s = (e.shifts[monthKey] || [])[d];
              return s === 'T' || s === 'C';
            }).length;

            if (coverage > maxCoverage) {
              maxCoverage = coverage;
              bestDayIdx = d;
            }
          }

          if (bestDayIdx !== -1) {
            const date = new Date(currentMY.year, currentMY.month, bestDayIdx + 1);
            list.push({
              holidayDate: h.date,
              holidayName: h.name,
              empId: emp.id,
              empName: emp.name,
              suggestedDayIdx: bestDayIdx,
              suggestedDayLabel: `${String(bestDayIdx + 1).padStart(2, '0')}/${String(currentMY.month + 1).padStart(2, '0')} (${WEEKDAY_NAMES[date.getDay()].split('-')[0]})`,
            });
          }
        }
      });
    });

    return list;
  }, [employees, currentMY, customHolidays, holidaySet, monthKey, daysInMonth]);

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-6 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-rose-100 text-rose-600 rounded-xl flex items-center justify-center shadow-sm">
                    <Icon name="event_repeat" className="text-xl" fill />
                </div>
                <div>
                    <h3 className="text-lg font-black text-slate-900">Gestão de Folgas de Feriado</h3>
                    <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Compensação Mensal de Créditos de Feriados</p>
                </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                <Icon name="close" className="text-slate-400" />
            </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {credits.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                <Icon name="celebration" className="text-5xl mb-4 opacity-20" />
                <p className="font-bold">Nenhum crédito de feriado pendente para este mês.</p>
                <p className="text-xs">Isso acontece quando não há feriados ou todos já foram compensados.</p>
            </div>
          ) : (
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-[10px] font-extrabold text-slate-500 uppercase tracking-widest border-b border-slate-200">
                    <th className="p-4">Feriado</th>
                    <th className="p-4">Colaborador</th>
                    <th className="p-4">Sugestão de Folga</th>
                    <th className="p-4 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {credits.map((item, idx) => {
                    const hDate = new Date(item.holidayDate + 'T00:00:00');
                    return (
                      <tr key={`${item.empId}-${item.holidayDate}-${idx}`} className="hover:bg-slate-50/50 transition-colors">
                        <td className="p-4">
                          <div className="flex flex-col">
                            <span className="text-xs font-black text-slate-900">{item.holidayName}</span>
                            <span className="text-[10px] font-bold text-slate-400 truncate">
                              {String(hDate.getDate()).padStart(2, '0')}/{String(hDate.getMonth() + 1).padStart(2, '0')}
                            </span>
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                             <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-black text-slate-500 uppercase">
                                {item.empName.charAt(0)}
                             </div>
                             <span className="text-xs font-bold text-slate-700 uppercase">{item.empName}</span>
                          </div>
                        </td>
                        <td className="p-4">
                           <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 text-blue-700 rounded-lg border border-blue-100">
                              <Icon name="auto_fix_high" className="text-xs" />
                              <span className="text-[11px] font-black">{item.suggestedDayLabel}</span>
                           </div>
                        </td>
                        <td className="p-4 text-center">
                          <button
                            onClick={() => {
                              const holidayLabel = `${String(hDate.getDate()).padStart(2, '0')}/${String(hDate.getMonth() + 1).padStart(2, '0')}`;
                              onApplyFix(item.empId, item.suggestedDayIdx, `FF ${holidayLabel}`);
                            }}
                            className="bg-orange-500 hover:bg-orange-600 text-white text-[10px] font-black px-4 py-2 rounded-lg transition-all shadow-sm active:scale-95"
                          >
                            Aplicar Folga
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="p-6 bg-slate-50 border-t border-slate-200">
            <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl flex gap-3 items-start">
               <Icon name="info" className="text-blue-500 mt-1" />
               <div className="text-[11px] leading-relaxed text-blue-800">
                  <p className="font-black uppercase mb-1">Como as sugestões são geradas?</p>
                  O sistema busca dias de **segunda a sexta** que não coincidam com a folga padrão do colaborador. 
                  A sugestão prioriza dias onde a **equipe está mais completa**, garantindo que a operação da loja não seja afetada pela ausência compensatória.
               </div>
            </div>
        </div>
      </div>
    </div>
  );
};
