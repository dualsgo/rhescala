
import React from 'react';
import { Employee, MonthYear, Holiday, ShiftType } from '../types';
import { Icon } from './Icon';
import { HolidayCredit } from '../hooks/useHolidayCredits';
import { isWorkingShift } from '../hooks/useScheduleEngine';
import { buildHolidaySet } from '../constants';

interface EmployeeScheduleCardProps {
  employee: Employee;
  currentMY: MonthYear;
  customHolidays: Holiday[];
  holidayCredits: HolidayCredit[];
  onUpdateEmployee?: (empId: string, data: Partial<Employee>) => void;
  isAdmin?: boolean;
  isValidated?: boolean;
  onClose: () => void;
}

export const EmployeeScheduleCard: React.FC<EmployeeScheduleCardProps> = ({
  employee,
  currentMY,
  customHolidays,
  holidayCredits,
  onUpdateEmployee,
  isAdmin,
  isValidated,
  onClose
}) => {
  const [newRequest, setNewRequest] = React.useState('');
  const [selectedRequestDate, setSelectedRequestDate] = React.useState('');
  const [showSubmitFeedback, setShowSubmitFeedback] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<'mes' | 'atual' | 'pedidos'>('mes');

  const monthKey = `${currentMY.year}-${String(currentMY.month + 1).padStart(2, '0')}`;
  const daysInMonth = new Date(currentMY.year, currentMY.month + 1, 0).getDate();
  const holidaySet = buildHolidaySet(currentMY.year, customHolidays);

  const shifts = (employee.shifts || {})[monthKey] || [];
  const hours = (employee.dailyHours || {})[monthKey] || [];

  const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

  const pendingCredits = holidayCredits.filter(c => c.status === 'pending');
  const scheduledCredits = holidayCredits.filter(c => c.status === 'scheduled');

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-white dark:bg-black w-full max-w-2xl rounded-[2.5rem] shadow-2xl border border-slate-200 dark:border-zinc-800 flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-300">
        
        {/* Header */}
        <div className="px-8 py-6 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between sticky top-0 bg-white dark:bg-black z-10">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded-2xl flex items-center justify-center text-xl font-black shadow-sm">
              {employee.name.substring(0, 2).toUpperCase()}
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight leading-tight">{employee.name}</h3>
              <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">{employee.cargo || 'Colaborador'} • {months[currentMY.month]} {currentMY.year}</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-10 h-10 rounded-full hover:bg-slate-100 dark:hover:bg-zinc-900 flex items-center justify-center text-slate-400 transition-colors"
          >
            <Icon name="close" className="text-2xl" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-100 dark:border-zinc-800 px-8 overflow-x-auto custom-scrollbar">
          <button 
            onClick={() => setActiveTab('mes')}
            className={`px-4 py-4 text-[11px] font-black uppercase tracking-widest border-b-2 transition-all whitespace-nowrap ${activeTab === 'mes' ? 'border-orange-500 text-orange-600' : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
          >
            Escala do Mês
          </button>
          <button 
            onClick={() => setActiveTab('atual')}
            className={`px-4 py-4 text-[11px] font-black uppercase tracking-widest border-b-2 transition-all whitespace-nowrap ${activeTab === 'atual' ? 'border-orange-500 text-orange-600' : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
          >
            Escala Atual
          </button>
          <button 
            onClick={() => setActiveTab('pedidos')}
            className={`px-4 py-4 text-[11px] font-black uppercase tracking-widest border-b-2 transition-all whitespace-nowrap ${activeTab === 'pedidos' ? 'border-orange-500 text-orange-600' : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
          >
            Solicitações
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          
          {activeTab === 'mes' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in">
            
            {/* Calendar Section */}
            <div className="space-y-4">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <Icon name="calendar_month" className="text-orange-500" /> Sua Escala do Mês
              </h4>
              
              <div className="grid grid-cols-7 gap-1">
                {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => (
                  <div key={i} className="text-center text-[9px] font-black text-slate-300 py-1 uppercase">{d}</div>
                ))}
                {(() => {
                  const firstDay = new Date(currentMY.year, currentMY.month, 1).getDay();
                  const grid = [];
                  for (let i = 0; i < firstDay; i++) grid.push(<div key={`pad-${i}`} />);
                  for (let d = 1; d <= daysInMonth; d++) {
                    const shift = shifts[d - 1] || 'T';
                    const isWorking = isWorkingShift(shift);
                    const isToday = new Date().getDate() === d && new Date().getMonth() === currentMY.month && new Date().getFullYear() === currentMY.year;
                    
                    let bgClass = 'bg-slate-50 dark:bg-zinc-900/50 text-slate-400';
                    let borderClass = 'border-transparent';
                    
                    if (shift === 'F') bgClass = 'bg-rose-100 text-rose-600 dark:bg-rose-900/40';
                    else if (shift.startsWith('FF')) bgClass = 'bg-amber-100 text-amber-600 dark:bg-amber-900/40';
                    else if (shift === 'FE') bgClass = 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40';
                    else if (shift === 'DO') bgClass = 'bg-fuchsia-600 text-white shadow-md';
                    else if (isWorking) bgClass = 'bg-indigo-600 text-white shadow-md';
                    
                    if (isToday) borderClass = 'border-orange-500 ring-2 ring-orange-500/20';

                    grid.push(
                      <div 
                        key={d} 
                        className={`aspect-square rounded-xl flex flex-col items-center justify-center text-[11px] font-black transition-all border-2 ${bgClass} ${borderClass}`}
                      >
                        <span>{d}</span>
                        {shift !== 'T' && shift !== 'F' && <span className="text-[7px] opacity-70 leading-none mt-0.5">{shift.startsWith('FF') ? 'FF' : shift}</span>}
                      </div>
                    );
                  }
                  return grid;
                })()}
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                <div className="flex items-center gap-1.5 px-2 py-1 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg">
                  <div className="w-2 h-2 rounded-full bg-indigo-600" />
                  <span className="text-[9px] font-bold text-indigo-600 dark:text-indigo-400 uppercase">Trabalha</span>
                </div>
                <div className="flex items-center gap-1.5 px-2 py-1 bg-rose-50 dark:bg-rose-900/20 rounded-lg">
                  <div className="w-2 h-2 rounded-full bg-rose-500" />
                  <span className="text-[9px] font-bold text-rose-500 dark:text-rose-400 uppercase">Folga</span>
                </div>
                <div className="flex items-center gap-1.5 px-2 py-1 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                  <div className="w-2 h-2 rounded-full bg-amber-500" />
                  <span className="text-[9px] font-bold text-amber-500 dark:text-amber-400 uppercase">Feriado</span>
                </div>
              </div>
            </div>

            {/* Details Section */}
            <div className="space-y-6">
              
              {/* Holiday Credits */}
              <div className="space-y-4">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <Icon name="history" className="text-emerald-500" /> Feriados e Folgas Especiais
                </h4>
                
                <div className="space-y-2">
                  {pendingCredits.length > 0 ? (
                    pendingCredits.map((c, i) => (
                      <div key={i} className="flex items-center justify-between p-3 bg-amber-50 dark:bg-amber-900/20 rounded-2xl border border-amber-100 dark:border-amber-800/50">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 rounded-lg flex items-center justify-center">
                            <Icon name="event_available" className="text-lg" />
                          </div>
                          <div>
                            <p className="text-[11px] font-black text-slate-800 dark:text-slate-100 uppercase">{c.holidayName}</p>
                            <p className="text-[9px] font-bold text-amber-600 uppercase tracking-tighter">Pendente de Agendamento</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] font-black text-slate-400 uppercase">{c.holidayDate.split('-').reverse().slice(0, 2).join('/')}</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-4 bg-slate-50 dark:bg-zinc-900/50 rounded-2xl border border-dashed border-slate-200 dark:border-zinc-800 text-center">
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Nenhum feriado pendente</p>
                    </div>
                  )}

                  {scheduledCredits.map((c, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl border border-emerald-100 dark:border-emerald-800/50">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 rounded-lg flex items-center justify-center">
                          <Icon name="check_circle" className="text-lg" />
                        </div>
                        <div>
                          <p className="text-[11px] font-black text-slate-800 dark:text-slate-100 uppercase">{c.holidayName}</p>
                          <p className="text-[9px] font-bold text-emerald-600 uppercase tracking-tighter">Agendado para {c.scheduledDate?.split('-').reverse().slice(0, 2).join('/')}</p>
                        </div>
                      </div>
                      <Icon name="done_all" className="text-emerald-500" />
                    </div>
                  ))}
                </div>
              </div>

              {/* Quick Info */}
              <div className="p-5 bg-slate-950 dark:bg-zinc-900 rounded-3xl text-white shadow-lg space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
                    <Icon name="schedule" className="text-xl" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-white/50 uppercase tracking-widest">Carga Horária Base</p>
                    <p className="text-sm font-black uppercase">{employee.workPeriod || '44h Semanais'}</p>
                  </div>
                </div>
                <div className="h-px bg-white/10" />
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
                    <Icon name="celebration" className="text-xl" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-white/50 uppercase tracking-widest">Preferência de Folga</p>
                    <p className="text-sm font-black uppercase text-orange-400">{employee.preferredDayOff || 'Variável'}</p>
                  </div>
                </div>
              </div>

            </div>
          </div>
          )}

          {/* List of Shifts for the month */}
          {activeTab === 'atual' && (
            <div className="space-y-4 animate-fade-in">
            <div className="flex items-center justify-between px-2">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <Icon name="format_list_bulleted" className="text-indigo-500" /> Sua Escala Atual
              </h4>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {Array.from({ length: daysInMonth }, (_, i) => {
                const d = i + 1;
                const shift = shifts[i] || 'T';
                const hour = hours[i] || employee.workPeriod;
                const date = new Date(currentMY.year, currentMY.month, d);
                const dow = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'][date.getDay()];
                const isSun = date.getDay() === 0;
                const isHol = holidaySet.has(`${currentMY.year}-${String(currentMY.month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
                const fullDate = `${currentMY.year}-${String(currentMY.month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                const hasReq = (employee.requests || []).find(r => r.date === fullDate);

                if (shift === 'N/A') return null;

                return (
                  <div 
                    key={d} 
                    className={`flex items-center justify-between p-3 rounded-2xl border transition-all ${
                      isSun ? 'bg-rose-50/30 border-rose-100' : 
                      isHol ? 'bg-amber-50/30 border-amber-100' : 
                      'bg-slate-50/30 border-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex flex-col items-center justify-center w-10 h-10 bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-slate-100 dark:border-zinc-800">
                        <span className="text-[8px] font-black text-slate-300 uppercase leading-none">{dow.substring(0, 3)}</span>
                        <span className={`text-sm font-black ${isSun ? 'text-rose-500' : 'text-slate-700 dark:text-slate-200'}`}>{d}</span>
                      </div>
                      <div>
                        <p className={`text-[11px] font-black uppercase ${shift === 'F' ? 'text-rose-600' : (typeof shift === 'string' && shift.startsWith('FF')) ? 'text-amber-600' : 'text-slate-800 dark:text-slate-100'}`}>
                          {shift === 'T' ? 'Trabalha' : shift === 'F' ? 'Folga' : (typeof shift === 'string' && shift.startsWith('FF')) ? 'Folga Feriado' : shift === 'FE' ? 'Férias' : shift === 'C' ? 'Curso' : shift === 'DO' ? 'Aniversário' : shift}
                        </p>
                        <div className="flex items-center gap-2">
                           <p className="text-[9px] font-bold text-slate-400 uppercase">{isWorkingShift(shift) ? hour : '---'}</p>
                           {hasReq && (
                             <span className={`w-1.5 h-1.5 rounded-full ${hasReq.status === 'granted' ? 'bg-emerald-500' : hasReq.status === 'seen' ? 'bg-blue-500' : 'bg-orange-500 animate-pulse'}`} />
                           )}
                        </div>
                      </div>
                    </div>
                    {isWorkingShift(shift) ? (
                      <div className="px-3 py-1 bg-indigo-100 dark:bg-indigo-900/40 rounded-full">
                        <span className="text-[9px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">Presente</span>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
          )}

          {/* Mural de Pedidos / Recados */}
          {activeTab === 'pedidos' && (
            <div className="space-y-6 animate-fade-in">
            <div className="flex items-center justify-between">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <Icon name="add_circle" className="text-orange-500" /> Nova Solicitação
              </h4>
            </div>

            {onUpdateEmployee ? (
              <div className="p-5 bg-slate-50 dark:bg-zinc-900/50 rounded-[2rem] border border-slate-200 dark:border-zinc-800 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                   <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Data Desejada</label>
                      <input 
                        type="date"
                        className="w-full bg-slate-100 dark:bg-zinc-950 border-none rounded-xl px-4 py-3 text-xs font-bold outline-none ring-1 ring-slate-200 dark:ring-zinc-800 focus:ring-2 focus:ring-orange-500 transition-all"
                        value={selectedRequestDate}
                        onChange={(e) => setSelectedRequestDate(e.target.value)}
                      />
                   </div>
                   <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Justificativa (Breve)</label>
                      <input 
                        type="text"
                        className="w-full bg-slate-100 dark:bg-zinc-950 border-none rounded-xl px-4 py-3 text-xs font-bold outline-none ring-1 ring-slate-200 dark:ring-zinc-800 focus:ring-2 focus:ring-orange-500 transition-all"
                        placeholder="Ex: Consulta médica"
                        value={newRequest}
                        onChange={(e) => setNewRequest(e.target.value)}
                      />
                   </div>
                </div>
                
                <div className="flex items-center justify-between gap-4 pt-2">
                  <p className="text-[9px] text-slate-400 font-bold italic leading-tight">
                    * Esta é uma solicitação sujeita a análise e não garante a folga até que o gestor a valide na escala oficial.
                  </p>
                  <button 
                    disabled={!newRequest.trim() || !selectedRequestDate}
                    onClick={() => {
                      const updated = [
                        ...(employee.requests || []).filter(r => r.date !== selectedRequestDate),
                        { 
                          date: selectedRequestDate, 
                          text: newRequest.trim(), 
                          status: 'pending',
                          createdAt: new Date().toISOString() 
                        }
                      ];
                      onUpdateEmployee(employee.id, { requests: updated });
                      setNewRequest('');
                      setSelectedRequestDate('');
                      setShowSubmitFeedback(true);
                      setTimeout(() => setShowSubmitFeedback(false), 8000);
                    }}
                    className="whitespace-nowrap px-6 py-3 bg-orange-500 text-white rounded-xl text-[10px] font-black uppercase hover:bg-orange-600 transition-all shadow-md active:scale-95 disabled:opacity-50"
                  >
                    Enviar Pedido
                  </button>
                </div>

                {/* Aviso de Análise Operacional */}
                {showSubmitFeedback && (
                  <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-2xl animate-fade-in">
                    <div className="flex gap-3">
                      <div className="w-8 h-8 bg-blue-500 text-white rounded-lg flex items-center justify-center shrink-0">
                        <Icon name="info" className="text-lg" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest">Solicitação Enviada!</p>
                        <p className="text-[11px] font-bold text-blue-800 dark:text-blue-300 leading-relaxed">
                          Sua solicitação foi enviada e será analisada durante a criação da escala. Ela será atendida sempre que possível, desde que não onere a operação da loja.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 text-center">
                 <p className="text-[10px] font-bold text-slate-400 uppercase italic">Acesse com sua senha para enviar solicitações.</p>
              </div>
            )}

            {/* List existing requests */}
            <div className="space-y-4">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 px-2">
                <Icon name="history" className="text-slate-400" /> Suas Solicitações
              </h4>
              <div className="space-y-3">
                {(employee.requests || []).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')).map((req, i) => (
                  <div className={`p-4 rounded-2xl border shadow-sm relative group transition-all ${
                    req.status === 'granted' && (isAdmin || isValidated) ? 'bg-emerald-50 border-emerald-100' :
                    req.status === 'refused' && (isAdmin || isValidated) ? 'bg-red-50 border-red-100' :
                    req.status === 'seen' && (isAdmin || isValidated) ? 'bg-blue-50 border-blue-100' :
                    'bg-white dark:bg-black border-slate-100 dark:border-zinc-800'
                  }`}>
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`text-[9px] font-black px-2 py-0.5 rounded-lg uppercase tracking-widest ${
                        req.status === 'granted' && (isAdmin || isValidated) ? 'bg-emerald-100 text-emerald-700' :
                        req.status === 'refused' && (isAdmin || isValidated) ? 'bg-red-100 text-red-700' :
                        req.status === 'seen' && (isAdmin || isValidated) ? 'bg-blue-100 text-blue-700' :
                        'bg-orange-100 text-orange-700'
                      }`}>
                        {(req.date || '').split('-').reverse().join('/')}
                      </span>
                      <span className="text-[8px] font-black text-slate-400 uppercase">
                        {req.status === 'granted' && (isAdmin || isValidated) ? 'Aprovado' : 
                         req.status === 'refused' && (isAdmin || isValidated) ? 'Recusado' : 
                         req.status === 'seen' && (isAdmin || isValidated) ? 'Visto' : 
                         'Pendente'}
                      </span>
                    </div>
                    <span className="text-[8px] font-bold text-slate-400 uppercase">
                      {(() => {
                        try {
                          return req.createdAt ? new Date(req.createdAt).toLocaleDateString('pt-BR') : '---';
                        } catch (e) {
                          return '---';
                        }
                      })()}
                    </span>
                  </div>
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-200 leading-relaxed pr-8">{req.text}</p>
                  
                  {req.feedback && (isAdmin || isValidated) && (
                    <div className="mt-3 p-2 bg-slate-50 dark:bg-zinc-900 rounded-lg border border-slate-100 dark:border-zinc-800">
                      <p className="text-[9px] font-black uppercase text-slate-400 mb-0.5">Justificativa do Gerente:</p>
                      <p className="text-[10px] font-bold text-slate-600 dark:text-slate-300 italic">{req.feedback}</p>
                    </div>
                  )}
                  
                  <div className="absolute top-4 right-4 flex items-center gap-2">
                    {/* Admin Actions - Only show if current user is admin/manager */}
                    {isAdmin && onUpdateEmployee && (
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                         <button 
                          title="Marcar como Visto"
                          onClick={() => {
                            const updated = (employee.requests || []).map(r => 
                              (r.createdAt === req.createdAt || (r.text === req.text && r.date === req.date)) 
                                ? { ...r, status: 'seen' as const } : r
                            );
                            onUpdateEmployee(employee.id, { requests: updated });
                          }}
                          className="p-1.5 text-blue-400 hover:text-blue-600 transition-colors"
                        >
                          <Icon name="visibility" className="text-sm" />
                        </button>
                        <button 
                          title="Atender Pedido"
                          onClick={() => {
                            const updated = (employee.requests || []).map(r => 
                              (r.createdAt === req.createdAt || (r.text === req.text && r.date === req.date)) 
                                ? { ...r, status: 'granted' as const, feedback: undefined } : r
                            );
                            onUpdateEmployee(employee.id, { requests: updated });
                          }}
                          className="p-1.5 text-emerald-400 hover:text-emerald-600 transition-colors"
                        >
                          <Icon name="check_circle" className="text-sm" />
                        </button>
                        <button 
                          title="Recusar Pedido"
                          onClick={() => {
                            const justification = window.prompt('Por que este pedido está sendo recusado? (Esta justificativa será visível para o colaborador)');
                            if (justification !== null) {
                              const updated = (employee.requests || []).map(r => 
                                (r.createdAt === req.createdAt || (r.text === req.text && r.date === req.date)) 
                                  ? { ...r, status: 'refused' as const, feedback: justification.trim() || undefined } : r
                              );
                              onUpdateEmployee(employee.id, { requests: updated });
                            }
                          }}
                          className="p-1.5 text-red-400 hover:text-red-600 transition-colors"
                        >
                          <Icon name="cancel" className="text-sm" />
                        </button>
                      </div>
                    )}
                    
                    <button 
                      title="Excluir Pedido"
                      onClick={() => {
                        const updated = (employee.requests || []).filter(r => r.createdAt !== req.createdAt);
                        onUpdateEmployee?.(employee.id, { requests: updated });
                      }}
                      className="p-1.5 text-slate-300 hover:text-rose-500 transition-colors"
                    >
                      <Icon name="delete" className="text-sm" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-6 bg-slate-50 dark:bg-zinc-900/50 border-t border-slate-100 dark:border-zinc-800 flex gap-3">
          <button 
            onClick={() => window.print()}
            className="flex-1 py-3.5 bg-slate-900 dark:bg-slate-700 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2"
          >
            <Icon name="print" /> Imprimir Minha Escala
          </button>
          <button 
            onClick={onClose}
            className="px-8 py-3.5 bg-white dark:bg-black border border-slate-200 dark:border-zinc-800 text-slate-500 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all active:scale-95"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
