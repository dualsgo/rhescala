import { useCallback } from 'react';
import { 
  Employee, 
  MonthYear, 
  ShiftType, 
  AuditLogEntry, 
  Holiday, 
  JornadaSettings 
} from '../types';
import { AuditImpactPreview } from '../components/AuditJustificationModal';
import { 
  classifyShiftChange, 
  classifyHourChange, 
  classifyTacticalChange 
} from '../src/utils/auditUtils';
import { 
  isEmployeeActiveInMonth, 
  buildHolidaySet, 
  DEFAULT_JORNADA_SETTINGS 
} from '../src/engine/config/schedule-constants';
import { getShiftClassification } from '../src/engine/shifts/shift-predicates';
import { resolveTacticalDay } from '../src/engine/tactical/tactical-positions';

export interface PendingAuditAction {
  impacts: AuditImpactPreview[];
  onConfirm: (justification: string) => void;
}

export interface UseScheduleCommandsParams {
  employees: Employee[];
  setEmployees: (action: React.SetStateAction<Employee[]>, description?: string) => void;
  currentMY: MonthYear;
  monthKey: string;
  isReadOnly: boolean;
  isValidated: boolean;
  setAuditLogs: React.Dispatch<React.SetStateAction<AuditLogEntry[]>>;
  setPendingAuditAction: (action: PendingAuditAction | null) => void;
  customHolidays?: Holiday[];
  deletedNationalHolidays?: string[];
  jornadaSettings?: JornadaSettings;
}

export interface ScheduleCommands {
  handleUpdateShift: (empId: string, dayIdx: number, newShift: ShiftType) => void;
  handleUpdateShifts: (updates: { empId: string; dayIdx: number; newShift: ShiftType }[]) => void;
  onUpdateEmployeeDailyHour: (empId: string, dayIdx: number, newHour: string) => void;
  onUpdateTacticalPosition: (empId: string, dayIdx: number, newPos: string | null) => void;
}

/**
 * Cria uma entrada padronizada de registro de auditoria.
 */
function createAuditLog(params: {
  empId: string;
  empName: string;
  monthKey: string;
  dayIdx: number;
  dateStr: string;
  changeType: AuditLogEntry['changeType'];
  beforeVal: string;
  afterVal: string;
  humanDescription: string;
  justification: string;
}): AuditLogEntry {
  return {
    id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toISOString(),
    authorRole: 'admin',
    authorName: 'Gestor',
    empId: params.empId,
    empName: params.empName,
    monthKey: params.monthKey,
    dayIdx: params.dayIdx,
    dateStr: params.dateStr,
    changeType: params.changeType,
    beforeVal: params.beforeVal,
    afterVal: params.afterVal,
    humanDescription: params.humanDescription,
    justification: params.justification,
    isPostOfficialization: true,
  };
}

/**
 * Hook da camada de aplicação responsável por orquestrar comandos de alteração de escala,
 * controlando a interceptação de auditoria pós-oficialização, geração de logs e mutação de estado.
 */
export function useScheduleCommands(params: UseScheduleCommandsParams): ScheduleCommands {
  const {
    employees,
    setEmployees,
    currentMY,
    monthKey,
    isReadOnly,
    isValidated,
    setAuditLogs,
    setPendingAuditAction,
    customHolidays = [],
    deletedNationalHolidays = [],
    jornadaSettings = DEFAULT_JORNADA_SETTINGS,
  } = params;

  /**
   * 1. Atualização individual de turno
   */
  const handleUpdateShift = useCallback((empId: string, dayIdx: number, newShift: ShiftType) => {
    if (isReadOnly) return;
    const targetEmp = employees.find(e => e.id === empId);
    if (!targetEmp) return;

    const oldShift = targetEmp.shifts[monthKey]?.[dayIdx] || 'T';
    if (oldShift === newShift) return; // Zero falsos positivos

    const dateStr = `${String(dayIdx + 1).padStart(2, '0')}/${String(currentMY.month + 1).padStart(2, '0')}/${currentMY.year}`;
    const curHour = targetEmp.dailyHours[monthKey]?.[dayIdx] || targetEmp.workPeriod || '';

    const applyChange = (justification?: string) => {
      setEmployees(prev => {
        const next = prev.map(emp => {
          if (emp.id !== empId) return emp;
          const sfs = [...(emp.shifts[monthKey] || [])];
          sfs[dayIdx] = newShift;
          return { ...emp, shifts: { ...emp.shifts, [monthKey]: sfs } };
        });

        const dateStrIso = `${currentMY.year}-${String(currentMY.month + 1).padStart(2, '0')}-${String(dayIdx + 1).padStart(2, '0')}`;
        const isHoliday = buildHolidaySet(currentMY.year, customHolidays, deletedNationalHolidays).has(dateStrIso);
        const isSunday = new Date(currentMY.year, currentMY.month, dayIdx + 1).getDay() === 0;
        const activeEmps = next.filter(e => isEmployeeActiveInMonth(e, currentMY.year, currentMY.month));
        const dayRoles = resolveTacticalDay(activeEmps, monthKey, dayIdx, isHoliday, isSunday, jornadaSettings);

        return next.map(emp => {
          if (dayRoles[emp.id]) {
            const currentMonthRoles = { ...(emp.dailyAssignedRoles?.[monthKey] || {}) };
            currentMonthRoles[dayIdx] = dayRoles[emp.id];
            return {
              ...emp,
              dailyAssignedRoles: {
                ...(emp.dailyAssignedRoles || {}),
                [monthKey]: currentMonthRoles
              }
            };
          }
          return emp;
        });
      }, 'Alteração de turno');

      if (justification) {
        const c = classifyShiftChange(targetEmp.name, dateStr, oldShift, newShift, curHour);
        const newLog = createAuditLog({
          empId: targetEmp.id,
          empName: targetEmp.name,
          monthKey,
          dayIdx,
          dateStr,
          changeType: c.changeType,
          beforeVal: c.beforeVal,
          afterVal: c.afterVal,
          humanDescription: c.humanDescription,
          justification,
        });
        setAuditLogs(prev => [newLog, ...prev]);
      }
    };

    if (isValidated) {
      const c = classifyShiftChange(targetEmp.name, dateStr, oldShift, newShift, curHour);
      setPendingAuditAction({
        impacts: [{
          empId: targetEmp.id,
          empName: targetEmp.name,
          dayIdx,
          dateStr,
          beforeVal: c.beforeVal,
          afterVal: c.afterVal,
          changeType: c.changeType,
          humanDescription: c.humanDescription,
        }],
        onConfirm: (justification) => {
          applyChange(justification);
          setPendingAuditAction(null);
        }
      });
    } else {
      applyChange();
    }
  }, [isReadOnly, employees, monthKey, currentMY, isValidated, setEmployees, setAuditLogs, setPendingAuditAction, customHolidays, deletedNationalHolidays, jornadaSettings]);

  /**
   * 2. Atualização em lote de turnos
   */
  const handleUpdateShifts = useCallback((updates: { empId: string; dayIdx: number; newShift: ShiftType }[]) => {
    if (isReadOnly) return;
    const effectiveUpdates = updates.filter(u => {
      const emp = employees.find(e => e.id === u.empId);
      const oldShift = emp?.shifts[monthKey]?.[u.dayIdx] || 'T';
      return oldShift !== u.newShift;
    });
    if (effectiveUpdates.length === 0) return;

    const applyChange = (justification?: string) => {
      setEmployees(prev => {
        const next = prev.map(emp => {
          const empU = effectiveUpdates.filter(u => u.empId === emp.id);
          if (empU.length === 0) return emp;
          const sfs = [...(emp.shifts[monthKey] || [])];
          empU.forEach(u => { sfs[u.dayIdx] = u.newShift; });
          return { ...emp, shifts: { ...emp.shifts, [monthKey]: sfs } };
        });

        const affectedDays = Array.from(new Set(effectiveUpdates.map(u => u.dayIdx)));
        const activeEmps = next.filter(e => isEmployeeActiveInMonth(e, currentMY.year, currentMY.month));
        const holidaySet = buildHolidaySet(currentMY.year, customHolidays, deletedNationalHolidays);

        const rolesByDay: Record<number, Record<string, any>> = {};
        for (const d of affectedDays) {
          const dateStrIso = `${currentMY.year}-${String(currentMY.month + 1).padStart(2, '0')}-${String(d + 1).padStart(2, '0')}`;
          const isHoliday = holidaySet.has(dateStrIso);
          const isSunday = new Date(currentMY.year, currentMY.month, d + 1).getDay() === 0;
          rolesByDay[d] = resolveTacticalDay(activeEmps, monthKey, d, isHoliday, isSunday, jornadaSettings);
        }

        return next.map(emp => {
          let updatedRolesForEmp: Record<number, any> | null = null;
          for (const d of affectedDays) {
            if (rolesByDay[d]?.[emp.id]) {
              if (!updatedRolesForEmp) updatedRolesForEmp = { ...(emp.dailyAssignedRoles?.[monthKey] || {}) };
              updatedRolesForEmp[d] = rolesByDay[d][emp.id];
            }
          }
          if (updatedRolesForEmp) {
            return {
              ...emp,
              dailyAssignedRoles: {
                ...(emp.dailyAssignedRoles || {}),
                [monthKey]: updatedRolesForEmp
              }
            };
          }
          return emp;
        });
      }, 'Alteração de múltiplos turnos');

      if (justification) {
        const newLogs: AuditLogEntry[] = effectiveUpdates.map(u => {
          const emp = employees.find(e => e.id === u.empId)!;
          const dateStr = `${String(u.dayIdx + 1).padStart(2, '0')}/${String(currentMY.month + 1).padStart(2, '0')}/${currentMY.year}`;
          const oldShift = emp.shifts[monthKey]?.[u.dayIdx] || 'T';
          const curHour = emp.dailyHours[monthKey]?.[u.dayIdx] || emp.workPeriod || '';
          const c = classifyShiftChange(emp.name, dateStr, oldShift, u.newShift, curHour);
          return createAuditLog({
            empId: emp.id,
            empName: emp.name,
            monthKey,
            dayIdx: u.dayIdx,
            dateStr,
            changeType: c.changeType,
            beforeVal: c.beforeVal,
            afterVal: c.afterVal,
            humanDescription: c.humanDescription,
            justification,
          });
        });
        setAuditLogs(prev => [...newLogs, ...prev]);
      }
    };

    if (isValidated) {
      const impacts = effectiveUpdates.map(u => {
        const emp = employees.find(e => e.id === u.empId)!;
        const dateStr = `${String(u.dayIdx + 1).padStart(2, '0')}/${String(currentMY.month + 1).padStart(2, '0')}/${currentMY.year}`;
        const oldShift = emp.shifts[monthKey]?.[u.dayIdx] || 'T';
        const curHour = emp.dailyHours[monthKey]?.[u.dayIdx] || emp.workPeriod || '';
        const c = classifyShiftChange(emp.name, dateStr, oldShift, u.newShift, curHour);
        return {
          empId: emp.id,
          empName: emp.name,
          dayIdx: u.dayIdx,
          dateStr,
          beforeVal: c.beforeVal,
          afterVal: c.afterVal,
          changeType: c.changeType,
          humanDescription: c.humanDescription,
        };
      });

      setPendingAuditAction({
        impacts,
        onConfirm: (justification) => {
          applyChange(justification);
          setPendingAuditAction(null);
        }
      });
    } else {
      applyChange();
    }
  }, [isReadOnly, employees, monthKey, currentMY, isValidated, setEmployees, setAuditLogs, setPendingAuditAction]);

  /**
   * 3. Atualização de horário diário
   */
  const onUpdateEmployeeDailyHour = useCallback((empId: string, dayIdx: number, newHour: string) => {
    if (isReadOnly) return;
    const targetEmp = employees.find(e => e.id === empId);
    if (!targetEmp) return;

    const oldHour = targetEmp.dailyHours[monthKey]?.[dayIdx] || targetEmp.workPeriod || '';
    if (oldHour === newHour) return; // Zero falsos positivos

    const dateStr = `${String(dayIdx + 1).padStart(2, '0')}/${String(currentMY.month + 1).padStart(2, '0')}/${currentMY.year}`;

    const applyChange = (justification?: string) => {
      setEmployees(prev => prev.map(emp => {
        if (emp.id !== empId) return emp;
        const hours = [...(emp.dailyHours[monthKey] || [])];
        hours[dayIdx] = newHour;
        return { ...emp, dailyHours: { ...emp.dailyHours, [monthKey]: hours } };
      }), 'Alteração de horário');

      if (justification) {
        const c = classifyHourChange(targetEmp.name, dateStr, oldHour, newHour);
        const newLog = createAuditLog({
          empId: targetEmp.id,
          empName: targetEmp.name,
          monthKey,
          dayIdx,
          dateStr,
          changeType: c.changeType,
          beforeVal: c.beforeVal,
          afterVal: c.afterVal,
          humanDescription: c.humanDescription,
          justification,
        });
        setAuditLogs(prev => [newLog, ...prev]);
      }
    };

    if (isValidated) {
      const c = classifyHourChange(targetEmp.name, dateStr, oldHour, newHour);
      setPendingAuditAction({
        impacts: [{
          empId: targetEmp.id,
          empName: targetEmp.name,
          dayIdx,
          dateStr,
          beforeVal: c.beforeVal,
          afterVal: c.afterVal,
          changeType: c.changeType,
          humanDescription: c.humanDescription,
        }],
        onConfirm: (justification) => {
          applyChange(justification);
          setPendingAuditAction(null);
        }
      });
    } else {
      applyChange();
    }
  }, [isReadOnly, employees, monthKey, currentMY, isValidated, setEmployees, setAuditLogs, setPendingAuditAction]);

  /**
   * 4. Atualização de posição tática (com rotação/auto-swap de grupo de abertura/fechamento)
   */
  const onUpdateTacticalPosition = useCallback((empId: string, dayIdx: number, newPos: string | null) => {
    if (isReadOnly) return;
    const targetEmp = employees.find(e => e.id === empId);
    if (!targetEmp) return;

    const dateStr = `${String(dayIdx + 1).padStart(2, '0')}/${String(currentMY.month + 1).padStart(2, '0')}/${currentMY.year}`;
    const oldPos = targetEmp.tacticalPositions?.[monthKey]?.[dayIdx] || null;
    if (oldPos === newPos) return;

    const applyChange = (justification?: string) => {
      setEmployees(prev => {
        const activeEmps = prev.filter(e => isEmployeeActiveInMonth(e, currentMY.year, currentMY.month));
        const empHour = targetEmp.dailyHours[monthKey]?.[dayIdx] || targetEmp.workPeriod;
        const date = new Date(currentMY.year, currentMY.month, dayIdx + 1);
        const isSunday = date.getDay() === 0;
        const targetGroup = getShiftClassification(empHour, isSunday);

        const isHoliday = buildHolidaySet(currentMY.year, customHolidays, deletedNationalHolidays).has(`${currentMY.year}-${String(currentMY.month + 1).padStart(2, '0')}-${String(dayIdx + 1).padStart(2, '0')}`);
        const resolved = resolveTacticalDay(activeEmps, monthKey, dayIdx, isHoliday, isSunday, jornadaSettings);
        const resolvedOldPos = targetEmp.tacticalPositions?.[monthKey]?.[dayIdx] || resolved[empId];

        return prev.map(emp => {
          if (emp.id === empId) {
            const positions = [...(emp.tacticalPositions?.[monthKey] || [])];
            positions[dayIdx] = newPos;
            return { ...emp, tacticalPositions: { ...emp.tacticalPositions, [monthKey]: positions } };
          }

          const eHour = emp.dailyHours[monthKey]?.[dayIdx] || emp.workPeriod;
          const eGroup = getShiftClassification(eHour, isSunday);

          if (eGroup === targetGroup && newPos !== 'AUTO') {
            const empCurrentPos = emp.tacticalPositions?.[monthKey]?.[dayIdx] || resolved[emp.id];
            if (empCurrentPos === newPos) {
              const positions = [...(emp.tacticalPositions?.[monthKey] || [])];
              positions[dayIdx] = resolvedOldPos;
              return { ...emp, tacticalPositions: { ...emp.tacticalPositions, [monthKey]: positions } };
            }
          }

          return emp;
        });
      }, 'Alteração de função (correlata)');

      if (justification) {
        const c = classifyTacticalChange(targetEmp.name, dateStr, oldPos, newPos);
        const newLog = createAuditLog({
          empId: targetEmp.id,
          empName: targetEmp.name,
          monthKey,
          dayIdx,
          dateStr,
          changeType: c.changeType,
          beforeVal: c.beforeVal,
          afterVal: c.afterVal,
          humanDescription: c.humanDescription,
          justification,
        });
        setAuditLogs(prev => [newLog, ...prev]);
      }
    };

    if (isValidated) {
      const c = classifyTacticalChange(targetEmp.name, dateStr, oldPos, newPos);
      setPendingAuditAction({
        impacts: [{
          empId: targetEmp.id,
          empName: targetEmp.name,
          dayIdx,
          dateStr,
          beforeVal: c.beforeVal,
          afterVal: c.afterVal,
          changeType: c.changeType,
          humanDescription: c.humanDescription,
        }],
        onConfirm: (justification) => {
          applyChange(justification);
          setPendingAuditAction(null);
        }
      });
    } else {
      applyChange();
    }
  }, [
    isReadOnly,
    employees,
    monthKey,
    currentMY,
    customHolidays,
    deletedNationalHolidays,
    jornadaSettings,
    isValidated,
    setEmployees,
    setAuditLogs,
    setPendingAuditAction
  ]);

  return {
    handleUpdateShift,
    handleUpdateShifts,
    onUpdateEmployeeDailyHour,
    onUpdateTacticalPosition,
  };
}
