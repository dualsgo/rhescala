
import { Employee, ShiftType } from '../types';

export interface LunchSlot {
  time: string;
  employees: { id: string; name: string; isApprentice: boolean; isStockist: boolean; cargo?: string }[];
  duration: number; // in minutes
}

/**
 * Nova Lógica de Almoço:
 * - Máximo 2 pessoas saindo simultaneamente.
 * - Jovem Aprendiz: 12:45 (15 min).
 * - Estoquista: Horário flexível.
 * - Slots Fixos:
 *   13:00, 13:30, 14:00, 14:30, 15:30, 16:00, 16:30, 17:00 (1 vaga cada)
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
        isStockist: e.cargo === 'Estoquista',
        cargo: e.cargo
      }))
    });
  };

  // Simplificação para feriados e domingos se não houver regra específica
  if (isHoliday || isSunday) {
    let currentTime = 13 * 60; // 13:00
    const groupSize = 2;
    for (let i = 0; i < workingInStore.length; i += groupSize) {
        const timeStr = `${Math.floor(currentTime / 60)}:00`;
        addSlot(timeStr, isHoliday ? 15 : 60, workingInStore.slice(i, i + groupSize));
        currentTime += 60;
    }
    return slots;
  }

  // Regra Dias Úteis (Weekday)
  const apprentices = workingInStore.filter(e => e.isYoungApprentice);
  const stockists = workingInStore.filter(e => e.cargo === 'Estoquista');
  const regulars = workingInStore.filter(e => !e.isYoungApprentice && e.cargo !== 'Estoquista');

  // Ordenar regulares por horário de início (abertura primeiro)
  const sortedRegulars = [...regulars].sort((a, b) => {
    const hA = (a.dailyHours[monthKey] || [])[dayIdx] || a.workPeriod;
    const hB = (b.dailyHours[monthKey] || [])[dayIdx] || b.workPeriod;
    return hA.localeCompare(hB);
  });

  // Aloca Jovem Aprendiz às 12:45
  if (apprentices.length > 0) {
    addSlot("12:45", 15, apprentices);
  }

  // Slots de almoço conforme solicitado: 13h, 13h30, 14h, 14h30, 15h30, 16h, 16h30 e 17h
  const mainSlots = [
    { time: "13:00", capacity: 1 },
    { time: "13:30", capacity: 1 },
    { time: "14:00", capacity: 1 },
    { time: "14:30", capacity: 1 },
    { time: "15:30", capacity: 1 },
    { time: "16:00", capacity: 1 },
    { time: "16:30", capacity: 1 },
    { time: "17:00", capacity: 1 }
  ];

  let regIdx = 0;
  mainSlots.forEach(slot => {
    const batch: typeof regulars = [];
    for (let i = 0; i < slot.capacity && regIdx < sortedRegulars.length; i++) {
      batch.push(sortedRegulars[regIdx]);
      regIdx++;
    }
    addSlot(slot.time, 60, batch);
  });

  // Se sobrarem regulares (time muito grande), alocar no final ou onde couber
  while (regIdx < sortedRegulars.length) {
    const lastTime = mainSlots[mainSlots.length - 1].time;
    const [h, m] = lastTime.split(':').map(Number);
    const nextTimeInMinutes = h * 60 + m + 60;
    const nextTimeStr = `${Math.floor(nextTimeInMinutes / 60)}:${(nextTimeInMinutes % 60).toString().padStart(2, '0')}`;
    addSlot(nextTimeStr, 60, [sortedRegulars[regIdx]]);
    regIdx++;
  }

  // Estoquistas: Flexível (Adicionamos um slot especial sem horário rígido ou apenas listamos)
  if (stockists.length > 0) {
    addSlot("Flexível", 60, stockists);
  }

  return slots;
}
