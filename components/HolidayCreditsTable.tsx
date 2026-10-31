import React, { useRef, useState, useMemo } from 'react';
import { Employee, MonthYear, Holiday } from '../types';
import { getNationalHolidays, getShortName } from '../constants';
import { HolidayCredit } from '../hooks/useHolidayCredits';
import { isWorkingShift } from '../src/engine/shifts/shift-predicates';
import { toPng } from 'html-to-image';
import { Icon } from './Icon';

interface HolidayCreditsTableProps {
  employees: Employee[];
  currentMY: MonthYear;
  customHolidays: Holiday[];
  holidayCredits: Record<string, HolidayCredit[]>;
  deletedNationalHolidays?: string[];
  validatedMonths?: Record<string, boolean>;
  trackingStartDate?: string;
}

const WEEKDAY_ABBR = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];

export const HolidayCreditsTable: React.FC<HolidayCreditsTableProps> = ({
  employees,
  currentMY,
  customHolidays,
  holidayCredits,
  deletedNationalHolidays = [],
  validatedMonths = {},
  trackingStartDate,
}) => {
  const [filterMode, setFilterMode] = useState<'all' | 'officialized'>('officialized');
  const [isExporting, setIsExporting] = useState(false);
  const tableCaptureRef = useRef<HTMLDivElement>(null);

  // Colaboradores ativos ordenados por nome
  const activeEmployees = useMemo(() => {
    return employees
      .filter(emp => !emp.isYoungApprentice) // Jovem aprendiz não trabalha em feriados
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [employees]);

  // Feriados do ano corrente
  const yearHolidays = useMemo(() => {
    const nationals = getNationalHolidays(currentMY.year).filter(
      h => !(deletedNationalHolidays || []).includes(h.id)
    );
    const all = [...nationals, ...customHolidays]
      .filter(h => h.date && h.date.startsWith(String(currentMY.year)))
      .filter((h, i, self) => i === self.findIndex(t => t.date === h.date))
      .sort((a, b) => a.date.localeCompare(b.date));

    if (filterMode === 'officialized') {
      return all.filter(h => {
        if (trackingStartDate && h.date < trackingStartDate) return false;
        const [y, m] = h.date.split('-');
        return validatedMonths[`${y}-${m}`] === true;
      });
    }

    return all;
  }, [currentMY.year, deletedNationalHolidays, customHolidays, filterMode, trackingStartDate, validatedMonths]);

  // Função para baixar a tabela em imagem PNG em alta resolução
  const handleDownloadPng = async () => {
    if (!tableCaptureRef.current) return;
    setIsExporting(true);

    try {
      // Pequeno delay para garantir que classes e estilos estejam prontos
      await new Promise(resolve => setTimeout(resolve, 100));

      const dataUrl = await toPng(tableCaptureRef.current, {
        backgroundColor: '#ffffff',
        pixelRatio: 2,
        cacheBust: true,
        style: {
          margin: '0',
          display: 'block',
        },
      });

      const link = document.createElement('a');
      link.download = `tabela-folgas-feriados-${currentMY.year}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Erro ao gerar imagem PNG da tabela de feriados:', err);
    } finally {
      setIsExporting(false);
    }
  };

  // Totais consolidados da equipe
  const teamTotals = useMemo(() => {
    let totalWorked = 0;
    let totalPending = 0;
    let totalScheduled = 0;
    let totalGranted = 0;

    activeEmployees.forEach(emp => {
      const credits = holidayCredits[emp.id] || [];
      credits.forEach(c => {
        if (c.holidayDate.startsWith(String(currentMY.year))) {
          totalWorked++;
          if (c.status === 'pending') totalPending++;
          else if (c.status === 'scheduled') totalScheduled++;
          else if (c.status === 'granted') totalGranted++;
        }
      });
    });

    return { totalWorked, totalPending, totalScheduled, totalGranted };
  }, [activeEmployees, holidayCredits, currentMY.year]);

  return (
    <div className="space-y-4">
      {/* Barra de Ferramentas / Controles Superiores da Tabela */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-zinc-50 dark:bg-zinc-800/60 p-3 rounded-2xl border border-zinc-200 dark:border-zinc-700/60 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          {/* Alternador de Filtro: Apenas Oficializados vs Todos do Ano */}
          <div className="inline-flex items-center bg-white dark:bg-zinc-900 rounded-xl p-1 border border-zinc-200 dark:border-zinc-700 shadow-inner">
            <button
              type="button"
              onClick={() => setFilterMode('officialized')}
              className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                filterMode === 'officialized'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
              }`}
            >
              <Icon name="verified" className="text-xs" />
              <span>Oficializados ({yearHolidays.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                filterMode === 'all'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
              }`}
            >
              <Icon name="calendar_month" className="text-xs" />
              <span>Todos do Ano</span>
            </button>
          </div>

          {/* Legenda de Cores Rápida */}
          <div className="hidden sm:flex items-center gap-2 text-[11px] font-bold px-2 py-1 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-700/60">
            <span className="flex items-center gap-1 text-rose-700 dark:text-rose-400">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block"></span>
              Pendente
            </span>
            <span className="text-zinc-300 dark:text-zinc-700">•</span>
            <span className="flex items-center gap-1 text-amber-700 dark:text-amber-400">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block"></span>
              Agendada
            </span>
            <span className="text-zinc-300 dark:text-zinc-700">•</span>
            <span className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span>
              Concluída
            </span>
          </div>
        </div>

        {/* Botão de Download PNG */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleDownloadPng}
            disabled={isExporting || yearHolidays.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-95 disabled:opacity-50 text-white rounded-xl font-black uppercase text-xs tracking-wider transition-all shadow-md shadow-indigo-600/20"
            title="Baixar imagem PNG em alta resolução desta tabela para compartilhar ou imprimir"
          >
            <Icon name={isExporting ? 'hourglass_top' : 'download'} className="text-sm" />
            <span>{isExporting ? 'Gerando Imagem...' : 'Baixar Imagem (PNG)'}</span>
          </button>
        </div>
      </div>

      {/* Resumo Rápido de Cards de Totais */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 flex items-center justify-center font-black text-sm">
            <Icon name="event" className="text-lg" />
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Trabalhados</div>
            <div className="text-lg font-black text-zinc-800 dark:text-zinc-100">{teamTotals.totalWorked}</div>
          </div>
        </div>

        <div className="bg-rose-50/60 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 rounded-2xl p-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-rose-100 dark:bg-rose-900/50 text-rose-600 dark:text-rose-300 flex items-center justify-center font-black text-sm">
            <Icon name="pending_actions" className="text-lg" />
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">Pendentes</div>
            <div className="text-lg font-black text-rose-700 dark:text-rose-300">{teamTotals.totalPending}</div>
          </div>
        </div>

        <div className="bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-2xl p-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-300 flex items-center justify-center font-black text-sm">
            <Icon name="schedule" className="text-lg" />
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">Agendadas</div>
            <div className="text-lg font-black text-amber-700 dark:text-amber-300">{teamTotals.totalScheduled}</div>
          </div>
        </div>

        <div className="bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 rounded-2xl p-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-300 flex items-center justify-center font-black text-sm">
            <Icon name="check_circle" className="text-lg" />
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Concluídas</div>
            <div className="text-lg font-black text-emerald-700 dark:text-emerald-300">{teamTotals.totalGranted}</div>
          </div>
        </div>
      </div>

      {/* ÁREA DA TABELA FIXA E CAPTURÁVEL */}
      <div
        ref={tableCaptureRef}
        className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-md overflow-hidden p-4"
      >
        {/* Cabeçalho Visual Oficial na Captura PNG */}
        <div className="mb-4 pb-3 border-b border-zinc-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
                Rhescala • Ri Happy
              </span>
              <span className="text-xs text-zinc-300 dark:text-zinc-700">|</span>
              <span className="text-xs font-bold uppercase text-zinc-400">Controle Oficial de Feriados</span>
            </div>
            <h3 className="text-base sm:text-lg font-black uppercase text-zinc-900 dark:text-zinc-100 tracking-tight mt-0.5">
              Grade de Créditos e Folgas de Feriados Trabalhados — {currentMY.year}
            </h3>
          </div>
          <div className="flex items-center gap-3 text-[11px] font-bold text-zinc-500">
            <span className="px-2.5 py-1 bg-zinc-100 dark:bg-zinc-800 rounded-lg">
              {activeEmployees.length} Colaboradores
            </span>
            <span className="px-2.5 py-1 bg-zinc-100 dark:bg-zinc-800 rounded-lg">
              {yearHolidays.length} Feriados Mapeados
            </span>
          </div>
        </div>

        {yearHolidays.length === 0 ? (
          <div className="text-center py-16 text-zinc-400">
            <Icon name="event_busy" className="text-4xl mb-2 opacity-50" />
            <p className="text-xs font-black uppercase tracking-wider">
              Nenhum feriado localizado para os filtros selecionados
            </p>
            <p className="text-[11px] mt-1 text-zinc-500">
              Selecione &quot;Todos do Ano&quot; acima ou oficialize escalas com feriados para visualizar os créditos.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto custom-scrollbar border border-zinc-300 dark:border-zinc-800 rounded-xl">
            <table className="w-full border-collapse text-left" style={{ fontSize: '10px' }}>
              <thead>
                <tr className="bg-zinc-100 dark:bg-zinc-800/90 text-zinc-700 dark:text-zinc-200">
                  {/* Coluna Fixa do Colaborador */}
                  <th className="sticky left-0 z-20 bg-zinc-100 dark:bg-zinc-800 border-b border-r border-zinc-300 dark:border-zinc-700 p-2.5 text-left w-52 min-w-[200px] max-w-[220px] font-black uppercase tracking-wider shadow-[2px_0_6px_-1px_rgba(0,0,0,0.06)]">
                    Colaborador
                  </th>

                  {/* Colunas dos Feriados */}
                  {yearHolidays.map(h => {
                    const [, m, d] = h.date.split('-');
                    const dateObj = new Date(parseInt(h.date.slice(0, 4), 10), parseInt(m, 10) - 1, parseInt(d, 10));
                    const weekday = WEEKDAY_ABBR[dateObj.getDay()] || '';
                    const isOfficialized = validatedMonths[`${h.date.slice(0, 7)}`] === true;

                    return (
                      <th
                        key={h.id || h.date}
                        className="border-b border-r border-zinc-300 dark:border-zinc-700 p-2 text-center min-w-[96px] w-[104px] bg-zinc-50/80 dark:bg-zinc-850/80"
                      >
                        <div className="flex flex-col items-center justify-center">
                          <span className="font-black text-[11px] text-zinc-900 dark:text-zinc-100">
                            {d}/{m}
                          </span>
                          <span className="text-[9px] font-bold text-zinc-400 uppercase">
                            {weekday}
                          </span>
                          <span
                            className="text-[9px] font-black uppercase text-indigo-600 dark:text-indigo-400 truncate max-w-[96px] mt-0.5"
                            title={h.name}
                          >
                            {h.name}
                          </span>
                          {!isOfficialized && (
                            <span className="text-[8px] font-black text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 px-1 rounded mt-0.5">
                              Previsto
                            </span>
                          )}
                        </div>
                      </th>
                    );
                  })}

                  {/* Colunas de Totais */}
                  <th className="border-b border-r border-zinc-300 dark:border-zinc-700 p-2 text-center w-16 min-w-[64px] font-black uppercase text-rose-700 dark:text-rose-400 bg-rose-50/50 dark:bg-rose-950/30">
                    Pend.
                  </th>
                  <th className="border-b border-r border-zinc-300 dark:border-zinc-700 p-2 text-center w-16 min-w-[64px] font-black uppercase text-amber-700 dark:text-amber-400 bg-amber-50/50 dark:bg-amber-950/30">
                    Agend.
                  </th>
                  <th className="border-b border-r border-zinc-300 dark:border-zinc-700 p-2 text-center w-16 min-w-[64px] font-black uppercase text-emerald-700 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/30">
                    Concl.
                  </th>
                  <th className="border-b border-zinc-300 dark:border-zinc-700 p-2 text-center w-24 min-w-[96px] font-black uppercase bg-zinc-100 dark:bg-zinc-800">
                    Situação
                  </th>
                </tr>
              </thead>

              <tbody>
                {activeEmployees.map((emp, empIdx) => {
                  const empCredits = holidayCredits[emp.id] || [];

                  // Contagens do Colaborador
                  let empWorked = 0;
                  let empPending = 0;
                  let empScheduled = 0;
                  let empGranted = 0;

                  return (
                    <tr
                      key={emp.id}
                      className={`hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors ${
                        empIdx % 2 === 0 ? 'bg-white dark:bg-zinc-900' : 'bg-zinc-50/40 dark:bg-zinc-900/60'
                      }`}
                    >
                      {/* Coluna Fixa com Nome do Colaborador */}
                      <td className="sticky left-0 z-10 bg-inherit border-b border-r border-zinc-300 dark:border-zinc-700 p-2 font-black uppercase truncate max-w-[220px] shadow-[2px_0_6px_-1px_rgba(0,0,0,0.06)]">
                        <div className="flex flex-col">
                          <span className="text-zinc-900 dark:text-zinc-100 truncate text-[11px]">
                            {getShortName(emp.name, activeEmployees)}
                          </span>
                          <span className="text-[9px] font-bold text-zinc-400 truncate tracking-wide">
                            {emp.cargo || 'Colaborador'}
                          </span>
                        </div>
                      </td>

                      {/* Células por Feriado */}
                      {yearHolidays.map(h => {
                        const [year, month, day] = h.date.split('-');
                        const monthKey = `${year}-${month}`;
                        const dayIdx = parseInt(day, 10) - 1;
                        const isOfficial = validatedMonths[monthKey] === true;

                        // Créditos registrados para este feriado
                        const matchingCredits = empCredits.filter(c => c.holidayDate === h.date);

                        // Se há créditos oficiais calculados
                        if (matchingCredits.length > 0) {
                          empWorked++;
                          const primaryCredit = matchingCredits[0];
                          if (primaryCredit.status === 'pending') empPending++;
                          else if (primaryCredit.status === 'scheduled') empScheduled++;
                          else if (primaryCredit.status === 'granted') empGranted++;

                          // 1. Célula Amarela: Agendado
                          if (primaryCredit.status === 'scheduled') {
                            const offFormatted = primaryCredit.offDate
                              ? primaryCredit.offDate.split('-').slice(1).reverse().join('/')
                              : '';
                            return (
                              <td
                                key={h.date}
                                className="border-b border-r border-zinc-300 dark:border-zinc-700 p-1 text-center bg-amber-100 dark:bg-amber-950/70 border-amber-300 dark:border-amber-800/80"
                              >
                                <div className="flex flex-col items-center justify-center">
                                  <span className="font-black text-[9px] text-amber-900 dark:text-amber-200 uppercase px-1 py-0.5 rounded bg-amber-200/80 dark:bg-amber-900/60">
                                    AGENDADA
                                  </span>
                                  {offFormatted && (
                                    <span className="text-[9px] font-black text-amber-800 dark:text-amber-300 mt-0.5">
                                      {offFormatted}
                                    </span>
                                  )}
                                </div>
                              </td>
                            );
                          }

                          // 2. Célula Verde: Concluído
                          if (primaryCredit.status === 'granted') {
                            const offFormatted = primaryCredit.offDate
                              ? primaryCredit.offDate.split('-').slice(1).reverse().join('/')
                              : '';
                            return (
                              <td
                                key={h.date}
                                className="border-b border-r border-zinc-300 dark:border-zinc-700 p-1 text-center bg-emerald-100 dark:bg-emerald-950/70 border-emerald-300 dark:border-emerald-800/80"
                              >
                                <div className="flex flex-col items-center justify-center">
                                  <span className="font-black text-[9px] text-emerald-900 dark:text-emerald-200 uppercase px-1 py-0.5 rounded bg-emerald-200/80 dark:bg-emerald-900/60">
                                    CONCLUÍDA
                                  </span>
                                  {offFormatted && (
                                    <span className="text-[9px] font-black text-emerald-800 dark:text-emerald-300 mt-0.5">
                                      {offFormatted}
                                    </span>
                                  )}
                                </div>
                              </td>
                            );
                          }

                          // 3. Célula Vermelha: Pendente
                          return (
                            <td
                              key={h.date}
                              className="border-b border-r border-zinc-300 dark:border-zinc-700 p-1 text-center bg-rose-100 dark:bg-rose-950/70 border-rose-300 dark:border-rose-800/80"
                            >
                              <div className="flex flex-col items-center justify-center">
                                <span className="font-black text-[9px] text-rose-900 dark:text-rose-200 uppercase px-1 py-0.5 rounded bg-rose-200/80 dark:bg-rose-900/60">
                                  PENDENTE
                                </span>
                              </div>
                            </td>
                          );
                        }

                        // Caso o colaborador não tenha créditos oficiais nesta data:
                        // Verificamos o turno da escala
                        let shift = emp.shifts[monthKey]?.[dayIdx];
                        if (emp.vacationStart && emp.vacationEnd && h.date >= emp.vacationStart && h.date <= emp.vacationEnd) {
                          shift = 'FE';
                        } else if (emp.atestadoStart && emp.atestadoEnd && h.date >= emp.atestadoStart && h.date <= emp.atestadoEnd) {
                          shift = 'AT';
                        }

                        // Se o mês ainda não foi oficializado mas o turno está como trabalhado
                        if (!isOfficial && shift && isWorkingShift(shift)) {
                          return (
                            <td
                              key={h.date}
                              className="border-b border-r border-zinc-300 dark:border-zinc-700 p-1 text-center bg-zinc-50 dark:bg-zinc-800/40 text-zinc-600 dark:text-zinc-400"
                            >
                              <span className="text-[8.5px] font-black uppercase px-1 py-0.5 rounded bg-zinc-200/70 dark:bg-zinc-700/60">
                                ESCALADO
                              </span>
                            </td>
                          );
                        }

                        // Se estava de férias
                        if (shift === 'FE') {
                          return (
                            <td
                              key={h.date}
                              className="border-b border-r border-zinc-300 dark:border-zinc-700 p-1 text-center bg-zinc-100/60 dark:bg-zinc-800/40 text-zinc-400"
                            >
                              <span className="text-[8.5px] font-bold uppercase text-zinc-400">FÉRIAS</span>
                            </td>
                          );
                        }

                        // Se estava de atestado
                        if (shift === 'AT') {
                          return (
                            <td
                              key={h.date}
                              className="border-b border-r border-zinc-300 dark:border-zinc-700 p-1 text-center bg-zinc-100/60 dark:bg-zinc-800/40 text-zinc-400"
                            >
                              <span className="text-[8.5px] font-bold uppercase text-zinc-400">ATESTADO</span>
                            </td>
                          );
                        }

                        // Não trabalhou / Folga regular
                        return (
                          <td
                            key={h.date}
                            className="border-b border-r border-zinc-300 dark:border-zinc-700 p-1 text-center text-zinc-300 dark:text-zinc-600"
                          >
                            <span className="text-[10px] font-bold">—</span>
                          </td>
                        );
                      })}

                      {/* Total de Pendentes */}
                      <td className="border-b border-r border-zinc-300 dark:border-zinc-700 p-1.5 text-center font-black text-[10px]">
                        {empPending > 0 ? (
                          <span className="inline-block px-1.5 py-0.5 rounded bg-rose-100 dark:bg-rose-900/50 text-rose-700 dark:text-rose-300">
                            {empPending}
                          </span>
                        ) : (
                          <span className="text-zinc-400">0</span>
                        )}
                      </td>

                      {/* Total de Agendadas */}
                      <td className="border-b border-r border-zinc-300 dark:border-zinc-700 p-1.5 text-center font-black text-[10px]">
                        {empScheduled > 0 ? (
                          <span className="inline-block px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300">
                            {empScheduled}
                          </span>
                        ) : (
                          <span className="text-zinc-400">0</span>
                        )}
                      </td>

                      {/* Total de Concluídas */}
                      <td className="border-b border-r border-zinc-300 dark:border-zinc-700 p-1.5 text-center font-black text-[10px]">
                        {empGranted > 0 ? (
                          <span className="inline-block px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300">
                            {empGranted}
                          </span>
                        ) : (
                          <span className="text-zinc-400">0</span>
                        )}
                      </td>

                      {/* Situação Geral */}
                      <td className="border-b border-zinc-300 dark:border-zinc-700 p-1.5 text-center font-black text-[9px] uppercase">
                        {empPending > 0 ? (
                          <span className="text-rose-600 dark:text-rose-400">
                            {empPending} PENDENTE{empPending > 1 ? 'S' : ''}
                          </span>
                        ) : empWorked > 0 ? (
                          <span className="text-emerald-600 dark:text-emerald-400">
                            ✓ EM DIA
                          </span>
                        ) : (
                          <span className="text-zinc-400">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>

              {/* Linha de Totalização por Feriado (Rodapé tfoot) */}
              <tfoot>
                <tr className="bg-zinc-100 dark:bg-zinc-800 font-black text-zinc-800 dark:text-zinc-200">
                  <td className="sticky left-0 z-20 bg-zinc-100 dark:bg-zinc-800 border-t-2 border-r border-zinc-400 dark:border-zinc-600 p-2 text-right uppercase text-[9px] shadow-[2px_0_6px_-1px_rgba(0,0,0,0.06)]">
                    TOTAL TRABALHARAM:
                  </td>

                  {yearHolidays.map(h => {
                    let holidayWorkedCount = 0;
                    activeEmployees.forEach(emp => {
                      const empCredits = holidayCredits[emp.id] || [];
                      if (empCredits.some(c => c.holidayDate === h.date)) {
                        holidayWorkedCount++;
                      }
                    });

                    return (
                      <td
                        key={h.date}
                        className="border-t-2 border-r border-zinc-400 dark:border-zinc-600 p-1 text-center font-black text-[10px]"
                      >
                        {holidayWorkedCount > 0 ? (
                          <span className="inline-block px-1.5 py-0.5 rounded bg-zinc-200 dark:bg-zinc-700">
                            {holidayWorkedCount}
                          </span>
                        ) : (
                          <span className="text-zinc-400">0</span>
                        )}
                      </td>
                    );
                  })}

                  <td className="border-t-2 border-r border-zinc-400 dark:border-zinc-600 p-1 text-center font-black text-[10px] text-rose-700 dark:text-rose-300">
                    {teamTotals.totalPending}
                  </td>
                  <td className="border-t-2 border-r border-zinc-400 dark:border-zinc-600 p-1 text-center font-black text-[10px] text-amber-700 dark:text-amber-300">
                    {teamTotals.totalScheduled}
                  </td>
                  <td className="border-t-2 border-r border-zinc-400 dark:border-zinc-600 p-1 text-center font-black text-[10px] text-emerald-700 dark:text-emerald-300">
                    {teamTotals.totalGranted}
                  </td>
                  <td className="border-t-2 border-zinc-400 dark:border-zinc-600 p-1 text-center text-[8.5px] uppercase text-zinc-500">
                    Total Anual
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {/* Rodapé Informativo da Imagem PNG */}
        <div className="mt-4 pt-3 border-t border-zinc-200 dark:border-zinc-800 flex flex-wrap items-center justify-between text-[10px] text-zinc-400 font-bold gap-2">
          <div className="flex items-center gap-2">
            <span>Legenda:</span>
            <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-black">Amarelo = Agendada</span>
            <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-black">Verde = Concluída</span>
            <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 font-black">Vermelho = Pendente</span>
          </div>
          <div>
            Relatório gerado em {new Date().toLocaleDateString('pt-BR')} via Rhescala
          </div>
        </div>
      </div>
    </div>
  );
};

