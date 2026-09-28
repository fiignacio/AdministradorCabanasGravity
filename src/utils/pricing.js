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
 * Price is calculated per night using dynamic prices, seasonConfig, and discountConfig.
 */
export function calculateReservationCost(startDate, endDate, adultsCount, childrenCount, prices, seasonConfig, discountConfig) {
  if (!startDate || !endDate || !prices) return 0;
  
  const start = startOfDay(parseSafeDate(startDate));
  const end = startOfDay(parseSafeDate(endDate));
  
  if (start >= end) return 0;
  
  let days = eachDayOfInterval({ start, end });
  if (days.length > 1) {
    days.pop(); // Remove checkout day
  }

  const nights = days.length;
  const totalGuests = Number(adultsCount || 0) + Number(childrenCount || 0);

  let totalCost = 0;

  days.forEach(day => {
    let adultPrice = isHighSeason(day, seasonConfig) ? Number(prices.highSeasonAdult) : Number(prices.lowSeasonAdult);
    
    // Descuento por grupo de personas (si el administrador lo habilitó)
    if (
      discountConfig?.enableGroupDiscount &&
      totalGuests >= Number(discountConfig.groupMinGuests || 10) &&
      Number(discountConfig.groupRatePerAdult) > 0
    ) {
      adultPrice = Number(discountConfig.groupRatePerAdult);
    }

    totalCost += (adultsCount * adultPrice);
    totalCost += (childrenCount * Number(prices.child));
  });

  // Descuento por cantidad de días / larga estadía (si el administrador lo habilitó)
  if (
    discountConfig?.enableDurationDiscount &&
    nights >= Number(discountConfig.durationMinNights || 7) &&
    Number(discountConfig.durationDiscountPercent) > 0
  ) {
    const discountAmount = (totalCost * Number(discountConfig.durationDiscountPercent)) / 100;
    totalCost = Math.max(0, totalCost - discountAmount);
  }

  return Math.round(totalCost);
}

/**
 * Calculates cost for non-date or date-based quote estimates with discountConfig.
 */
export function calculateQuoteCabinCost({
  nights,
  adults,
  children,
  isHighSeason,
  prices,
  discountConfig
}) {
  const totalGuests = Number(adults || 0) + Number(children || 0);
  let adultPrice = isHighSeason ? Number(prices.highSeasonAdult) : Number(prices.lowSeasonAdult);

  // Descuento por grupo (si el administrador lo habilitó)
  if (
    discountConfig?.enableGroupDiscount &&
    totalGuests >= Number(discountConfig.groupMinGuests || 10) &&
    Number(discountConfig.groupRatePerAdult) > 0
  ) {
    adultPrice = Number(discountConfig.groupRatePerAdult);
  }

  let subtotal = (adults * adultPrice * nights) + (children * Number(prices.child) * nights);

  // Descuento por cantidad de días (si el administrador lo habilitó)
  if (
    discountConfig?.enableDurationDiscount &&
    nights >= Number(discountConfig.durationMinNights || 7) &&
    Number(discountConfig.durationDiscountPercent) > 0
  ) {
    const discount = (subtotal * Number(discountConfig.durationDiscountPercent)) / 100;
    subtotal = Math.max(0, subtotal - discount);
  }

  return Math.round(subtotal);
}


