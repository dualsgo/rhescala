
import React, { useMemo } from 'react';
import { Employee, MonthYear, ShiftType, Holiday } from '../types';
import { Icon } from './Icon';
import { getPrevMonthConsecutive } from '../hooks/useScheduleEngine';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { buildHolidaySet } from '../constants';

interface AlertsPanelProps {
  employees: Employee[];
  currentMY: MonthYear;
  customHolidays: Holiday[];
  today: Date;
  onSelectDay: (idx: number) => void;
  onApplyFix: (empId: string, dayIdx: number, newShift: ShiftType) => void;
  onApplyBulkFixes: (updates: { empId: string, dayIdx: number, newShift: ShiftType }[]) => void;
  onClose: () => void;
}

interface AlertFix {
  label: string;
  empId: string;
  dayIdx: number;
  newShift: ShiftType;
}

interface Alert {
  id: string;
  type: 'legal' | 'operational';
  severity: 'error' | 'warning' | 'info';
  title: string;
  detail: string;
  dayIdx: number;
  empId?: string;
  empName?: string;
  fix?: AlertFix;
  suggestion?: string;
}

const isActivityShift = (s: ShiftType | undefined): boolean => s === 'T' || s === 'C';

function getEffectiveShift(emp: Employee, year: number, month: number, dayIdx: number): ShiftType {
    const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayIdx + 1).padStart(2, '0')}`;
    if (emp.vacationStart && dateStr >= emp.vacationStart && dateStr <= (emp.vacationEnd || '')) return 'FE';
    return (emp.shifts?.[monthKey] ?? [])[dayIdx] || 'F';
}

export const AlertsPanel: React.FC<AlertsPanelProps> = ({
  employees, currentMY, customHolidays, today, onSelectDay, onApplyFix, onApplyBulkFixes, onClose
}) => {
  const [resolvedAlerts, setResolvedAlerts] = useLocalStorage<string[]>('escalaResolvedAlerts', []);

  const monthKey = `${currentMY.year}-${String(currentMY.month + 1).padStart(2, '0')}`;
  const daysInMonth = new Date(currentMY.year, currentMY.month + 1, 0).getDate();
  const holidaySet = useMemo(() => buildHolidaySet(currentMY.year, customHolidays), [currentMY.year, customHolidays]);

  const alerts = useMemo(() => {
    const results: Alert[] = [];
    const isPastMonth = currentMY.year < today.getFullYear() || (currentMY.year === today.getFullYear() && currentMY.month < today.getMonth());
    if (isPastMonth) return [];

    const activeEmps = employees.filter(e => e.status === 'active');
    const cltEmps = activeEmps.filter(e => !e.isYoungApprentice);
    
    // ── LEGAL INCONSISTENCIES ──
    const prevMonthConsecs = getPrevMonthConsecutive(cltEmps, currentMY.year, currentMY.month);
    const sundays: number[] = [];
    for (let d = 0; d < daysInMonth; d++) {
        if (new Date(currentMY.year, currentMY.month, d + 1).getDay() === 0) sundays.push(d);
    }

    for (const emp of cltEmps) {
        // 6x1
        let streak = 0;
        for (let d = 0; d < daysInMonth; d++) {
            const s = getEffectiveShift(emp, currentMY.year, currentMY.month, d);
            if (isActivityShift(s)) streak++;
            else streak = 0;

            if (streak > 6) {
                results.push({
                    id: `${emp.id}-6x1-${d}`,
                    type: 'legal',
                    severity: 'error',
                    title: 'Violação de Descanso Semanal (6x1)',
                    detail: `${emp.name} está trabalhando há ${streak} dias seguidos.`,
                    dayIdx: d,
                    empId: emp.id,
                    empName: emp.name,
                    fix: { label: `Dar folga no dia ${d + 1}`, empId: emp.id, dayIdx: d, newShift: 'F' },
                    suggestion: 'A legislação brasileira exige que o colaborador tenha pelo menos 1 folga a cada 6 dias trabalhados.'
                });
                streak = 0;
            }
        }

        // 2 Sundays in a row (for women) or 3 Sundays (for men)? Actually user said "3 domingos seguidos"
        let sunStreak = prevMonthConsecs.get(emp.id) || 0;
        for (const sun of sundays) {
            const s = getEffectiveShift(emp, currentMY.year, currentMY.month, sun);
            if (isActivityShift(s)) sunStreak++;
            else sunStreak = 0;

            if (sunStreak >= 3) {
                results.push({
                    id: `${emp.id}-sun-${sun}`,
                    type: 'legal',
                    severity: 'error',
                    title: 'Excesso de Domingos Trabalhados',
                    detail: `${emp.name} está trabalhando no 3º domingo consecutivo.`,
                    dayIdx: sun,
                    empId: emp.id,
                    empName: emp.name,
                    fix: { label: `Folga no domingo ${sun + 1}`, empId: emp.id, dayIdx: sun, newShift: 'F' },
                    suggestion: 'Revezamento de domingos é obrigatório. Evite escalas de 3 domingos seguidos para manter a conformidade CLT.'
                });
            }
        }
    }

    // ── OPERATIONAL BOTTLENECKS ──
    for (let d = 0; d < daysInMonth; d++) {
        const dateStr = `${currentMY.year}-${String(currentMY.month + 1).padStart(2, '0')}-${String(d + 1).padStart(2, '0')}`;
        const isHoliday = holidaySet.has(dateStr);
        const dayWorkers = activeEmps.filter(e => getEffectiveShift(e, currentMY.year, currentMY.month, d) === 'T');
        
        // General Coverage
        if (dayWorkers.length < 6) {
            results.push({
                id: `coverage-${d}`,
                type: 'operational',
                severity: 'warning',
                title: 'Cobertura Baixa na Loja',
                detail: `Apenas ${dayWorkers.length} colaboradores trabalhando no dia ${d + 1}.`,
                dayIdx: d,
                suggestion: 'O mínimo recomendado para operação estável é de 6 pessoas. Considere mover uma folga deste dia para outro dia da semana.'
            });
        }

        // Shift Coverage (simplified: check if anyone is in Abertura/Fechamento)
        const opening = dayWorkers.filter(e => {
            const h = (e.dailyHours[monthKey] || [])[d] || e.workPeriod;
            return h.includes('10h');
        });
        const closing = dayWorkers.filter(e => {
            const h = (e.dailyHours[monthKey] || [])[d] || e.workPeriod;
            return h.includes('13h40') || h.includes('22h');
        });

        if (opening.length < 1) {
            results.push({
                id: `opening-${d}`,
                type: 'operational',
                severity: 'error',
                title: 'Sem Colaborador na Abertura',
                detail: `Ninguém escalado para abrir a loja no dia ${d + 1}.`,
                dayIdx: d,
                suggestion: 'A abertura (10h) está sem cobertura. Altere o horário de um dos colaboradores deste dia.'
            });
        }
        if (closing.length < 1) {
            results.push({
                id: `closing-${d}`,
                type: 'operational',
                severity: 'error',
                title: 'Sem Colaborador no Fechamento',
                detail: `Ninguém escalado para fechar a loja no dia ${d + 1}.`,
                dayIdx: d,
                suggestion: 'O fechamento (22h) está sem cobertura. Altere o horário de um dos colaboradores deste dia.'
            });
        }
    }

    return results;
  }, [employees, currentMY, today, daysInMonth, holidaySet, monthKey]);

  const filteredAlerts = alerts.filter(a => !resolvedAlerts.includes(a.id));

  const handleResolve = (id: string) => {
    setResolvedAlerts(prev => [...prev, id]);
  };

  const handleApplyAll = () => {
    const fixes = filteredAlerts.filter(a => a.fix).map(a => a.fix!);
    onApplyBulkFixes(fixes);
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950 p-8 pt-0">
      <header className="flex items-center justify-between mb-8 sticky top-0 bg-slate-50 dark:bg-slate-950 py-6 z-10 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h2 className="text-3xl font-black text-slate-900 dark:text-white items-center gap-3 flex">
            <div className="w-12 h-12 bg-orange-500 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-orange-500/20">
                <Icon name="notifications_active" className="text-2xl" />
            </div>
            Alertas e Inconsistências
          </h2>
          <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-widest">
            {filteredAlerts.length} Alertas pendentes para {months[currentMY.month]}
          </p>
        </div>
        <div className="flex items-center gap-3">
            <button 
                onClick={handleApplyAll}
                className="px-6 py-3 bg-indigo-600 text-white text-xs font-black uppercase rounded-2xl hover:bg-indigo-700 transition-all shadow-xl active:scale-95 flex items-center gap-2"
            >
                <Icon name="auto_fix_high" /> Aplicar Correções Automáticas
            </button>
            <button onClick={onClose} className="p-3 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-400">
                <Icon name="close" className="text-2xl" />
            </button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 overflow-y-auto custom-scrollbar flex-1 pb-10">
        {filteredAlerts.length === 0 ? (
            <div className="col-span-full flex flex-col items-center justify-center py-20 opacity-40">
                <Icon name="verified" className="text-8xl text-emerald-500 mb-6" />
                <h3 className="text-2xl font-black text-slate-900 dark:text-white uppercase">Escala 100% Ok</h3>
                <p className="text-sm font-bold text-slate-400 mt-2">Nenhuma inconsistência ou gargalo encontrado.</p>
            </div>
        ) : (
            filteredAlerts.map(alert => (
                <div key={alert.id} className={`bg-white dark:bg-slate-900 rounded-[2.5rem] border p-8 shadow-sm transition-all hover:shadow-md flex flex-col ${
                    alert.severity === 'error' ? 'border-rose-100 dark:border-rose-900/50' : 'border-amber-100 dark:border-amber-900/50'
                }`}>
                    <div className="flex items-start justify-between mb-6">
                        <div className="flex items-center gap-4">
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl ${
                                alert.severity === 'error' ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-600'
                            }`}>
                                <Icon name={alert.type === 'legal' ? 'gavel' : 'warning_amber'} />
                            </div>
                            <div>
                                <h4 className={`text-lg font-black tracking-tight ${alert.severity === 'error' ? 'text-rose-900 dark:text-rose-400' : 'text-amber-900 dark:text-amber-400'}`}>
                                    {alert.title}
                                </h4>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest leading-none">
                                        Dia {alert.dayIdx + 1} • {alert.type === 'legal' ? 'Regra CLT' : 'Gargalo Operacional'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-6 mb-6">
                        <p className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">{alert.detail}</p>
                        {alert.suggestion && (
                            <div className="flex items-start gap-2 mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                                <Icon name="lightbulb" className="text-amber-500 mt-0.5" />
                                <p className="text-xs text-slate-400 font-medium italic leading-relaxed">{alert.suggestion}</p>
                            </div>
                        )}
                    </div>

                    <div className="mt-auto flex items-center gap-3">
                        <button 
                            onClick={() => onSelectDay(alert.dayIdx)}
                            className="flex-1 px-6 py-3 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-[10px] font-black uppercase rounded-xl hover:bg-slate-800 transition-all flex items-center justify-center gap-2"
                        >
                            <Icon name="visibility" /> Ver na Grade
                        </button>
                        
                        {alert.fix ? (
                            <button 
                                onClick={() => onApplyFix(alert.fix!.empId, alert.fix!.dayIdx, alert.fix!.newShift)}
                                className="flex-1 px-6 py-3 bg-orange-500 text-white text-[10px] font-black uppercase rounded-xl hover:bg-orange-600 transition-all shadow-lg shadow-orange-500/20 flex items-center justify-center gap-2"
                            >
                                <Icon name="check" /> {alert.fix.label}
                            </button>
                        ) : (
                            <button 
                                onClick={() => handleResolve(alert.id)}
                                className="flex-1 px-6 py-3 bg-emerald-500 text-white text-[10px] font-black uppercase rounded-xl hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2"
                            >
                                <Icon name="done_all" /> Marcar como Resolvido
                            </button>
                        )}

                        {!alert.fix && (
                             <button 
                                title="Ignorar este alerta para este mês"
                                onClick={() => handleResolve(alert.id)}
                                className="p-3 text-slate-400 hover:text-slate-600 transition-colors"
                            >
                                <Icon name="remove_done" />
                            </button>
                        )}
                    </div>
                </div>
            ))
        )}
      </div>
    </div>
  );
};

const months = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
