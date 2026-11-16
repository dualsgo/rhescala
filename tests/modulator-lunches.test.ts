import { describe, it, expect } from 'vitest';
import { modulateDailyLunches, ModulatorLunchInput } from '../src/engine/tactical/modulator-lunches';

describe('Modulador da Escala Diária — Regras de Almoço (Troca 14h & Máx 2/h)', () => {
  const emp = (
    id: string,
    name: string,
    shiftName: 'Abertura' | 'Intermediário' | 'Fechamento',
    extra?: Partial<ModulatorLunchInput>
  ): ModulatorLunchInput => ({
    id,
    name,
    shiftName,
    hour: shiftName === 'Abertura' ? '10h às 18h20' : shiftName === 'Intermediário' ? '12h às 20h20' : '13h40 às 22h',
    pos: 'Vendas',
    ...extra,
  });

  it('1. Aprendiz sempre recebe 12h45 fixo e Estoquista é flexível sem contar no piso de 3 até 14h', () => {
    const team: ModulatorLunchInput[] = [
      emp('ap1', 'Lucas Aprendiz', 'Abertura', { isYoungApprentice: true, hour: '10h às 16h15', pos: 'Apoio' }),
      emp('est1', 'Marcos Estoque', 'Abertura', { cargo: 'Estoquista', pos: 'Estoque' }),
      emp('ab1', 'Ana', 'Abertura', { pos: 'Caixa' }),
      emp('ab2', 'Bruno', 'Abertura', { pos: 'Vendas' }),
      emp('ab3', 'Carla', 'Abertura', { pos: 'Pacote' }),
    ];

    const { lunchesById, summary } = modulateDailyLunches(team);

    expect(lunchesById['ap1']).toBe('12h45');
    expect(summary.apprenticeCount).toBe(1);
    expect(summary.estoquistaCount).toBe(1);
    expect(summary.aberturaSalonCount).toBe(3);

    // Como só há 3 no salão (tirando Aprendiz e Estoquista), os 3 vão às 14h!
    expect(lunchesById['ab1']).toBe('14h');
    expect(lunchesById['ab2']).toBe('14h');
    expect(lunchesById['ab3']).toBe('14h');
  });

  it('2. Abertura com 4 pessoas no salão: 1 vai às 13h e 3 vão às 14h', () => {
    const team: ModulatorLunchInput[] = [
      emp('ab1', 'Ana', 'Abertura', { pos: 'Caixa' }),
      emp('ab2', 'Bruno', 'Abertura', { pos: 'Vendas' }),
      emp('ab3', 'Carla', 'Abertura', { pos: 'Pacote' }),
      emp('ab4', 'Daniel', 'Abertura', { pos: 'Apoio' }),
    ];

    const { lunchesById, summary } = modulateDailyLunches(team);

    expect(summary.aberturaAt12).toBe(0);
    expect(summary.aberturaAt13).toBe(1);
    expect(summary.aberturaAt14).toBe(3);
    expect(Object.values(lunchesById).filter(v => v === '13h')).toHaveLength(1);
    expect(Object.values(lunchesById).filter(v => v === '14h')).toHaveLength(3);
  });

  it('3. Abertura com 5 pessoas no salão: 1 vai às 12h, 1 vai às 13h e 3 vão às 14h', () => {
    const team: ModulatorLunchInput[] = [
      emp('ab1', 'Ana', 'Abertura', { pos: 'Caixa' }),
      emp('ab2', 'Bruno', 'Abertura', { pos: 'Vendas' }),
      emp('ab3', 'Carla', 'Abertura', { pos: 'Pacote' }),
      emp('ab4', 'Daniel', 'Abertura', { pos: 'Apoio' }),
      emp('ab5', 'Eduarda', 'Abertura', { pos: 'Fiscal' }),
    ];

    const { summary } = modulateDailyLunches(team);

    expect(summary.aberturaAt12).toBe(1);
    expect(summary.aberturaAt13).toBe(1);
    expect(summary.aberturaAt14).toBe(3);
  });

  it('4. Fechamento com 6 pessoas: máximo 2 por hora (2 às 15h, 2 às 16h, 2 às 17h)', () => {
    const team: ModulatorLunchInput[] = [
      emp('ab1', 'A1', 'Abertura'),
      emp('ab2', 'A2', 'Abertura'),
      emp('ab3', 'A3', 'Abertura'),
      emp('f1', 'F1', 'Fechamento', { pos: 'Caixa' }),
      emp('f2', 'F2', 'Fechamento', { pos: 'Caixa' }),
      emp('f3', 'F3', 'Fechamento'),
      emp('f4', 'F4', 'Fechamento'),
      emp('f5', 'F5', 'Fechamento'),
      emp('f6', 'F6', 'Fechamento'),
    ];

    const { lunchesById, summary } = modulateDailyLunches(team);

    expect(summary.fechamentoAt15).toBe(2);
    expect(summary.fechamentoAt16).toBe(2);
    expect(summary.fechamentoAt17).toBe(2);
    // Dois Caixas não saem juntos
    expect(lunchesById['f1']).not.toBe(lunchesById['f2']);
  });

  it('5. Fechamento com menos pessoas (3 pessoas): distribui 1 às 15h, 1 às 16h e 1 às 17h sem concentrar', () => {
    const team: ModulatorLunchInput[] = [
      emp('ab1', 'A1', 'Abertura'),
      emp('ab2', 'A2', 'Abertura'),
      emp('ab3', 'A3', 'Abertura'),
      emp('f1', 'F1', 'Fechamento', { pos: 'Caixa' }),
      emp('f2', 'F2', 'Fechamento'),
      emp('f3', 'F3', 'Fechamento'),
    ];

    const { summary } = modulateDailyLunches(team);

    expect(summary.fechamentoAt15).toBe(1);
    expect(summary.fechamentoAt16).toBe(1);
    expect(summary.fechamentoAt17).toBe(1);
  });
});
