import { Employee } from '../types';
import { calculateLunchSchedule } from './useLunchEngine';

export type TacticalPosition = 'P1' | 'P2' | 'P3' | 'P4' | 'P5+' | 'Estoque' | 'Pausa/Almoço';

export interface TacticalAllocation {
  id: string;
  name: string;
  cargo?: string;
  position: TacticalPosition;
  isApprentice: boolean;
  status: 'working' | 'lunch';
}

function parseTimeToMinutes(tStr: string): number {
    if (!tStr || tStr === 'Flexível') return 0;
    const clean = tStr.replace(/h/g, ':');
    const parts = clean.split(':');
    const h = parseInt(parts[0]) || 0;
    const m = parseInt(parts[1]) || 0;
    return h * 60 + m;
}

function parseShiftRange(shiftStr: string): { start: number, end: number } | null {
    // Example formats: "10h às 18h20", "13:40 às 22h", "12h as 20h"
    if (!shiftStr) return null;
    const parts = shiftStr.toLowerCase().split(/ às | as | - /);
    if (parts.length !== 2) {
        // Fallback or generic 8-hour if cannot parse end
        const start = parseTimeToMinutes(parts[0]);
        if (start) return { start, end: start + 8 * 60 };
        return null;
    }
    
    const start = parseTimeToMinutes(parts[0]);
    const end = parseTimeToMinutes(parts[1]);
    
    return { start, end };
}

export function calculateTacticalPositions(
    employees: Employee[],
    dayIdx: number,
    monthKey: string,
    queryHourStr: string,
    isSunday: boolean,
    isHoliday: boolean
): TacticalAllocation[] {
    const lunchSlots = calculateLunchSchedule(employees, dayIdx, isSunday, isHoliday, monthKey);

    const workingEmps = employees.filter(emp => {
        if (emp.status !== 'active' || emp.isHidden) return false;
        const shift = (emp.shifts[monthKey] || [])[dayIdx] || 'F';
        return shift === 'T'; 
    });

    if (workingEmps.length === 0) return [];

    const queryTime = parseTimeToMinutes(queryHourStr);

    const allocations: TacticalAllocation[] = [];
    const availableForPositions: Employee[] = [];

    const getEmpHourStr = (e: Employee) => (e.dailyHours[monthKey] || [])[dayIdx] || e.workPeriod || '';

    workingEmps.forEach(emp => {
        const shiftStr = getEmpHourStr(emp);
        const shiftRange = parseShiftRange(shiftStr);
        
        // Verifica se o colaborador está na loja no momento
        if (!shiftRange || queryTime < shiftRange.start || queryTime >= shiftRange.end) {
            return; 
        }

        let onLunch = false;
        for (const slot of lunchSlots) {
            if (slot.employees.some(e => e.id === emp.id)) {
                let slotStart = parseTimeToMinutes(slot.time);
                if (slot.time === 'Flexível') {
                     // Estimativa para almoço flexível do Estoquista: assume metade do turno
                     slotStart = shiftRange.start + Math.floor((shiftRange.end - shiftRange.start) / 2) - 30;
                }
                const slotEnd = slotStart + slot.duration;
                if (queryTime >= slotStart && queryTime < slotEnd) {
                    onLunch = true;
                    allocations.push({
                        id: emp.id,
                        name: emp.name.split(' ')[0],
                        cargo: emp.cargo,
                        position: 'Pausa/Almoço',
                        isApprentice: emp.isYoungApprentice,
                        status: 'lunch'
                    });
                    break;
                }
            }
        }

        if (!onLunch) {
            if (emp.cargo === 'Estoquista') {
                allocations.push({
                    id: emp.id,
                    name: emp.name.split(' ')[0],
                    cargo: emp.cargo,
                    position: 'Estoque',
                    isApprentice: emp.isYoungApprentice,
                    status: 'working'
                });
            } else {
                availableForPositions.push(emp);
            }
        }
    });

    // Regra determinística: Ordenamos por horário de chegada e depois nome
    availableForPositions.sort((a, b) => {
        const startA = parseShiftRange(getEmpHourStr(a))?.start || 0;
        const startB = parseShiftRange(getEmpHourStr(b))?.start || 0;
        if (startA !== startB) return startA - startB;
        return a.name.localeCompare(b.name);
    });

    availableForPositions.forEach((emp, index) => {
        let pos: TacticalPosition = (emp.tacticalPosition as TacticalPosition);
        if (!pos) {
            const rank = index + 1;
            if (rank === 1) pos = 'P1';
            else if (rank === 2) pos = 'P2';
            else if (rank === 3 && availableForPositions.length >= 4) pos = 'P4';
            else pos = 'P3';
        }

        allocations.push({
            id: emp.id,
            name: emp.name.split(' ')[0],
            cargo: emp.cargo,
            position: pos,
            isApprentice: emp.isYoungApprentice,
            status: 'working'
        });
    });

    // Regra da ALERTA DE CRÍSE (Único na loja)
    const workingNow = allocations.filter(a => a.status === 'working');
    if (workingNow.length === 1) {
        const theOnlyOne = workingNow[0];
        if (theOnlyOne.position === 'Estoque') {
            theOnlyOne.position = 'P1'; // Estoquista assume P1 se for o único
        }
    }

    return allocations;
}
