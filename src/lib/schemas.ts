import { z } from "zod";
import type { PropertiesJson } from "./types";

/**
 * Esquema de EXTRACCIÓN — es el contrato que se le impone al LLM vía
 * `generateObject`.
 *
 * Decisión de diseño importante: `properties` es un ARRAY de tuplas y no un
 * `z.record()`. El modo structured outputs de OpenAI rechaza los objetos con
 * `additionalProperties: true`, así que un record libre falla en tiempo de
 * ejecución. El array se convierte a JSONB en `toPropertiesJson()`.
 */
export const ExtractionSchema = z.object({
  title: z
    .string()
    .describe(
      "Título ANÓNIMO y comercial, máximo 80 caracteres. Debe describir el " +
        "material y el volumen sin revelar jamás el nombre de la empresa, marcas, " +
        "personas ni direcciones. Ejemplo: '15 Tn/mes de polímero sintético post-industrial'.",
    ),

  material_family: z
    .string()
    .describe(
      "Familia genérica del material en 1-3 palabras. Ej: 'polímero termoplástico', " +
        "'subproducto orgánico vegetal', 'escoria metalúrgica'.",
    ),

  ler_code: z
    .string()
    .describe(
      "Código LER de 6 dígitos con el formato exacto 'NN NN NN'. " +
        "DEBE ser uno de los códigos del catálogo proporcionado.",
    ),

  ler_description: z
    .string()
    .describe("Descripción oficial del código LER elegido, copiada del catálogo."),

  properties: z
    .array(
      z.object({
        key: z
          .string()
          .describe(
            "Nombre de la métrica en minúsculas y sin tildes. Ej: 'humedad', 'ph'.",
          ),
        value: z.string().describe("Valor numérico o rango. Ej: '62', '5-20'."),
        unit: z
          .string()
          .describe(
            "Unidad de medida, o cadena vacía si la métrica es adimensional (ej: pH).",
          ),
      }),
    )
    .describe(
      "Métricas químicas y físicas relevantes extraídas del texto o de la ficha técnica: " +
        "humedad, pH, granulometría, densidad, poder calorífico, materia orgánica, " +
        "contenido en cenizas, etc. Deja el array vacío si no hay ninguna. NO inventes valores.",
    ),

  quantity_ton_month: z
    .number()
    .nullable()
    .describe(
      "Cantidad estimada en TONELADAS AL MES. Convierte desde otras unidades " +
        "(kg, t/año, t/semana). Usa null si el texto no permite estimarla.",
    ),

  contains_identifying_info: z
    .boolean()
    .describe(
      "true si el texto original contenía datos identificativos (razón social, marca, " +
        "persona de contacto, dirección exacta, teléfono, CIF) que se han omitido del título.",
    ),

  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe("Confianza global de la extracción, de 0 a 1."),
});

export type Extraction = z.infer<typeof ExtractionSchema>;

export type { PropertiesJson } from "./types";

export function toPropertiesJson(props: Extraction["properties"]): PropertiesJson {
  const out: PropertiesJson = {};
  for (const p of props) {
    const key = p.key.trim().toLowerCase().replace(/\s+/g, "_");
    if (!key) continue;
    out[key] = { value: p.value.trim(), unit: p.unit?.trim() || null };
  }
  return out;
}

// -----------------------------------------------------------------------------
// Entrada de la API
// -----------------------------------------------------------------------------

export const CreateListingInputSchema = z.object({
  type: z.enum(["OFERTA", "DEMANDA"]),
  /** Descripción libre del subproducto. Opcional si se adjunta un PDF. */
  description: z.string().max(20_000).optional().default(""),
  /** Zona industrial aproximada. Ej: "Polígono Industrial, Zaragoza". */
  location: z.string().max(200).optional().default(""),
});
// La empresa ya no viaja en el cuerpo: sale de la sesión. Aceptarla por
// parámetro dejaba publicar en nombre de cualquiera con sólo saber su email.

export type CreateListingInput = z.infer<typeof CreateListingInputSchema>;

export const ContactRequestInputSchema = z.object({
  fromListingId: z.uuid(),
  toListingId: z.uuid(),
  similarity: z.number().min(0).max(1).optional(),
  message: z.string().max(2000).optional().default(""),
});

// -----------------------------------------------------------------------------
// Autenticación
// -----------------------------------------------------------------------------

/**
 * 10 caracteres de mínimo en vez de los 8 habituales, y sin exigir mayúsculas ni
 * símbolos: las reglas de composición empujan a la gente a "Password1!" mientras
 * que la longitud es lo que realmente aporta entropía. Es también lo que
 * recomienda el NIST desde SP 800-63B.
 */
const passwordField = z
  .string()
  .min(10, "La contraseña debe tener al menos 10 caracteres.")
  .max(200, "La contraseña es demasiado larga.");

export const RegisterInputSchema = z.object({
  companyName: z.string().trim().min(1, "Indica el nombre de la empresa.").max(200),
  email: z.email("El email no es válido.").max(200),
  password: passwordField,
});

export const LoginInputSchema = z.object({
  email: z.email("El email no es válido.").max(200),
  password: z.string().min(1, "Indica la contraseña.").max(200),
});

export const ContactDecisionSchema = z.object({
  decision: z.enum(["ACCEPT", "REJECT"]),
});
