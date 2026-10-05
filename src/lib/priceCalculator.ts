import { SeasonalRate } from "@/hooks/useSeasonalRates";
import { format, addDays, parseISO, isWithinInterval, startOfDay } from "date-fns";

export interface DailyPriceBreakdown {
  date: string;
  price: number;
  isSpecial: boolean;
  rateLabel?: string;
}

export interface PriceCalculationResult {
  totalPrice: number;
  nights: number;
  breakdown: DailyPriceBreakdown[];
  specialNights: number;
  regularNights: number;
}

/**
 * Finds the applicable rate for a specific date
 * If multiple rates apply, uses the most recently updated one
 */
function findApplicableRate(
  date: Date,
  seasonalRates: SeasonalRate[]
): SeasonalRate | null {
  const applicableRates = seasonalRates.filter((rate) => {
    const startDate = startOfDay(parseISO(rate.start_date));
    const endDate = startOfDay(parseISO(rate.end_date));
    const checkDate = startOfDay(date);
    
    return isWithinInterval(checkDate, { start: startDate, end: endDate });
  });

  if (applicableRates.length === 0) return null;

  // Return the most recently updated rate (conflict resolution by updated_at)
  return applicableRates.reduce((mostRecent, current) =>
    new Date(current.updated_at) > new Date(mostRecent.updated_at) ? current : mostRecent
  );
}

/**
 * Calculates the total price for a reservation considering seasonal rates
 * 
 * @param checkIn - Check-in date
 * @param checkOut - Check-out date
 * @param basePricePerNight - Default price per night from the property
 * @param seasonalRates - Array of seasonal rates for the property
 * @returns Price calculation result with breakdown
 */
export function calculatePriceWithSeasonalRates(
  checkIn: Date,
  checkOut: Date,
  basePricePerNight: number,
  seasonalRates: SeasonalRate[]
): PriceCalculationResult {
  const breakdown: DailyPriceBreakdown[] = [];
  let totalPrice = 0;
  let specialNights = 0;
  let regularNights = 0;

  // Iterate through each night of the stay
  let currentDate = startOfDay(checkIn);
  const lastNight = startOfDay(checkOut);

  while (currentDate < lastNight) {
    const applicableRate = findApplicableRate(currentDate, seasonalRates);
    
    const price = applicableRate ? Number(applicableRate.daily_price) : basePricePerNight;
    const isSpecial = !!applicableRate;
    
    breakdown.push({
      date: format(currentDate, "yyyy-MM-dd"),
      price,
      isSpecial,
      rateLabel: applicableRate?.label || undefined,
    });

    totalPrice += price;
    
    if (isSpecial) {
      specialNights++;
    } else {
      regularNights++;
    }

    currentDate = addDays(currentDate, 1);
  }

  return {
    totalPrice,
    nights: breakdown.length,
    breakdown,
    specialNights,
    regularNights,
  };
}

export interface PriceSegment {
  label: string;
  startDate: string; // first night (yyyy-MM-dd)
  endDate: string;   // last night (yyyy-MM-dd)
  nights: number;
  price: number;
  isSpecial: boolean;
  subtotal: number;
}

/**
 * Groups consecutive nights with the same rate into display segments,
 * e.g. "Réveillon 29/12–01/01 · 3 noites × R$ 300"
 */
export function groupPriceSegments(result: PriceCalculationResult): PriceSegment[] {
  const segments: PriceSegment[] = [];

  for (const day of result.breakdown) {
    const label = day.isSpecial ? day.rateLabel || "Tarifa especial" : "Tarifa padrão";
    const last = segments[segments.length - 1];

    if (last && last.label === label && last.price === day.price) {
      last.endDate = day.date;
      last.nights += 1;
      last.subtotal += day.price;
    } else {
      segments.push({
        label,
        startDate: day.date,
        endDate: day.date,
        nights: 1,
        price: day.price,
        isSpecial: day.isSpecial,
        subtotal: day.price,
      });
    }
  }

  return segments;
}

/**
 * Formats the price breakdown for display
 */
export function formatPriceBreakdown(result: PriceCalculationResult): string {
  const parts: string[] = [];
  
  if (result.specialNights > 0) {
    parts.push(`${result.specialNights} diária${result.specialNights > 1 ? 's' : ''} com tarifa especial`);
  }
  
  if (result.regularNights > 0) {
    parts.push(`${result.regularNights} diária${result.regularNights > 1 ? 's' : ''} com tarifa padrão`);
  }
  
  return parts.join(" + ");
}
