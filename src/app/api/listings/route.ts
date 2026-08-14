import { NextResponse } from "next/server";
import { listListings, statsOverview, type ListingType } from "@/lib/db/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/listings?type=OFERTA|DEMANDA&limit=50 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const typeParam = url.searchParams.get("type");
    const type: ListingType | undefined =
      typeParam === "OFERTA" || typeParam === "DEMANDA" ? typeParam : undefined;

    const limit = Number.parseInt(url.searchParams.get("limit") ?? "50", 10);

    const [listings, stats] = await Promise.all([
      listListings({ type, limit: Number.isFinite(limit) ? limit : 50 }),
      statsOverview(),
    ]);

    return NextResponse.json({ listings, stats });
  } catch (error) {
    console.error("[GET /api/listings]", error);
    return NextResponse.json(
      {
        error: "No se han podido cargar las publicaciones.",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
