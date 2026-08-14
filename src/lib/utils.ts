import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatTons(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return `${new Intl.NumberFormat("es-ES", { maximumFractionDigits: 1 }).format(value)} Tn/mes`;
}

export function formatDistance(km: number | null): string {
  if (km === null || !Number.isFinite(km)) return "distancia desconocida";
  if (km < 1) return "misma zona";
  return `a ${new Intl.NumberFormat("es-ES", { maximumFractionDigits: 0 }).format(km)} km`;
}
