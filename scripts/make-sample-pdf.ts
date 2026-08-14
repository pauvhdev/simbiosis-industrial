/**
 * Genera samples/ficha-tecnica-ejemplo.pdf: una ficha técnica sintética para
 * poder probar la ruta de subida de PDF sin buscar un documento real.
 *
 *   npx tsx scripts/make-sample-pdf.ts
 *
 * Escribe el PDF a mano (sin librería) porque sólo hacen falta texto plano y una
 * fuente estándar. Los offsets de la tabla xref se calculan sobre los bytes ya
 * serializados: si se escribieran a ojo, pdf.js rechazaría el fichero.
 */
import fs from "node:fs";
import path from "node:path";

const LINES = [
  "FICHA TECNICA DE SUBPRODUCTO",
  "",
  "Denominacion: Purga de polipropileno copolimero post-industrial",
  "Proceso de origen: inyeccion de piezas tecnicas",
  "Naturaleza: termoplastico monomaterial, sin cargas minerales",
  "",
  "CARACTERIZACION",
  "  Indice de fluidez ................ 12 g/10min (230 C / 2,16 kg)",
  "  Densidad ......................... 905 kg/m3",
  "  Humedad .......................... 0,3 %",
  "  Granulometria .................... 8 mm",
  "  Cenizas .......................... 0,4 %",
  "  Temperatura de reblandecimiento .. 148 C",
  "",
  "DISPONIBILIDAD",
  "  Volumen generado ................. 42 toneladas al mes",
  "  Continuidad ...................... estable todo el año",
  "  Presentacion ..................... big bag de 1000 kg, triturado",
  "",
  "LOGISTICA",
  "  Zona ............................. Poligono industrial, Sabadell, Barcelona",
  "  Carga ............................ muelle propio, camion de piso movil",
];

function buildPdf(lines: string[]): Buffer {
  const content =
    "BT\n/F1 10 Tf\n12 TL\n40 790 Td\n" +
    lines.map((line) => `(${line.replace(/([()\\])/g, "\\$1")}) Tj T*\n`).join("") +
    "ET\n";

  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] " +
      "/Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    `<< /Length ${Buffer.byteLength(content, "latin1")} >>\nstream\n${content}endstream`,
  ];

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];

  objects.forEach((body, i) => {
    offsets.push(Buffer.byteLength(pdf, "latin1"));
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });

  const xrefOffset = Buffer.byteLength(pdf, "latin1");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return Buffer.from(pdf, "latin1");
}

const outDir = path.join(process.cwd(), "samples");
fs.mkdirSync(outDir, { recursive: true });

const outFile = path.join(outDir, "ficha-tecnica-ejemplo.pdf");
fs.writeFileSync(outFile, buildPdf(LINES));

console.log(
  `✔ ${path.relative(process.cwd(), outFile)} (${fs.statSync(outFile).size} bytes)`,
);
