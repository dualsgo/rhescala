import React, { useCallback } from 'react';
import { Holiday } from '../types';

export interface UseHolidayHandlersParams {
  setCustomHolidays: React.Dispatch<React.SetStateAction<Holiday[]>>;
  setDeletedNationalHolidays: React.Dispatch<React.SetStateAction<string[]>>;
}

export interface UseHolidayHandlersReturn {
  onAddHoliday: (h: Omit<Holiday, 'id'>) => void;
  onRemoveHoliday: (id: string) => void;
  onEditHoliday: (id: string, updatedHoliday: Omit<Holiday, 'id'>) => void;
}

/**
 * Hook dedicado para gerenciar a adição, remoção e edição de feriados:
 * - Adição de novos feriados customizados (geração de id aleatório);
 * - Remoção segura: feriados nacionais ('national-...') são marcados em deletedNationalHolidays;
 *   feriados customizados são removidos do array customHolidays;
 * - Edição inteligente: edição de feriado nacional o marca como deletado e cria um novo customizado;
 *   edição de feriado customizado atualiza o registro existente no array.
 */
export function useHolidayHandlers({
  setCustomHolidays,
  setDeletedNationalHolidays,
}: UseHolidayHandlersParams): UseHolidayHandlersReturn {
  const onAddHoliday = useCallback((h: Omit<Holiday, 'id'>) => {
    const newHoliday: Holiday = { ...h, id: Math.random().toString(36).substring(2, 9) };
    setCustomHolidays(prev => [...prev, newHoliday]);
  }, [setCustomHolidays]);

  const onRemoveHoliday = useCallback((id: string) => {
    if (id.startsWith('national-')) {
      setDeletedNationalHolidays(prev => [...prev, id]);
    } else {
      setCustomHolidays(prev => prev.filter(h => h.id !== id));
    }
  }, [setCustomHolidays, setDeletedNationalHolidays]);

  const onEditHoliday = useCallback((id: string, updatedHoliday: Omit<Holiday, 'id'>) => {
    if (id.startsWith('national-')) {
      setDeletedNationalHolidays(prev => [...prev, id]);
      onAddHoliday(updatedHoliday);
    } else {
      setCustomHolidays(prev => prev.map(h => h.id === id ? { ...h, ...updatedHoliday } : h));
    }
  }, [setDeletedNationalHolidays, onAddHoliday, setCustomHolidays]);

  return {
    onAddHoliday,
    onRemoveHoliday,
    onEditHoliday,
  };
}
