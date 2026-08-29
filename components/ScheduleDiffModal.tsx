import React, { useState, useMemo } from 'react';
import { Employee, MonthYear, OfficialScheduleSnapshot, ScheduleDiffItem } from '../types';
import { Icon } from './Icon';
import { copyToClipboard } from '../src/utils/clipboard';
import { useDialog } from '../contexts/DialogContext';

interface ScheduleDiffModalProps {
  isOpen: boolean;
  onClose: () => void;
  snapshot?: OfficialScheduleSnapshot;
  diffs: ScheduleDiffItem[];
  currentMY: MonthYear;
  onSelectDay?: (dayIdx: number) => void;
}

export const ScheduleDiffModal: React.FC<ScheduleDiffModalProps> = ({
  isOpen,
  onClose,
  snapshot,
  diffs,
  currentMY,
  onSelectDay,
}) => {
  const { showDialog } = useDialog();
  const [selectedEmpId, setSelectedEmpId] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'shift' | 'hour' | 'position'>('all');

  const filteredDiffs = useMemo(() => {
    return diffs.filter(d => {
      if (selectedEmpId !== 'all' && d.empId !== selectedEmpId) return false;
      if (typeFilter !== 'all' && d.type !== typeFilter) return false;
      return true;
    });
  }, [diffs, selectedEmpId, typeFilter]);

  const stats = useMemo(() => {
    const shiftCount = diffs.filter(d => d.type === 'shift').length;
    const hourCount = diffs.filter(d => d.type === 'hour').length;
    const posCount = diffs.filter(d => d.type === 'position').length;
    return { total: diffs.length, shiftCount, hourCount, posCount };
  }, [diffs]);

  // Lista única de colaboradores que possuem alterações
  const employeesWithDiffs = useMemo(() => {
    const map = new Map<string, string>();
    diffs.forEach(d => map.set(d.empId, d.empName));
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [diffs]);

  if (!isOpen) return null;

  const monthName = new Date(currentMY.year, currentMY.month).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  const validatedDateStr = snapshot?.validatedAt
    ? new Date(snapshot.validatedAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
    : 'Desconhecida';

  const handleCopyReport = async () => {
    if (diffs.length === 0) {
      await showDialog({ message: 'Nenhuma alteração registrada em relação à escala oficial.', type: 'alert' });
      return;
    }

    let text = `📋 *Relatório de Alterações — Escala de ${monthName}*\n`;
    text += `🔒 *Oficializada em:* ${validatedDateStr}\n`;
    text += `⚠️ *Total de Divergências:* ${diffs.length}\n\n`;

    // Agrupar por colaborador
    const byEmp: Record<string, ScheduleDiffItem[]> = {};
    diffs.forEach(d => {
      if (!byEmp[d.empName]) byEmp[d.empName] = [];
      byEmp[d.empName].push(d);
    });

    Object.entries(byEmp).forEach(([name, items]) => {
      text += `👤 *${name}* (${items.length} alterações):\n`;
      items.forEach(it => {
        if (it.type === 'shift') {
          text += `  • Dia ${it.dateStr}: Turno Oficial [${it.officialVal}] ➔ Atual [${it.currentVal}]\n`;
        } else if (it.type === 'hour') {
          text += `  • Dia ${it.dateStr}: Horário Oficial [${it.officialVal}] ➔ Atual [${it.currentVal}]\n`;
        } else if (it.type === 'position') {
          text += `  • Dia ${it.dateStr}: Posição Oficial [${it.officialVal}] ➔ Atual [${it.currentVal}]\n`;
        }
      });
      text += `\n`;
    });

    const success = await copyToClipboard(text);
    if (success) {
      await showDialog({ title: 'Sucesso', message: 'Relatório de auditoria copiado para a área de transferência!' });
    }
  };

  const getShiftBadge = (val: string) => {
    if (val === 'F') return <span className="px-2 py-0.5 bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 rounded font-black text-[10px]">Folga (F)</span>;
    if (val === 'FF') return <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 rounded font-black text-[10px]">Folga Feriado (FF)</span>;
    if (val === 'FE') return <span className="px-2 py-0.5 bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 rounded font-black text-[10px]">Férias (FE)</span>;
    if (val === 'AT') return <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 rounded font-black text-[10px]">Atestado (AT)</span>;
    if (val === 'DO') return <span className="px-2 py-0.5 bg-pink-100 dark:bg-pink-950/60 text-pink-700 dark:text-pink-300 rounded font-black text-[10px]">Aniversário (DO)</span>;
    if (val === 'T') return <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 rounded font-black text-[10px]">Trabalho (T)</span>;
    return <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded font-bold text-[10px]">{val}</span>;
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-[2rem] max-w-4xl w-full shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Icon name="history_toggle_off" className="text-2xl" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight">
                  Auditoria de Alterações
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 text-[10px] font-black uppercase">
                  Escala Oficial
                </span>
              </div>
              <p className="text-xs font-bold text-slate-400">
                Oficializada em: <span className="text-slate-600 dark:text-slate-300">{validatedDateStr}</span> • {monthName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-400"
          >
            <Icon name="close" />
          </button>
        </div>

        {/* Stats Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-6 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
          <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 flex items-center justify-center font-black">
              {stats.total}
            </div>
            <div>
              <p className="text-[10px] font-black uppercase text-slate-400">Total Alterações</p>
              <p className="text-xs font-black text-slate-800 dark:text-slate-200">{stats.total === 0 ? 'Sem divergências' : `${stats.total} no mês`}</p>
            </div>
          </div>

          <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-rose-100 dark:bg-rose-900/40 text-rose-600 flex items-center justify-center font-black">
              {stats.shiftCount}
            </div>
            <div>
              <p className="text-[10px] font-black uppercase text-slate-400">Folgas / Turnos</p>
              <p className="text-xs font-black text-slate-800 dark:text-slate-200">{stats.shiftCount} trocas</p>
            </div>
          </div>

          <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-900/40 text-amber-600 flex items-center justify-center font-black">
              {stats.hourCount}
            </div>
            <div>
              <p className="text-[10px] font-black uppercase text-slate-400">Horários</p>
              <p className="text-xs font-black text-slate-800 dark:text-slate-200">{stats.hourCount} alterações</p>
            </div>
          </div>

          <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-900/40 text-blue-600 flex items-center justify-center font-black">
              {stats.posCount}
            </div>
            <div>
              <p className="text-[10px] font-black uppercase text-slate-400">Posições</p>
              <p className="text-xs font-black text-slate-800 dark:text-slate-200">{stats.posCount} ajustes</p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="p-4 bg-slate-50/70 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={selectedEmpId}
              onChange={(e) => setSelectedEmpId(e.target.value)}
              className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">Todos os Colaboradores ({diffs.length})</option>
              {employeesWithDiffs.map(emp => (
                <option key={emp.id} value={emp.id}>{emp.name}</option>
              ))}
            </select>

            <div className="flex items-center bg-slate-200/70 dark:bg-slate-800 p-1 rounded-xl gap-1 text-[11px] font-black">
              <button
                onClick={() => setTypeFilter('all')}
                className={`px-2.5 py-1 rounded-lg transition-all ${typeFilter === 'all' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500'}`}
              >
                Todas
              </button>
              <button
                onClick={() => setTypeFilter('shift')}
                className={`px-2.5 py-1 rounded-lg transition-all ${typeFilter === 'shift' ? 'bg-white dark:bg-slate-700 text-rose-600 dark:text-rose-400 shadow-sm' : 'text-slate-500'}`}
              >
                Folgas
              </button>
              <button
                onClick={() => setTypeFilter('hour')}
                className={`px-2.5 py-1 rounded-lg transition-all ${typeFilter === 'hour' ? 'bg-white dark:bg-slate-700 text-amber-600 dark:text-amber-400 shadow-sm' : 'text-slate-500'}`}
              >
                Horários
              </button>
              <button
                onClick={() => setTypeFilter('position')}
                className={`px-2.5 py-1 rounded-lg transition-all ${typeFilter === 'position' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500'}`}
              >
                Posições
              </button>
            </div>
          </div>

          <button
            onClick={handleCopyReport}
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-sm"
          >
            <Icon name="content_copy" className="text-sm" /> Copiar Resumo
          </button>
        </div>

        {/* Content Table / List */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          {filteredDiffs.length === 0 ? (
            <div className="py-16 text-center">
              <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-4 text-3xl">
                <Icon name="verified" />
              </div>
              <h4 className="text-base font-black text-slate-800 dark:text-slate-200">
                {diffs.length === 0 ? 'Nenhuma alteração pós-oficialização' : 'Nenhuma alteração com os filtros selecionados'}
              </h4>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                {diffs.length === 0 
                  ? 'A escala em andamento está 100% idêntica à versão oficial que foi impressa no início do mês.'
                  : 'Tente limpar os filtros acima para visualizar as outras alterações.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredDiffs.map((diff) => (
                <div
                  key={diff.id}
                  className="bg-white dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:border-indigo-400/50 transition-all shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => {
                        if (onSelectDay) {
                          onSelectDay(diff.dayIdx);
                          onClose();
                        }
                      }}
                      className="px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 rounded-xl text-center transition-colors group"
                      title="Ir para este dia na grade"
                    >
                      <span className="block text-xs font-black text-slate-800 dark:text-slate-100 group-hover:text-indigo-600">{diff.dateStr}</span>
                      <span className="block text-[9px] font-bold text-slate-400 uppercase">Dia {diff.dayIdx + 1}</span>
                    </button>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-slate-900 dark:text-slate-100">{diff.empName}</span>
                        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md ${
                          diff.type === 'shift' ? 'bg-rose-100 dark:bg-rose-950/50 text-rose-600' :
                          diff.type === 'hour' ? 'bg-amber-100 dark:bg-amber-950/50 text-amber-600' :
                          'bg-blue-100 dark:bg-blue-950/50 text-blue-600'
                        }`}>
                          {diff.type === 'shift' ? 'Turno / Folga' : diff.type === 'hour' ? 'Horário' : 'Posição Tática'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {diff.type === 'shift' && 'Alteração no status de trabalho/folga'}
                        {diff.type === 'hour' && 'Mudança no horário da jornada diária'}
                        {diff.type === 'position' && 'Troca de setor/posição tática'}
                      </p>
                    </div>
                  </div>

                  {/* Comparativo: Oficial vs Atual */}
                  <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900/60 p-2 rounded-xl border border-slate-100 dark:border-slate-800 self-stretch sm:self-auto justify-between sm:justify-end">
                    <div className="text-right">
                      <span className="block text-[9px] font-black text-slate-400 uppercase">Oficial</span>
                      {diff.type === 'shift' ? getShiftBadge(diff.officialVal) : (
                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400 line-through">{diff.officialVal}</span>
                      )}
                    </div>

                    <Icon name="arrow_forward" className="text-slate-400 text-sm mx-1" />

                    <div>
                      <span className="block text-[9px] font-black text-indigo-500 uppercase">Atual</span>
                      {diff.type === 'shift' ? getShiftBadge(diff.currentVal) : (
                        <span className="text-xs font-black text-indigo-600 dark:text-indigo-400">{diff.currentVal}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex items-center justify-between">
          <p className="text-[11px] text-slate-400 font-medium">
            💡 Dica: Clique no dia para navegar diretamente para ele na grade da escala.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="py-2.5 px-6 bg-slate-900 hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600 text-white font-black uppercase text-xs tracking-wider rounded-xl transition-all"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
