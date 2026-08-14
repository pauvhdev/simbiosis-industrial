/**
 * Tipos compartidos entre servidor y cliente.
 *
 * Viven aparte de `db/queries.ts` a propósito: ese módulo abre PGlite o `pg` al
 * importarse, así que un componente de cliente que importara los tipos desde
 * allí arrastraría el driver de base de datos al bundle del navegador.
 */

export type ListingType = "OFERTA" | "DEMANDA";
export type ListingStatus = "ACTIVE" | "MATCHED" | "ARCHIVED";

export type PropertiesJson = Record<string, { value: string; unit: string | null }>;

/** Proyección pública: sin `company_id` y sin `embedding`. */
export interface PublicListing {
  id: string;
  type: ListingType;
  title: string;
  description: string | null;
  anonymous_location: string | null;
  lat: number | null;
  lng: number | null;
  ler_code: string | null;
  ler_description: string | null;
  properties: PropertiesJson;
  quantity_ton_month: number | null;
  status: ListingStatus;
  created_at: string;
}

export interface MatchRow extends PublicListing {
  /** Similitud coseno cruda [0, 1] devuelta por match_listings(). */
  similarity: number;
  distance_km: number | null;
}

export interface ScoredMatch extends MatchRow {
  /** Porcentaje de afinidad ya calibrado y modulado, 0-100. */
  affinity: number;
  breakdown: {
    rawSimilarity: number;
    calibrated: number;
    proximityFactor: number;
    lerFactor: number;
  };
}

export interface Stats {
  offers: number;
  demands: number;
  contacts: number;
}

export interface AppStatus {
  db: { driver: string; schemaReady: boolean };
  ai: { id: string; label: string; cost: string };
}
