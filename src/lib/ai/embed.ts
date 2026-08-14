import { embed } from "ai";
import type { Extraction } from "../schemas";
import { localEmbed } from "./local";
import {
  EMBEDDING_DIM,
  embeddingProviderOptions,
  getEmbeddingModel,
  resolveProviderId,
  type ProviderId,
} from "./provider";

export interface EmbedResult {
  embedding: number[];
  provider: ProviderId;
  usedFallback: boolean;
}

/**
 * Texto canónico que se vectoriza.
 *
 * Decisión clave del matchmaking: NO se embebe la descripción original ni el
 * tipo (OFERTA/DEMANDA), sino la ficha estructurada que produjo la extracción.
 * Dos motivos:
 *
 *  1. Una oferta redactada como "nos sobran 15 t de suero" y una demanda como
 *     "compramos lactosuero para alimentación animal" tienen que caer JUNTAS en
 *     el espacio vectorial: es justo su complementariedad lo que buscamos. Si se
 *     embebiera el texto crudo, el verbo y el registro las separarían.
 *  2. La ficha ya está anonimizada, así que ningún dato identificativo del texto
 *     original acaba dentro del vector.
 */
export function buildEmbeddingText(extraction: Extraction): string {
  const props = extraction.properties
    .map((p) => `${p.key}: ${p.value}${p.unit ? ` ${p.unit}` : ""}`)
    .join("; ");

  return [
    `Material: ${extraction.material_family}`,
    `Descripción: ${extraction.title}`,
    `Clasificación LER ${extraction.ler_code}: ${extraction.ler_description}`,
    extraction.quantity_ton_month !== null
      ? `Volumen: ${extraction.quantity_ton_month} toneladas al mes`
      : "",
    props ? `Propiedades: ${props}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export async function embedText(value: string): Promise<EmbedResult> {
  const providerId = resolveProviderId();

  if (providerId === "local") {
    return { embedding: localEmbed(value), provider: "local", usedFallback: false };
  }

  try {
    const model = await getEmbeddingModel(providerId);
    if (!model) throw new Error("modelo de embeddings no disponible");

    const { embedding } = await embed({
      model,
      value,
      providerOptions: embeddingProviderOptions(providerId),
    });

    if (embedding.length !== EMBEDDING_DIM) {
      // Recortar en silencio corrompería el matching de forma invisible: los
      // vectores viejos y los nuevos dejarían de ser comparables.
      throw new Error(
        `el proveedor devolvió ${embedding.length} dimensiones y el esquema espera ${EMBEDDING_DIM}`,
      );
    }

    return { embedding, provider: providerId, usedFallback: false };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.warn(`[embed] proveedor ${providerId} falló, usando motor local: ${reason}`);
    return { embedding: localEmbed(value), provider: providerId, usedFallback: true };
  }
}

/** Formato que espera pgvector para un parámetro: '[0.1,0.2,...]'. */
export function toVectorLiteral(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
}
