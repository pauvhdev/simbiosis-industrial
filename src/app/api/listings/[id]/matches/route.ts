import { NextResponse } from "next/server";
import { getListing, matchListings } from "@/lib/db/queries";
import { computeAffinity } from "@/lib/affinity";
import { resolveProviderId } from "@/lib/ai/provider";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/listings/:id/matches?threshold=0.15&limit=12
 *
 * Devuelve las publicaciones del tipo opuesto ordenadas por afinidad.
 * El cruce vectorial lo resuelve `match_listings()` en Postgres; aquí sólo se
 * traduce la similitud coseno cruda al porcentaje de afinidad que ve el usuario.
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const url = new URL(request.url);

    const threshold = Number.parseFloat(url.searchParams.get("threshold") ?? "0.15");
    const limit = Number.parseInt(url.searchParams.get("limit") ?? "12", 10);

    const source = await getListing(id);
    if (!source) {
      return NextResponse.json({ error: "Publicación no encontrada." }, { status: 404 });
    }

    const rows = await matchListings(
      id,
      Number.isFinite(threshold) ? threshold : 0.15,
      Number.isFinite(limit) ? Math.min(limit, 50) : 12,
    );

    const provider = resolveProviderId();

    const matches = rows
      .map((row) => {
        const affinity = computeAffinity({
          similarity: row.similarity,
          distanceKm: row.distance_km,
          lerCodeA: source.ler_code,
          lerCodeB: row.ler_code,
          provider,
        });
        return { ...row, affinity: affinity.percent, breakdown: affinity.breakdown };
      })
      // match_listings() ordena por distancia coseno; la afinidad final también
      // pondera cercanía y coherencia LER, así que puede reordenar el ranking.
      .sort((a, b) => b.affinity - a.affinity);

    return NextResponse.json({ source, matches, provider });
  } catch (error) {
    console.error("[GET /api/listings/:id/matches]", error);
    return NextResponse.json(
      {
        error: "No se han podido calcular las coincidencias.",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
