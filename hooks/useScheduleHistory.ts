import { useState, useRef, useCallback } from 'react';
import { Employee } from '../types';

export interface HistoryStep {
  employees: Employee[];
  description: string;
  timestamp: number;
}

export interface UseScheduleHistoryReturn {
  employees: Employee[];
  setEmployees: (action: React.SetStateAction<Employee[]>, description?: string) => void;
  undo: () => HistoryStep | null;
  redo: () => HistoryStep | null;
  canUndo: boolean;
  canRedo: boolean;
  lastUndoDescription: string | null;
  lastRedoDescription: string | null;
  historyLength: number;
  clearHistory: () => void;
}

const MAX_HISTORY_STEPS = 30;

function deepCloneEmployees(emps: Employee[]): Employee[] {
  try {
    return structuredClone(emps);
  } catch {
    return JSON.parse(JSON.stringify(emps));
  }
}

/**
 * Hook de gerenciamento de histórico (Undo / Redo / Reversão) da escala.
 * Mantém um snapshot imutável dos colaboradores para permitir desfazer e refazer
 * edições na grade, aplicações de pré-definições, folgas, rotação de domingos e outras ações de lote.
 */
export function useScheduleHistory(
  storedEmployees: Employee[],
  setEmployeesStorage: (value: React.SetStateAction<Employee[]>) => void
): UseScheduleHistoryReturn {
  const [past, setPast] = useState<HistoryStep[]>([]);
  const [future, setFuture] = useState<HistoryStep[]>([]);

  // Mantém sempre o valor síncrono mais recente para evitar descompasso em chamadas rápidas
  const employeesRef = useRef<Employee[]>(storedEmployees);
  employeesRef.current = storedEmployees;

  const setEmployees = useCallback((
    action: React.SetStateAction<Employee[]>,
    description: string = 'Alteração na escala'
  ) => {
    const current = employeesRef.current;
    const nextValue = typeof action === 'function' ? action(current) : action;

    // Se o valor retornado for estritamente idêntico ao atual, ignora
    if (nextValue === current) return;

    // Salva o snapshot imutável do estado anterior no histórico
    setPast(prevPast => [
      ...prevPast.slice(-(MAX_HISTORY_STEPS - 1)),
      {
        employees: deepCloneEmployees(current),
        description,
        timestamp: Date.now(),
      },
    ]);

    // Toda nova alteração limpa o histórico de refazer
    setFuture([]);

    // Atualiza a referência síncrona e despacha para o storage / nuvem
    employeesRef.current = nextValue;
    setEmployeesStorage(nextValue);
  }, [setEmployeesStorage]);

  const undo = useCallback((): HistoryStep | null => {
    if (past.length === 0) return null;

    const previousStep = past[past.length - 1];
    const newPast = past.slice(0, past.length - 1);
    const current = employeesRef.current;

    // Move o estado atual para o future (permitindo Refazer)
    setFuture(prevFuture => [
      {
        employees: deepCloneEmployees(current),
        description: previousStep.description,
        timestamp: Date.now(),
      },
      ...prevFuture.slice(0, MAX_HISTORY_STEPS - 1),
    ]);

    setPast(newPast);

    // Restaura o estado anterior
    employeesRef.current = previousStep.employees;
    setEmployeesStorage(previousStep.employees);

    return previousStep;
  }, [past, setEmployeesStorage]);

  const redo = useCallback((): HistoryStep | null => {
    if (future.length === 0) return null;

    const nextStep = future[0];
    const newFuture = future.slice(1);
    const current = employeesRef.current;

    // Move o estado atual para o past
    setPast(prevPast => [
      ...prevPast.slice(-(MAX_HISTORY_STEPS - 1)),
      {
        employees: deepCloneEmployees(current),
        description: nextStep.description,
        timestamp: Date.now(),
      },
    ]);

    setFuture(newFuture);

    // Reaplica o estado futuro
    employeesRef.current = nextStep.employees;
    setEmployeesStorage(nextStep.employees);

    return nextStep;
  }, [future, setEmployeesStorage]);

  const clearHistory = useCallback(() => {
    setPast([]);
    setFuture([]);
  }, []);

  const lastUndoDescription = past.length > 0 ? past[past.length - 1].description : null;
  const lastRedoDescription = future.length > 0 ? future[0].description : null;

  return {
    employees: storedEmployees,
    setEmployees,
    undo,
    redo,
    canUndo: past.length > 0,
    canRedo: future.length > 0,
    lastUndoDescription,
    lastRedoDescription,
    historyLength: past.length,
    clearHistory,
  };
}

