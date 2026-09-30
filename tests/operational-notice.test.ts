import { describe, it, expect } from 'vitest';
import { generateOperationalNotice } from '../src/services/operationalNoticeService';
import { Employee, MonthYear } from '../types';

describe('operationalNoticeService - generateOperationalNotice', () => {
  const currentMY: MonthYear = { year: 2026, month: 9 }; // Outubro 2026

  const empAbertura: Employee = {
    id: 'emp-1',
    name: 'Ana Caixa',
    isYoungApprentice: false,
    status: 'active',
    statusColor: '#000',
    shifts: { '2026-10': ['T'] },
    dailyHours: { '2026-10': ['10h às 18h20'] },
    tacticalPositions: { '2026-10': ['P1'] },
    workPeriod: '10h às 18h20',
    preferredDayOff: 'Segunda-feira',
    shiftName: 'Abertura',
  };

  const empFechamento: Employee = {
    id: 'emp-2',
    name: 'Carlos Caixa',
    isYoungApprentice: false,
    status: 'active',
    statusColor: '#000',
    shifts: { '2026-10': ['T'] },
    dailyHours: { '2026-10': ['13h40 às 22h'] },
    tacticalPositions: { '2026-10': ['P1'] },
    workPeriod: '13h40 às 22h',
    preferredDayOff: 'Terça-feira',
    shiftName: 'Fechamento',
  };

  it('deve gerar texto contendo cabeçalho, funções diárias e dança de cobertura', () => {
    const text = generateOperationalNotice({
      dayIdx: 0,
      currentMY,
      employees: [empAbertura],
      tacticalDisplayMode: 'positions',
    });

    expect(text).toContain('🛠️ *Apoio Operacional*');
    expect(text).toContain('📍 *Funções Diárias (Correlatas)*');
    expect(text).toContain('🟥 *Caixa (P1)*');
    expect(text).toContain('⚡ *Dança de Cobertura*');
    expect(text).toContain('• Ida p/ Caixa: Vai o Fiscal > Vendas (P3)');
  });

  it('deve formatar rótulos para modo roles quando tacticalDisplayMode for "roles"', () => {
    const text = generateOperationalNotice({
      dayIdx: 0,
      currentMY,
      employees: [empAbertura],
      tacticalDisplayMode: 'roles',
    });

    expect(text).toContain('🟥 *Caixa*\n');
    expect(text).toContain('🟦 *Fiscal*\n');
    expect(text).toContain('• Ida p/ Caixa: Fiscal > Vendas / Atendimento');
  });

  it('deve incluir seção de Revezamento de Caixa quando houver Caixa na Abertura e no Fechamento', () => {
    const text = generateOperationalNotice({
      dayIdx: 0,
      currentMY,
      employees: [empAbertura, empFechamento],
      tacticalDisplayMode: 'positions',
    });

    expect(text).toContain('🤝 *Revezamento (Caixa)*');
    expect(text).toContain('CARLOS');
    expect(text).toContain('ANA');
  });

  it('não deve incluir seção de Revezamento de Caixa quando houver apenas um caixa', () => {
    const text = generateOperationalNotice({
      dayIdx: 0,
      currentMY,
      employees: [empAbertura],
      tacticalDisplayMode: 'positions',
    });

    expect(text).not.toContain('🤝 *Revezamento (Caixa)*');
  });
});
