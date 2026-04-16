
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

  const apprentices = workingInStore.filter(e => e.isYoungApprentice);
  const stockists = workingInStore.filter(e => e.cargo === 'Estoquista');
  const others = workingInStore.filter(e => !e.isYoungApprentice && e.cargo !== 'Estoquista');

  const getEmpHour = (e: Employee) => (e.dailyHours[monthKey] || [])[dayIdx] || e.workPeriod || '';
  const getStartHour = (e: Employee) => {
    const h = getEmpHour(e);
    const match = h.match(/^(\d+)/);
    return match ? parseInt(match[1]) : 0;
  };

  // REGRA ESPECIAL: DOMINGO
  if (isSunday) {
    const openers = others.filter(e => getStartHour(e) === 12);
    const nonOpeners = others.filter(e => getStartHour(e) !== 12);

    // 2 abertura as 13h
    if (openers.length > 0) addSlot("13:00", 60, openers.slice(0, 2));
    if (openers.length > 2) nonOpeners.unshift(...openers.slice(2));

    // Slots sequenciais: 14h, 15h, 16h, 17h
    const sSlots = ["14:00", "15:00", "16:00", "17:00"];
    let nIdx = 0;
    
    // Aloca 1 por slot iniciamente
    sSlots.forEach(time => {
      if (nIdx < nonOpeners.length) {
        addSlot(time, 60, [nonOpeners[nIdx]]);
        nIdx++;
      }
    });

    // Se houver mais gente, preenche 16h e 17h ate 2 pessoas
    if (nIdx < nonOpeners.length) {
       addSlot("16:00", 60, [nonOpeners[nIdx]]); // Atua como adição ao slot já criado? 
       // Na verdade, a lógica de slots deve ser agrupada.
    }
    
    // Recalculo dos slots de domingo para permitir múltiplos
    const finalSundaySlots: Record<string, Employee[]> = {};
    if (openers.length > 0) finalSundaySlots["13h"] = openers.slice(0, 2);
    
    const othersForSlots = [...(openers.slice(2)), ...nonOpeners];
    let currentIdx = 0;
    ["14h", "15h", "16h", "17h"].forEach(time => {
      if (currentIdx < othersForSlots.length) {
        let count = 1;
        if ((time === "16h" || time === "17h") && (othersForSlots.length - currentIdx) > (4 - ["14h", "15h", "16h", "17h"].indexOf(time))) {
          count = 2; // Cabe 2 se sobrar gente
        }
        finalSundaySlots[time] = othersForSlots.slice(currentIdx, currentIdx + count);
        currentIdx += count;
      }
    });

    // Cleanup and return for Sunday
    slots.length = 0; // Clear previous adds
    if (apprentices.length > 0) addSlot("12h45", 15, apprentices);
    Object.entries(finalSundaySlots).forEach(([time, emps]) => addSlot(time, 60, emps as any));
    if (stockists.length > 0) addSlot("Flexível", 60, stockists);
    return slots;
  }

  // REGRA ESPECIAL: FERIADO (15 min, 1 por vez)
  if (isHoliday) {
    let startMinutes = 13 * 60; // Começa as 13h
    others.forEach(e => {
       const h = Math.floor(startMinutes / 60);
       const m = startMinutes % 60;
       const timeStr = m === 0 ? `${h}h` : `${h}h${m}`;
       addSlot(timeStr, 15, [e]);
       startMinutes += 15;
    });
    if (apprentices.length > 0) addSlot("12h45", 15, apprentices);
    if (stockists.length > 0) addSlot("Flexível", 15, stockists);
    return slots;
  }

  const abertura = others.filter(e => getStartHour(e) <= 10);
  const intermediario = others.filter(e => getStartHour(e) > 10 && getStartHour(e) <= 13);
  const fechamento = others.filter(e => getStartHour(e) >= 14);

  // 1. Jovem Aprendiz @ 12h45
  if (apprentices.length > 0) {
    addSlot("12h45", 15, apprentices);
  }

  // 2. Abertura
  let extraAbertura: typeof others = [];
  if (abertura.length === 1) {
    addSlot("13h", 60, [abertura[0]]);
  } else if (abertura.length === 2) {
    addSlot("14h", 60, abertura.slice(0, 2));
  } else if (abertura.length === 3) {
    addSlot("13h", 60, [abertura[0]]);
    addSlot("14h", 60, abertura.slice(1, 3));
  } else if (abertura.length >= 4) {
    addSlot("13h", 60, abertura.slice(0, 2));
    addSlot("14h", 60, abertura.slice(2, 4));
    extraAbertura = abertura.slice(4);
  }

  // 3. Tarde (Intermediários e Fechamentos)
  const afternoonPool = [...extraAbertura, ...intermediario, ...fechamento];
  
  if (afternoonPool.length > 0) {
    const M = afternoonPool.length;

    if (M === 1) {
        addSlot("15h", 60, [afternoonPool[0]]);
    } else if (M === 2) {
        addSlot("15h", 60, [afternoonPool[0]]);
        addSlot("16h", 60, [afternoonPool[1]]);
    } else if (M === 3) {
        addSlot("15h", 60, [afternoonPool[0]]);
        addSlot("16h", 60, [afternoonPool[1]]);
        addSlot("17h", 60, [afternoonPool[2]]);
    } else if (M === 4) {
        addSlot("15h", 60, [afternoonPool[0]]);
        addSlot("16h", 60, [afternoonPool[1]]);
        addSlot("16h30", 60, [afternoonPool[2]]);
        addSlot("17h", 60, [afternoonPool[3]]);
    } else {
        // >= 5 people
        addSlot("15h", 60, afternoonPool.slice(0, 2));
        addSlot("16h", 60, [afternoonPool[2]]);
        addSlot("16h30", 60, [afternoonPool[3]]);
        addSlot("17h", 60, [afternoonPool[4]]);
        
        // If more than 5, distribute every 30 mins after 17h
        const extras = afternoonPool.slice(5);
        const lateTimes = ["17h30", "18h", "18h30", "19h"];
        extras.forEach((emp, i) => {
            const time = i < lateTimes.length ? lateTimes[i] : `19h30+ (${i})`;
            addSlot(time, 60, [emp]);
        });
    }
  }

  // 5. Estoquista (Flexível)
  if (stockists.length > 0) {
    addSlot("Flexível", 60, stockists);
  }

  return slots;
}
