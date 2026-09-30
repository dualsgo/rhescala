import { useState, useCallback } from 'react';

export type DayTypeFilter = 'all' | 'sunday' | 'holiday' | 'week';
export type ContractTypeFilter = 'all' | 'clt' | 'sazonal';

export interface ScheduleFiltersState {
  filter: DayTypeFilter;
  contractFilter: ContractTypeFilter;
  onlyWorkingToday: boolean;
  selectedGroup: string | null;
  hasActiveFilters: boolean;
  setFilter: (filter: DayTypeFilter) => void;
  setContractFilter: (contractFilter: ContractTypeFilter) => void;
  setOnlyWorkingToday: (value: boolean | ((prev: boolean) => boolean)) => void;
  toggleOnlyWorkingToday: () => void;
  setSelectedGroup: (group: string | null) => void;
  clearFilters: () => void;
}

/**
 * Hook puro para gerenciar o estado dos filtros da grade de escala.
 * Não acessa storage nem regras do motor, focando exclusivamente no estado de UI de filtros.
 */
export function useScheduleFilters(): ScheduleFiltersState {
  const [filter, setFilter] = useState<DayTypeFilter>('all');
  const [contractFilter, setContractFilter] = useState<ContractTypeFilter>('all');
  const [onlyWorkingToday, setOnlyWorkingToday] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);

  const toggleOnlyWorkingToday = useCallback(() => {
    setOnlyWorkingToday(prev => !prev);
  }, []);

  const clearFilters = useCallback(() => {
    setFilter('all');
    setContractFilter('all');
    setOnlyWorkingToday(false);
    setSelectedGroup(null);
  }, []);

  const hasActiveFilters = filter !== 'all' || contractFilter !== 'all' || onlyWorkingToday || selectedGroup !== null;

  return {
    filter,
    contractFilter,
    onlyWorkingToday,
    selectedGroup,
    hasActiveFilters,
    setFilter,
    setContractFilter,
    setOnlyWorkingToday,
    toggleOnlyWorkingToday,
    setSelectedGroup,
    clearFilters,
  };
}
