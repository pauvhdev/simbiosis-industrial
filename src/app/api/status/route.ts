import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { providerConfig, resolveProviderId } from "@/lib/ai/provider";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/status
 *
 * Diagnóstico: qué driver de base de datos y qué proveedor de IA están activos,
 * y si el esquema ya está aplicado. La UI lo muestra en la cabecera para que en
 * ningún momento haya duda de si se está usando el LLM o el motor local.
 */
export async function GET() {
  const provider = providerConfig(resolveProviderId());

  try {
    const db = await getDb();
    const { rows } = await db.query<{ ready: boolean }>(
      `select to_regclass('public.listings') is not null as ready`,
    );

    return NextResponse.json({
      db: { driver: db.driver, schemaReady: rows[0]?.ready === true },
      ai: { id: provider.id, label: provider.label, cost: provider.cost },
    });
  } catch (error) {
    return NextResponse.json(
      {
        db: { driver: "desconocido", schemaReady: false },
        ai: { id: provider.id, label: provider.label, cost: provider.cost },
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
