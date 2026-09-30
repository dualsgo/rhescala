// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { useScheduleExport, UseScheduleExportReturn } from '../hooks/useScheduleExport';
import { Employee, MonthYear, JornadaSettings } from '../types';
import { DEFAULT_JORNADA_SETTINGS } from '../constants';
import * as clipboardModule from '../src/utils/clipboard';
import * as exportCsvModule from '../src/utils/exportScheduleCsv';
import * as operationalNoticeModule from '../src/services/operationalNoticeService';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('useScheduleExport', () => {
  const currentMY: MonthYear = { year: 2026, month: 9 }; // Outubro 2026

  const mockEmployee: Employee = {
    id: 'emp-1',
    name: 'Ana Maria',
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

  const defaultJornadaSettings: JornadaSettings = DEFAULT_JORNADA_SETTINGS;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  function mountHook(showDialogMock = vi.fn().mockResolvedValue(true)) {
    let hookResult!: UseScheduleExportReturn;
    function TestComponent() {
      hookResult = useScheduleExport({
        employees: [mockEmployee],
        currentMY,
        jornadaSettings: defaultJornadaSettings,
        showDialog: showDialogMock,
      });
      return null;
    }

    const container = document.createElement('div');
    const root = createRoot(container);
    return {
      render: async () => {
        await act(async () => {
          root.render(React.createElement(TestComponent));
        });
        return hookResult;
      },
      cleanup: () => root.unmount(),
    };
  }

  it('handleShareApoioWhatsApp deve gerar o aviso, copiar para a área de transferência e exibir diálogo de sucesso', async () => {
    const showDialog = vi.fn().mockResolvedValue(true);
    const generateSpy = vi.spyOn(operationalNoticeModule, 'generateOperationalNotice').mockReturnValue('Texto do Apoio Operacional Mock');
    const copySpy = vi.spyOn(clipboardModule, 'copyToClipboard').mockResolvedValue(true);

    const helper = mountHook(showDialog);
    const hook = await helper.render();

    await act(async () => {
      await hook.handleShareApoioWhatsApp(5);
    });

    expect(generateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        dayIdx: 5,
        currentMY,
        employees: [mockEmployee],
      })
    );
    expect(copySpy).toHaveBeenCalledWith('Texto do Apoio Operacional Mock');
    expect(showDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Apoio Operacional Copiado!',
      })
    );

    helper.cleanup();
  });

  it('handleShareApoioWhatsApp deve alertar caso a cópia para a área de transferência falhe', async () => {
    const showDialog = vi.fn().mockResolvedValue(true);
    vi.spyOn(operationalNoticeModule, 'generateOperationalNotice').mockReturnValue('Texto');
    vi.spyOn(clipboardModule, 'copyToClipboard').mockResolvedValue(false);

    const helper = mountHook(showDialog);
    const hook = await helper.render();

    await act(async () => {
      await hook.handleShareApoioWhatsApp(0);
    });

    expect(showDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Cópia Manual',
        type: 'alert',
      })
    );

    helper.cleanup();
  });

  it('handleExportScheduleCsv deve invocar downloadScheduleCsv corretamente', async () => {
    const showDialog = vi.fn().mockResolvedValue(true);
    const downloadSpy = vi.spyOn(exportCsvModule, 'downloadScheduleCsv').mockImplementation(() => {});

    const helper = mountHook(showDialog);
    const hook = await helper.render();

    act(() => {
      hook.handleExportScheduleCsv();
    });

    expect(downloadSpy).toHaveBeenCalledWith([mockEmployee], currentMY, defaultJornadaSettings);
    expect(showDialog).not.toHaveBeenCalled();

    helper.cleanup();
  });

  it('handleExportScheduleCsv deve exibir diálogo caso ocorra um erro durante o download', async () => {
    const showDialog = vi.fn().mockResolvedValue(true);
    vi.spyOn(exportCsvModule, 'downloadScheduleCsv').mockImplementation(() => {
      throw new Error('Falha de escrita de arquivo');
    });

    const helper = mountHook(showDialog);
    const hook = await helper.render();

    act(() => {
      hook.handleExportScheduleCsv();
    });

    expect(showDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Erro de Exportação',
        message: expect.stringContaining('Falha de escrita de arquivo'),
        type: 'alert',
      })
    );

    helper.cleanup();
  });

  it('generateScheduleCsvContent (função pura) deve formatar cabeçalhos com dias e linhas de colaboradores', () => {
    const csvContent = exportCsvModule.generateScheduleCsvContent(
      [mockEmployee],
      currentMY,
      defaultJornadaSettings
    );

    expect(csvContent).toContain('Colaborador;Função;Turno;Horário');
    expect(csvContent).toContain('Ana Maria;');
    expect(csvContent).toContain('Abertura;');
    expect(csvContent).toContain('10h às 18h20');
  });
});
