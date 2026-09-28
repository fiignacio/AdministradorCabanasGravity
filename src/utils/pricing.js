import { getMonth, eachDayOfInterval, startOfDay } from 'date-fns';
import { parseSafeDate } from './dateUtils';

export const MONTHS = [
  { id: 0, name: 'Enero', short: 'Ene' },
  { id: 1, name: 'Febrero', short: 'Feb' },
  { id: 2, name: 'Marzo', short: 'Mar' },
  { id: 3, name: 'Abril', short: 'Abr' },
  { id: 4, name: 'Mayo', short: 'May' },
  { id: 5, name: 'Junio', short: 'Jun' },
  { id: 6, name: 'Julio', short: 'Jul' },
  { id: 7, name: 'Agosto', short: 'Ago' },
  { id: 8, name: 'Septiembre', short: 'Sep' },
  { id: 9, name: 'Octubre', short: 'Oct' },
  { id: 10, name: 'Noviembre', short: 'Nov' },
  { id: 11, name: 'Diciembre', short: 'Dic' }
];

/**
 * Determines if a given date is in High Season.
 */
export function isHighSeason(date, seasonConfig) {
  if (!date) return false;
  const parsedDate = typeof date === 'string' ? parseSafeDate(date) : date;
  if (isNaN(parsedDate)) return false;
  const month = getMonth(parsedDate);
  const highMonths = seasonConfig?.highSeasonMonths || [11, 0, 1, 2, 3];
  return highMonths.includes(month);
}

/**
 * Gets human readable list of high season months.
 */
export function getHighSeasonText(seasonConfig) {
  const highMonths = seasonConfig?.highSeasonMonths || [11, 0, 1, 2, 3];
  if (highMonths.length === 0) return 'Sin meses asignados';
  if (highMonths.length === 12) return 'Todo el año';
  
  const names = MONTHS
    .filter(m => highMonths.includes(m.id))
    .map(m => m.name);
  return names.join(', ');
}

/**
 * Gets human readable list of low season months.
 */
export function getLowSeasonText(seasonConfig) {
  const highMonths = seasonConfig?.highSeasonMonths || [11, 0, 1, 2, 3];
  const lowMonths = MONTHS.filter(m => !highMonths.includes(m.id));
  if (lowMonths.length === 0) return 'Sin meses asignados';
  if (lowMonths.length === 12) return 'Todo el año';
  
  return lowMonths.map(m => m.name).join(', ');
}

/**
 * Calculates the total cost of a reservation.
 * Price is calculated per night using dynamic prices and seasonConfig.
 */
export function calculateReservationCost(startDate, endDate, adultsCount, childrenCount, prices, seasonConfig) {
  if (!startDate || !endDate || !prices) return 0;
  
  const start = startOfDay(parseSafeDate(startDate));
  const end = startOfDay(parseSafeDate(endDate));
  
  if (start >= end) return 0;
  
  let days = eachDayOfInterval({ start, end });
  if (days.length > 1) {
    days.pop(); // Remove checkout day
  }

  let totalCost = 0;

  days.forEach(day => {
    const adultPrice = isHighSeason(day, seasonConfig) ? Number(prices.highSeasonAdult) : Number(prices.lowSeasonAdult);
    
    totalCost += (adultsCount * adultPrice);
    totalCost += (childrenCount * Number(prices.child));
  });

  return totalCost;
}

