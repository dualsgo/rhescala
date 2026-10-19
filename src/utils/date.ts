/**
 * Utilitários de data no fuso LOCAL do dispositivo.
 *
 * Evite `date.toISOString().split('T')[0]`: ele converte para UTC e, no Brasil (UTC-3),
 * a partir das 21h retorna o dia seguinte.
 */

const pad2 = (n: number): string => String(n).padStart(2, '0');

/** Formata uma data como `YYYY-MM-DD` usando o fuso local. */
export function toLocalISODate(date: Date = new Date()): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

/** Converte `YYYY-MM-DD` em Date à meia-noite local (sem deslocamento de fuso). */
export function parseLocalISODate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

/** Soma `days` dias corridos a uma data `YYYY-MM-DD` e retorna `YYYY-MM-DD`. */
export function addDaysToISODate(dateStr: string, days: number): string {
  if (!dateStr) return '';
  const d = parseLocalISODate(dateStr);
  d.setDate(d.getDate() + days);
  return toLocalISODate(d);
}

/** Retorna a quantidade de dias no mês correspondente à chave "YYYY-MM" */
export function getDaysInMonthKey(monthKey: string): number {
  if (!monthKey) return 31;
  const [y, m] = monthKey.split('-').map(Number);
  if (!y || !m) return 31;
  return new Date(y, m, 0).getDate();
}


