/**
 * MOTOR LOCAL — extracción y embeddings con coste 0 y sin ninguna API key.
 *
 * Es el modo por defecto: garantiza que el proyecto arranca y funciona de punta
 * a punta recién clonado, sin tarjeta ni cuentas. No pretende igualar a un LLM
 * (no razona sobre texto abierto ni entiende contexto), pero sí:
 *
 *   - clasifica el LER por coincidencia ponderada de palabras clave,
 *   - extrae métricas numéricas con expresiones regulares específicas,
 *   - normaliza cantidades a Tn/mes desde kg, t/año, t/semana...,
 *   - genera embeddings deterministas por hashing con signo ("hashing trick"),
 *     que capturan solapamiento léxico real — suficiente para que el
 *     matchmaking demuestre su comportamiento.
 *
 * Al poner una API key, `extract.ts` y `embed.ts` conmutan al LLM y este módulo
 * se queda como red de seguridad si la llamada falla (cuota, red, key inválida).
 */

import { EMBEDDING_DIM } from "./provider";
import { LER_CATALOG, LER_UNKNOWN } from "../ler";
import type { Extraction } from "../schemas";

// -----------------------------------------------------------------------------
// Normalización de texto
// -----------------------------------------------------------------------------

function normalize(text: string): string {
  return (
    text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      // Las fichas técnicas usan puntos de relleno ("Densidad ....... 905 kg/m3").
      // Sin colapsarlos, el hueco entre la etiqueta y el valor se dispara y las
      // reglas de extracción dejan de casar. Un punto suelto sí se conserva:
      // es el separador decimal.
      .replace(/\.{2,}/g, " ")
      // La coma se conserva: es el separador decimal en español. Filtrarla aquí
      // convertía "humedad 0,3 %" en "humedad 0 3" y toda métrica con decimal
      // acababa truncada a su parte entera.
      .replace(/[^a-z0-9\s.,/%-]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
}

/**
 * Palabras vacías. Incluye a propósito los verbos de polaridad
 * ("busco", "necesito", "dispongo", "genero"...): una OFERTA y una DEMANDA del
 * mismo material deben quedar CERCA en el espacio vectorial, y si el verbo
 * pesara los separaría justo por lo que las hace complementarias.
 */
const STOPWORDS = new Set([
  "de",
  "del",
  "la",
  "las",
  "el",
  "los",
  "un",
  "una",
  "unos",
  "unas",
  "y",
  "o",
  "en",
  "con",
  "por",
  "para",
  "que",
  "se",
  "su",
  "sus",
  "al",
  "es",
  "son",
  "como",
  "mas",
  "muy",
  "sin",
  "sobre",
  "entre",
  "desde",
  "hasta",
  "nuestro",
  "nuestra",
  "empresa",
  "compania",
  "sociedad",
  "planta",
  "fabrica",
  "industrial",
  "industria",
  // polaridad oferta/demanda — deliberadamente ignorada
  "busco",
  "buscamos",
  "necesito",
  "necesitamos",
  "compro",
  "compramos",
  "demando",
  "demandamos",
  "requiero",
  "requerimos",
  "solicito",
  "solicitamos",
  "dispongo",
  "disponemos",
  "tengo",
  "tenemos",
  "vendo",
  "vendemos",
  "ofrezco",
  "ofrecemos",
  "genero",
  "generamos",
  "producimos",
  "produzco",
  "oferta",
  "demanda",
]);

/**
 * Léxico de dominio: expande cada término a vocabulario vecino para que
 * descripciones que hablan de lo mismo con palabras distintas se solapen.
 * Es lo que sustituye, de forma pobre pero funcional, a la semántica del LLM.
 */
const LEXICON: Record<string, string[]> = {
  suero: ["lacteo", "lactosuero", "organico", "proteina", "liquido"],
  lactosuero: ["suero", "lacteo", "organico", "proteina"],
  leche: ["lacteo", "suero", "organico"],
  queso: ["lacteo", "suero", "organico"],
  polimero: ["plastico", "termoplastico", "granza", "resina"],
  plastico: ["polimero", "termoplastico", "granza", "resina"],
  granza: ["plastico", "polimero", "pellet", "resina"],
  pet: ["plastico", "polimero", "polietileno", "tereftalato", "envase"],
  hdpe: ["plastico", "polimero", "polietileno", "alta", "densidad"],
  ldpe: ["plastico", "polimero", "polietileno", "baja", "densidad"],
  pp: ["plastico", "polimero", "polipropileno"],
  polipropileno: ["plastico", "polimero", "pp", "termoplastico"],
  polietileno: ["plastico", "polimero", "pe", "termoplastico"],
  serrin: ["madera", "viruta", "biomasa", "lignocelulosico"],
  viruta: ["serrin", "madera", "mecanizado", "metal"],
  madera: ["serrin", "viruta", "biomasa", "astilla", "lignocelulosico"],
  astilla: ["madera", "biomasa", "serrin"],
  biomasa: ["madera", "vegetal", "organico", "combustible", "energetico"],
  orujo: ["vegetal", "organico", "aceituna", "oliva", "biomasa"],
  bagazo: ["vegetal", "organico", "cerveza", "malta", "fibra"],
  vinaza: ["organico", "liquido", "destileria", "vino", "alcohol"],
  cascarilla: ["vegetal", "biomasa", "organico", "fibra"],
  hueso: ["biomasa", "aceituna", "vegetal", "combustible"],
  citrico: ["fruta", "vegetal", "organico", "naranja", "limon", "pulpa"],
  naranja: ["citrico", "fruta", "vegetal", "organico", "pulpa"],
  fruta: ["vegetal", "organico", "hortaliza", "pulpa", "destrio"],
  hortaliza: ["vegetal", "organico", "fruta", "verdura"],
  pulpa: ["vegetal", "organico", "fibra", "humedo"],
  lodo: ["fango", "humedo", "organico", "depuradora"],
  fango: ["lodo", "humedo", "organico", "depuradora"],
  digestato: ["biogas", "organico", "fertilizante", "anaerobio", "nutriente"],
  compost: ["organico", "fertilizante", "enmienda", "nutriente"],
  purin: ["ganadero", "organico", "nitrogeno", "liquido", "fertilizante"],
  estiercol: ["ganadero", "organico", "nitrogeno", "fertilizante"],
  ceniza: ["escoria", "mineral", "combustion", "inorganico", "silice"],
  escoria: ["ceniza", "mineral", "siderurgia", "inorganico", "arido"],
  chatarra: ["metal", "acero", "hierro", "ferreo", "reciclable"],
  acero: ["metal", "hierro", "ferreo", "chatarra"],
  aluminio: ["metal", "ferreo", "chatarra", "ligero"],
  vidrio: ["calcin", "envase", "mineral", "silice"],
  calcin: ["vidrio", "envase", "mineral"],
  carton: ["papel", "celulosa", "envase", "fibra"],
  papel: ["carton", "celulosa", "fibra"],
  textil: ["fibra", "algodon", "tejido", "retal"],
  neumatico: ["caucho", "goma", "elastomero", "nfu"],
  caucho: ["neumatico", "goma", "elastomero"],
  hormigon: ["cemento", "arido", "mineral", "construccion", "rcd"],
  ceramica: ["ladrillo", "arcilla", "mineral", "chamota", "cocido"],
  aceite: ["grasa", "lipido", "oleico", "biodiesel"],
  grasa: ["aceite", "lipido", "animal"],
  glicerina: ["biodiesel", "quimico", "liquido", "subproducto"],
  fertilizante: ["nutriente", "nitrogeno", "fosforo", "agricola", "enmienda"],
  energetico: ["combustible", "calorifico", "biomasa", "valorizacion"],
  combustible: ["energetico", "calorifico", "biomasa", "valorizacion"],
};

function tokenize(text: string): string[] {
  return normalize(text)
    .split(/[\s.,/%-]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t) && !/^\d+$/.test(t));
}

// -----------------------------------------------------------------------------
// Embeddings deterministas por hashing con signo
// -----------------------------------------------------------------------------

/** FNV-1a de 32 bits: estable entre procesos y ejecuciones. */
function fnv1a(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

function addFeature(vec: Float64Array, feature: string, weight: number): void {
  const idx = fnv1a(feature) % EMBEDDING_DIM;
  // Un segundo hash decide el signo. Sin él, todos los vectores tendrían sólo
  // componentes positivas y hasta dos textos sin relación darían un coseno alto.
  const sign = fnv1a(`${feature}#s`) & 1 ? 1 : -1;
  vec[idx] += weight * sign;
}

/**
 * Vector de 1536 dimensiones, L2-normalizado, determinista.
 *
 * Combina tres tipos de rasgo:
 *   - término completo (peso 1.0), más el vocabulario vecino del léxico (0.55)
 *   - 4-gramas de carácter (0.30) -> tolera plurales y variantes morfológicas
 *   - bigramas de términos contiguos (0.45) -> capta "alta densidad", "poder calorifico"
 */
export function localEmbed(text: string): number[] {
  const vec = new Float64Array(EMBEDDING_DIM);
  const tokens = tokenize(text);

  for (const token of tokens) {
    addFeature(vec, `t:${token}`, 1.0);

    for (const related of LEXICON[token] ?? []) {
      addFeature(vec, `t:${related}`, 0.55);
    }

    if (token.length >= 5) {
      for (let i = 0; i + 4 <= token.length; i++) {
        addFeature(vec, `g:${token.slice(i, i + 4)}`, 0.3);
      }
    }
  }

  for (let i = 0; i + 1 < tokens.length; i++) {
    addFeature(vec, `b:${tokens[i]}_${tokens[i + 1]}`, 0.45);
  }

  let norm = 0;
  for (let i = 0; i < EMBEDDING_DIM; i++) norm += vec[i] * vec[i];
  norm = Math.sqrt(norm);
  if (norm === 0) return Array.from({ length: EMBEDDING_DIM }, () => 0);

  const out = new Array<number>(EMBEDDING_DIM);
  for (let i = 0; i < EMBEDDING_DIM; i++) out[i] = vec[i] / norm;
  return out;
}

// -----------------------------------------------------------------------------
// Clasificación LER por palabras clave
// -----------------------------------------------------------------------------

export interface LerClassification {
  code: string;
  description: string;
  label: string;
  /** Términos del catálogo que realmente aparecieron en el texto. */
  matched: string[];
  score: number;
}

/**
 * Busca un término como palabra completa, admitiendo plural.
 *
 * Incluye una guarda de negación: en "chatarra no férrea", el término "ferreo"
 * NO debe puntuar para 12 01 01 (metales férreos) — el texto está diciendo
 * justo lo contrario.
 */
function containsTerm(haystack: string, needle: string): boolean {
  let from = 0;
  for (;;) {
    const idx = haystack.indexOf(` ${needle}`, from);
    if (idx === -1) return false;

    const rest = haystack.slice(idx + needle.length + 1);
    const boundaryOk =
      rest.startsWith(" ") || rest.startsWith("s ") || rest.startsWith("es ");

    if (boundaryOk) {
      const previousWord = haystack
        .slice(0, idx + 1)
        .trim()
        .split(" ")
        .pop();
      if (previousWord !== "no" && previousWord !== "sin") return true;
    }
    from = idx + 1;
  }
}

export function classifyLer(text: string): LerClassification {
  const haystack = ` ${normalize(text)} `;

  let best: LerClassification = {
    ...LER_UNKNOWN,
    matched: [],
    score: 0,
  };

  for (const entry of LER_CATALOG) {
    let score = 0;
    const matched: string[] = [];

    const scan = (terms: string[] | undefined, weight: number) => {
      for (const kw of terms ?? []) {
        const needle = normalize(kw);
        if (!containsTerm(haystack, needle)) continue;
        // Los términos largos son más específicos y por tanto más informativos.
        score += weight * (1 + needle.length / 12);
        matched.push(needle);
      }
    };

    // Los términos de proceso ("mecanizado") pesan un tercio: si no, decidirían
    // entre viruta de acero y viruta de aluminio, y son comunes a las dos.
    scan(entry.keywords, 1);
    scan(entry.context, 0.35);

    if (score > best.score) {
      best = {
        code: entry.code,
        description: entry.description,
        label: entry.label,
        matched,
        score,
      };
    }
  }

  // Sin ninguna señal se devuelve el cajón genérico (19 12 12) en lugar de
  // inventar un código con pinta de exacto.
  return best;
}

// -----------------------------------------------------------------------------
// Cantidad -> toneladas/mes
// -----------------------------------------------------------------------------

const UNIT_TO_TON: Record<string, number> = {
  t: 1,
  tn: 1,
  ton: 1,
  tons: 1,
  tonelada: 1,
  toneladas: 1,
  kg: 0.001,
  kgs: 0.001,
  kilo: 0.001,
  kilos: 0.001,
  kilogramo: 0.001,
  kilogramos: 0.001,
  m3: 0.6, // densidad aparente media de un subproducto suelto; aproximación explícita
};

const PERIOD_TO_MONTHLY: Record<string, number> = {
  mes: 1,
  mensual: 1,
  mensuales: 1,
  meses: 1,
  ano: 1 / 12,
  anual: 1 / 12,
  anuales: 1 / 12,
  anos: 1 / 12,
  semana: 4.345,
  semanal: 4.345,
  semanales: 4.345,
  semanas: 4.345,
  dia: 30.44,
  diario: 30.44,
  diarios: 30.44,
  diaria: 30.44,
  diarias: 30.44,
  dias: 30.44,
};

/**
 * Convierte un número escrito en formato español.
 *
 *   "1.800"    -> 1800     (punto = separador de miles)
 *   "4.2"      -> 4.2      (punto = decimal: no forma grupos de tres)
 *   "1.800,50" -> 1800.5
 *   "62,5"     -> 62.5
 *
 * Sin esta distinción, "1.800 toneladas al año" se leía como 1,8 t/año.
 */
export function parseSpanishNumber(raw: string): number {
  let s = raw.trim();

  if (s.includes(",")) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (/^\d{1,3}(?:\.\d{3})+$/.test(s)) {
    s = s.replace(/\./g, "");
  }

  return Number.parseFloat(s);
}

const NUM = String.raw`(\d+(?:[.,]\d+)*)`;
const UNITS =
  "toneladas|tonelada|tons|tn|ton|kilogramos|kilogramo|kilos|kilo|kgs|kg|m3|t";
const TON_UNITS = "toneladas|tonelada|tons|tn|ton|t";
// El orden importa: las alternativas largas van primero para que "diarias" no
// se quede en "diaria" y deje una "s" suelta que rompa el \b final.
const PERIODS =
  "mensuales|mensual|meses|mes|anuales|anual|anos|ano|semanales|semanal|semanas|semana|diarias|diarios|diaria|diario|dias|dia";

export function parseQuantityTonMonth(text: string): number | null {
  const t = normalize(text);

  // Paso 1: cantidad CON periodo explícito ("42 tn/mes", "1.800 toneladas al año").
  // El separador es obligatorio aquí; en la versión anterior un `\s*` delante se
  // comía el espacio y "al año" nunca llegaba a casar.
  const strict = new RegExp(
    `${NUM}\\s*(${UNITS})\\b(?:\\s*/\\s*|\\s+(?:al|a la|por|cada)\\s+|\\s+)(${PERIODS})\\b`,
    "g",
  );

  for (let m = strict.exec(t); m !== null; m = strict.exec(t)) {
    const value = toTonsPerMonth(m[1], m[2], m[3]);
    if (value !== null) return value;
  }

  // Paso 2: cantidad SIN periodo -> se asume mensual, que es la convención del
  // formulario. Se restringe a unidades de tonelada y se excluye lo seguido de
  // "/": si no, "905 kg/m3" (una densidad) se leería como 0,9 Tn/mes.
  const loose = new RegExp(`${NUM}\\s*(${TON_UNITS})\\b(?!\\s*/)`, "g");

  for (let m = loose.exec(t); m !== null; m = loose.exec(t)) {
    const value = toTonsPerMonth(m[1], m[2], undefined);
    if (value !== null) return value;
  }

  return null;
}

function toTonsPerMonth(
  rawAmount: string,
  unit: string,
  period: string | undefined,
): number | null {
  const amount = parseSpanishNumber(rawAmount);
  const factor = UNIT_TO_TON[unit];
  if (!Number.isFinite(amount) || factor === undefined) return null;

  const periodFactor = period ? (PERIOD_TO_MONTHLY[period] ?? 1) : 1;
  const tonsPerMonth = amount * factor * periodFactor;

  return tonsPerMonth > 0 ? Math.round(tonsPerMonth * 100) / 100 : null;
}

// -----------------------------------------------------------------------------
// Métricas químicas / físicas
// -----------------------------------------------------------------------------

interface PropertyRule {
  key: string;
  pattern: RegExp;
  unit: string;
}

/**
 * El hueco entre la etiqueta y el valor excluye `.` y `;` para que una regla no
 * pueda saltar de una frase a la siguiente y robar un número que no le
 * corresponde. Y toda etiqueta va entre `\b`: sin el límite de palabra, "grasa"
 * casaba dentro de "des-grasa-nte" y se llevaba el número de la frase siguiente.
 */
const GAP = String.raw`[^\d\n.;]{0,45}`;
const DECIMAL = String.raw`\d+(?:[.,]\d+)?`;
const RANGE = String.raw`(${DECIMAL}(?:\s*[-a]\s*${DECIMAL})?)`;

const PROPERTY_RULES: PropertyRule[] = [
  {
    key: "humedad",
    pattern: new RegExp(String.raw`\bhumedad\b${GAP}${RANGE}\s*%?`),
    unit: "%",
  },
  { key: "ph", pattern: new RegExp(String.raw`\bph\b${GAP}${RANGE}`), unit: "" },
  {
    key: "granulometria",
    pattern: new RegExp(String.raw`\bgranulometria\b${GAP}${RANGE}\s*(?:mm|milimetros)?`),
    unit: "mm",
  },
  {
    key: "densidad",
    pattern: new RegExp(
      String.raw`\bdensidad\b${GAP}(${DECIMAL})\s*(?:kg\/m3|g\/cm3|t\/m3)?`,
    ),
    unit: "kg/m3",
  },
  {
    key: "poder_calorifico",
    pattern: new RegExp(
      String.raw`\bpoder\s+calorifico\b${GAP}(${DECIMAL})\s*(?:mj\/kg|kcal\/kg|kwh\/kg)?`,
    ),
    unit: "MJ/kg",
  },
  {
    key: "materia_organica",
    pattern: new RegExp(String.raw`\bmateria\s+organica\b${GAP}(${DECIMAL})\s*%?`),
    unit: "%",
  },
  {
    key: "cenizas",
    pattern: new RegExp(String.raw`\bcenizas?\b${GAP}(${DECIMAL})\s*%?`),
    unit: "%",
  },
  {
    key: "proteina",
    pattern: new RegExp(String.raw`\bproteina\b${GAP}(${DECIMAL})\s*%?`),
    unit: "%",
  },
  {
    key: "grasa",
    pattern: new RegExp(String.raw`\bgrasas?\b${GAP}(${DECIMAL})\s*%?`),
    unit: "%",
  },
  {
    key: "temperatura",
    pattern: new RegExp(String.raw`\btemperatura\b${GAP}(${DECIMAL})\s*o?\s*c\b`),
    unit: "ºC",
  },
  {
    key: "nitrogeno",
    pattern: new RegExp(String.raw`\bnitrogeno\b${GAP}(${DECIMAL})\s*%?`),
    unit: "%",
  },
  {
    key: "fosforo",
    pattern: new RegExp(String.raw`\bfosforo\b${GAP}(${DECIMAL})\s*%?`),
    unit: "%",
  },
  {
    key: "solidos_totales",
    pattern: new RegExp(String.raw`\bsolidos\s+totales\b${GAP}(${DECIMAL})\s*%?`),
    unit: "%",
  },
  {
    key: "dqo",
    pattern: new RegExp(String.raw`\bdqo\b${GAP}(${DECIMAL})\s*(?:mg\/l|g\/l)?`),
    unit: "mg/L",
  },
  {
    key: "indice_fluidez",
    pattern: new RegExp(
      String.raw`(?:\bindice\s+de\s+fluidez\b|\bmelt\s+flow\b|\bmfi\b)${GAP}(${DECIMAL})`,
    ),
    unit: "g/10min",
  },
];

export function extractProperties(text: string): Extraction["properties"] {
  const t = normalize(text);
  const out: Extraction["properties"] = [];

  for (const rule of PROPERTY_RULES) {
    const m = t.match(rule.pattern);
    if (m?.[1]) {
      const raw = m[1].replace(/\s+/g, "");
      // Los rangos ("5-20") se dejan literales; los valores sueltos pasan por el
      // normalizador español para que "1.800" no acabe como 1,8.
      const value = /^[\d.,]+$/.test(raw) ? String(parseSpanishNumber(raw)) : raw;
      out.push({ key: rule.key, value, unit: rule.unit });
    }
  }
  return out;
}

// -----------------------------------------------------------------------------
// Anonimización
// -----------------------------------------------------------------------------

const IDENTIFYING_PATTERNS: RegExp[] = [
  /[\w.+-]+@[\w-]+\.[\w.]+/i, // email
  /\b(?:\+34[\s-]?)?[6-9]\d{2}[\s-]?\d{3}[\s-]?\d{3}\b/, // teléfono ES
  /\b[A-HJNP-SUVW]\d{7}[0-9A-J]\b/, // CIF
  /\b\d{8}[A-Z]\b/, // NIF
  /\b(?:S\.?L\.?U?|S\.?A\.?U?|S\.?C\.?|C\.?B\.?)\b/i, // forma societaria
  /\bcalle\b|\bavda\b|\bavenida\b|\bc\/\s*\w/i, // dirección
];

export function detectIdentifyingInfo(text: string): boolean {
  return IDENTIFYING_PATTERNS.some((re) => re.test(text));
}

// -----------------------------------------------------------------------------
// Extracción completa en modo local
// -----------------------------------------------------------------------------

export function localExtract(text: string, type: "OFERTA" | "DEMANDA"): Extraction {
  const ler = classifyLer(text);
  const quantity = parseQuantityTonMonth(text);
  const properties = extractProperties(text);

  // El título usa el nombre comercial del catálogo, NO la descripción oficial
  // del LER: cuatro códigos comparten "materiales inadecuados para el consumo o
  // la elaboración", así que usarla dejaría el suero lácteo y el bagazo de
  // cerveza con exactamente el mismo título — y por tanto con casi el mismo
  // vector.
  const qty = quantity !== null ? `${formatTons(quantity)} Tn/mes de ` : "";
  const title = capitalize(
    type === "DEMANDA"
      ? quantity !== null
        ? `se buscan ${qty}${ler.label}`
        : `se busca ${ler.label}`
      : `${qty}${ler.label}`,
  ).slice(0, 80);

  // `material_family` sólo alimenta al embedding, así que se le añaden los
  // términos que dispararon la clasificación. Son ellos los que separan dos
  // materiales que caen bajo la misma etiqueta.
  const evidence = [...new Set(ler.matched)].slice(0, 6);
  const materialFamily = evidence.length
    ? `${ler.label} (${evidence.join(", ")})`
    : ler.label;

  return {
    title,
    material_family: materialFamily,
    ler_code: ler.code,
    ler_description: ler.description,
    properties,
    quantity_ton_month: quantity,
    contains_identifying_info: detectIdentifyingInfo(text),
    // Confianza derivada de cuántas señales reales se han encontrado. En modo
    // local nunca se declara alta: el usuario debe saber que esto son reglas.
    confidence: Math.min(
      0.75,
      0.2 +
        (ler.score > 0 ? 0.25 : 0) +
        (quantity !== null ? 0.15 : 0) +
        properties.length * 0.05,
    ),
  };
}

function formatTons(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1).replace(".", ",");
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
