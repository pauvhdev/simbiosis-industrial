import { NextResponse } from "next/server";
import { requireCompany } from "@/lib/auth/guard";
import { listListingsForCompany } from "@/lib/db/queries";

export const runtime = "nodejs";

/** GET /api/listings/mine — las publicaciones de la empresa autenticada. */
export async function GET() {
  try {
    const auth = await requireCompany();
    if ("response" in auth) return auth.response;

    return NextResponse.json({
      listings: await listListingsForCompany(auth.company.id),
    });
  } catch (error) {
    console.error("[GET /api/listings/mine]", error);
    return NextResponse.json(
      { error: "No se han podido cargar tus publicaciones." },
      { status: 500 },
    );
  }
}
