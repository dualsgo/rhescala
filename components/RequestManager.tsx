import React, { useMemo } from 'react';
import { Employee, MonthYear, ShiftType } from '../types';
import { Icon } from './Icon';
import { getShortName } from '../constants';

interface RequestManagerProps {
  employees: Employee[];
  currentMY: MonthYear;
  onUpdateEmployee: (empId: string, data: Partial<Employee>) => void;
  isReadOnly?: boolean;
}

export const RequestManager: React.FC<RequestManagerProps> = ({
  employees,
  currentMY,
  onUpdateEmployee,
  isReadOnly = false,
}) => {
  const monthKey = `${currentMY.year}-${String(currentMY.month + 1).padStart(2, '0')}`;

  const allRequests = useMemo(() => {
    const list: { employee: Employee; request: any; isCurrentMonth: boolean }[] = [];
    employees.forEach(emp => {
      if (emp.isHidden || emp.status !== 'active') return;
      (emp.requests || []).forEach(req => {
        const isCurrentMonth = req.date?.startsWith(monthKey);
        // Show if pending (any date) OR if it belongs to current month
        if (req.status === 'pending' || isCurrentMonth) {
          list.push({ employee: emp, request: req, isCurrentMonth });
        }
      });
    });

    // Sort: Pending first, then by date descending
    list.sort((a, b) => {
      if (a.request.status === 'pending' && b.request.status !== 'pending') return -1;
      if (a.request.status !== 'pending' && b.request.status === 'pending') return 1;
      return new Date(b.request.date || b.request.createdAt).getTime() - new Date(a.request.date || a.request.createdAt).getTime();
    });

    return list;
  }, [employees, monthKey]);

  const pendingCount = allRequests.filter(r => r.request.status === 'pending').length;

  return (
    <div className="h-full flex flex-col p-4 sm:p-8 animate-fade-in custom-scrollbar overflow-y-auto">
      <div className="max-w-5xl mx-auto w-full space-y-8">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-6 rounded-3xl shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center shadow-sm">
              <Icon name="assignment" className="text-3xl" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">Central de Solicitações</h2>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                {pendingCount > 0 ? `${pendingCount} Pedido${pendingCount > 1 ? 's' : ''} Pendente${pendingCount > 1 ? 's' : ''}` : 'Nenhuma pendência atual'}
              </p>
            </div>
          </div>
        </div>

        {/* Requests List */}
        <div className="space-y-4">
          {allRequests.length === 0 ? (
            <div className="bg-slate-50 dark:bg-zinc-900/50 border border-dashed border-slate-200 dark:border-zinc-800 p-12 rounded-3xl text-center">
               <div className="w-16 h-16 bg-slate-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300 dark:text-slate-600">
                 <Icon name="inbox" className="text-3xl" />
               </div>
               <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-2">Caixa Vazia</h3>
               <p className="text-[11px] font-bold text-slate-400">Não há solicitações pendentes nem histórico para este mês.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {allRequests.map(({ employee, request: req }, idx) => {
                const reqDate = new Date(req.createdAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
                
                return (
                  <div key={`${employee.id}-${req.createdAt}-${idx}`} className={`p-5 rounded-2xl border transition-all ${
                    req.status === 'pending' ? 'bg-white dark:bg-black border-orange-200 dark:border-orange-900/50 shadow-lg shadow-orange-500/5' :
                    'bg-slate-50 dark:bg-zinc-900/50 border-slate-200 dark:border-zinc-800 opacity-75 hover:opacity-100'
                  }`}>
                    
                    <div className="flex flex-col md:flex-row gap-6">
                      {/* Left: Info */}
                      <div className="flex-1 space-y-4">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-slate-100 dark:bg-zinc-800 rounded-xl flex items-center justify-center text-[10px] font-black text-slate-500 uppercase">
                              {employee.name.substring(0, 2)}
                            </div>
                            <div>
                              <h4 className="text-[12px] font-black text-slate-800 dark:text-slate-100 uppercase">{employee.name}</h4>
                              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{reqDate}</p>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-black px-3 py-1 rounded-xl uppercase tracking-widest ${
                              req.status === 'granted' ? 'bg-emerald-100 text-emerald-700' :
                              req.status === 'refused' ? 'bg-red-100 text-red-700' :
                              req.status === 'seen' ? 'bg-blue-100 text-blue-700' :
                              'bg-orange-100 text-orange-700 animate-pulse-subtle'
                            }`}>
                              {req.status === 'granted' ? 'Aprovado' : 
                               req.status === 'refused' ? 'Recusado' : 
                               req.status === 'seen' ? 'Visto' : 'Pendente'}
                            </span>
                            {req.type === 'troca_turno' && (
                              <span className="text-[9px] font-black px-3 py-1 rounded-xl uppercase tracking-widest bg-purple-100 text-purple-700 border border-purple-200">
                                Troca de Turno
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="bg-slate-100/50 dark:bg-zinc-950 p-4 rounded-xl border border-slate-200 dark:border-zinc-800">
                          <div className="flex items-center gap-2 mb-2">
                            <Icon name="event" className="text-slate-400 text-sm" />
                            <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">
                              Data Solicitada: {(req.date || '').split('-').reverse().join('/')}
                            </span>
                          </div>
                          <p className="text-sm font-bold text-slate-700 dark:text-slate-300 leading-relaxed">
                            "{req.text}"
                          </p>
                        </div>
                        
                        {req.feedback && (
                          <div className="pl-4 border-l-2 border-slate-200 dark:border-slate-700 mt-4">
                            <p className="text-[9px] font-black uppercase text-slate-400 mb-1 tracking-widest">Sua Resposta</p>
                            <p className="text-[11px] font-bold text-slate-600 dark:text-slate-400 italic">"{req.feedback}"</p>
                          </div>
                        )}
                      </div>

                      {/* Right: Actions */}
                      {!isReadOnly && req.status === 'pending' && (
                        <div className="flex flex-col gap-2 md:w-56 shrink-0 justify-center border-t md:border-t-0 md:border-l border-slate-200 dark:border-zinc-800 pt-4 md:pt-0 md:pl-6">
                          
                          {/* Folga Normal Action */}
                          {req.type !== 'troca_turno' && (
                            <button 
                              onClick={() => {
                                if(window.confirm(`Isto lançará automaticamente "F" na escala do dia ${(req.date || '').split('-').reverse().join('/')}. Confirmar?`)) {
                                  const [year, month, day] = (req.date || '').split('-');
                                  if (year && month && day) {
                                    const mKey = `${year}-${month}`;
                                    const dIdx = parseInt(day, 10) - 1;
                                    const updatedShifts = [...(employee.shifts[mKey] || Array(31).fill('T'))];
                                    updatedShifts[dIdx] = 'F';
                                    
                                    const updated = (employee.requests || []).map(r => 
                                      (r.createdAt === req.createdAt) 
                                        ? { ...r, status: 'granted' as const, feedback: 'Folga Oficial (F) concedida e lançada na escala.' } : r
                                    );
                                    onUpdateEmployee(employee.id, { 
                                      requests: updated, 
                                      shifts: { ...employee.shifts, [mKey]: updatedShifts } 
                                    });
                                  }
                                }
                              }}
                              className="w-full px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase transition-colors shadow-md shadow-emerald-500/20 active:scale-95 flex items-center justify-center gap-2"
                            >
                              <Icon name="event_available" className="text-sm" /> Dar Folga (F)
                            </button>
                          )}

                          {/* Troca de Turno Action */}
                          {req.type === 'troca_turno' && req.targetEmployeeId && (
                            <button 
                              onClick={() => {
                                if(window.confirm('Isto trocará automaticamente os turnos, horários e posições dos dois colaboradores neste dia. Confirmar?')) {
                                  const [year, month, day] = (req.date || '').split('-');
                                  if (year && month && day) {
                                    const mKey = `${year}-${month}`;
                                    const dIdx = parseInt(day, 10) - 1;
                                    
                                    const targetEmp = employees.find(e => e.id === req.targetEmployeeId);
                                    if (targetEmp) {
                                      const myShift = (employee.shifts[mKey] || [])[dIdx] || 'T';
                                      const myHour = (employee.dailyHours[mKey] || [])[dIdx] || employee.workPeriod;
                                      const myPos = (employee.tacticalPositions?.[mKey] || [])[dIdx] || null;
                                      
                                      const theirShift = (targetEmp.shifts[mKey] || [])[dIdx] || 'T';
                                      const theirHour = (targetEmp.dailyHours[mKey] || [])[dIdx] || targetEmp.workPeriod;
                                      const theirPos = (targetEmp.tacticalPositions?.[mKey] || [])[dIdx] || null;
                                      
                                      const newTargetShifts = [...(targetEmp.shifts[mKey] || Array(31).fill('T'))];
                                      newTargetShifts[dIdx] = myShift;
                                      const newTargetHours = [...(targetEmp.dailyHours[mKey] || [])];
                                      newTargetHours[dIdx] = myHour;
                                      const newTargetPos = [...(targetEmp.tacticalPositions?.[mKey] || [])];
                                      newTargetPos[dIdx] = myPos;
                                      
                                      onUpdateEmployee(targetEmp.id, { 
                                        shifts: { ...targetEmp.shifts, [mKey]: newTargetShifts },
                                        dailyHours: { ...targetEmp.dailyHours, [mKey]: newTargetHours },
                                        tacticalPositions: { ...targetEmp.tacticalPositions, [mKey]: newTargetPos }
                                      });
                                      
                                      const newMyShifts = [...(employee.shifts[mKey] || Array(31).fill('T'))];
                                      newMyShifts[dIdx] = theirShift;
                                      const newMyHours = [...(employee.dailyHours[mKey] || [])];
                                      newMyHours[dIdx] = theirHour;
                                      const newMyPos = [...(employee.tacticalPositions?.[mKey] || [])];
                                      newMyPos[dIdx] = theirPos;
                                      
                                      const updated = (employee.requests || []).map(r => 
                                        (r.createdAt === req.createdAt) 
                                          ? { ...r, status: 'granted' as const, feedback: `Troca de turno com ${getShortName(targetEmp.name, employees)} efetuada na escala.` } : r
                                      );
                                      onUpdateEmployee(employee.id, { 
                                        requests: updated, 
                                        shifts: { ...employee.shifts, [mKey]: newMyShifts },
                                        dailyHours: { ...employee.dailyHours, [mKey]: newMyHours },
                                        tacticalPositions: { ...employee.tacticalPositions, [mKey]: newMyPos }
                                      });
                                    }
                                  }
                                }
                              }}
                              className="w-full px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-[10px] font-black uppercase transition-colors shadow-md shadow-purple-500/20 active:scale-95 flex items-center justify-center gap-2"
                            >
                              <Icon name="swap_horiz" className="text-sm" /> Efetuar Troca (Auto)
                            </button>
                          )}

                          <button 
                            onClick={() => {
                              const msg = window.prompt('Justificativa da aprovação (ex: Liberado mais cedo):', 'Pedido aprovado.');
                              if (msg !== null) {
                                const updated = (employee.requests || []).map(r => 
                                  (r.createdAt === req.createdAt) ? { ...r, status: 'granted' as const, feedback: msg || 'Pedido aprovado.' } : r
                                );
                                onUpdateEmployee(employee.id, { requests: updated });
                              }
                            }}
                            className="w-full px-4 py-2 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-700 rounded-xl text-[10px] font-black uppercase transition-colors text-slate-700 dark:text-slate-300"
                          >
                            <Icon name="check" className="text-sm inline mr-1" /> Aprovar (Outro)
                          </button>

                          <button 
                            onClick={() => {
                              const updated = (employee.requests || []).map(r => 
                                (r.createdAt === req.createdAt) ? { ...r, status: 'seen' as const, feedback: 'Gestor ciente do aviso.' } : r
                              );
                              onUpdateEmployee(employee.id, { requests: updated });
                            }}
                            className="w-full px-4 py-2 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-700 rounded-xl text-[10px] font-black uppercase transition-colors text-blue-600 dark:text-blue-400"
                          >
                            <Icon name="visibility" className="text-sm inline mr-1" /> Ciente (Aviso)
                          </button>

                          <button 
                            onClick={() => {
                              const msg = window.prompt('Motivo da recusa:');
                              if (msg !== null) {
                                const updated = (employee.requests || []).map(r => 
                                  (r.createdAt === req.createdAt) ? { ...r, status: 'refused' as const, feedback: msg || 'Pedido recusado sem justificativa.' } : r
                                );
                                onUpdateEmployee(employee.id, { requests: updated });
                              }
                            }}
                            className="w-full px-4 py-2 bg-rose-50 hover:bg-rose-100 dark:bg-rose-900/20 dark:hover:bg-rose-900/40 text-rose-600 rounded-xl text-[10px] font-black uppercase transition-colors"
                          >
                            <Icon name="close" className="text-sm inline mr-1" /> Recusar
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
