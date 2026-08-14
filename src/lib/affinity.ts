import { providerConfig, type ProviderId } from "./ai/provider";

/**
 * Cálculo del "Porcentaje de Afinidad" que ve el usuario.
 *
 * Enseñar el coseno crudo sería honesto pero inútil: con embeddings reales, dos
 * textos industriales sin relación ya sacan ~0.15, y un cruce excelente se queda
 * en ~0.60. Un usuario que ve "60 %" en la mejor coincidencia posible asume que
 * el sistema no ha encontrado nada bueno.
 *
 * Por eso la afinidad se construye en dos pasos:
 *
 *   1. CALIBRAR: el tramo útil del coseno [floor, ceiling] se estira a [0, 1].
 *      Los umbrales dependen del proveedor y viven en `provider.ts`.
 *
 *   2. MODULAR: el resultado se ajusta por dos factores logísticos reales, de
 *      forma MULTIPLICATIVA y acotada a [0.78, 1.0]. Se hace así, y no sumando
 *      pesos, para que la compatibilidad del material siga mandando: una
 *      coincidencia semántica floja al lado de casa no debe adelantar a una
 *      coincidencia excelente a 200 km.
 *
 *        - Proximidad: decaimiento exponencial con escala 250 km, que es el
 *          orden de magnitud a partir del cual el transporte se come el margen
 *          de un subproducto de bajo valor.
 *        - Coherencia LER: mismo código, o mismo capítulo (2 primeros dígitos).
 */

export interface AffinityInput {
  /** Similitud coseno cruda devuelta por match_listings(). */
  similarity: number;
  distanceKm: number | null;
  lerCodeA: string | null;
  lerCodeB: string | null;
  provider?: ProviderId;
}

export interface AffinityResult {
  /** 0-100, listo para pintar. */
  percent: number;
  /** Desglose para poder explicar el número en la UI. */
  breakdown: {
    rawSimilarity: number;
    calibrated: number;
    proximityFactor: number;
    lerFactor: number;
  };
}

const DISTANCE_SCALE_KM = 250;

export function computeAffinity(input: AffinityInput): AffinityResult {
  const { floor, ceiling } = providerConfig(input.provider).calibration;

  const calibrated = clamp01((input.similarity - floor) / (ceiling - floor));

  // Sin coordenadas no se penaliza ni se premia: 0.5 es el punto neutro.
  const proximity =
    input.distanceKm === null ? 0.5 : Math.exp(-input.distanceKm / DISTANCE_SCALE_KM);

  const ler = lerCoherence(input.lerCodeA, input.lerCodeB);

  const modifier = 0.78 + 0.14 * proximity + 0.08 * ler;

  return {
    percent: Math.round(clamp01(calibrated * modifier) * 100),
    breakdown: {
      rawSimilarity: input.similarity,
      calibrated,
      proximityFactor: proximity,
      lerFactor: ler,
    },
  };
}

/** 1 = mismo código LER, 0.5 = mismo capítulo, 0 = sin relación. */
function lerCoherence(a: string | null, b: string | null): number {
  if (!a || !b) return 0;
  const na = a.replace(/\s/g, "");
  const nb = b.replace(/\s/g, "");
  if (na === nb) return 1;
  if (na.slice(0, 2) === nb.slice(0, 2)) return 0.5;
  return 0;
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

/** Etiqueta cualitativa para acompañar al porcentaje. */
export function affinityLabel(percent: number): {
  text: string;
  tone: "high" | "medium" | "low";
} {
  if (percent >= 70) return { text: "Compatibilidad alta", tone: "high" };
  if (percent >= 45) return { text: "Compatibilidad media", tone: "medium" };
  return { text: "Compatibilidad baja", tone: "low" };
}
