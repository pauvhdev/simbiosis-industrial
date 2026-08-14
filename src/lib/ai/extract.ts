import { generateObject } from "ai";
import { ExtractionSchema, type Extraction } from "../schemas";
import { isKnownLerCode, lerCatalogPrompt } from "../ler";
import { classifyLer, localExtract } from "./local";
import { getLanguageModel, resolveProviderId, type ProviderId } from "./provider";

export interface ExtractResult {
  extraction: Extraction;
  provider: ProviderId;
  /** true si se pidió un LLM pero se resolvió con el motor local. */
  usedFallback: boolean;
  fallbackReason?: string;
}

const SYSTEM_PROMPT = `Eres un técnico de gestión de residuos industriales especializado en simbiosis industrial y en la Lista Europea de Residuos (LER).

Tu trabajo es convertir la descripción libre de un subproducto industrial en una ficha estructurada y ANÓNIMA.

REGLAS INNEGOCIABLES:
1. ANONIMATO. El título no puede contener jamás: razón social, marca comercial, nombre de persona, dirección exacta, teléfono, email ni CIF. Si aparecen en el texto original, márcalo en contains_identifying_info y omítelos.
2. NO INVENTES DATOS. Si el texto no da la humedad, no pongas humedad. Si no se puede estimar la cantidad, devuelve null en quantity_ton_month. Un campo vacío es correcto; un campo inventado destruye la utilidad del cruce.
3. El código LER debe salir OBLIGATORIAMENTE del catálogo que se te da abajo, copiando el formato exacto "NN NN NN". No construyas códigos nuevos.
4. Normaliza siempre la cantidad a TONELADAS AL MES. 500 kg/semana son 2,17 Tn/mes. 1.200 t/año son 100 Tn/mes.
5. El título debe ser útil comercialmente: material + característica diferencial + volumen. Máximo 80 caracteres.

CATÁLOGO LER DISPONIBLE:
`;

export async function extractListing(params: {
  text: string;
  type: "OFERTA" | "DEMANDA";
}): Promise<ExtractResult> {
  const { text, type } = params;
  const providerId = resolveProviderId();

  if (providerId === "local") {
    return {
      extraction: localExtract(text, type),
      provider: "local",
      usedFallback: false,
    };
  }

  try {
    const model = await getLanguageModel(providerId);
    if (!model) throw new Error("modelo de lenguaje no disponible");

    const { object } = await generateObject({
      model,
      schema: ExtractionSchema,
      system: SYSTEM_PROMPT + lerCatalogPrompt(),
      prompt: [
        `Tipo de publicación: ${type} (${type === "OFERTA" ? "la empresa GENERA este subproducto y quiere darle salida" : "la empresa NECESITA este material como entrada"}).`,
        "",
        "Descripción aportada por la empresa:",
        '"""',
        text.slice(0, 15_000),
        '"""',
      ].join("\n"),
      temperature: 0,
    });

    return {
      extraction: sanitize(object, text, type),
      provider: providerId,
      usedFallback: false,
    };
  } catch (error) {
    // Cuota agotada, key inválida, red caída... la publicación no se pierde:
    // se resuelve con reglas y se avisa en la respuesta de la API.
    const reason = error instanceof Error ? error.message : String(error);
    console.warn(
      `[extract] proveedor ${providerId} falló, usando motor local: ${reason}`,
    );
    return {
      extraction: localExtract(text, type),
      provider: providerId,
      usedFallback: true,
      fallbackReason: reason,
    };
  }
}

/**
 * Red de seguridad sobre la salida del LLM.
 *
 * Aunque el prompt exige un código del catálogo, los modelos pequeños inventan
 * códigos con formato correcto de vez en cuando. Si el que devuelve no existe,
 * se sustituye por el del clasificador por palabras clave — un código real
 * aproximado vale mucho más que uno inventado con pinta de exacto.
 */
function sanitize(
  object: Extraction,
  originalText: string,
  type: "OFERTA" | "DEMANDA",
): Extraction {
  const out: Extraction = { ...object };

  if (!isKnownLerCode(out.ler_code)) {
    const fallback = classifyLer(originalText);
    out.ler_code = fallback.code;
    out.ler_description = fallback.description;
    out.confidence = Math.min(out.confidence, 0.6);
  }

  out.title = out.title.trim().slice(0, 80);
  if (!out.title) out.title = localExtract(originalText, type).title;

  if (out.quantity_ton_month !== null && !Number.isFinite(out.quantity_ton_month)) {
    out.quantity_ton_month = null;
  }
  if (out.quantity_ton_month !== null && out.quantity_ton_month <= 0) {
    out.quantity_ton_month = null;
  }

  out.properties = (out.properties ?? []).filter((p) => p.key?.trim() && p.value?.trim());

  return out;
}
