import type { EmbeddingModel, LanguageModel } from "ai";
import type { ProviderOptions } from "@ai-sdk/provider-utils";

export type ProviderId = "openai" | "google" | "local";

export const EMBEDDING_DIM = 1536;

export interface ProviderConfig {
  id: ProviderId;
  label: string;
  /** Coste real por publicación creada, para mostrarlo en la UI. */
  cost: "gratis" | "gratis (con cuota)" | "de pago";
  /**
   * Calibración del coseno -> afinidad mostrada al usuario.
   *
   * El coseno crudo no es interpretable de cara al usuario: con
   * `text-embedding-3-small` dos textos industriales sin nada que ver ya sacan
   * ~0.15, y un emparejamiento excelente se queda en ~0.60. Enseñar "60 %"
   * cuando es la mejor coincidencia posible confunde. Estos dos valores definen
   * el tramo útil que se estira a 0-100 %.
   */
  calibration: { floor: number; ceiling: number };
}

const CONFIGS: Record<ProviderId, ProviderConfig> = {
  openai: {
    id: "openai",
    label: "OpenAI · gpt-4o-mini + text-embedding-3-small",
    cost: "de pago",
    calibration: { floor: 0.15, ceiling: 0.85 },
  },
  google: {
    id: "google",
    label: "Google · gemini-2.5-flash + gemini-embedding-001",
    cost: "gratis (con cuota)",
    calibration: { floor: 0.35, ceiling: 0.92 },
  },
  local: {
    id: "local",
    label: "Local · reglas + embeddings hasheados",
    cost: "gratis",
    calibration: { floor: 0.05, ceiling: 0.7 },
  },
};

/**
 * Resuelve el proveedor activo.
 *
 *   AI_PROVIDER=openai|google|local   -> fuerza uno concreto
 *   si no, se autodetecta por la API key presente
 *   si no hay ninguna                 -> 'local' (la app funciona igual, sin coste)
 */
export function resolveProviderId(): ProviderId {
  const forced = process.env.AI_PROVIDER?.trim().toLowerCase();
  if (forced === "openai" || forced === "google" || forced === "local") {
    return forced;
  }
  if (process.env.OPENAI_API_KEY?.trim()) return "openai";
  if (process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim()) return "google";
  return "local";
}

export function providerConfig(id: ProviderId = resolveProviderId()): ProviderConfig {
  return CONFIGS[id];
}

/** Modelo de lenguaje para la extracción estructurada. Null en modo local. */
export async function getLanguageModel(id: ProviderId): Promise<LanguageModel | null> {
  if (id === "openai") {
    const { openai } = await import("@ai-sdk/openai");
    return openai(process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini");
  }
  if (id === "google") {
    const { google } = await import("@ai-sdk/google");
    return google(process.env.GOOGLE_MODEL?.trim() || "gemini-2.5-flash");
  }
  return null;
}

/** Modelo de embeddings. Null en modo local. */
export async function getEmbeddingModel(id: ProviderId): Promise<EmbeddingModel | null> {
  if (id === "openai") {
    const { openai } = await import("@ai-sdk/openai");
    return openai.textEmbeddingModel("text-embedding-3-small"); // nativo 1536
  }
  if (id === "google") {
    const { google } = await import("@ai-sdk/google");
    return google.textEmbeddingModel("gemini-embedding-001"); // truncado a 1536 vía MRL
  }
  return null;
}

/**
 * Opciones específicas de proveedor para forzar la dimensión a 1536.
 *
 * El tipo de retorno se anota explícitamente: sin la anotación, TypeScript
 * infiere una unión con `openai?: undefined` / `google?: undefined`, y
 * `undefined` no encaja en la firma indexada de `ProviderOptions`.
 */
export function embeddingProviderOptions(id: ProviderId): ProviderOptions | undefined {
  if (id === "google") {
    return {
      google: {
        outputDimensionality: EMBEDDING_DIM,
        taskType: "SEMANTIC_SIMILARITY",
      },
    };
  }
  if (id === "openai") {
    return { openai: { dimensions: EMBEDDING_DIM } };
  }
  return undefined;
}
