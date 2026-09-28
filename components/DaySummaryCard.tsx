
import React, { useMemo } from 'react';
import { Icon } from './Icon';
import { Employee, MonthYear, Holiday, JornadaSettings } from '../types';
import { buildHolidaySet, DEFAULT_JORNADA_SETTINGS, getShortName, isEmployeeActiveInMonth } from '../constants';
import { isWorkingShift } from '../src/engine/shifts/shift-predicates';
import { calculateLunches } from '../hooks/useScheduleEngine';


interface DaySummaryCardProps {
  employees: Employee[];
  selectedDayIdx: number;
  currentMY: MonthYear;
  customHolidays: Holiday[];
  jornadaSettings?: JornadaSettings;
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

export const DaySummaryCard: React.FC<DaySummaryCardProps> = ({
  employees,
  selectedDayIdx,
  currentMY,
  customHolidays,
  jornadaSettings = DEFAULT_JORNADA_SETTINGS,
}) => {
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

    employees.filter(e => isEmployeeActiveInMonth(e, currentMY.year, currentMY.month)).forEach(e => {
      const dateStr = `${currentMY.year}-${String(currentMY.month + 1).padStart(2, '0')}-${String(selectedDayIdx + 1).padStart(2, '0')}`;
      let shift = (e.shifts[monthKey] || [])[selectedDayIdx];

      // Override with hiredAt, firedAt, vacation, atestado or birthday if applicable
      if (e.hiredAt && dateStr < e.hiredAt) {
        shift = 'N/A';
      } else if (e.firedAt && dateStr > e.firedAt) {
        shift = 'N/A';
      } else if (e.atestadoStart && e.atestadoEnd && dateStr >= e.atestadoStart && dateStr <= e.atestadoEnd) {
        shift = 'AT';
      } else if (e.vacationStart && e.vacationEnd && dateStr >= e.vacationStart && dateStr <= e.vacationEnd) {
        shift = 'FE';
      } else if (e.birthday) {
        const empMD = e.birthday.length > 5 ? e.birthday.substring(5) : e.birthday;
        const dateMD = dateStr.substring(5);
        if (empMD === dateMD) shift = 'F';
      }

      const hForDay = (e.dailyHours[monthKey] || [])[selectedDayIdx] || e.workPeriod;

      if (isWorkingShift(shift)) {

        if (e.isYoungApprentice) {
          counts.aprendiz++;
          counts.total++;
        } else {
          counts.total++;
          if (isHoliday) {
            if (hForDay.includes('12h')) { counts.abertura++; names.abertura.push(getShortName(e.name, employees)); }
            else if (hForDay.includes('13h')) { counts.interm1++; names.interm1.push(getShortName(e.name, employees)); }
            else if (hForDay.includes('14h')) { counts.interm2++; names.interm2.push(getShortName(e.name, employees)); }
            else if (hForDay.includes('15h')) { counts.fechamento++; names.fechamento.push(getShortName(e.name, employees)); }
          } else {
            if (hForDay.includes('10h')) { counts.abertura++; names.abertura.push(getShortName(e.name, employees)); }
            else if (hForDay.includes('12h')) { counts.intermediario++; names.intermediario.push(getShortName(e.name, employees)); }
            else if (hForDay.includes('13h40')) { counts.fechamento++; names.fechamento.push(getShortName(e.name, employees)); }
          }
        }
      } else if (shift === 'F' || (shift && (shift.startsWith('FF') || shift === 'DO' || shift === 'AT'))) {
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

  const lunchAberta = buildLunchSlots(names.abertura, isHoliday ? { windowStart: 13.5 * 60, windowEnd: 15.5 * 60, slotDuration: 30 } : { windowStart: 12.5 * 60, windowEnd: 14.5 * 60, slotDuration: 30 });
  const lunchInter  = isHoliday ? [] : buildLunchSlots(names.intermediario, { windowStart: 14 * 60, windowEnd: 16 * 60, slotDuration: 30 });
  const lunchFecha  = buildLunchSlots(names.fechamento, isHoliday ? { windowStart: 16.5 * 60, windowEnd: 18.5 * 60, slotDuration: 30 } : { windowStart: 15 * 60, windowEnd: 18 * 60, slotDuration: 30 });

  // Simplified lunch distribution for summary card using the settings
  const getLunchList = (catNames: string[], category: 'abertura' | 'fechamento' | 'intermediario') => {
      if (catNames.length === 0) return [];
      const isSun = new Date(currentMY.year, currentMY.month, selectedDayIdx + 1).getDay() === 0;
      const isOp = category === 'abertura';
      
      const members = employees.filter(e => catNames.includes(getShortName(e.name, employees)));
      // Note: calculateLunches expects members with some extra fields but we just need it to run
      const times = calculateLunches(members, isHoliday, isSun, isOp, jornadaSettings);
      
      const groups: Record<string, string[]> = {};
      times.forEach((t, i) => {
          if (!groups[t]) groups[t] = [];
          groups[t].push(catNames[i]);
      });
      
      return Object.entries(groups).map(([time, names]) => ({
          time,
          names,
          isDouble: names.length > 1
      }));
  };

  const lAberta = getLunchList(names.abertura, 'abertura');
  const lInter = getLunchList(names.intermediario, 'intermediario');
  const lFecha = getLunchList(names.fechamento, 'fechamento');
  const lInter1 = getLunchList(names.interm1, 'intermediario');
  const lInter2 = getLunchList(names.interm2, 'intermediario');

  const hasLunchData = counts.abertura > 0 || counts.intermediario > 0 || counts.fechamento > 0 || counts.interm1 > 0 || counts.interm2 > 0;

  // New variables for the updated JSX
  const date = new Date(currentMY.year, currentMY.month, selectedDayIdx + 1);
  const dateNum = date.getDate();
  const weekdayName = date.toLocaleDateString('pt-BR', { weekday: 'short' }).toUpperCase().replace('.', '');

  const totalWorkers = counts.total;
  const totalOff = counts.folga + counts.curso + counts.ferias;

  const buckets = useMemo(() => {
    const b: Record<string, string[]> = {};
    if (isHoliday) {
      if (names.abertura.length > 0) b[`ABERTURA (${HOLIDAY_LUNCH_CONFIG.abertura.range})`] = names.abertura;
      if (names.interm1.length > 0) b[`INTERM. 1 (${HOLIDAY_LUNCH_CONFIG.interm1.range})`] = names.interm1;
      if (names.interm2.length > 0) b[`INTERM. 2 (${HOLIDAY_LUNCH_CONFIG.interm2.range})`] = names.interm2;
      if (names.fechamento.length > 0) b[`FECHAMENTO (${HOLIDAY_LUNCH_CONFIG.fechamento.range})`] = names.fechamento;
    } else {
      if (names.abertura.length > 0) b[`ABERTURA (${LUNCH_CONFIG.abertura.range})`] = names.abertura;
      if (names.intermediario.length > 0) b[`INTERMEDIÁRIO (${LUNCH_CONFIG.intermediario.range})`] = names.intermediario;
      if (names.fechamento.length > 0) b[`FECHAMENTO (${LUNCH_CONFIG.fechamento.range})`] = names.fechamento;
    }
    return b;
  }, [isHoliday, names]);

  return (
    <div className="bg-white  rounded-2xl border border-slate-200  shadow-sm p-3 flex flex-col h-full hover:shadow-md transition-all group overflow-hidden">
      
      {/* Mini-header: Dia e Data */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-baseline gap-1.5">
          <span className="text-2xl font-black text-slate-900 tracking-tighter">{dateNum}</span>
          <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">{weekdayName}</span>
        </div>
        
        <div className="flex items-center gap-1.5 flex-wrap justify-end">
          {isHoliday && (
            <div className="flex items-center gap-1 bg-red-50 text-red-600 px-2 py-0.5 rounded-full text-[8px] font-black uppercase ring-1 ring-inset ring-red-200">
               <Icon name="event_busy" className="text-[10px]" /> FERIADO
            </div>
          )}

          
        </div>
      </div>

      {/* Stats Quickbar */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="bg-slate-50  rounded-xl p-2 flex items-center gap-2 border border-slate-100 ">
           <div className="w-6 h-6 rounded-lg bg-indigo-100  text-indigo-600  flex items-center justify-center">
              <Icon name="person" className="text-xs" />
           </div>
           <div className="flex flex-col">
              <span className="text-[14px] font-black text-slate-900  leading-none">{totalWorkers}</span>
              <span className="text-[8px] font-bold text-slate-400  uppercase tracking-tighter">Equipe</span>
           </div>
        </div>
        <div className="bg-slate-50  rounded-xl p-2 flex items-center gap-2 border border-slate-100 ">
           <div className="w-6 h-6 rounded-lg bg-orange-100  text-orange-600  flex items-center justify-center">
              <Icon name="block" className="text-xs" />
           </div>
           <div className="flex flex-col">
              <span className="text-[14px] font-black text-slate-900  leading-none">{totalOff}</span>
              <span className="text-[8px] font-bold text-slate-400  uppercase tracking-tighter">Folgas</span>
           </div>
        </div>
      </div>

      {/* Shift Buckets */}
      <div className="space-y-2 flex-grow">
         {(Object.entries(buckets) as [string, string[]][]).map(([shiftName, names]) => (
            <div key={shiftName} className="bg-slate-50  rounded-xl p-2.5 border border-slate-100  group-hover:bg-white  transition-colors">
               <div className="flex justify-between items-center mb-1.5 px-0.5">
                  <span className="text-[9px] font-black text-slate-900  uppercase tracking-wider">{shiftName}</span>
                  <span className="text-[9px] font-black text-indigo-600  bg-indigo-50  px-1.5 rounded-md">{(names as string[]).length}</span>
               </div>
               <div className="flex flex-col gap-1">
                  {(names as string[]).map((name, i) => (
                    <div key={i} className="flex items-center gap-2">
                       <div className="w-1 h-1 rounded-full bg-slate-200 "></div>
                       <span className="text-[10px] font-bold text-slate-500  uppercase truncate" title={name}>{name}</span>
                    </div>
                  ))}
               </div>
            </div>
         ))}
      </div>

      {hasLunchData && (
        <div className="bg-white  rounded-2xl border border-amber-100  shadow-sm p-4 animate-fade-in group-hover/summary:border-amber-200  transition-colors mt-3">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 bg-amber-50  rounded-lg flex items-center justify-center text-amber-500  shadow-inner">
              <Icon name="restaurant" className="text-sm" />
            </div>
            <div>
              <h4 className="font-black text-xs text-slate-900  leading-tight uppercase tracking-tight">Pausas Sugeridas</h4>
              <p className="text-[9px] text-slate-400  font-bold uppercase tracking-widest mt-0.5">
                Balanceamento de loja · {isHoliday ? '15 min' : '1h'} pausa
              </p>
            </div>
          </div>

          <div className={`grid grid-cols-1 ${isHoliday ? 'sm:grid-cols-4' : 'sm:grid-cols-3'} gap-2.5`}>
            <LunchSection label={isHoliday ? "Ab. (H)" : "Abertura"} slots={[]} lunchData={lAberta} count={counts.abertura} color="orange" icon="wb_twilight" />
            {!isHoliday && <LunchSection label="Intermed." slots={[]} lunchData={lInter} count={counts.intermediario} color="sky" icon="sunny" />}
            {isHoliday && <LunchSection label="Int 1 (H)" slots={[]} lunchData={lInter1} count={counts.interm1} color="emerald" icon="sunny" />}
            {isHoliday && <LunchSection label="Int 2 (H)" slots={[]} lunchData={lInter2} count={counts.interm2} color="pink" icon="sunny" />}
            <LunchSection label={isHoliday ? "Fech (H)" : "Fechamento"} slots={[]} lunchData={lFecha} count={counts.fechamento} color={isHoliday ? "rose" : "indigo"} icon="nightlight" />
          </div>
        </div>
      )}
    </div>
  );
};

const ShiftBox: React.FC<{ label: string, range: string, count: number, names: string[], color: string, icon: any }> = ({ label, range, count, names, color, icon }) => (
  <div className={`bg-${color}-50/40 p-2.5 rounded-xl border border-${color}-100/60 flex flex-col justify-center min-h-[60px] transition-all hover:bg-${color}-50/80`}>
    <div className={`flex items-center gap-1.5 mb-0.5 text-${color}-600`}>
      <Icon name={icon} className="text-[10px]" />
      <span className="text-[8px] font-black uppercase tracking-widest">{label}</span>
      <span className={`text-[7px] text-${color}-400 ml-auto font-bold`}>{range}</span>
    </div>
    <p className="text-lg font-black text-slate-900 leading-none">{count} <span className="text-[8px] text-slate-300 font-black uppercase ml-0.5">Colab.</span></p>
    {names.length > 0 && <p className={`text-[8px] font-bold text-${color}-500/80 mt-1 truncate max-w-full italic`}>{names.join(', ')}</p>}
  </div>
);

const StatCircle: React.FC<{ label: string, count: number, color: string }> = ({ label, count, color }) => (
  <div className="text-center">
    <p className="text-[8px] font-black text-slate-400 uppercase mb-1 tracking-widest leading-none">{label}</p>
    <div className={`w-8 h-8 rounded-lg bg-${color}-50 flex items-center justify-center mx-auto text-${color}-600 font-black text-xs border border-${color}-100 shadow-sm`}>{count}</div>
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
    <div className="space-y-1">
      {lunchData.map((slot, i) => (
        <div key={i} className={`flex items-start gap-1.5 ${slot.isDouble ? 'opacity-90' : ''}`}>
          <span className={`text-[9px] font-black rounded px-1.5 py-0.5 text-center shrink-0 min-w-[38px] ${slot.isDouble ? 'bg-amber-100 text-amber-700 border border-amber-200' : `bg-${color}-100 text-${color}-600`}`}>
            {slot.time}
          </span>
          <span className="text-[9px] font-bold text-slate-600 leading-tight truncate">
            {slot.names.join(', ')}
            {slot.isDouble && <span className="ml-1 text-[7px] text-amber-500 font-black">(2×)</span>}
          </span>
        </div>
      ))}
    </div>
  </div>
);
