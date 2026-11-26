/**
 * Returns the local calendar date in `YYYY-MM-DD` format.
 */
export function getLocalTodayIso(now: Date = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Formats an ISO `YYYY-MM-DD` due date as a short pt-BR local date label,
 * falling back to the raw string if the input is not a valid calendar date.
 */
export function formatLocalDueDate(dueDate: string): string {
  const parts = dueDate.split('-').map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) {
    return dueDate;
  }
  const [year, month, day] = parts;
  const localDate = new Date(year, month - 1, day);
  if (
    Number.isNaN(localDate.getTime()) ||
    localDate.getFullYear() !== year ||
    localDate.getMonth() !== month - 1 ||
    localDate.getDate() !== day
  ) {
    return dueDate;
  }
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
  }).format(localDate);
}
