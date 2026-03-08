
import React, { useMemo } from 'react';
import { Icon } from './Icon';
import { Employee, MonthYear, Holiday } from '../types';
import { buildHolidaySet } from '../constants';

interface DaySummaryCardProps {
  employees: Employee[];
  selectedDayIdx: number;
  currentMY: MonthYear;
  customHolidays: Holiday[];
}

// ─── Lunch interval definitions ───────────────────────────────────────────────
const LUNCH_CONFIG = {
  abertura:      { windowStart: 12.5 * 60, windowEnd: 14.5 * 60, slotDuration: 30, label: 'Abertura',     icon: 'wb_twilight', color: 'orange', range: '10h–18h20' },
  intermediario: { windowStart: 14 * 60, windowEnd: 16 * 60, slotDuration: 30, label: 'Intermediário', icon: 'sunny',       color: 'sky',    range: '12h–20h20' },
  fechamento:    { windowStart: 15 * 60, windowEnd: 18 * 60, slotDuration: 30, label: 'Fechamento',   icon: 'nightlight',  color: 'indigo', range: '13h40–22h' },
} as const;

const HOLIDAY_LUNCH_CONFIG = {
  abertura:      { windowStart: 13.5 * 60, windowEnd: 15.5 * 60, slotDuration: 30, label: 'Abertura (H)',     icon: 'wb_twilight', color: 'orange',  range: '12h–18h' },
  interm1:       { windowStart: 14.5 * 60, windowEnd: 16.5 * 60, slotDuration: 30, label: 'Interm. 1 (H)',   icon: 'sunny',       color: 'emerald', range: '13h–19h' },
  interm2:       { windowStart: 15.5 * 60, windowEnd: 17.5 * 60, slotDuration: 30, label: 'Interm. 2 (H)',   icon: 'sunny',       color: 'pink',    range: '14h–20h' },
  fechamento:    { windowStart: 16.5 * 60, windowEnd: 18.5 * 60, slotDuration: 30, label: 'Fechamento (H)',   icon: 'nightlight',  color: 'rose',    range: '15h–21h' },
} as const;

/** Formats minutes-from-midnight as "HHhMM" */
function fmtTime(mins: number): string {
  const h = Math.floor(mins / 60).toString().padStart(2, '0');
  const m = (mins % 60).toString().padStart(2, '0');
  return m === '00' ? `${h}h` : `${h}h${m}`;
}

/**
 * Returns all discrete possible lunch slot labels for a shift config.
 */
function getAvailableSlots(config: any): string[] {
  const slots: string[] = [];
  for (let t = config.windowStart; t < config.windowEnd; t += config.slotDuration) {
    slots.push(fmtTime(t));
  }
  return slots;
}

/**
 * Distributes employees across available lunch slots.
 */
function buildLunchSlots(
  names: string[],
  config: any
): { time: string; names: string[]; isDouble: boolean }[] {
  const n = names.length;
  if (n === 0) return [];

  const availableSlots = getAvailableSlots(config);
  const totalSlots = availableSlots.length;

  const slotMap: Record<string, string[]> = {};
  availableSlots.forEach(t => { slotMap[t] = []; });

  names.forEach((name, idx) => {
    const slotLabel = availableSlots[idx % totalSlots];
    slotMap[slotLabel].push(name);
  });

  return availableSlots
    .filter(t => slotMap[t].length > 0)
    .map(t => ({
      time: t,
      names: slotMap[t],
      isDouble: slotMap[t].length > 1,
    }));
}

export const DaySummaryCard: React.FC<DaySummaryCardProps> = ({ employees, selectedDayIdx, currentMY, customHolidays }) => {
  const monthKey = `${currentMY.year}-${(currentMY.month + 1).toString().padStart(2, '0')}`;
  const dateStr = `${currentMY.year}-${String(currentMY.month + 1).padStart(2, '0')}-${String(selectedDayIdx + 1).padStart(2, '0')}`;
  const isHoliday = buildHolidaySet(currentMY.year, customHolidays).has(dateStr);

  const data = useMemo(() => {
    const counts = {
      abertura: 0,
      intermediario: 0,
      interm1: 0,
      interm2: 0,
      fechamento: 0,
      aprendiz: 0,
      folga: 0,
      curso: 0,
      ferias: 0,
      total: 0,
    };

    const names = {
      abertura: [] as string[],
      intermediario: [] as string[],
      interm1: [] as string[],
      interm2: [] as string[],
      fechamento: [] as string[],
    };

    employees.filter(e => !e.isHidden).forEach(e => {
      const dateStr = `${currentMY.year}-${String(currentMY.month + 1).padStart(2, '0')}-${String(selectedDayIdx + 1).padStart(2, '0')}`;
      let shift = (e.shifts[monthKey] || [])[selectedDayIdx];

      // Override with vacation if applicable
      if (e.vacationStart && e.vacationEnd && dateStr >= e.vacationStart && dateStr <= e.vacationEnd) {
        shift = 'FE';
      }

      const hForDay = (e.dailyHours[monthKey] || [])[selectedDayIdx] || e.workPeriod;

      if (shift === 'T') {
        if (e.isYoungApprentice) {
          counts.aprendiz++;
          counts.total++;
        } else {
          counts.total++;
          if (isHoliday) {
            if (hForDay.includes('12h')) { counts.abertura++; names.abertura.push(e.name.split(' ')[0]); }
            else if (hForDay.includes('13h')) { counts.interm1++; names.interm1.push(e.name.split(' ')[0]); }
            else if (hForDay.includes('14h')) { counts.interm2++; names.interm2.push(e.name.split(' ')[0]); }
            else if (hForDay.includes('15h')) { counts.fechamento++; names.fechamento.push(e.name.split(' ')[0]); }
          } else {
            if (hForDay.includes('10h')) { counts.abertura++; names.abertura.push(e.name.split(' ')[0]); }
            else if (hForDay.includes('12h')) { counts.intermediario++; names.intermediario.push(e.name.split(' ')[0]); }
            else if (hForDay.includes('13h40')) { counts.fechamento++; names.fechamento.push(e.name.split(' ')[0]); }
          }
        }
      } else if (shift === 'F' || (shift && (shift.startsWith('FF') || shift === 'DO'))) {
        counts.folga++;
      } else if (shift === 'C') {
        counts.curso++;
        // C is activity but NOT store presence, consistent with rule
      } else if (shift === 'FE') {
        counts.ferias++;
      }
    });

    return { counts, names };
  }, [employees, monthKey, selectedDayIdx, isHoliday]);

  const { counts, names } = data;

  const lunchAberta = buildLunchSlots(names.abertura, isHoliday ? HOLIDAY_LUNCH_CONFIG.abertura : LUNCH_CONFIG.abertura);
  const lunchInter  = isHoliday ? [] : buildLunchSlots(names.intermediario, LUNCH_CONFIG.intermediario);
  const lunchInter1 = isHoliday ? buildLunchSlots(names.interm1, HOLIDAY_LUNCH_CONFIG.interm1) : [];
  const lunchInter2 = isHoliday ? buildLunchSlots(names.interm2, HOLIDAY_LUNCH_CONFIG.interm2) : [];
  const lunchFecha  = buildLunchSlots(names.fechamento, isHoliday ? HOLIDAY_LUNCH_CONFIG.fechamento : LUNCH_CONFIG.fechamento);

  const hasLunchData = counts.abertura > 0 || counts.intermediario > 0 || counts.fechamento > 0 || counts.interm1 > 0 || counts.interm2 > 0;

  return (
    <div className="flex flex-col gap-4 mb-8 animate-fade-in">
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div className="flex items-center gap-5 md:border-r border-slate-100 pr-8">
            <div className={`w-14 h-14 ${isHoliday ? 'bg-rose-50 text-rose-600' : 'bg-orange-50 text-orange-600'} rounded-xl flex items-center justify-center`}>
              <Icon name={isHoliday ? 'event_busy' : 'groups'} className="text-3xl" fill />
            </div>
            <div>
              <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">{isHoliday ? 'Equipe no Feriado' : 'Equipe Presente'}</p>
              <h3 className="text-3xl font-extrabold text-slate-900">{counts.total}<span className="text-lg text-slate-300 ml-1 font-medium">/{employees.length}</span></h3>
              {counts.aprendiz > 0 && (
                <p className="text-[10px] font-bold text-teal-600 mt-0.5">incl. {counts.aprendiz} aprendiz{counts.aprendiz > 1 ? 'es' : ''}</p>
              )}
            </div>
          </div>

          <div className={`flex-1 grid grid-cols-1 ${isHoliday ? 'sm:grid-cols-4' : 'sm:grid-cols-3'} gap-4`}>
            {isHoliday ? (
              <>
                <ShiftBox label="Abertura (H)" range="12h–18h" count={counts.abertura} names={names.abertura} color="orange" icon="wb_twilight" />
                <ShiftBox label="Interm. 1 (H)" range="13h–19h" count={counts.interm1} names={names.interm1} color="emerald" icon="sunny" />
                <ShiftBox label="Interm. 2 (H)" range="14h–20h" count={counts.interm2} names={names.interm2} color="pink" icon="sunny" />
                <ShiftBox label="Fechamento (H)" range="15h–21h" count={counts.fechamento} names={names.fechamento} color="rose" icon="nightlight" />
              </>
            ) : (
              <>
                <ShiftBox label="Abertura" range="10h–18h20" count={counts.abertura} names={names.abertura} color="orange" icon="wb_twilight" />
                <ShiftBox label="Intermediário" range="12h–20h20" count={counts.intermediario} names={names.intermediario} color="sky" icon="sunny" />
                <ShiftBox label="Fechamento" range="13h40–22h" count={counts.fechamento} names={names.fechamento} color="indigo" icon="nightlight" />
              </>
            )}
          </div>

          <div className="flex items-center gap-6 pl-0 md:pl-8 md:border-l border-slate-100">
            <StatCircle label="Folgas" count={counts.folga} color="orange" />
            <StatCircle label="Curso" count={counts.curso} color="teal" />
            <StatCircle label="Férias" count={counts.ferias} color="red" />
          </div>
        </div>
      </div>

      {hasLunchData && (
        <div className="bg-white rounded-xl border border-amber-200 shadow-sm p-5 animate-fade-in">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 bg-amber-50 rounded-lg flex items-center justify-center text-amber-500">
              <Icon name="restaurant" className="text-lg" />
            </div>
            <div>
              <h4 className="font-extrabold text-sm text-slate-900 leading-tight">Sugestão de Pausa</h4>
              <p className="text-[10px] text-slate-400 font-medium">
                1 pessoa por horário · CLT: {isHoliday ? '15 min' : '1h'} pausa · Aprendiz: 15 min
              </p>
            </div>
          </div>

          <div className={`grid grid-cols-1 ${isHoliday ? 'sm:grid-cols-4' : 'sm:grid-cols-3'} gap-3`}>
            <LunchSection label={isHoliday ? "Abertura (H)" : "Abertura"} slots={getAvailableSlots(isHoliday ? HOLIDAY_LUNCH_CONFIG.abertura : LUNCH_CONFIG.abertura)} lunchData={lunchAberta} count={counts.abertura} color="orange" icon="wb_twilight" />
            {!isHoliday && <LunchSection label="Intermediário" slots={getAvailableSlots(LUNCH_CONFIG.intermediario)} lunchData={lunchInter} count={counts.intermediario} color="sky" icon="sunny" />}
            {isHoliday && <LunchSection label="Interm. 1 (H)" slots={getAvailableSlots(HOLIDAY_LUNCH_CONFIG.interm1)} lunchData={lunchInter1} count={counts.interm1} color="emerald" icon="sunny" />}
            {isHoliday && <LunchSection label="Interm. 2 (H)" slots={getAvailableSlots(HOLIDAY_LUNCH_CONFIG.interm2)} lunchData={lunchInter2} count={counts.interm2} color="pink" icon="sunny" />}
            <LunchSection label={isHoliday ? "Fechamento (H)" : "Fechamento"} slots={getAvailableSlots(isHoliday ? HOLIDAY_LUNCH_CONFIG.fechamento : LUNCH_CONFIG.fechamento)} lunchData={lunchFecha} count={counts.fechamento} color={isHoliday ? "rose" : "indigo"} icon="nightlight" />
          </div>

          <p className="text-[9px] text-slate-300 mt-3 text-right font-medium">
            * Sugestão automática para balanceamento de equipe.
          </p>
        </div>
      )}
    </div>
  );
};

const ShiftBox: React.FC<{ label: string, range: string, count: number, names: string[], color: string, icon: any }> = ({ label, range, count, names, color, icon }) => (
  <div className={`bg-${color}-50/60 p-4 rounded-xl border border-${color}-100 flex flex-col justify-center`}>
    <div className={`flex items-center gap-2 mb-1 text-${color}-600`}>
      <Icon name={icon} className="text-sm" />
      <span className="text-[10px] font-extrabold uppercase tracking-tight">{label}</span>
      <span className={`text-[9px] text-${color}-400 ml-auto`}>{range}</span>
    </div>
    <p className="text-xl font-extrabold text-slate-900">{count} <span className="text-[10px] text-slate-400 font-bold uppercase">Colabs.</span></p>
    {names.length > 0 && <p className={`text-[9px] text-${color}-500 mt-1 truncate`}>{names.join(', ')}</p>}
  </div>
);

const StatCircle: React.FC<{ label: string, count: number, color: string }> = ({ label, count, color }) => (
  <div className="text-center">
    <p className="text-[9px] font-extrabold text-slate-400 uppercase mb-2 tracking-tighter">{label}</p>
    <div className={`w-10 h-10 rounded-full bg-${color}-100/50 flex items-center justify-center mx-auto text-${color}-700 font-extrabold text-sm border border-${color}-200`}>{count}</div>
  </div>
);

const LunchSection: React.FC<{ label: string, slots: string[], lunchData: any[], count: number, color: string, icon: any }> = ({ label, slots, lunchData, count, color, icon }) => (
  <div className={`bg-${color}-50/80 rounded-xl border border-${color}-100 p-4`}>
    <div className="flex items-center gap-2 mb-1">
      <Icon name={icon} className={`text-${color}-500 text-sm`} />
      <span className={`text-[10px] font-extrabold text-${color}-600 uppercase tracking-wide`}>{label}</span>
      <span className={`text-[9px] text-${color}-400 ml-auto`}>{count} colab{count > 1 ? 's' : ''}</span>
    </div>
    <div className="flex flex-wrap gap-1 mb-3">
      {slots.map(s => (
        <span key={s} className={`text-[8px] font-bold text-${color}-300 border border-${color}-200 rounded px-1 py-0.5`}>{s}</span>
      ))}
    </div>
    <div className="space-y-1.5">
      {lunchData.map((slot, i) => (
        <div key={i} className={`flex items-start gap-2 ${slot.isDouble ? 'opacity-80' : ''}`}>
          <span className={`w-14 flex-shrink-0 text-[10px] font-extrabold rounded px-1.5 py-0.5 text-center ${slot.isDouble ? 'bg-amber-100 text-amber-700 border border-amber-300' : `bg-${color}-100 text-${color}-600`}`}>
            {slot.time}
          </span>
          <span className="text-[10px] font-bold text-slate-600 leading-snug">
            {slot.names.join(', ')}
            {slot.isDouble && <span className="ml-1 text-[8px] text-amber-500 font-extrabold">(2×)</span>}
          </span>
        </div>
      ))}
    </div>
  </div>
);
