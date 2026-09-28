import { DEFAULT_JORNADA_SETTINGS } from '../config/schedule-constants';

export function calculateLunches(
    members: any[],
    isHoliday: boolean,
    isSunday: boolean,
    isOpening: boolean,
    settings: JornadaSettings = DEFAULT_JORNADA_SETTINGS
): string[] {
    if (!members || members.length === 0) return [];

    // 1. Feriados (Pausa flexível de 15 min escalonada de 15 em 15 min)
    if (isHoliday) {
        let holidayPauseIdx = 0;
        return members.map(m => {
            if (m?.isYoungApprentice || m?.cargo === 'Aprendiz') {
                return settings?.lunchRules?.apprentice || '12h45';
            }
            if (m?.cargo === 'Estoquista') {
                return 'Flexível';
            }
            // Exibe a pausa de 15 min de forma escalonada (ex: 14h30, 14h45, 15h00, 15h15...)
            const startMins = 14 * 60 + 30 + (holidayPauseIdx % 6) * 15;
            holidayPauseIdx++;
            const h = Math.floor(startMins / 60);
            const min = startMins % 60;
            const timeStr = `${h}h${min === 0 ? '' : min}`;
            return `${timeStr} (15 min)`;
        });
    }

    const results: string[] = Array(members.length).fill('');
    const allocatable: { member: any; index: number; startHour: number; isIntermediario: boolean }[] = [];

    // 2. Separar papéis especiais (Jovem Aprendiz = Fixo 12h45, Estoquista = Flexível)
    members.forEach((m, idx) => {
        if (!m) return;
        if (m.isYoungApprentice || m.cargo === 'Aprendiz') {
            results[idx] = settings?.lunchRules?.apprentice || '12h45';
        } else if (m.cargo === 'Estoquista') {
            results[idx] = 'Flexível';
        } else {
            const periodStr = m.workPeriod || m.dailyHours || m.hour || '';
            const match = String(periodStr).match(/^(\d{1,2})[h:]/);
            const startHour = match ? parseInt(match[1], 10) : (isOpening ? 10 : 13);
            const isIntermediario = startHour >= 11 && startHour <= 12;
            allocatable.push({ member: m, index: idx, startHour, isIntermediario });
        }
    });

    const N = allocatable.length;
    if (N === 0) return results;

    // 3. Domingos (Lógica Simplificada e Escalonada de Domingo)
    if (isSunday) {
        if (isOpening) {
            // Abertura no Domingo (12h às 20h):
            // Abrem 2 pessoas às 12h e vão juntas almoçar às 13h (retornam às 14h).
            // Para equipes sazonais (N > 2), agrupam em duplas (13h, 13h30).
            allocatable.forEach((item, i) => {
                const wave = Math.floor(i / 2);
                results[item.index] = wave === 0 ? (settings?.lunchRules?.sundayOpening || '13h') : '13h30';
            });
        } else {
            // Fechamento no Domingo (13h às 21h):
            // Após retorno da Abertura às 14h, vão um de cada vez (14h, 15h, 16h, 17h).
            // Com equipe sazonal maior (N > 4), evolui automaticamente para duplas (14h, 15h, 16h...).
            const sundaySlots = ['14h', '15h', '16h', '17h'];
            allocatable.forEach((item, i) => {
                const maxPerSlot = N <= 4 ? 1 : 2;
                const waveIndex = Math.floor(i / maxPerSlot);
                results[item.index] = sundaySlots[Math.min(waveIndex, sundaySlots.length - 1)];
            });
        }
        return results;
    }

    // 4. Dias de Semana (Turno Abertura vs Fechamento)
    if (isOpening) {
        // Abertura (10h às 18h20):
        // Slots disponíveis: 13h, 13h45, 14h
        allocatable.sort((a, b) => a.startHour - b.startHour);

        allocatable.forEach((item, i) => {
            if (N === 1) {
                results[item.index] = '14h';
            } else if (N === 2) {
                results[item.index] = (i === 0) ? '13h45' : '14h';
            } else if (N === 3) {
                if (i === 0) results[item.index] = '13h45';
                else results[item.index] = '14h';
            } else if (N === 4) {
                if (i === 0) results[item.index] = '13h';
                else if (i === 1) results[item.index] = '13h45';
                else results[item.index] = '14h';
            } else {
                // Para N >= 5 (Equipe com Sazonais)
                if (i < Math.ceil(N / 4)) results[item.index] = '13h';
                else if (i < Math.ceil(N / 2)) results[item.index] = '13h45';
                else results[item.index] = '14h';
            }
        });
    } else {
        // Fechamento / Intermediário (13h40 às 22h, 12h às 20h20):
        // Entram às 13h40 -> almoçam a partir das 15h.
        // Slots: 15h, 15h30, 16h, 16h30, 17h
        allocatable.sort((a, b) => {
            if (a.isIntermediario && !b.isIntermediario) return -1;
            if (!a.isIntermediario && b.isIntermediario) return 1;
            return a.startHour - b.startHour;
        });

        const closingSlots = ['15h', '15h30', '16h', '16h30', '17h'];

        allocatable.forEach((item, i) => {
            if (N <= 5) {
                // 1 por slot para máxima cobertura sem sobreposição
                results[item.index] = closingSlots[i] || closingSlots[closingSlots.length - 1];
            } else {
                // Equipe sazonal maior (N > 5): 2 por slot em ondas escalonadas
                const waveIndex = Math.floor(i / 2);
                results[item.index] = closingSlots[Math.min(waveIndex, closingSlots.length - 1)];
            }
        });
    }

    return results;
}
