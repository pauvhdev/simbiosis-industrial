import { NextResponse } from "next/server";
import { getSessionCompanyId } from "@/lib/auth/session";
import { getSessionCompany } from "@/lib/db/queries";

export const runtime = "nodejs";

/** GET /api/auth/me — la empresa de la sesión, o null. Nunca devuelve 401. */
export async function GET() {
  const companyId = await getSessionCompanyId();
  if (!companyId) return NextResponse.json({ company: null });

  const company = await getSessionCompany(companyId);
  return NextResponse.json({ company: company ?? null });
}
