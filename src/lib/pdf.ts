/**
 * Extracción de texto de fichas técnicas en PDF.
 *
 * Se usa `unpdf` (build serverless de pdf.js) en lugar de `pdf-parse` porque no
 * arrastra binarios nativos ni intenta leer ficheros de test al importarse, así
 * que funciona igual en local, en Vercel y en un contenedor.
 *
 * Los PDF escaneados (imagen pura, sin capa de texto) devuelven cadena vacía;
 * el endpoint lo detecta y responde con un error entendible en vez de mandar
 * texto vacío al LLM. Para esos haría falta OCR, fuera del alcance del MVP.
 */

export interface PdfExtraction {
  text: string;
  pages: number;
  /** true si el PDF no tiene capa de texto (probablemente escaneado). */
  isLikelyScanned: boolean;
}

const MAX_CHARS = 30_000;

/** Guiones blandos, espacios de ancho cero y BOM que pdf.js deja en los cortes de línea. */
const INVISIBLE_CHARS = /[­​‌‍﻿]/g;

export async function extractPdfText(buffer: ArrayBuffer): Promise<PdfExtraction> {
  const { extractText } = await import("unpdf");

  const { totalPages, text } = await extractText(new Uint8Array(buffer), {
    mergePages: true,
  });

  const cleaned = text
    // Sin esto, "poli-\nmero" llega al modelo partido en dos palabras.
    .replace(INVISIBLE_CHARS, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return {
    text: cleaned.slice(0, MAX_CHARS),
    pages: totalPages,
    // Menos de 40 caracteres por página es, en la práctica, un PDF sin texto.
    isLikelyScanned: cleaned.length < totalPages * 40,
  };
}
