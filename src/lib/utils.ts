import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Parses a date string like "2026-02-21" without timezone shift.
 * new Date("2026-02-21") treats it as UTC, causing -1 day in Brazil.
 * This forces local time interpretation.
 */
export function parseDateLocal(dateStr: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Formats a date string from DB (yyyy-MM-dd) to dd/MM/yyyy (Brazil format).
 */
export function formatDateBR(dateStr: string): string {
  return parseDateLocal(dateStr).toLocaleDateString("pt-BR");
}

