import { format, addDays } from 'date-fns';
import { es } from 'date-fns/locale';

/**
 * Ensures a date is evaluated consistently without timezone shifts.
 * Works with YYYY-MM-DD strings, ISO strings, or Date objects.
 */
export const parseSafeDate = (dateVal) => {
  if (!dateVal) return new Date();

  if (dateVal instanceof Date) return dateVal;

  const dateStr = String(dateVal);

  // If it's a timestamp (number as string)
  if (!isNaN(dateStr) && dateStr.length >= 10) {
    const d = new Date(Number(dateStr));
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0);
  }

  // Handle "YYYY-MM-DD" or ISO strings
  const datePart = dateStr.split('T')[0];
  const parts = datePart.split('-');

  if (parts.length === 3) {
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    return new Date(year, month, day, 12, 0, 0);
  }

  const fallback = new Date(dateVal);
  return isNaN(fallback.getTime()) ? new Date() : fallback;
};

export const formatSafeDate = (dateVal, formatStr = 'dd MMM yyyy') => {
  const safe = parseSafeDate(dateVal);
  return format(safe, formatStr, { locale: es });
};

/**
 * Returns YYYY-MM-DD for the day immediately after dateVal without timezone shift.
 */
export const getNextDayStr = (dateVal) => {
  if (!dateVal) return '';
  const safe = parseSafeDate(dateVal);
  return format(addDays(safe, 1), 'yyyy-MM-dd');
};
