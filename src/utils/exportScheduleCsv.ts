import { Employee, MonthYear, JornadaSettings } from '../../types';
import { isEmployeeActiveInMonth, isEmployeeActiveOnDay, DEFAULT_JORNADA_SETTINGS } from '../../constants';
import { getShiftClassification, isWorkingShift } from '../../hooks/useScheduleEngine';

function escapeCSVField(value: string | number | undefined | null): string {
  if (value === undefined || value === null) return '';
  const str = String(value);
  if (str.includes(';') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

const MONTH_NAMES_PT = [
  'janeiro', 'fevereiro', 'marco', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
];

const WEEKDAY_NAMES = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];

/**
 * Gera o conteúdo em string CSV da escala para o mês selecionado,
 * preservando as colunas e as linhas exatamente como na grade e no formato histórico.
 */
export function generateScheduleCsvContent(
  employees: Employee[],
  currentMY: MonthYear,
  jornadaSettings: JornadaSettings = DEFAULT_JORNADA_SETTINGS
): string {
  const { year, month } = currentMY;
  const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Dias do mês
  const days = Array.from({ length: daysInMonth }, (_, i) => {
    const d = new Date(year, month, i + 1);
    const dow = d.getDay();
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`;
    return {
      num: i + 1,
      weekday: WEEKDAY_NAMES[dow],
      isSunday: dow === 0,
      dateStr,
    };
  });

  // Linha 1: Cabeçalho com dias numéricos (1, 2, 3...)
  const headerRow1 = [
    'Colaborador',
    'Função',
    'Turno',
    'Horário',
    ...days.map(d => String(d.num))
  ];

  // Linha 2: Cabeçalho com dias da semana (DOM, SEG, TER...)
  const headerRow2 = [
    '',
    '',
    '',
    '',
    ...days.map(d => d.weekday)
  ];

  // Agrupamento de colaboradores ativos por turno (Abertura, Intermediário, Fechamento, Folgas/Outros)
  const activeEmployees = employees.filter(e => isEmployeeActiveInMonth(e, year, month) && !e.isHidden && e.status === 'active');

  const groups: Record<string, Employee[]> = {
    'Abertura': [],
    'Intermediário': [],
    'Fechamento': [],
    'Folgas/Outros': []
  };

  activeEmployees.forEach(emp => {
    const hour = emp.workPeriod || '';
    const classification = getShiftClassification(hour, false, jornadaSettings);

    if (groups[classification]) {
      groups[classification].push(emp);
    } else {
      groups['Fechamento'].push(emp);
    }
  });

  const groupOrder = ['Abertura', 'Intermediário', 'Fechamento', 'Folgas/Outros'];
  const employeeRows: string[][] = [];

  groupOrder.forEach(groupName => {
    const list = groups[groupName] || [];
    // Ordena colaboradores por nome dentro de cada grupo
    list.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

    list.forEach(emp => {
      const row: string[] = [
        emp.name,
        emp.cargo || 'Atendente',
        groupName,
        emp.workPeriod || ''
      ];

      for (let dayIdx = 0; dayIdx < daysInMonth; dayIdx++) {
        const d = days[dayIdx];
        const isActiveOnDay = isEmployeeActiveOnDay(emp, d.dateStr, monthKey, dayIdx);

        if (!isActiveOnDay) {
          row.push('-');
          continue;
        }

        let rawShift = emp.shifts[monthKey]?.[dayIdx] || 'T';

        if (emp.hiredAt && d.dateStr < emp.hiredAt) {
          rawShift = 'N/A';
        } else if (emp.firedAt && d.dateStr > emp.firedAt) {
          rawShift = 'N/A';
        } else if (emp.atestadoStart && emp.atestadoEnd && d.dateStr >= emp.atestadoStart && d.dateStr <= emp.atestadoEnd) {
          rawShift = 'AT';
        } else if (emp.vacationStart && emp.vacationEnd && d.dateStr >= emp.vacationStart && d.dateStr <= emp.vacationEnd) {
          rawShift = 'FE';
        }

        let cellValue: string;
        if (rawShift === 'N/A') {
          cellValue = '-';
        } else if (rawShift === 'AT') {
          cellValue = 'AT';
        } else if (rawShift === 'FE') {
          cellValue = 'FE';
        } else if (rawShift === 'DO') {
          cellValue = 'DO';
        } else if (rawShift === 'C') {
          cellValue = 'C';
        } else if (rawShift === 'F') {
          cellValue = 'F';
        } else if (rawShift.startsWith('FF')) {
          cellValue = 'FF';
        } else if (isWorkingShift(rawShift)) {
          // Preserva posições táticas específicas como P1, PC, P2, P3, P4, ESTQ se definidas
          if (['P1', 'PC', 'P2', 'P3', 'P4', 'ESTQ'].includes(rawShift)) {
            cellValue = rawShift;
          } else {
            cellValue = 'T';
          }
        } else {
          cellValue = rawShift;
        }

        row.push(cellValue);
      }

      employeeRows.push(row);
    });
  });

  const allRows = [
    headerRow1,
    headerRow2,
    ...employeeRows
  ];

  const csvBody = allRows
    .map(row => row.map(escapeCSVField).join(';'))
    .join('\r\n');

  // Adiciona UTF-8 BOM (\uFEFF) para garantir abertura correta no Excel no Windows
  return `\uFEFF${csvBody}`;
}

/**
 * Dispara o download imediato do arquivo CSV gerado.
 */
export function downloadScheduleCsv(
  employees: Employee[],
  currentMY: MonthYear,
  jornadaSettings: JornadaSettings = DEFAULT_JORNADA_SETTINGS
): void {
  const csvContent = generateScheduleCsvContent(employees, currentMY, jornadaSettings);
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const monthName = MONTH_NAMES_PT[currentMY.month] || `mes_${currentMY.month + 1}`;
  const filename = `escala_rihappy_${monthName}_${currentMY.year}.csv`;

  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
