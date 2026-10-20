import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Employee, MonthYear, Holiday, JornadaSettings, TacticalDisplayMode, EmployeeRole, EMPLOYEE_ROLES, ROLE_METADATA_MAP, normalizeEmployeeRole } from '../types';
import { Icon } from './Icon';
import { useDialog } from '../contexts/DialogContext';
import { copyToClipboard } from '../src/utils/clipboard';
import { 
  buildHolidaySet, 
  getDefaultHourForDay, 
  getShortName, 
  getTacticalEmoji, 
  getTacticalLabel, 
  isEmployeeActiveInMonth 
} from '../constants';
import { isWorkingShift, getShiftClassification } from '../src/engine/shifts/shift-predicates';
import { 
  calculateLunches, 
  resolveTacticalDay 
} from '../hooks/useScheduleEngine';

interface DailyScheduleModulatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  dayIdx: number;
  currentMY: MonthYear;
  employees: Employee[];
  customHolidays: Holiday[];
  deletedNationalHolidays?: string[];
  jornadaSettings: JornadaSettings;
  tacticalDisplayMode?: TacticalDisplayMode;
  onSaveDayPositions?: (dayIdx: number, positions: Record<string, string>) => void;
}

interface ModulatorItem {
  id: string;
  name: string;
  firstName: string;
  hour: string;
  shiftName: string;
  lunch: string;
  pos: string;
  posEmoji: string;
  included: boolean;
}

interface StatusItem {
  id: string;
  name: string;
  detail?: string;
  included: boolean;
}

const COMMON_LUNCH_TIMES = [
  '11h30', '12h', '12h30', '13h', '13h30', '14h', '14h30', 
  '15h', '15h30', '16h', '16h30', '17h', '17h30', '18h'
];

const TACTICAL_POSITIONS: EmployeeRole[] = EMPLOYEE_ROLES;

export const DailyScheduleModulatorModal: React.FC<DailyScheduleModulatorModalProps> = ({
  isOpen,
  onClose,
  dayIdx,
  currentMY,
  employees,
  customHolidays,
  deletedNationalHolidays = [],
  jornadaSettings,
  tacticalDisplayMode = 'positions',
  onSaveDayPositions,
}) => {
  const { showDialog } = useDialog();
  const monthKey = `${currentMY.year}-${String(currentMY.month + 1).padStart(2, '0')}`;

  // Tab for mobile view
  const [activeMobileTab, setActiveMobileTab] = useState<'modulator' | 'preview'>('modulator');

  // Modulated State
  const [items, setItems] = useState<ModulatorItem[]>([]);
  const [folgas, setFolgas] = useState<StatusItem[]>([]);
  const [atestados, setAtestados] = useState<StatusItem[]>([]);
  const [digital1Id, setDigital1Id] = useState<string>('');
  const [digital2Id, setDigital2Id] = useState<string>('');
  const [retirada1Id, setRetirada1Id] = useState<string>('');
  const [retirada2Id, setRetirada2Id] = useState<string>('');
  
  // Extra block toggles
  const [showLunches, setShowLunches] = useState(true);
  const [showPositions, setShowPositions] = useState(true);
  const [showFolgas, setShowFolgas] = useState(true);
  const [showAtestados, setShowAtestados] = useState(true);
  const [showDigital, setShowDigital] = useState(true);
  const [showRetiradas, setShowRetiradas] = useState(true);
  const [showHolidayNotice, setShowHolidayNotice] = useState(true);
  const [showLegend, setShowLegend] = useState(true);
  const [customNote, setCustomNote] = useState('');

  // Free text override (optional user manual edit)
  const [isFreeTextMode, setIsFreeTextMode] = useState(false);
  const [manualText, setManualText] = useState('');
  const [isCopied, setIsCopied] = useState(false);

  // Date Information
  const dateInfo = useMemo(() => {
    const weekdaysFull = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    const date = new Date(currentMY.year, currentMY.month, dayIdx + 1);
    const weekdayName = weekdaysFull[date.getDay()];
    const dateFormatted = `${String(dayIdx + 1).padStart(2, '0')}/${String(currentMY.month + 1).padStart(2, '0')}`;
    const dateStr = `${currentMY.year}-${String(currentMY.month + 1).padStart(2, '0')}-${String(dayIdx + 1).padStart(2, '0')}`;
    const isHoliday = buildHolidaySet(currentMY.year, customHolidays, deletedNationalHolidays).has(dateStr);
    const isSunday = date.getDay() === 0;

    return { date, weekdayName, dateFormatted, dateStr, isHoliday, isSunday };
  }, [currentMY, dayIdx, customHolidays, deletedNationalHolidays]);

  // Initial Calculation from System Logic
  const computeInitialState = useCallback(() => {
    const { isHoliday, isSunday } = dateInfo;
    const activeEmps = (employees || []).filter(e => isEmployeeActiveInMonth(e, currentMY.year, currentMY.month));
    const resolvedPositions = resolveTacticalDay(activeEmps, monthKey, dayIdx, isHoliday, isSunday, jornadaSettings);

    const initialFolgas: StatusItem[] = [];
    const initialAtestados: StatusItem[] = [];
    const initialGroups: Record<string, any[]> = {};

    activeEmps.forEach(e => {
      const shift = e.shifts?.[monthKey]?.[dayIdx] || 'T';

      if (shift === 'F' || (typeof shift === 'string' && shift.startsWith('FF'))) {
        initialFolgas.push({
          id: e.id,
          name: getShortName(e.name, activeEmps),
          detail: shift,
          included: true
        });
        return;
      }

      if (shift === 'AT') {
        initialAtestados.push({
          id: e.id,
          name: getShortName(e.name, activeEmps),
          included: true
        });
        return;
      }

      if (!isWorkingShift(shift)) return;

      const hour = e.dailyHours?.[monthKey]?.[dayIdx] || getDefaultHourForDay(e, isHoliday, isSunday);
      const savedPos = e.tacticalPositions?.[monthKey]?.[dayIdx];
      const pos = savedPos && savedPos !== 'AUTO'
        ? normalizeEmployeeRole(savedPos)
        : (resolvedPositions[e.id] || normalizeEmployeeRole(e.cargo || e.role));
      const posEmoji = getTacticalEmoji(pos);

      if (!initialGroups[hour]) initialGroups[hour] = [];
      initialGroups[hour].push({ ...e, firstName: getShortName(e.name, activeEmps), posEmoji, pos });
    });

    const hourOrder = isHoliday ? ['12h às 18h', '13h às 19h', '14h às 20h', '15h às 21h'] : 
                      isSunday ? ['12h às 20h', '13h às 21h'] :
                      ['10h às 16h15', '10h às 18h20', '12h às 20h20', '13h40 às 22h'];

    const sortedHours = Object.keys(initialGroups).sort((a, b) => {
      const idxA = hourOrder.indexOf(a);
      const idxB = hourOrder.indexOf(b);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      return a.localeCompare(b);
    });

    // Coleta todos os colaboradores trabalhando hoje para cálculo coordenado de almoços
    const allMembersFlat: any[] = [];
    sortedHours.forEach(hour => {
      initialGroups[hour].forEach((m: any) => {
        allMembersFlat.push({ ...m, hour });
      });
    });

    const calculatedLunches = calculateLunches(
      allMembersFlat,
      isHoliday,
      isSunday,
      undefined,
      jornadaSettings
    ) || [];

    const memberLunchMap = new Map<string, string>();
    allMembersFlat.forEach((m, idx) => {
      memberLunchMap.set(m.id, calculatedLunches[idx] || '13h');
    });

    const initialItems: ModulatorItem[] = [];

    sortedHours.forEach(hour => {
      const members = initialGroups[hour];
      const shiftName = getShiftClassification(hour, isSunday, jornadaSettings);

      members.forEach((m) => {
        const lunchTime = memberLunchMap.get(m.id) || '13h';
        initialItems.push({
          id: m.id,
          name: m.name,
          firstName: m.firstName,
          hour,
          shiftName,
          lunch: lunchTime,
          pos: m.pos,
          posEmoji: m.posEmoji,
          included: true
        });
      });
    });

    // Pick Digitals and Retiradas
    const empsWithPos = initialItems.map(item => ({
      id: item.id,
      name: item.name,
      shiftName: item.shiftName,
      pos: item.pos
    }));

    const getPriority = (pos: string) => {
      if (pos === 'Vendas') return 1;
      if (pos === 'Caixa') return 2;
      if (pos === 'Fiscal') return 3;
      if (pos === 'Apoio') return 4;
      return 5;
    };

    const pickDigital = (group: any[], excludeIds: string[] = [], seedOffset: number = 0) => {
      let available = group.filter(e => !excludeIds.includes(e.id));
      if (available.length === 0) available = group;
      if (available.length === 0) return null;
      const minPriority = Math.min(...available.map(e => getPriority(e.pos)));
      const candidates = available.filter(e => getPriority(e.pos) === minPriority);
      candidates.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      const digitalIdx = (dayIdx * 7 + currentMY.month * 11 + seedOffset) % Math.max(1, candidates.length);
      return candidates[digitalIdx];
    };

    const turno1 = empsWithPos.filter(e => e.shiftName === 'Abertura');
    const turno2 = empsWithPos.filter(e => e.shiftName !== 'Abertura');

    let digital1 = pickDigital(turno1);
    let digital2 = pickDigital(turno2);
    if (!digital1 && turno2.length > 1) {
      const remaining = turno2.filter(e => e.id !== digital2?.id);
      digital1 = pickDigital(remaining);
    } else if (!digital2 && turno1.length > 1) {
      const remaining = turno1.filter(e => e.id !== digital1?.id);
      digital2 = pickDigital(remaining);
    }

    const excludeForRetiradas = [digital1?.id, digital2?.id].filter(Boolean) as string[];
    let retirada1 = pickDigital(turno1, excludeForRetiradas, 3);
    let retirada2 = pickDigital(turno2, excludeForRetiradas, 3);
    if (!retirada1 && turno2.length > 1) {
      const remaining = turno2.filter(e => e.id !== retirada2?.id);
      retirada1 = pickDigital(remaining, excludeForRetiradas, 3);
    } else if (!retirada2 && turno1.length > 1) {
      const remaining = turno1.filter(e => e.id !== retirada1?.id);
      retirada2 = pickDigital(remaining, excludeForRetiradas, 3);
    }

    setItems(initialItems);
    setFolgas(initialFolgas);
    setAtestados(initialAtestados);
    setDigital1Id(digital1?.id || '');
    setDigital2Id(digital2?.id || '');
    setRetirada1Id(retirada1?.id || '');
    setRetirada2Id(retirada2?.id || '');
    setShowHolidayNotice(isHoliday);
    setShowLegend(true);
    setCustomNote('');
    setIsFreeTextMode(false);
  }, [dateInfo, employees, monthKey, dayIdx, jornadaSettings, currentMY.month]);

  // Recompute when opened or dayIdx changes
  useEffect(() => {
    if (isOpen) {
      computeInitialState();
    }
  }, [isOpen, dayIdx, computeInitialState]);

  // Distribuição Automática de Funções e Horários de Almoço
  const handleAutoDistribute = useCallback(async () => {
    const { isHoliday, isSunday } = dateInfo;
    const activeEmps = (employees || []).filter(e => isEmployeeActiveInMonth(e, currentMY.year, currentMY.month));

    // Apenas colaboradores que estão incluídos e trabalhando
    const includedEmpIds = new Set(items.filter(it => it.included).map(it => it.id));
    const workingEmps = activeEmps.filter(e => includedEmpIds.has(e.id));

    if (workingEmps.length === 0) {
      await showDialog({
        title: 'Nenhum Colaborador',
        message: 'Não há colaboradores marcados como presentes para distribuir funções e almoço.',
        type: 'alert'
      });
      return;
    }

    // Forçar cálculo autônomo de posições para os colaboradores presentes (sem travar em manual)
    const empsForResolve = workingEmps.map(e => ({
      ...e,
      tacticalPositions: {
        ...e.tacticalPositions,
        [monthKey]: []
      }
    }));

    const resolvedPositions = resolveTacticalDay(empsForResolve, monthKey, dayIdx, isHoliday, isSunday, jornadaSettings);

    // Preparar lista plana com as horas e novas funções para o calculateLunches
    const updatedMembersFlat = items.filter(it => it.included).map(it => {
      const newPos = resolvedPositions[it.id] || it.pos || 'Vendas';
      return {
        ...it,
        pos: newPos,
        cargo: newPos,
        role: newPos,
      };
    });

    const calculatedLunches = calculateLunches(
      updatedMembersFlat,
      isHoliday,
      isSunday,
      undefined,
      jornadaSettings
    ) || [];

    const memberLunchMap = new Map<string, string>();
    updatedMembersFlat.forEach((m, idx) => {
      memberLunchMap.set(m.id, calculatedLunches[idx] || m.lunch || '13h');
    });

    const newItems = items.map(it => {
      if (!it.included) return it;
      const newPos = resolvedPositions[it.id] || it.pos || 'Vendas';
      const newEmoji = getTacticalEmoji(newPos);
      const newLunch = memberLunchMap.get(it.id) || it.lunch;
      return {
        ...it,
        pos: newPos,
        posEmoji: newEmoji,
        lunch: newLunch
      };
    });

    setItems(newItems);

    // Salvar posições distribuídas na base se callback fornecido
    if (onSaveDayPositions) {
      const posMap: Record<string, string> = {};
      newItems.forEach(it => {
        if (it.pos) posMap[it.id] = it.pos;
      });
      onSaveDayPositions(dayIdx, posMap);
    }

    await showDialog({
      title: 'Funções e Almoço Distribuídos!',
      message: 'As funções operacionais (Caixa, Pacote, Vendas, Apoio, Fiscal e Estoque) e os intervalos de almoço foram balanceados e escalonados automaticamente para a equipe presente.'
    });
  }, [dateInfo, employees, currentMY, items, monthKey, dayIdx, jornadaSettings, onSaveDayPositions, showDialog]);

  // Real-Time Generated Text Builder
  const generatedText = useMemo(() => {
    if (isFreeTextMode) return manualText;

    const { weekdayName, dateFormatted, isHoliday } = dateInfo;

    let text = `📅 *Escala ${weekdayName} ${dateFormatted}*\n`;
    if (isHoliday) {
      text += `⏱️ Jornada 5h45 + 15 min. pausa\n`;
    }
    text += `\n`;

    // Group items by hour
    const includedItems = items.filter(it => it.included);
    const groups: Record<string, ModulatorItem[]> = {};

    includedItems.forEach(item => {
      if (!groups[item.hour]) groups[item.hour] = [];
      groups[item.hour].push(item);
    });

    Object.keys(groups).forEach(hour => {
      const members = groups[hour];
      const shiftName = members[0]?.shiftName || 'Turno';

      text += `⏰ *${shiftName} ${hour}*\n`;
      members.forEach(m => {
        const posStr = showPositions ? `${m.posEmoji} ` : '';
        const lunchStr = showLunches && m.lunch ? ` (almoço ${m.lunch})` : '';
        text += `${posStr}${m.firstName}${lunchStr}\n`;
      });
      text += '\n';
    });

    // Folgas
    const activeFolgas = folgas.filter(f => f.included);
    if (showFolgas && activeFolgas.length > 0) {
      text += `Folgas: ${activeFolgas.map(f => `${f.name}${f.detail ? ` (${f.detail})` : ''}`).join(', ')}\n`;
    }

    // Atestados
    const activeAtestados = atestados.filter(a => a.included);
    if (showAtestados && activeAtestados.length > 0) {
      text += `🩺 Atestados: ${activeAtestados.map(a => a.name).join(', ')}\n`;
    }

    // Digital
    if (showDigital) {
      const d1 = items.find(i => i.id === digital1Id && i.included);
      const d2 = items.find(i => i.id === digital2Id && i.included);
      text += `\n📱 *Digital (WhatsApp da Loja)*\n`;
      if (d1 || d2) {
        if (d1) text += `• ${d1.shiftName}: ${d1.firstName}\n`;
        if (d2 && d2.id !== d1?.id) text += `• ${d2.shiftName}: ${d2.firstName}\n`;
      } else {
        text += `• Responsável: Não definido\n`;
      }
    }

    // Retiradas Online
    if (showRetiradas) {
      const r1 = items.find(i => i.id === retirada1Id && i.included);
      const r2 = items.find(i => i.id === retirada2Id && i.included);
      text += `\n🛍️ *Retiradas Online*\n`;
      if (r1 || r2) {
        if (r1) text += `• ${r1.shiftName}: ${r1.firstName}\n`;
        if (r2 && r2.id !== r1?.id) text += `• ${r2.shiftName}: ${r2.firstName}\n`;
      } else {
        text += `• Responsável: Não definido\n`;
      }
    }

    // Holiday Notice
    if (isHoliday && showHolidayNotice) {
      text += `\n⚠️ *Aviso:* Pausa para almoço 1 colaborador por vez. Saída permitida somente após o retorno do outro. Primeira saída 14h30\n`;
    }

    // Custom Note
    if (customNote.trim()) {
      text += `\n📝 *Observação:*\n${customNote.trim()}\n`;
    }

    // Legenda de Funções
    if (showLegend && showPositions) {
      text += `\n📋 🟥 Caixa · 🟧 Pacote · 🟨 Fiscal · 🟩 Vendas · 🟦 Apoio · 📦 Estoque\n`;
    }

    return text;
  }, [
    items, folgas, atestados, digital1Id, digital2Id, retirada1Id, retirada2Id,
    showLunches, showPositions, showFolgas, showAtestados, showDigital, showRetiradas,
    showHolidayNotice, showLegend, customNote, isFreeTextMode, manualText, dateInfo
  ]);

  // Keep manual text in sync when switching to free text
  const handleToggleFreeText = () => {
    if (!isFreeTextMode) {
      setManualText(generatedText);
      setIsFreeTextMode(true);
    } else {
      setIsFreeTextMode(false);
    }
  };

  // Copy action with user feedback
  const handleCopy = async () => {
    // Save modulated operational positions for this day without altering shifts base
    if (onSaveDayPositions) {
      const posMap: Record<string, string> = {};
      items.forEach(it => {
        if (it.pos) posMap[it.id] = it.pos;
      });
      onSaveDayPositions(dayIdx, posMap);
    }

    const textToCopy = isFreeTextMode ? manualText : generatedText;
    const copied = await copyToClipboard(textToCopy);
    if (copied) {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2500);
      await showDialog({
        title: 'Escala Copiada!',
        message: 'O texto formatado da escala foi copiado para a área de transferência. Você já pode colá-lo no grupo do WhatsApp da loja.'
      });
      onClose();
    } else {
      await showDialog({
        title: 'Cópia Manual',
        message: 'Não foi possível copiar automaticamente para a área de transferência. Por favor, selecione e copie o texto exibido na pré-visualização.',
        type: 'alert'
      });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-2 sm:p-4 md:p-6 bg-zinc-950/70 backdrop-blur-md animate-fade-in">
      <div className="bg-white dark:bg-zinc-900 rounded-3xl max-w-6xl w-full h-[94vh] max-h-[900px] shadow-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden flex flex-col">
        
        {/* Header Bar */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between bg-slate-50/80 dark:bg-zinc-900/90 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-emerald-100 text-emerald-600 dark:bg-emerald-950/80 dark:text-emerald-400 flex items-center justify-center shadow-sm shrink-0">
              <Icon name="chat" className="text-xl sm:text-2xl" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-zinc-100 tracking-tight uppercase">
                  Modulador da Escala Diária
                </h3>
                <span className="hidden sm:inline-block px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                  WhatsApp
                </span>
              </div>
              <p className="text-[11px] font-bold text-slate-500 dark:text-zinc-400 mt-0.5">
                {dateInfo.weekdayName}, {dateInfo.dateFormatted} {dateInfo.isHoliday ? '• Feriado (5h45)' : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Mobile View Toggle */}
            <div className="flex md:hidden bg-slate-200 dark:bg-zinc-800 p-0.5 rounded-xl">
              <button
                type="button"
                onClick={() => setActiveMobileTab('modulator')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all ${
                  activeMobileTab === 'modulator'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-zinc-400'
                }`}
              >
                ⚙️ Modular
              </button>
              <button
                type="button"
                onClick={() => setActiveMobileTab('preview')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all ${
                  activeMobileTab === 'preview'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-zinc-400'
                }`}
              >
                👁️ Ver Texto
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 hover:bg-slate-200/70 dark:hover:bg-zinc-800 rounded-full text-slate-400 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-200 transition-colors"
              title="Fechar"
            >
              <Icon name="close" className="text-xl" />
            </button>
          </div>
        </div>

        {/* Modal Body: 2 Columns on Desktop */}
        <div className="flex-1 min-h-0 overflow-hidden grid grid-cols-1 md:grid-cols-12">
          
          {/* Column 1: Modulation Controls (Desktop: 7 cols) */}
          <div className={`md:col-span-7 h-full min-h-0 overflow-y-auto custom-scrollbar p-4 sm:p-6 space-y-6 pb-12 border-r border-slate-100 dark:border-zinc-800 ${
            activeMobileTab === 'preview' ? 'hidden md:block' : 'block'
          }`}>
            
            {/* Quick Action Helper Banner */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-gradient-to-r from-orange-50/80 to-amber-50/60 dark:from-orange-950/20 dark:to-amber-950/20 border border-orange-200/60 dark:border-orange-900/40 text-orange-900 dark:text-orange-200 shadow-xs">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-orange-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <Icon name="auto_awesome" className="text-base" />
                </div>
                <div>
                  <span className="text-xs font-black uppercase tracking-wider block">
                    Distribuição Inteligente de Turno
                  </span>
                  <span className="text-[11px] font-normal text-zinc-500 dark:text-zinc-400 block">
                    Aloca funções balanceadas e escala intervalos de almoço com trava CLT.
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleAutoDistribute}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-orange-500 hover:bg-orange-600 active:scale-95 text-white text-[11px] font-black uppercase tracking-wider shadow-sm transition-all cursor-pointer"
                  title="Distribuir postos de trabalho e horários de almoço automaticamente com inteligência de cobertura"
                >
                  <Icon name="magic_button" className="text-sm" />
                  <span>Distribuir Funções & Almoço</span>
                </button>

                <button
                  type="button"
                  onClick={computeInitialState}
                  className="px-2.5 py-1.5 rounded-xl bg-zinc-200/70 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-[11px] font-black uppercase tracking-wider transition-colors cursor-pointer"
                  title="Redefinir todas as alterações para a sugestão calculada automaticamente"
                >
                  Restaurar
                </button>
              </div>
            </div>

            {/* Secao 1: Colaboradores e Horários de Almoço */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Icon name="schedule" className="text-emerald-600 text-base" />
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-zinc-200">
                    Colaboradores Escalados ({items.filter(i => i.included).length}/{items.length})
                  </h4>
                </div>
                
                <label className="flex items-center gap-2 cursor-pointer select-none text-[11px] font-bold text-slate-600 dark:text-zinc-400">
                  <input
                    type="checkbox"
                    checked={showLunches}
                    onChange={(e) => setShowLunches(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 rounded-sm"
                  />
                  <span>Exibir Almoços</span>
                </label>
              </div>

              {items.length === 0 ? (
                <div className="p-4 rounded-xl border border-dashed border-slate-200 dark:border-zinc-800 text-center text-xs text-slate-400">
                  Nenhum colaborador escalado para trabalhar neste dia.
                </div>
              ) : (
                <div className="space-y-2">
                  {items.map((item) => (
                    <div
                      key={item.id}
                      className={`p-3 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        item.included
                          ? 'bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 shadow-sm'
                          : 'bg-slate-50 dark:bg-zinc-950/60 border-slate-200/50 dark:border-zinc-900 opacity-50'
                      }`}
                    >
                      {/* Checkbox + Nome */}
                      <div className="flex items-center gap-2.5 min-w-[160px]">
                        <input
                          type="checkbox"
                          checked={item.included}
                          onChange={(e) => {
                            const newIncluded = e.target.checked;
                            setItems(prev => prev.map(it => it.id === item.id ? { ...it, included: newIncluded } : it));
                          }}
                          className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                        />
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-black text-slate-900 dark:text-zinc-100">
                              {item.firstName}
                            </span>
                            <span className="text-[11px] text-slate-400 font-bold">
                              ({item.shiftName})
                            </span>
                          </div>
                          <span className="text-[11px] text-slate-400 block">
                            {item.hour}
                          </span>
                        </div>
                      </div>

                      {/* Controles de Modulação: Função e Almoço */}
                      {item.included && (
                        <div className="flex items-center gap-2 flex-wrap">
                          {/* Função na Loja */}
                          <div className="flex items-center gap-1 bg-slate-100 dark:bg-zinc-800 px-2 py-1 rounded-xl border border-slate-200 dark:border-zinc-700">
                            <span className="text-xs">{item.posEmoji}</span>
                            <select
                              value={item.pos}
                              onChange={(e) => {
                                const newPos = e.target.value;
                                const newEmoji = getTacticalEmoji(newPos);
                                setItems(prev => prev.map(it => it.id === item.id ? { ...it, pos: newPos, posEmoji: newEmoji } : it));
                              }}
                              className="bg-transparent text-[11px] font-black uppercase text-slate-800 dark:text-zinc-200 outline-none cursor-pointer"
                              title="Alterar função na loja"
                            >
                              {TACTICAL_POSITIONS.map(pos => (
                                <option key={pos} value={pos}>
                                  {pos} ({ROLE_METADATA_MAP[pos].code})
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Horário de Almoço */}
                          {showLunches && (
                            <div className="flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-xl border border-emerald-200 dark:border-emerald-900/50">
                              <Icon name="restaurant" className="text-xs text-emerald-600 dark:text-emerald-400" />
                              <span className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300">
                                Almoço:
                              </span>
                              <select
                                value={item.lunch}
                                onChange={(e) => {
                                  const newLunch = e.target.value;
                                  setItems(prev => prev.map(it => it.id === item.id ? { ...it, lunch: newLunch } : it));
                                }}
                                className="bg-transparent text-[11px] font-black text-emerald-900 dark:text-emerald-200 outline-none cursor-pointer"
                              >
                                {COMMON_LUNCH_TIMES.map(lt => (
                                  <option key={lt} value={lt}>{lt}</option>
                                ))}
                              </select>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Secao 2: Responsabilidades Especiais (Digital e Retiradas) */}
            <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Icon name="storefront" className="text-indigo-600 text-base" />
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-zinc-200">
                    Responsabilidades da Operação
                  </h4>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* WhatsApp Digital */}
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-800/60 border border-slate-200/60 dark:border-zinc-700/60 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={showDigital}
                        onChange={(e) => setShowDigital(e.target.checked)}
                        className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                      />
                      <span className="text-xs font-black text-slate-800 dark:text-zinc-200">
                        📱 Digital (WhatsApp)
                      </span>
                    </label>
                  </div>

                  {showDigital && (
                    <div className="space-y-1.5 pt-1">
                      <div>
                        <span className="text-[11px] font-black uppercase text-slate-400 block mb-0.5">Turno 1 / Abertura:</span>
                        <select
                          value={digital1Id}
                          onChange={(e) => setDigital1Id(e.target.value)}
                          className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg px-2 py-1 text-xs font-bold text-slate-800 dark:text-zinc-200 outline-none"
                        >
                          <option value="">Não definido</option>
                          {items.filter(i => i.included).map(i => (
                            <option key={i.id} value={i.id}>{i.firstName} ({i.shiftName})</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <span className="text-[11px] font-black uppercase text-slate-400 block mb-0.5">Turno 2 / Fechamento:</span>
                        <select
                          value={digital2Id}
                          onChange={(e) => setDigital2Id(e.target.value)}
                          className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg px-2 py-1 text-xs font-bold text-slate-800 dark:text-zinc-200 outline-none"
                        >
                          <option value="">Não definido</option>
                          {items.filter(i => i.included).map(i => (
                            <option key={i.id} value={i.id}>{i.firstName} ({i.shiftName})</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}
                </div>

                {/* Retiradas Online */}
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-800/60 border border-slate-200/60 dark:border-zinc-700/60 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={showRetiradas}
                        onChange={(e) => setShowRetiradas(e.target.checked)}
                        className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                      />
                      <span className="text-xs font-black text-slate-800 dark:text-zinc-200">
                        🛍️ Retiradas Online
                      </span>
                    </label>
                  </div>

                  {showRetiradas && (
                    <div className="space-y-1.5 pt-1">
                      <div>
                        <span className="text-[11px] font-black uppercase text-slate-400 block mb-0.5">Turno 1 / Abertura:</span>
                        <select
                          value={retirada1Id}
                          onChange={(e) => setRetirada1Id(e.target.value)}
                          className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg px-2 py-1 text-xs font-bold text-slate-800 dark:text-zinc-200 outline-none"
                        >
                          <option value="">Não definido</option>
                          {items.filter(i => i.included).map(i => (
                            <option key={i.id} value={i.id}>{i.firstName} ({i.shiftName})</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <span className="text-[11px] font-black uppercase text-slate-400 block mb-0.5">Turno 2 / Fechamento:</span>
                        <select
                          value={retirada2Id}
                          onChange={(e) => setRetirada2Id(e.target.value)}
                          className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg px-2 py-1 text-xs font-bold text-slate-800 dark:text-zinc-200 outline-none"
                        >
                          <option value="">Não definido</option>
                          {items.filter(i => i.included).map(i => (
                            <option key={i.id} value={i.id}>{i.firstName} ({i.shiftName})</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Secao 3: Blocos Extras & Informações Complementares */}
            <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-sm space-y-3">
              <div className="flex items-center gap-2">
                <Icon name="extension" className="text-orange-500 text-base" />
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-zinc-200">
                  Blocos Opcionais do Comunicado
                </h4>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1">
                <label className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 dark:bg-zinc-800/60 border border-slate-200/60 dark:border-zinc-700/60 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={showPositions}
                    onChange={(e) => setShowPositions(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="text-xs font-bold text-slate-700 dark:text-zinc-300">🏷️ Funções da Equipe</span>
                </label>

                <label className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 dark:bg-zinc-800/60 border border-slate-200/60 dark:border-zinc-700/60 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={showLegend}
                    onChange={(e) => setShowLegend(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="text-xs font-bold text-slate-700 dark:text-zinc-300">📋 Legenda de Funções</span>
                </label>

                <label className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 dark:bg-zinc-800/60 border border-slate-200/60 dark:border-zinc-700/60 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={showFolgas}
                    onChange={(e) => setShowFolgas(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="text-xs font-bold text-slate-700 dark:text-zinc-300">🏖️ Folgas ({folgas.length})</span>
                </label>

                <label className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 dark:bg-zinc-800/60 border border-slate-200/60 dark:border-zinc-700/60 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={showAtestados}
                    onChange={(e) => setShowAtestados(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="text-xs font-bold text-slate-700 dark:text-zinc-300">🩺 Atestados ({atestados.length})</span>
                </label>

                {dateInfo.isHoliday && (
                  <label className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 dark:bg-zinc-800/60 border border-slate-200/60 dark:border-zinc-700/60 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={showHolidayNotice}
                      onChange={(e) => setShowHolidayNotice(e.target.checked)}
                      className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="text-xs font-bold text-slate-700 dark:text-zinc-300">⚠️ Aviso Almoço</span>
                  </label>
                )}
              </div>

              {/* Custom Note Field */}
              <div className="pt-2">
                <label className="text-[11px] font-black uppercase text-slate-400 block mb-1">
                  Observação Adicional (Opcional):
                </label>
                <input
                  type="text"
                  value={customNote}
                  onChange={(e) => setCustomNote(e.target.value)}
                  placeholder="Ex: Foco no setor de Bebês hoje; conferência de etiquetas..."
                  className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-zinc-200 outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* Column 2: Live Preview (Desktop: 5 cols) */}
          <div className={`md:col-span-5 h-full min-h-0 flex flex-col bg-slate-50/50 dark:bg-zinc-950/50 ${
            activeMobileTab === 'modulator' ? 'hidden md:flex' : 'flex'
          }`}>
            {/* Preview Header */}
            <div className="p-4 border-b border-slate-200/70 dark:border-zinc-800 flex items-center justify-between bg-white dark:bg-zinc-900 shrink-0">
              <div className="flex items-center gap-2">
                <Icon name="visibility" className="text-emerald-600 text-sm" />
                <span className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-zinc-200">
                  Pré-visualização Dinâmica
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleToggleFreeText}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[11px] font-black uppercase tracking-wider transition-all ${
                    isFreeTextMode
                      ? 'bg-amber-500 text-white border-amber-500 shadow-xs'
                      : 'bg-white dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-300 hover:bg-slate-50'
                  }`}
                  title={isFreeTextMode ? 'Voltar para o modo de modulação automática' : 'Permitir digitação direta no texto'}
                >
                  <Icon name={isFreeTextMode ? 'lock_open' : 'edit_note'} className="text-xs" />
                  <span>{isFreeTextMode ? 'Edição Livre' : 'Editar Texto'}</span>
                </button>
              </div>
            </div>

            {/* Preview Content Area */}
            <div className="flex-1 min-h-0 p-4 overflow-y-auto custom-scrollbar">
              {isFreeTextMode ? (
                <textarea
                  value={manualText}
                  onChange={(e) => setManualText(e.target.value)}
                  className="w-full h-full min-h-0 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-2xl p-4 text-xs font-mono font-medium focus:ring-2 focus:ring-emerald-500 outline-none resize-none text-slate-800 dark:text-zinc-200 leading-relaxed custom-scrollbar shadow-inner"
                  placeholder="Edite o texto diretamente aqui..."
                />
              ) : (
                <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 text-xs font-mono font-medium text-slate-800 dark:text-zinc-200 whitespace-pre-wrap leading-relaxed shadow-sm break-words select-text">
                  {generatedText}
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Global Action Footer - Sempre visível independente de modo ou tab */}
        <div className="p-3.5 sm:p-4 bg-white dark:bg-zinc-900 border-t border-slate-200/80 dark:border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-500 dark:text-zinc-400 w-full sm:w-auto justify-between sm:justify-start">
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${isFreeTextMode ? 'bg-amber-500' : 'bg-emerald-500'} animate-pulse`} />
              <span>{isFreeTextMode ? 'Modo de edição livre ativado' : 'Texto formatado pronto para WhatsApp'}</span>
            </div>
            {isFreeTextMode && (
              <button
                type="button"
                onClick={() => setIsFreeTextMode(false)}
                className="text-[11px] font-black uppercase text-amber-600 dark:text-amber-400 hover:underline"
              >
                Descartar edição
              </button>
            )}
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleAutoDistribute}
              className="hidden sm:flex items-center gap-1.5 px-4 py-3 bg-orange-50 hover:bg-orange-100 dark:bg-orange-950/40 dark:hover:bg-orange-900/40 text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-800 font-bold text-xs uppercase tracking-wider rounded-xl transition-all active:scale-95 shadow-xs cursor-pointer"
              title="Distribuir postos de trabalho e horários de almoço automaticamente com inteligência de cobertura"
            >
              <Icon name="auto_awesome" className="text-base text-orange-500" />
              <span>Auto Distribuir</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-none px-5 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 font-bold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer"
            >
              Fechar
            </button>

            <button
              type="button"
              onClick={handleCopy}
              className={`flex-[2] sm:flex-none px-6 py-3 font-black text-xs uppercase tracking-wider rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 active:scale-95 cursor-pointer ${
                isCopied
                  ? 'bg-emerald-700 text-white shadow-emerald-700/30'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20'
              }`}
            >
              <Icon name={isCopied ? 'check' : 'content_copy'} className="text-base" />
              <span>{isCopied ? 'Copiado para WhatsApp!' : 'Copiar Escala (WhatsApp)'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
