import { NextResponse } from "next/server";
import { CreateListingInputSchema, toPropertiesJson } from "@/lib/schemas";
import { extractListing } from "@/lib/ai/extract";
import { buildEmbeddingText, embedText } from "@/lib/ai/embed";
import { providerConfig } from "@/lib/ai/provider";
import { extractPdfText } from "@/lib/pdf";
import { anonymizeLocation, resolveLocation } from "@/lib/geo";
import { insertListing } from "@/lib/db/queries";
import { requireCompany } from "@/lib/auth/guard";

// PGlite, pg y unpdf necesitan APIs de Node: este endpoint no puede correr en Edge.
export const runtime = "nodejs";

const MAX_PDF_BYTES = 10 * 1024 * 1024;

/**
 * POST /api/listings/create
 *
 * Acepta dos formatos:
 *   - application/json         -> { type, description, location }
 *   - multipart/form-data      -> los mismos campos + `pdf` (ficha técnica opcional)
 *
 * Pipeline:
 *   1. Reúne el texto de partida (descripción libre + texto del PDF si lo hay)
 *   2. `generateObject` con Zod  -> título anónimo, LER, propiedades, Tn/mes
 *   3. `embed`                   -> vector(1536) sobre la ficha ya anonimizada
 *   4. Geocodifica la zona a coordenadas difusas
 *   5. Persiste empresa (privada) + publicación (pública)
 */
export async function POST(request: Request) {
  try {
    // La publicación se atribuye a la empresa de la sesión, nunca a lo que
    // venga en el cuerpo.
    const auth = await requireCompany();
    if ("response" in auth) return auth.response;

    const contentType = request.headers.get("content-type") ?? "";

    let rawInput: Record<string, unknown>;
    let pdfText = "";
    let pdfMeta: { pages: number; name: string } | null = null;

    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();

      rawInput = {
        type: form.get("type"),
        description: form.get("description") ?? "",
        location: form.get("location") ?? "",
      };

      const file = form.get("pdf");
      if (file instanceof File && file.size > 0) {
        if (
          file.type !== "application/pdf" &&
          !file.name.toLowerCase().endsWith(".pdf")
        ) {
          return NextResponse.json(
            { error: "El archivo adjunto debe ser un PDF." },
            { status: 400 },
          );
        }
        if (file.size > MAX_PDF_BYTES) {
          return NextResponse.json(
            { error: "La ficha técnica supera el límite de 10 MB." },
            { status: 413 },
          );
        }

        const parsed = await extractPdfText(await file.arrayBuffer());
        if (parsed.isLikelyScanned) {
          return NextResponse.json(
            {
              error:
                "El PDF no contiene capa de texto (parece escaneado). Copia los datos de la ficha en el campo de descripción.",
            },
            { status: 422 },
          );
        }
        pdfText = parsed.text;
        pdfMeta = { pages: parsed.pages, name: file.name };
      }
    } else {
      rawInput = await request.json();
    }

    const parsedInput = CreateListingInputSchema.safeParse(rawInput);
    if (!parsedInput.success) {
      return NextResponse.json(
        {
          error: "Datos del formulario no válidos.",
          issues: parsedInput.error.issues.map((i) => ({
            field: i.path.join("."),
            message: i.message,
          })),
        },
        { status: 400 },
      );
    }

    const input = parsedInput.data;

    const sourceText = [
      input.description.trim(),
      pdfText ? `--- Ficha técnica adjunta ---\n${pdfText}` : "",
      input.location.trim() ? `Ubicación declarada: ${input.location.trim()}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    if (sourceText.replace(/\s/g, "").length < 20) {
      return NextResponse.json(
        {
          error:
            "Describe el subproducto con algo más de detalle (material, volumen, propiedades) o adjunta la ficha técnica.",
        },
        { status: 400 },
      );
    }

    // --- 2. Extracción estructurada -----------------------------------------
    const { extraction, provider, usedFallback, fallbackReason } = await extractListing({
      text: sourceText,
      type: input.type,
    });

    // --- 3. Embedding sobre la ficha ya anonimizada -------------------------
    const embeddingText = buildEmbeddingText(extraction);
    const { embedding, usedFallback: embedFallback } = await embedText(embeddingText);

    // --- 4. Ubicación difusa ------------------------------------------------
    const geo = resolveLocation(input.location || input.description);
    const anonymousLocation = anonymizeLocation(input.location, geo);

    // --- 5. Persistencia ----------------------------------------------------
    const listing = await insertListing({
      companyId: auth.company.id,
      type: input.type,
      title: extraction.title,
      // Se guarda la ficha anonimizada, NO el texto original: si el usuario
      // escribió su razón social en la descripción, no debe quedar en una
      // columna que luego alguien exponga por descuido.
      description: embeddingText,
      anonymousLocation,
      lat: geo?.lat ?? null,
      lng: geo?.lng ?? null,
      lerCode: extraction.ler_code,
      lerDescription: extraction.ler_description,
      properties: toPropertiesJson(extraction.properties),
      quantityTonMonth: extraction.quantity_ton_month,
      embedding,
    });

    return NextResponse.json(
      {
        listing,
        meta: {
          provider,
          providerLabel: providerConfig(provider).label,
          usedLocalFallback: usedFallback || embedFallback,
          fallbackReason: fallbackReason ?? null,
          confidence: extraction.confidence,
          containsIdentifyingInfo: extraction.contains_identifying_info,
          pdf: pdfMeta,
          geocoded: geo !== null,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("[POST /api/listings/create]", error);
    return NextResponse.json(
      {
        error: "No se ha podido crear la publicación.",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
