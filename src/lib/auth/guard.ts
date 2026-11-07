import { NextResponse } from "next/server";
import { getSessionCompanyId } from "./session";
import { getSessionCompany } from "@/lib/db/queries";
import type { SessionCompany } from "@/lib/types";

/**
 * Resuelve la empresa autenticada para un route handler.
 *
 * Devuelve o la empresa, o la respuesta 401 ya montada — así el handler queda
 * en una línea y no hay forma de olvidarse de cortar la ejecución:
 *
 *   const auth = await requireCompany();
 *   if ("response" in auth) return auth.response;
 *   auth.company.id  // ya es seguro
 */
export async function requireCompany(): Promise<
  { company: SessionCompany } | { response: NextResponse }
> {
  const companyId = await getSessionCompanyId();

  if (!companyId) {
    return {
      response: NextResponse.json(
        { error: "Necesitas iniciar sesión." },
        { status: 401 },
      ),
    };
  }

  // La cookie está firmada, pero la empresa puede haberse borrado desde que se
  // emitió. Sin esta comprobación, un id huérfano pasaría como sesión válida.
  const company = await getSessionCompany(companyId);
  if (!company) {
    return {
      response: NextResponse.json(
        { error: "La sesión ya no es válida. Vuelve a iniciar sesión." },
        { status: 401 },
      ),
    };
  }

  return { company };
}
