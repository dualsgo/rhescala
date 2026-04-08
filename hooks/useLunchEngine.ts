
import { Employee, ShiftType } from '../types';

export interface LunchSlot {
  time: string;
  employees: { id: string; name: string; isApprentice: boolean; isStockist: boolean }[];
  duration: number; // in minutes
}

/**
 * Rules:
 * - Apprentice: 15 min only.
 * - Stockist: Joker (flexible).
 * - Weekday Opening (10h-18h20) needs cover at 13:45 when closing arrives.
 * - Ideal max lunch time: 17:00.
 */
export function calculateLunchSchedule(
  employees: Employee[],
  dayIdx: number,
  isSunday: boolean,
  isHoliday: boolean,
  monthKey: string
): LunchSlot[] {
  const workingInStore = employees.filter(emp => {
    if (emp.status !== 'active') return false;
    const shift = (emp.shifts[monthKey] || [])[dayIdx] || 'F';
    // Codigo 'C' (Curso) significa trabalho externo, não está na loja.
    // Apenas turnos 'T' (Trabalho) contam para o escalonamento de almoço.
    return shift === 'T'; 
  });

  if (workingInStore.length === 0) return [];

  const slots: LunchSlot[] = [];

  const addSlot = (time: string, duration: number, emps: typeof workingInStore) => {
    if (emps.length === 0) return;
    slots.push({
      time,
      duration,
      employees: emps.map(e => ({
        id: e.id,
        name: e.name.split(' ')[0],
        isApprentice: e.isYoungApprentice,
        isStockist: e.cargo === 'Estoquista'
      }))
    });
  };

  if (isHoliday) {
    // Holidays: 15 minutes for everyone, starting from 13:00
    // Strictly sequential to ensure no more than 2 (actually 1 here) out.
    let currentTime = 13 * 60; // 13:00
    workingInStore.forEach((emp) => {
        const timeStr = `${Math.floor(currentTime / 60)}:${(currentTime % 60).toString().padStart(2, '0')}`;
        addSlot(timeStr, 15, [emp]);
        currentTime += 15;
    });
    return slots;
  }

  if (isSunday) {
    // Sundays: Starts at 13:00, hourly groups, MAX 2 people at a time
    const startTime = 13 * 60;
    const groupSize = 2; // Fixed at 2 to obey user limit
    for (let i = 0; i < workingInStore.length; i += groupSize) {
        const time = startTime + (Math.floor(i / groupSize) * 60);
        const timeStr = `${Math.floor(time / 60)}:00`;
        addSlot(timeStr, 60, workingInStore.slice(i, i + groupSize));
    }
    return slots;
  }

  // Weekdays - Robust logic for "Max 2 simultaneous" and "13h-17h window"
  const apprentices = workingInStore.filter(e => e.isYoungApprentice);
  const stockists = workingInStore.filter(e => e.cargo === 'Estoquista');
  const regulars = workingInStore.filter(e => !e.isYoungApprentice && e.cargo !== 'Estoquista');

  // Order of priority for lunch
  const abertura: typeof regulars = [];
  const intermediario: typeof regulars = [];
  const fechamento: typeof regulars = [];

  regulars.forEach(r => {
      const h = (r.dailyHours[monthKey] || [])[dayIdx] || r.workPeriod;
      if (h.includes('10h')) abertura.push(r);
      else if (h.includes('12h')) intermediario.push(r);
      else fechamento.push(r);
  });

  // Flat queue of all employees with their specific constraints
  const queue = [
    ...abertura.map(e => ({ emp: e, duration: 60, minStart: 13 * 60 })), // 13:00
    ...intermediario.map(e => ({ emp: e, duration: 60, minStart: 13 * 60 })), // 13:00
    ...apprentices.map(e => ({ emp: e, duration: 15, minStart: 13 * 60 })), // 13:00
    ...stockists.map(e => ({ emp: e, duration: 60, minStart: 14 * 60 })), // 14:00
    ...fechamento.map(e => ({ emp: e, duration: 60, minStart: 14 * 45 })) // 14:45 (after arriving at 13h40)
  ];

  // Logic: 2 "seats" for lunch
  let seat1FreeAt = 13 * 60;
  let seat2FreeAt = 13 * 60;

  queue.forEach(item => {
    // Pick the seat that is free earliest
    let selectedStartTime: number;
    let isSeat1 = seat1FreeAt <= seat2FreeAt;
    
    if (isSeat1) {
      selectedStartTime = Math.max(seat1FreeAt, item.minStart);
      const timeStr = `${Math.floor(selectedStartTime / 60)}:${(selectedStartTime % 60).toString().padStart(2, '0')}`;
      addSlot(timeStr, item.duration, [item.emp]);
      seat1FreeAt = selectedStartTime + item.duration;
    } else {
      selectedStartTime = Math.max(seat2FreeAt, item.minStart);
      const timeStr = `${Math.floor(selectedStartTime / 60)}:${(selectedStartTime % 60).toString().padStart(2, '0')}`;
      addSlot(timeStr, item.duration, [item.emp]);
      seat2FreeAt = selectedStartTime + item.duration;
    }
  });

  return slots;
}
