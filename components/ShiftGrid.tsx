
import React, { useMemo } from 'react';
import { Employee, MonthYear, ShiftType, Holiday } from '../types';
import { Icon } from './Icon';
import { buildHolidaySet } from '../constants';

interface ShiftGridProps {
  employees: Employee[];
  currentMY: MonthYear;
  selectedDayIdx: number;
  today: Date;
  customHolidays: Holiday[];
  onOpenAnalysis: () => void;
  isLocked: boolean;
  onToggleLock: (locked: boolean) => void;
  isEditable: boolean;
  onToggleEdit: () => void;
  onSelectDay: (idx: number) => void;
  onOpenDayDetail: (idx: number) => void;
  onUpdateShift: (empId: string, dayIdx: number, newShift: ShiftType) => void;
  onUpdateShifts: (empId: string, updates: { dayIdx: number; shift: ShiftType }[]) => void;
  onUpdateEmployeeDailyHour: (empId: string, dayIdx: number, newHour: string) => void;
  onShareWhatsApp: (dayIdx: number) => void;
  
  viewMode: 'table' | 'calendar';
  onViewModeChange: (v: 'table' | 'calendar') => void;
  sortConfig: { key: 'name' | 'workPeriod'; direction: 'asc' | 'desc' } | null;
  onSortChange: (cfg: { key: 'name' | 'workPeriod'; direction: 'asc' | 'desc' } | null) => void;
  hideOffOnSelectedDay: boolean;
  onToggleHideOff: () => void;
}

const WEEKDAY_ABBR = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];

const SHIFT_OPTIONS: { value: ShiftType; label: string; color: string }[] = [
  { value: 'T', label: 'T', color: 'bg-emerald-500' },
  { value: 'F', label: 'F', color: 'bg-rose-500' },
  { value: 'C', label: 'C', color: 'bg-teal-500' },
  { value: 'FE', label: 'FE', color: 'bg-indigo-300' },
];

export const ShiftGrid: React.FC<ShiftGridProps> = ({
  employees, currentMY, selectedDayIdx, today, customHolidays,
  onOpenAnalysis, isLocked, onToggleLock, isEditable, onToggleEdit,
  onSelectDay, onOpenDayDetail, onUpdateShift, onUpdateShifts,
  onUpdateEmployeeDailyHour, onShareWhatsApp,
  viewMode, onViewModeChange, sortConfig, onSortChange, hideOffOnSelectedDay, onToggleHideOff
}) => {
  const daysInMonth = new Date(currentMY.year, currentMY.month + 1, 0).getDate();
  const daysArr = Array.from({ length: daysInMonth }, (_, i) => i);
  const holidaySet = buildHolidaySet(currentMY.year, customHolidays);
  const monthKey = `${currentMY.year}-${String(currentMY.month+1).padStart(2,'0')}`;

  const sortedEmployees = useMemo(() => {
    let result = [...employees].filter(e => !e.isHidden);
    
    // Applying the "Hide Off" filter for the selected day
    if (hideOffOnSelectedDay) {
      result = result.filter(emp => {
        const s = (emp.shifts[monthKey] || [])[selectedDayIdx] || 'T';
        return s === 'T' || s.startsWith('FF');
      });
    }

    if (sortConfig) {
      result.sort((a, b) => {
        const valA = sortConfig.key === 'name' ? a.name : a.workPeriod;
        const valB = sortConfig.key === 'name' ? b.name : b.workPeriod;
        if (sortConfig.direction === 'asc') return valA.localeCompare(valB, 'pt-BR');
        return valB.localeCompare(valA, 'pt-BR');
      });
    }
    return result;
  }, [employees, sortConfig, hideOffOnSelectedDay, selectedDayIdx, monthKey]);

  const dailyStaff = useMemo(() => {
    return daysArr.map(d => {
      const active = employees.filter(e => !e.isHidden && e.status === 'active');
      const working = active.filter(e => {
        const s = (e.shifts[monthKey] || [])[d] || 'T';
        return s === 'T' || s.startsWith('FF');
      });
      const opening = working.filter(e => e.shiftName === 'Abertura').length;
      const closing = working.filter(e => e.shiftName === 'Fechamento').length;
      return { total: working.length, opening, closing };
    });
  }, [employees, daysArr, monthKey]);

  const handleSort = (key: 'name' | 'workPeriod') => {
    if (sortConfig?.key === key) {
      if (sortConfig.direction === 'asc') onSortChange({ key, direction: 'desc' });
      else onSortChange(null);
    } else {
      onSortChange({ key, direction: 'asc' });
    }
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm selection:bg-orange-100">
      
      {/* Grid Toolbar */}
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-white z-20">
        <div className="flex items-center gap-4">
           <div className="flex bg-slate-100 p-1 rounded-xl">
              <button 
                onClick={() => onViewModeChange('table')}
                className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'table' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
              >
                Tabela
              </button>
              <button 
                onClick={() => onViewModeChange('calendar')}
                className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'calendar' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
              >
                Calendário
              </button>
           </div>
           <div className="h-6 w-px bg-slate-200" />
           <button 
             onClick={onToggleHideOff}
             className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all flex items-center gap-2 ${hideOffOnSelectedDay ? 'bg-orange-500 border-orange-500 text-white' : 'bg-white border-slate-200 text-slate-500'}`}
           >
             <Icon name={hideOffOnSelectedDay ? 'visibility_off' : 'visibility'} className="text-sm" /> 
             {hideOffOnSelectedDay ? 'Escala Real' : 'Filtrar Folgas'}
           </button>
        </div>

        <div className="flex items-center gap-3">
           <button onClick={onOpenAnalysis} className="px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-[10px] font-black uppercase hover:bg-indigo-600 hover:text-white transition-all">Análise Geral</button>
           <button onClick={() => onToggleLock(!isLocked)} className={`p-2 rounded-xl border transition-all ${isLocked ? 'bg-slate-900 border-slate-900 text-white' : 'bg-orange-500 border-orange-500 text-white shadow-lg shadow-orange-100 animate-pulse'}`}>
             <Icon name={isLocked ? 'lock' : 'lock_open'} />
           </button>
        </div>
      </div>

      {viewMode === 'table' ? (
        <div className="flex-1 overflow-auto custom-scrollbar relative">
          <table className="w-full border-separate border-spacing-0">
            <thead className="sticky top-0 z-30">
              <tr className="bg-slate-50">
                <th 
                  onClick={() => handleSort('name')}
                  className="sticky left-0 z-40 px-6 py-4 text-left border-b border-slate-200 bg-slate-50 cursor-pointer group whitespace-nowrap"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest group-hover:text-slate-900">Colaborador</span>
                    <Icon name={sortConfig?.key === 'name' ? (sortConfig.direction === 'asc' ? 'expand_less' : 'expand_more') : 'unfold_more'} className="text-slate-300 text-xs" />
                  </div>
                </th>
                <th 
                  onClick={() => handleSort('workPeriod')}
                  className="px-6 py-4 text-left border-b border-slate-200 cursor-pointer group whitespace-nowrap"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest group-hover:text-slate-900">Turno Ref.</span>
                    <Icon name={sortConfig?.key === 'workPeriod' ? (sortConfig.direction === 'asc' ? 'expand_less' : 'expand_more') : 'unfold_more'} className="text-slate-300 text-xs" />
                  </div>
                </th>
                {daysArr.map(d => {
                  const date = new Date(currentMY.year, currentMY.month, d + 1);
                  const isSun = date.getDay() === 0;
                  const dateStr = `${currentMY.year}-${String(currentMY.month+1).padStart(2,'0')}-${String(d+1).padStart(2,'0')}`;
                  const isHol = holidaySet.has(dateStr);
                  const isToday = today.getDate() === (d + 1) && today.getMonth() === currentMY.month && today.getFullYear() === currentMY.year;
                  const isSelected = selectedDayIdx === d;
                  
                  return (
                    <th 
                      key={d} 
                      onClick={() => onSelectDay(d)}
                      className={`min-w-[45px] p-2 text-center border-b border-slate-100 cursor-pointer transition-all ${isSun ? 'bg-rose-50/30' : ''} ${isSelected ? 'ring-2 ring-inset ring-orange-500 bg-orange-50' : 'hover:bg-slate-100'}`}
                    >
                      <div className="flex flex-col items-center gap-0.5">
                        <span className={`text-[8px] font-black ${isHol ? 'text-rose-500' : isSun ? 'text-rose-400' : 'text-slate-400'}`}>{WEEKDAY_ABBR[date.getDay()]}</span>
                        <span className={`text-xs font-black ${isToday ? 'text-white bg-orange-500 rounded-full w-5 h-5 flex items-center justify-center' : (isSelected ? 'text-orange-600' : 'text-slate-800')}`}>{d + 1}</span>
                      </div>
                    </th>
                  );
                })}
              </tr>
              {/* Daily Stats Summary Row under headers */}
              <tr className="bg-slate-50/50">
                 <td colSpan={2} className="sticky left-0 bg-slate-50 border-b border-slate-200"></td>
                 {daysArr.map(d => {
                   const s = dailyStaff[d];
                   const isUnderAbertura = s.opening < 4 && new Date(currentMY.year, currentMY.month, d+1).getDay() !== 0;
                   const isUnderFechamento = s.closing <= 3 && new Date(currentMY.year, currentMY.month, d+1).getDay() !== 0;
                   return (
                     <td key={d} className="p-1 border-b border-slate-100 text-[8px] font-black text-center">
                        <div className="flex flex-col gap-0.5">
                          <span className={`${isUnderAbertura ? 'text-rose-600' : 'text-slate-400'}`}>A:{s.opening}</span>
                          <span className={`${isUnderFechamento ? 'text-rose-600' : 'text-slate-400'}`}>F:{s.closing}</span>
                        </div>
                     </td>
                   );
                 })}
              </tr>
            </thead>
            <tbody>
              {sortedEmployees.map((emp, empIdx) => (
                <tr key={emp.id} className="group hover:bg-slate-50 transition-colors">
                  <td className="sticky left-0 z-20 px-6 py-4 bg-white border-b border-slate-100 group-hover:bg-slate-50 shadow-[2px_0_10px_-2px_rgba(0,0,0,0.05)]">
                    <div className="flex flex-col">
                       <span className="text-xs font-black text-slate-800 uppercase truncate max-w-[140px] tracking-tight">{emp.name}</span>
                       <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{emp.cargo}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 border-b border-slate-100">
                    <span className="text-[10px] font-black text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg">{emp.workPeriod}</span>
                  </td>
                  {daysArr.map(d => {
                    const shifts = emp.shifts[monthKey] || Array(31).fill('T');
                    const shift = shifts[d] || 'T';
                    const isSelected = selectedDayIdx === d;
                    const date = new Date(currentMY.year, currentMY.month, d + 1);
                    const isSunday = date.getDay() === 0;

                    const shiftOpt = SHIFT_OPTIONS.find(o => o.value === shift) || { value: shift, label: shift, color: shift.startsWith('FF') ? 'bg-rose-500' : 'bg-slate-200' };

                    return (
                      <td 
                        key={d} 
                        onClick={() => selectedDayIdx === d ? onOpenDayDetail(d) : onSelectDay(d)}
                        className={`p-1.5 border-b border-slate-50 text-center transition-all ${isSelected ? 'bg-orange-50/40 shadow-inner' : ''}`}
                      >
                        <div className="relative flex justify-center">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-[11px] font-black text-white shadow-sm transition-all shadow-indigo-100/20 ${shiftOpt.color} ${isSunday && shift === 'T' ? 'ring-2 ring-rose-500' : ''}`}>
                            {shiftOpt.label.split(' ')[0]}
                          </div>
                          
                          {(isEditable && !isLocked) && (
                             <select 
                               value={shift} 
                               onChange={(e) => onUpdateShift(emp.id, d, e.target.value as ShiftType)}
                               className="absolute inset-0 opacity-0 cursor-pointer z-10 w-full h-full"
                             >
                               {SHIFT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                               {shift.startsWith('FF') && <option value={shift}>{shift}</option>}
                             </select>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="flex-1 p-6 overflow-auto custom-scrollbar bg-slate-50">
           <div className="grid grid-cols-7 gap-4">
              {WEEKDAY_ABBR.map(wd => <div key={wd} className="text-center text-[10px] font-black text-slate-400 py-2">{wd}</div>)}
              {(() => {
                const firstDay = new Date(currentMY.year, currentMY.month, 1).getDay();
                const boxes = [];
                for (let i = 0; i < firstDay; i++) boxes.push(<div key={`empty-${i}`} />);
                for (let i = 1; i <= daysInMonth; i++) {
                   const dIdx = i - 1;
                   const stats = dailyStaff[dIdx];
                   const isSelected = selectedDayIdx === dIdx;
                   const isUnder = (stats.opening < 4 || stats.closing <= 3) && new Date(currentMY.year, currentMY.month, i).getDay() !== 0;
                   boxes.push(
                     <div 
                       key={i} 
                       onClick={() => onOpenDayDetail(dIdx)}
                       className={`aspect-square bg-white rounded-3xl border p-4 flex flex-col justify-between group cursor-pointer hover:shadow-xl hover:-translate-y-1 transition-all ${isSelected ? 'border-orange-500 shadow-lg shadow-orange-100 ring-2 ring-orange-500' : 'border-slate-100 shadow-sm'} ${isUnder ? 'bg-rose-50 border-rose-200' : ''}`}
                     >
                       <div className="flex justify-between items-start">
                          <span className={`text-sm font-black ${isSelected ? 'text-orange-600' : 'text-slate-800'}`}>{i}</span>
                          {isUnder && <Icon name="warning" className="text-rose-500 text-xs" />}
                       </div>
                       <div className="flex flex-col items-center">
                          <span className="text-[20px] font-black text-slate-900 leading-none">{stats.total}</span>
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Ativos</span>
                       </div>
                       <div className="flex justify-between w-full pt-2 border-t border-slate-50">
                          <span className={`text-[8px] font-black ${stats.opening < 4 ? 'text-rose-600' : 'text-slate-400'}`}>A:{stats.opening}</span>
                          <span className={`text-[8px] font-black ${stats.closing <= 3 ? 'text-rose-600' : 'text-slate-400'}`}>F:{stats.closing}</span>
                       </div>
                     </div>
                   );
                }
                return boxes;
              })()}
           </div>
        </div>
      )}
      
      {/* Grid Footer - Legend & Info */}
      <div className="p-4 bg-white border-t border-slate-100 flex items-center justify-between no-print">
         <div className="flex gap-4">
            <LegendItem color="bg-emerald-500" label="Trabalho" />
            <LegendItem color="bg-rose-500" label="Folga" />
            <LegendItem color="bg-teal-500" label="Curso" />
            <LegendItem color="bg-indigo-300" label="Férias" />
            <div className="flex items-center gap-2 group cursor-help transition-opacity">
               <div className="w-2.5 h-2.5 rounded-full bg-rose-200 animate-pulse"></div>
               <span className="text-[10px] font-black text-slate-400 uppercase">Atenção Crítica de Equipe</span>
            </div>
         </div>
      </div>
    </div>
  );
};

const LegendItem: React.FC<{ color: string; label: string }> = ({ color, label }) => (
  <div className="flex items-center gap-2">
    <div className={`w-3 h-3 rounded-md ${color} shadow-sm shadow-indigo-100/50`}></div>
    <span className="text-[10px] font-black text-slate-500 uppercase tracking-tight">{label}</span>
  </div>
);
