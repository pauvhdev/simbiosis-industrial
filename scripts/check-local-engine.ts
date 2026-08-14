/**
 * Comprobación del motor local de extracción.
 *
 *   npm run check
 *
 * El motor local es un conjunto de reglas, y las reglas se rompen en silencio:
 * un regex que deja de casar no lanza ningún error, sólo devuelve un campo vacío
 * y la publicación sale peor clasificada. Estos casos fijan el comportamiento que
 * ya se ha verificado a mano, incluidos los tres fallos reales que aparecieron
 * durante el desarrollo:
 *
 *   - "1.800 t/año" se leía como 1,8 t/mes (punto español de miles + el periodo
 *     "al año" que nunca casaba)
 *   - el aluminio se clasificaba como metal FÉRREO porque "mecanizado" pesaba
 *     más que "aluminio"
 *   - "Densidad ......... 905" no se extraía: los puntos de relleno de las
 *     fichas técnicas desbordaban el hueco máximo del regex
 *
 * No usa framework de test a propósito: son asertos planos, sin dependencias.
 */
import {
  classifyLer,
  extractProperties,
  parseQuantityTonMonth,
} from "../src/lib/ai/local";
import { localEmbed } from "../src/lib/ai/local";

let failures = 0;

function check(label: string, actual: unknown, expected: unknown): void {
  const ok = actual === expected;
  if (!ok) failures++;
  console.log(
    `  ${ok ? "✔" : "✖"} ${label}` +
      (ok ? "" : `\n      esperado: ${expected}\n      obtenido: ${actual}`),
  );
}

// -----------------------------------------------------------------------------
console.log("\nCantidades → toneladas/mes");
// -----------------------------------------------------------------------------
const QUANTITIES: Array<[string, number | null]> = [
  ["Volumen constante de 320 toneladas al mes", 320],
  ["1.800 toneladas al año", 150], // punto = separador de miles
  ["42 Tn/mes de purga de polipropileno", 42],
  ["500 kg/semana", 2.17],
  ["entre 200 y 400 toneladas mensuales", 400],
  ["12.500 toneladas anuales", 1041.67],
  ["3 toneladas diarias", 91.32],
  // Los siguientes NO son cantidades: son especificaciones del material.
  ["densidad aparente 905 kg/m3", null],
  ["se sirve en big bag de 1000 kg", null],
  ["contenedor metalico de 1,5 m3", null],
];
for (const [text, expected] of QUANTITIES) {
  check(`"${text}"`, parseQuantityTonMonth(text), expected);
}

// -----------------------------------------------------------------------------
console.log("\nClasificación LER");
// -----------------------------------------------------------------------------
const LER: Array<[string, string]> = [
  ["Virutas y recortes de aluminio de la serie 6000 de mecanizado CNC", "12 01 03"],
  ["Virutas de acero al carbono procedentes de mecanizado", "12 01 01"],
  ["chatarra de aluminio no ferreo clasificada para horno de fusion", "12 01 03"],
  ["lactosuero dulce procedente de la elaboracion de queso", "02 05 01"],
  ["bagazo de malta procedente de la maceracion cervecera", "02 07 04"],
  ["serrin y viruta de pino sin tratar de aserradero", "03 01 05"],
  ["calcin de vidrio sodico-calcico de rechazo de linea", "15 01 07"],
  ["orujo graso humedo de almazara de dos fases", "02 03 04"],
  ["texto sin ninguna señal reconocible", "19 12 12"],
];
for (const [text, expected] of LER) {
  check(`"${text.slice(0, 52)}…"`, classifyLer(text).code, expected);
}

// -----------------------------------------------------------------------------
console.log("\nPropiedades con puntos de relleno (formato típico de ficha técnica)");
// -----------------------------------------------------------------------------
const DATASHEET = `CARACTERIZACION
  Indice de fluidez ................ 12 g/10min
  Densidad ......................... 905 kg/m3
  Humedad .......................... 0,3 %
  Granulometria .................... 8 mm
  Cenizas .......................... 0,4 %
  Temperatura de reblandecimiento .. 148 C`;

const props = Object.fromEntries(
  extractProperties(DATASHEET).map((p) => [p.key, p.value]),
);
for (const [key, expected] of [
  ["densidad", "905"],
  ["humedad", "0.3"],
  ["granulometria", "8"],
  ["cenizas", "0.4"],
  ["temperatura", "148"],
  ["indice_fluidez", "12"],
] as const) {
  check(`${key} = ${expected}`, props[key], expected);
}

// -----------------------------------------------------------------------------
console.log("\nPropiedades — falsos positivos que NO deben aparecer");
// -----------------------------------------------------------------------------
const NEGATIVES: Array<[string, string]> = [
  // "grasa" dentro de "desgrasante" se llevaba el 80 de "80 toneladas".
  [
    "Chamota para incorporar como desgrasante en pasta de gres. Consumo de 80 toneladas mensuales.",
    "grasa",
  ],
  // "ceniza" dentro de "cenizal"; el número pertenece a otra frase.
  ["Material procedente del cenizal antiguo. Volumen de 40 toneladas al mes.", "cenizas"],
];
for (const [text, key] of NEGATIVES) {
  const found = extractProperties(text).find((p) => p.key === key);
  check(`no extrae "${key}" de "${text.slice(0, 44)}…"`, found?.value, undefined);
}

// -----------------------------------------------------------------------------
console.log("\nEmbeddings locales");
// -----------------------------------------------------------------------------
function cosine(a: number[], b: number[]): number {
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot;
}

const offer = localEmbed("suero lacteo de queseria, humedad 93%, proteina 0.9%");
const demand = localEmbed("suero lactico para pienso de porcino, proteina minima 0.7%");
const unrelated = localEmbed("virutas de aluminio serie 6000 de mecanizado CNC");

check("dimensión = 1536", offer.length, 1536);
check(
  "vector normalizado (norma = 1)",
  Math.round(cosine(offer, offer) * 1000) / 1000,
  1,
);

const related = cosine(offer, demand);
const noise = cosine(offer, unrelated);
const separates = related > noise + 0.2;
if (!separates) failures++;
console.log(
  `  ${separates ? "✔" : "✖"} separa material relacionado del ruido ` +
    `(relacionado ${related.toFixed(3)} vs ruido ${noise.toFixed(3)})`,
);

// -----------------------------------------------------------------------------
if (failures === 0) {
  console.log("\n✔ Todas las comprobaciones pasan.\n");
} else {
  console.log(`\n✖ ${failures} comprobación(es) fallan.\n`);
  process.exitCode = 1;
}
