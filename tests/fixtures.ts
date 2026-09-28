import { Employee } from '../types';

export function createTestEmployee(overrides: Partial<Employee> = {}): Employee {
  return {
    id: 'emp-1',
    name: 'Colaborador Teste',
    isYoungApprentice: false,
    contractType: 'CLT',
    jornada: '6x1',
    cargo: 'Atendente',
    status: 'active',
    statusColor: '#00aa00',
    shifts: {},
    dailyHours: {},
    tacticalPositions: {},
    workPeriod: '13:40 às 22:00',
    preferredDayOff: 'Segunda-feira',
    shiftName: 'Fechamento',
    ...overrides
  };
}
