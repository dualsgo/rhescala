
import { Employee, MonthYear, Holiday } from '../types';
import { buildHolidaySet } from '../constants';
import { calculateLunchSchedule } from './useLunchEngine';

export const useWhatsApp = (employees: Employee[], currentMY: MonthYear, customHolidays: Holiday[], months: string[]) => {
  
  const generateWhatsAppText = (dayIdx: number) => {
    const monthKey = `${currentMY.year}-${String(currentMY.month + 1).padStart(2, '0')}`;
    const d = new Date(currentMY.year, currentMY.month, dayIdx + 1);
    const fullDayName = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'][d.getDay()];
    const monthName = months[currentMY.month];
    
    const legendText = `📍 Posicionamento\n🟦 P1 Caixa\n🟩 P2 Porta\n🟧 P3 Salão\n🟪 P4 Coringa\n\n`;
    const formattedDayName = fullDayName.charAt(0).toUpperCase() + fullDayName.slice(1);
    let text = `📅 Escala ${formattedDayName} ${String(dayIdx + 1).padStart(2, '0')}/${String(currentMY.month + 1).padStart(2, '0')}\n\n${legendText}`;

    const workingEmployees = employees.filter(emp => {
        if (emp.status !== 'active') return false;
        const shift = emp.shifts[monthKey]?.[dayIdx] || 'F';
        return shift === 'T';
    });

    const hSet = buildHolidaySet(currentMY.year, customHolidays);
    const dateStr = `${currentMY.year}-${String(currentMY.month + 1).padStart(2, '0')}-${String(dayIdx + 1).padStart(2, '0')}`;
    const isHoliday = hSet.has(dateStr);

    const groups: Record<string, typeof workingEmployees> = {};
    workingEmployees.forEach(emp => {
        const hour = (emp.dailyHours?.[monthKey]?.[dayIdx]) || emp.workPeriod || '10h às 18h20';
        if (!groups[hour]) groups[hour] = [];
        groups[hour].push(emp);
    });

    const getHourStart = (h: string) => {
        const match = h.match(/^(\d+)/);
        return match ? parseInt(match[1]) : 0;
    };

    const sortedHours = Object.keys(groups).sort((a, b) => getHourStart(a) - getHourStart(b));
    const isSunday = d.getDay() === 0;
    const lunchSlots = calculateLunchSchedule(employees, dayIdx, isSunday, isHoliday, monthKey);
    
    const getLunchTime = (empId: string) => {
        const slot = lunchSlots.find(s => s.employees.some(e => e.id === empId));
        return slot ? slot.time : '';
    };
    
    const groupEmpsCount = { 'Abertura': 0, 'Intermediário': 0, 'Fechamento': 0 };
    sortedHours.forEach(h => {
        const start = getHourStart(h);
        const gl = start <= 10 ? 'Abertura' : (start >= 13 ? 'Fechamento' : 'Intermediário');
        groupEmpsCount[gl] += groups[h].length;
    });

    let rankAbertura = 1;
    let rankFechamento = 1;
    let rankIntermediario = 1;

    sortedHours.forEach((hour) => {
        const emps = [...groups[hour]].sort((a, b) => a.name.localeCompare(b.name));
        const start = getHourStart(hour);
        const groupLabel = start <= 10 ? 'Abertura' : (start >= 13 ? 'Fechamento' : 'Intermediário');
        const formattedHourRange = hour.replace(/:/g, 'h').replace(/h00\b/g, 'h');
        
        text += `⏰ ${groupLabel} ${formattedHourRange}\n`;
        emps.forEach(e => {
            const firstName = e.name.split(' ')[0];
            const formattedName = firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();
            const emojiMap: Record<string, string> = { 'P1': '🟦', 'P2': '🟩', 'P3': '🟧', 'P4': '🟪', 'P5+': '⬜', 'Estoque': '📦' };
            
            let posKey = e.preferredPositions?.[0] || e.tacticalPosition;
            if (!posKey || posKey === '') {
                if (e.cargo === 'Estoquista') {
                    posKey = 'Estoque';
                } else {
                    let rankRef = groupLabel === 'Abertura' ? rankAbertura : groupLabel === 'Fechamento' ? rankFechamento : rankIntermediario;
                    if (rankRef === 1) posKey = 'P1';
                    else if (rankRef === 2) posKey = 'P2';
                    else if (rankRef === 3) posKey = 'P3';
                    else if (rankRef === 4) posKey = 'P4';
                    else posKey = 'P5+';

                    if (groupLabel === 'Abertura') rankAbertura++;
                    else if (groupLabel === 'Fechamento') rankFechamento++;
                    else rankIntermediario++;
                }
            }
            
            const posEmoji = (emojiMap[posKey] || '') + ' ';
            const lunchTime = getLunchTime(e.id);
            const lunchText = lunchTime ? ` (almoço ${lunchTime})` : '';
            text += `${posEmoji}${formattedName}${lunchText}\n`;
        });
        text += `\n`;
    });

    const absences = employees.filter(e => {
        if (e.isHidden || e.status !== 'active') return false;
        let s = (e.shifts[monthKey] || [])[dayIdx] || 'F';
        const ds = `${currentMY.year}-${String(currentMY.month + 1).padStart(2, '0')}-${String(dayIdx + 1).padStart(2, '0')}`;
        if (e.vacationStart && e.vacationEnd && ds >= e.vacationStart && ds <= e.vacationEnd) s = 'FE';
        return s === 'F' || s === 'FF';
    });

    if (absences.length > 0) {
        text += `🏖️ Folga\n`;
        absences.forEach(a => {
            const name = a.name.split(' ')[0];
            const formattedName = name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
            text += `${formattedName}\n`;
        });
        text += `\n`;
    }

    if (workingEmployees.length === 0) {
        text = `📅 Escala - ${fullDayName}, ${dayIdx + 1} de ${monthName}\n\nNenhum colaborador escalado para este dia.`;
    }

    return text;
  };

  return { generateWhatsAppText };
};
