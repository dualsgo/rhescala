import { Employee, MonthYear, Holiday, JornadaSettings, TacticalDisplayMode } from '../../types';
import { buildHolidaySet, getDefaultHourForDay, DEFAULT_JORNADA_SETTINGS } from '../engine/config/schedule-constants';
import { isWorkingShift, getShiftClassification } from '../engine/shifts/shift-predicates';
import { resolveTacticalDay } from '../engine/tactical/tactical-positions';
import { getShortName } from '../../constants';

export interface GenerateOperationalNoticeParams {
  dayIdx: number;
  currentMY: MonthYear;
  employees: Employee[];
  customHolidays?: Holiday[];
  deletedNationalHolidays?: string[];
  tacticalDisplayMode?: TacticalDisplayMode;
  jornadaSettings?: JornadaSettings;
}

/**
 * Constrói o texto do roteiro de Apoio Operacional diário para compartilhamento no WhatsApp.
 * 
 * Função pura: não interage com clipboard, window ou APIs do navegador.
 * Apenas recebe os parâmetros de escala e retorna o texto formatado.
 */
export function generateOperationalNotice(params: GenerateOperationalNoticeParams): string {
  const {
    dayIdx,
    currentMY,
    employees,
    customHolidays = [],
    deletedNationalHolidays = [],
    tacticalDisplayMode = 'off',
    jornadaSettings = DEFAULT_JORNADA_SETTINGS,
  } = params;

  const monthKey = `${currentMY.year}-${String(currentMY.month + 1).padStart(2, '0')}`;
  const dateStr = `${currentMY.year}-${String(currentMY.month + 1).padStart(2, '0')}-${String(dayIdx + 1).padStart(2, '0')}`;
  const isHoliday = buildHolidaySet(currentMY.year, customHolidays, deletedNationalHolidays).has(dateStr);
  const date = new Date(currentMY.year, currentMY.month, dayIdx + 1);
  const isSunday = date.getDay() === 0;
  const isRoles = tacticalDisplayMode === 'roles';

  let text = `🛠️ *Apoio Operacional*\n\n`;

  text += `📍 *Funções Diárias (Correlatas)*\n`;
  text += isRoles ? `🟥 *Caixa*\n` : `🟥 *Caixa (P1)*\n`;
  text += `• Só deixa o posto quando houver rendição.\n`;
  text += `• Sem filas: não ficar parado. Adiantar saquinhos de presente e alinhar produtos próximos.\n\n`;

  text += isRoles ? `🟧 *Pacote*\n` : `🟧 *Pacote (P1)*\n`;
  text += `• Apoio direto no balcão de embrulhos e embalagens.\n`;
  text += `• Agilizar o fluxo do caixa nos horários de maior movimento.\n\n`;

  text += isRoles ? `🟨 *Reposição / Organização*\n` : `🟨 *Reposição / Organização (P2)*\n`;
  text += `• Organização das seções, reposição contínua e frenteamento de gôndolas.\n`;
  text += `• Quando assumir rendição, retornar imediatamente ao posto de origem depois.\n\n`;

  text += isRoles ? `🟩 *Vendas / Atendimento*\n` : `🟩 *Vendas / Atendimento (P3)*\n`;
  text += `• Largar qualquer tarefa de arrumação imediatamente se visualizar um cliente.\n`;
  text += `• Foco total em consultoria, demonstração de brinquedos e encantamento.\n\n`;

  text += isRoles ? `🟦 *Fiscal*\n` : `🟦 *Fiscal (Prevenção e Entrada)*\n`;
  text += `• Recepção acolhedora, porta de loja e prevenção de perdas.\n`;
  text += `• Apoio e suporte operacional nos momentos de alta demanda.\n\n`;

  text += `⚡ *Dança de Cobertura*\n`;
  text += isRoles
    ? `• Ida p/ Caixa: Fiscal > Vendas / Atendimento > Reposição (emergência extrema).\n• Retorno: Reposição > Vendas / Atendimento > Fiscal.\n\n`
    : `• Ida p/ Caixa: Vai o Fiscal > Vendas (P3) > Reposição (P2) (emergência extrema).\n• Retorno: P2 > P3 > Fiscal.\n\n`;

  const activeEmps = (employees || []).filter(e => e && !e.isHidden && e.status === 'active');
  const resolvedPositions = resolveTacticalDay(activeEmps, monthKey, dayIdx, isHoliday, isSunday, jornadaSettings);

  interface WorkingEmpInfo extends Employee {
    firstName: string;
    pos: string | null;
    shiftName: string;
  }

  const allWorkingEmps: WorkingEmpInfo[] = [];
  activeEmps.forEach(e => {
    const shift = e.shifts?.[monthKey]?.[dayIdx] || 'T';
    if (!isWorkingShift(shift)) return;
    const hour = e.dailyHours?.[monthKey]?.[dayIdx] || getDefaultHourForDay(e, isHoliday, isSunday);
    const shiftName = getShiftClassification(hour, isSunday, jornadaSettings);
    let pos = e.tacticalPositions?.[monthKey]?.[dayIdx];
    if (!pos || pos === 'AUTO') {
      pos = shift !== 'T' ? shift : resolvedPositions[e.id];
    }
    allWorkingEmps.push({ ...e, firstName: getShortName(e.name, activeEmps), pos, shiftName });
  });

  const p1Abertura = allWorkingEmps.find(e => (e.pos === 'P1' || e.pos === 'CX') && e.shiftName === 'Abertura');
  const p1Fechamento = allWorkingEmps.find(e => (e.pos === 'P1' || e.pos === 'CX') && e.shiftName !== 'Abertura');

  if (p1Abertura && p1Fechamento) {
    text += `🤝 *Revezamento (Caixa)*\n`;
    text += `• O(a) ${p1Fechamento.firstName} (Fechamento) rende o almoço do(a) ${p1Abertura.firstName} (Abertura). Quando o(a) ${p1Abertura.firstName} retornar, o(a) ${p1Fechamento.firstName} almoça.\n`;
    text += `• Quando ambos presentes, o(a) ${p1Abertura.firstName} tem prioridade no Caixa, e o(a) ${p1Fechamento.firstName} atua em Vendas/Atendimento.\n\n`;
  }

  text += `*Tempo Ocioso:* Caixa abastece o balcão/saquinhos. No salão, foquem em arrumar a seção e abastecer no baixo fluxo.\n`;

  // Legenda de Funções no rodapé do texto de Apoio
  text += `\n📋 🟥 Caixa · 🟧 Pacote · 🟨 Fiscal · 🟩 Vendas · 🟦 Apoio · 📦 Estoque\n`;

  return text;
}
