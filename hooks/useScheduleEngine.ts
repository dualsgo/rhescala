/**
 * Fachada / Orquestrador do Motor de Escala (Rhescala Engine Facade)
 * 
 * Este módulo unifica as funcionalidades especializadas do motor de escalas
 * (CLT, rotação de domingos, posições táticas, almoço, rotinas, auditoria,
 * picos sazonais, dias protegidos e orquestração mensal), mantendo compatibilidade
 * retroativa com toda a UI do projeto enquanto delega as regras de negócio
 * para módulos de domínio puros e testáveis em src/engine/.
 */

import {
    WEEKDAY_NAMES,
    isWorkingShift,
    isBirthday,
    getTargetHours,
    getPrevMonthWorkStreak,
    generateMonthForEmployee,
    isEmployeePreferredDayOff
} from '../src/engine/clt/clt-rules';

import {
    isSundayUnavailable,
    getPrevMonthConsecutive,
    buildSundayAssignments,
    findSundayViolations
} from '../src/engine/clt/sunday-rotation';

import {
    getShiftClassification,
    resolveTacticalDay,
    distributeTacticalPositions,
    applyTacticalOnly
} from '../src/engine/tactical/tactical-positions';

import {
    calculateLunches,
    calculateDetailedLunches
} from '../src/engine/tactical/lunch-scheduler';
import type {
    LunchAllocation,
    DetailedLunchAssignment
} from '../src/engine/tactical/lunch-scheduler';

import {
    getCleaningSchedule
} from '../src/engine/routines/cleaning-rotation';

import {
    detectScheduleDiffs
} from '../src/engine/audit/schedule-diff';

import {
    optimizeOctoberPeak,
    optimizeDecemberPeak,
    optimizePeakWeek
} from '../src/engine/peaks/seasonal-peaks';

import {
    optimizeProtectedDays
} from '../src/engine/peaks/protected-days';

import {
    applyMonthUpdate,
    generateYearSchedule,
    applyHoursOnly,
    applyFolgasOnly,
    generateCleanMonthSchedule
} from '../src/engine/orchestration/month-generator';

import {
    getLegalOverride,
    getLegalOverrideForDay,
    isProtectedShift
} from '../src/engine/clt/legal-overrides';

import {
    WORKING_TACTICAL_CODES
} from '../src/engine/shifts/shift-predicates';

export {
    WEEKDAY_NAMES,
    isWorkingShift,
    isBirthday,
    getTargetHours,
    getPrevMonthWorkStreak,
    generateMonthForEmployee,
    isEmployeePreferredDayOff,
    isSundayUnavailable,
    getPrevMonthConsecutive,
    buildSundayAssignments,
    findSundayViolations,
    getShiftClassification,
    resolveTacticalDay,
    distributeTacticalPositions,
    applyTacticalOnly,
    calculateLunches,
    calculateDetailedLunches,
    getCleaningSchedule,
    detectScheduleDiffs,
    optimizeOctoberPeak,
    optimizeDecemberPeak,
    optimizePeakWeek,
    optimizeProtectedDays,
    applyMonthUpdate,
    generateYearSchedule,
    applyHoursOnly,
    applyFolgasOnly,
    generateCleanMonthSchedule,
    getLegalOverride,
    getLegalOverrideForDay,
    isProtectedShift,
    WORKING_TACTICAL_CODES
};

export type {
    LunchAllocation,
    DetailedLunchAssignment
};
