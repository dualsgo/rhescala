import { useCallback } from 'react';
import { toPng } from 'html-to-image';
import { Employee, MonthYear, Holiday, JornadaSettings, TacticalDisplayMode } from '../types';
import { copyToClipboard } from '../src/utils/clipboard';
import { downloadScheduleCsv } from '../src/utils/exportScheduleCsv';
import { generateOperationalNotice } from '../src/services/operationalNoticeService';

export interface UseScheduleExportParams {
  employees: Employee[];
  currentMY: MonthYear;
  jornadaSettings: JornadaSettings;
  customHolidays?: Holiday[];
  deletedNationalHolidays?: string[];
  tacticalDisplayMode?: TacticalDisplayMode;
  showDialog: (options: {
    title: string;
    message: string;
    type?: 'alert' | 'confirm' | 'prompt';
    confirmText?: string;
    cancelText?: string;
  }) => Promise<boolean | string | null>;
}

export interface UseScheduleExportReturn {
  handleShareApoioWhatsApp: (dayIdx: number) => Promise<void>;
  handleExportScheduleCsv: () => void;
  handleExportDayImage: (elementId?: string, dayIdx?: number) => Promise<void>;
}

/**
 * Hook dedicado para orquestrar operações de exportação e compartilhamento de escala:
 * - Geração e cópia de roteiro de Apoio Operacional diário para WhatsApp;
 * - Exportação de escala mensal em formato CSV;
 * - Captura e download de imagem PNG do resumo diário.
 */
export function useScheduleExport(params: UseScheduleExportParams): UseScheduleExportReturn {
  const {
    employees,
    currentMY,
    jornadaSettings,
    customHolidays = [],
    deletedNationalHolidays = [],
    tacticalDisplayMode = 'off',
    showDialog,
  } = params;

  const handleShareApoioWhatsApp = useCallback(async (dayIdx: number) => {
    try {
      const text = generateOperationalNotice({
        dayIdx,
        currentMY,
        employees,
        customHolidays,
        deletedNationalHolidays,
        tacticalDisplayMode,
        jornadaSettings,
      });

      const copied = await copyToClipboard(text);
      if (copied) {
        await showDialog({
          title: 'Apoio Operacional Copiado!',
          message: 'O roteiro de apoio operacional e funções diárias foi copiado para a área de transferência. Você já pode colá-lo no grupo do WhatsApp da loja.'
        });
      } else {
        await showDialog({
          title: 'Cópia Manual',
          message: 'Não foi possível copiar automaticamente para a área de transferência.',
          type: 'alert'
        });
      }
    } catch (err: unknown) {
      console.error('Erro ao gerar apoio para WhatsApp:', err);
      const errorMsg = err instanceof Error ? err.message : String(err);
      await showDialog({
        title: 'Erro de Geração',
        message: `Ocorreu um erro ao gerar o texto de apoio: ${errorMsg}`,
        type: 'alert'
      });
    }
  }, [currentMY, employees, customHolidays, deletedNationalHolidays, tacticalDisplayMode, jornadaSettings, showDialog]);

  const handleExportScheduleCsv = useCallback(() => {
    try {
      downloadScheduleCsv(employees, currentMY, jornadaSettings);
    } catch (err: unknown) {
      console.error('Erro ao exportar escala em CSV:', err);
      const errorMsg = err instanceof Error ? err.message : String(err);
      showDialog({
        title: 'Erro de Exportação',
        message: `Não foi possível gerar o arquivo CSV: ${errorMsg}`,
        type: 'alert'
      });
    }
  }, [employees, currentMY, jornadaSettings, showDialog]);

  const handleExportDayImage = useCallback(async (elementId = 'day-detail-screenshot', dayIdx = 0) => {
    try {
      const el = document.getElementById(elementId);
      if (el) {
        const dataUrl = await toPng(el, { 
          backgroundColor: '#ffffff', 
          pixelRatio: 2,
          style: { 
            padding: '30px', 
            borderRadius: '32px',
            transform: 'scale(0.9)',
            transformOrigin: 'center'
          } 
        });
        const link = document.createElement('a');
        const date = `${String(dayIdx + 1).padStart(2, '0')}-${String(currentMY.month + 1).padStart(2, '0')}`;
        link.download = `escala-dia-${date}.png`;
        link.href = dataUrl;
        link.click();
      }
    } catch (err: unknown) {
      console.error('Erro ao exportar imagem do dia:', err);
      const errorMsg = err instanceof Error ? err.message : String(err);
      await showDialog({
        title: 'Erro de Exportação',
        message: `Não foi possível gerar a imagem da escala: ${errorMsg}`,
        type: 'alert'
      });
    }
  }, [currentMY, showDialog]);

  return {
    handleShareApoioWhatsApp,
    handleExportScheduleCsv,
    handleExportDayImage,
  };
}
