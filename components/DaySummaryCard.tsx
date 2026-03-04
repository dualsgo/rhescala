
import React, { useMemo } from 'react';
import { Icon } from './Icon';
import { Employee, MonthYear } from '../types';

interface DaySummaryCardProps {
  employees: Employee[];
  selectedDayIdx: number;
  currentMY: MonthYear;
}

// Lunch break configuration per shift type
// windowStart / windowEnd in minutes from midnight, slotDuration in minutes
const LUNCH_CONFIG = {
  abertura:     { windowStart: 12 * 60,       windowEnd: 14 * 60,       slotDuration: 30, label: 'Abertura',     icon: 'wb_twilight',  color: 'orange' },
  intermediario:{ windowStart: 14 * 60,       windowEnd: 16 * 60,       slotDuration: 30, label: 'Intermediário', icon: 'sunny',        color: 'sky'    },
  fechamento:   { windowStart: 16 * 60,       windowEnd: 18 * 60,       slotDuration: 30, label: 'Fechamento',   icon: 'nightlight',   color: 'indigo' },
} as const;

type ShiftGroup = keyof typeof LUNCH_CONFIG;

/** Formats minutes-from-midnight as "HHhMM" */
function fmtTime(mins: number): string {
  const h = Math.floor(mins / 60).toString().padStart(2, '0');
  const m = (mins % 60).toString().padStart(2, '0');
  return m === '00' ? `${h}h` : `${h}h${m}`;
}

/**
 * Given a list of employee names and a shift config, distributes them
 * across time slots starting from windowStart, each slotDuration minutes.
 * Returns an array of { time, names } objects.
 *
 * Algorithm:
 *  1. Calculate total available slots in the window.
 *  2. Base load per slot = floor(N / slots). Remainder slots get +1.
 *  3. Fill from the FIRST slot onwards (sequential distribution).
 */
function buildLunchSlots(
  names: string[],
  config: typeof LUNCH_CONFIG[ShiftGroup]
): { time: string; names: string[] }[] {
  const n = names.length;
  if (n === 0) return [];

  const totalSlots = Math.floor((config.windowEnd - config.windowStart) / config.slotDuration);
  const slotsNeeded = Math.min(totalSlots, n); // no need for more slots than people
  const basePerSlot = Math.floor(n / slotsNeeded);
  const remainder   = n % slotsNeeded;

  const result: { time: string; names: string[] }[] = [];
  let nameIdx = 0;

  for (let s = 0; s < slotsNeeded; s++) {
    const count     = basePerSlot + (s < remainder ? 1 : 0);
    const slotNames = names.slice(nameIdx, nameIdx + count);
    nameIdx += count;
    result.push({
      time:  fmtTime(config.windowStart + s * config.slotDuration),
      names: slotNames,
    });
  }

  return result;
}

export const DaySummaryCard: React.FC<DaySummaryCardProps> = ({ employees, selectedDayIdx, currentMY }) => {
  const monthKey = `${currentMY.year}-${currentMY.month.toString().padStart(2, '0')}`;

  const data = useMemo(() => {
    const counts = {
      abertura: 0,       // 10h employees
      intermediario: 0,  // 12h employees
      fechamento: 0,     // 13h40 employees
      aprendiz: 0,       // apprentices working
      folga: 0,
      curso: 0,
      ferias: 0,
      total: 0,
    };

    const names = {
      abertura: [] as string[],
      intermediario: [] as string[],
      fechamento: [] as string[],
    };

    employees.forEach(e => {
      const mShifts = e.shifts[monthKey] || [];
      const shift = mShifts[selectedDayIdx];
      const hForDay = (e.dailyHours[monthKey] || [])[selectedDayIdx] || e.workPeriod;

      if (shift === 'T' || shift === 'FF') {
        if (e.isYoungApprentice) {
          counts.aprendiz++;
          counts.total++;
          // aprendizes are always abertura-like for lunch purposes but have 15min break only
        } else {
          counts.total++;
          if (hForDay.includes('10h')) {
            counts.abertura++;
            names.abertura.push(e.name.split(' ')[0]);
          } else if (hForDay.includes('12h')) {
            counts.intermediario++;
            names.intermediario.push(e.name.split(' ')[0]);
          } else if (hForDay.includes('13h40')) {
            counts.fechamento++;
            names.fechamento.push(e.name.split(' ')[0]);
          }
        }
      } else if (shift === 'F') counts.folga++;
      else if (shift === 'C') counts.curso++;
      else if (shift === 'FE') counts.ferias++;
    });

    return { counts, names };
  }, [employees, monthKey, selectedDayIdx]);

  const { counts, names } = data;

  const lunchAberta = buildLunchSlots(names.abertura, LUNCH_CONFIG.abertura);
  const lunchInter  = buildLunchSlots(names.intermediario, LUNCH_CONFIG.intermediario);
  const lunchFecha  = buildLunchSlots(names.fechamento, LUNCH_CONFIG.fechamento);

  const hasLunchData = counts.abertura > 0 || counts.intermediario > 0 || counts.fechamento > 0;

  return (
    <div className="flex flex-col gap-4 mb-8 animate-fade-in">
      {/* Top row: presence + shift counts */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div className="flex items-center gap-5 md:border-r border-slate-100 pr-8">
            <div className="w-14 h-14 bg-orange-50 rounded-xl flex items-center justify-center text-orange-600">
              <Icon name="groups" className="text-3xl" fill />
            </div>
            <div>
              <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Equipe Presente</p>
              <h3 className="text-3xl font-extrabold text-slate-900">{counts.total}<span className="text-lg text-slate-300 ml-1 font-medium">/{employees.length}</span></h3>
              {counts.aprendiz > 0 && (
                <p className="text-[10px] font-bold text-teal-600 mt-0.5">incl. {counts.aprendiz} aprendiz{counts.aprendiz > 1 ? 'es' : ''}</p>
              )}
            </div>
          </div>

          <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-orange-50/60 p-4 rounded-xl border border-orange-100 flex flex-col justify-center">
              <div className="flex items-center gap-2 mb-1 text-orange-600">
                <Icon name="wb_twilight" className="text-sm" />
                <span className="text-[10px] font-extrabold uppercase tracking-tight">Abertura</span>
                <span className="text-[9px] text-orange-400 ml-auto">10h–18h20</span>
              </div>
              <p className="text-xl font-extrabold text-slate-900">{counts.abertura} <span className="text-[10px] text-slate-400 font-bold uppercase">Colabs.</span></p>
              {names.abertura.length > 0 && <p className="text-[9px] text-orange-500 mt-1 truncate">{names.abertura.join(', ')}</p>}
            </div>
            <div className="bg-sky-50/60 p-4 rounded-xl border border-sky-100 flex flex-col justify-center">
              <div className="flex items-center gap-2 mb-1 text-sky-600">
                <Icon name="sunny" className="text-sm" />
                <span className="text-[10px] font-extrabold uppercase tracking-tight">Intermediário</span>
                <span className="text-[9px] text-sky-400 ml-auto">12h–20h20</span>
              </div>
              <p className="text-xl font-extrabold text-slate-900">{counts.intermediario} <span className="text-[10px] text-slate-400 font-bold uppercase">Colabs.</span></p>
              {names.intermediario.length > 0 && <p className="text-[9px] text-sky-500 mt-1 truncate">{names.intermediario.join(', ')}</p>}
            </div>
            <div className="bg-indigo-50/60 p-4 rounded-xl border border-indigo-100 flex flex-col justify-center">
              <div className="flex items-center gap-2 mb-1 text-indigo-600">
                <Icon name="nightlight" className="text-sm" />
                <span className="text-[10px] font-extrabold uppercase tracking-tight">Fechamento</span>
                <span className="text-[9px] text-indigo-400 ml-auto">13h40–22h</span>
              </div>
              <p className="text-xl font-extrabold text-slate-900">{counts.fechamento} <span className="text-[10px] text-slate-400 font-bold uppercase">Colabs.</span></p>
              {names.fechamento.length > 0 && <p className="text-[9px] text-indigo-500 mt-1 truncate">{names.fechamento.join(', ')}</p>}
            </div>
          </div>

          <div className="flex items-center gap-8 pl-0 md:pl-8 md:border-l border-slate-100">
            <div className="text-center group">
              <p className="text-[9px] font-extrabold text-slate-400 uppercase mb-2 tracking-tighter">Folgas</p>
              <div className="w-10 h-10 rounded-full bg-orange-100/50 flex items-center justify-center mx-auto text-orange-700 font-extrabold text-sm border border-orange-200">{counts.folga}</div>
            </div>
            <div className="text-center">
              <p className="text-[9px] font-extrabold text-slate-400 uppercase mb-2 tracking-tighter">Curso</p>
              <div className="w-10 h-10 rounded-full bg-teal-100/50 flex items-center justify-center mx-auto text-teal-700 font-extrabold text-sm border border-teal-200">{counts.curso}</div>
            </div>
            <div className="text-center">
              <p className="text-[9px] font-extrabold text-slate-400 uppercase mb-2 tracking-tighter">Férias</p>
              <div className="w-10 h-10 rounded-full bg-red-100/50 flex items-center justify-center mx-auto text-red-700 font-extrabold text-sm border border-red-200">{counts.ferias}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Lunch suggestion banner */}
      {hasLunchData && (
        <div className="bg-white rounded-xl border border-amber-200 shadow-sm p-5 animate-fade-in">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 bg-amber-50 rounded-lg flex items-center justify-center text-amber-500">
              <Icon name="restaurant" className="text-lg" />
            </div>
            <div>
              <h4 className="font-extrabold text-sm text-slate-900 leading-tight">Sugestão de Almoço</h4>
              <p className="text-[10px] text-slate-400 font-medium">Distribuição sequencial a partir do 1º horário disponível · CLT: 1h pausa · Aprendiz: 15 min</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Abertura */}
            {lunchAberta.length > 0 && (
              <div className="bg-orange-50/80 rounded-xl border border-orange-100 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Icon name="wb_twilight" className="text-orange-500 text-sm" />
                  <span className="text-[10px] font-extrabold text-orange-600 uppercase tracking-wide">Abertura</span>
                  <span className="text-[9px] text-orange-400 ml-auto">{counts.abertura} colabs · janela 12h–14h</span>
                </div>
                <div className="space-y-1.5">
                  {lunchAberta.map((slot, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className="w-14 flex-shrink-0 text-[10px] font-extrabold text-orange-600 bg-orange-100 rounded px-1.5 py-0.5 text-center">{slot.time}</span>
                      <span className="text-[10px] font-bold text-slate-600 leading-snug">{slot.names.join(', ')}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Intermediário */}
            {lunchInter.length > 0 && (
              <div className="bg-sky-50/80 rounded-xl border border-sky-100 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Icon name="sunny" className="text-sky-500 text-sm" />
                  <span className="text-[10px] font-extrabold text-sky-600 uppercase tracking-wide">Intermediário</span>
                  <span className="text-[9px] text-sky-400 ml-auto">{counts.intermediario} colabs · janela 14h–16h</span>
                </div>
                <div className="space-y-1.5">
                  {lunchInter.map((slot, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className="w-14 flex-shrink-0 text-[10px] font-extrabold text-sky-600 bg-sky-100 rounded px-1.5 py-0.5 text-center">{slot.time}</span>
                      <span className="text-[10px] font-bold text-slate-600 leading-snug">{slot.names.join(', ')}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Fechamento */}
            {lunchFecha.length > 0 && (
              <div className="bg-indigo-50/80 rounded-xl border border-indigo-100 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Icon name="nightlight" className="text-indigo-500 text-sm" />
                  <span className="text-[10px] font-extrabold text-indigo-600 uppercase tracking-wide">Fechamento</span>
                  <span className="text-[9px] text-indigo-400 ml-auto">{counts.fechamento} colabs · janela 16h–18h</span>
                </div>
                <div className="space-y-1.5">
                  {lunchFecha.map((slot, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className="w-14 flex-shrink-0 text-[10px] font-extrabold text-indigo-600 bg-indigo-100 rounded px-1.5 py-0.5 text-center">{slot.time}</span>
                      <span className="text-[10px] font-bold text-slate-600 leading-snug">{slot.names.join(', ')}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Aprendiz notice */}
            {counts.aprendiz > 0 && (
              <div className="bg-teal-50/80 rounded-xl border border-teal-100 p-4 sm:col-span-3">
                <div className="flex items-center gap-2">
                  <Icon name="school" className="text-teal-500 text-sm" />
                  <span className="text-[10px] font-extrabold text-teal-600 uppercase tracking-wide">Jovem{counts.aprendiz > 1 ? 's' : ''} Aprendiz</span>
                  <span className="text-[11px] font-bold text-slate-600 ml-2">
                    Pausa de <strong>15 minutos</strong> — sem horário fixo de almoço (jornada reduzida 10h–16h15)
                  </span>
                </div>
              </div>
            )}
          </div>

          <p className="text-[9px] text-slate-300 mt-3 text-right font-medium">
            * Sugestão automática baseada na quantidade de colaboradores por turno. Ajuste conforme demanda.
          </p>
        </div>
      )}
    </div>
  );
};
