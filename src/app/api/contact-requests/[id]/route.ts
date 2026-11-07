import { NextResponse } from "next/server";
import { ContactDecisionSchema } from "@/lib/schemas";
import { requireCompany } from "@/lib/auth/guard";
import { decideContactRequest } from "@/lib/db/queries";

export const runtime = "nodejs";

/**
 * PATCH /api/contact-requests/[id]   { decision: "ACCEPT" | "REJECT" }
 *
 * Cierra el doble consentimiento. Sólo puede decidir quien RECIBIÓ la solicitud,
 * y sólo mientras siga pendiente; ambas condiciones se comprueban dentro del
 * propio UPDATE, así que no hay ventana entre la comprobación y la escritura.
 *
 * Al aceptar, las dos partes pasan a ver el nombre y el email de la otra en
 * GET /api/contact-requests. Es simétrico a propósito: quien acepta revela lo
 * mismo que recibe.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireCompany();
    if ("response" in auth) return auth.response;

    const { id } = await params;

    const parsed = ContactDecisionSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Indica si aceptas o rechazas la solicitud." },
        { status: 400 },
      );
    }

    const updated = await decideContactRequest(id, auth.company.id, parsed.data.decision);

    if (!updated) {
      // Se responde igual si la solicitud no existe, si no es suya o si ya
      // estaba resuelta: distinguirlos permitiría sondear qué ids existen.
      return NextResponse.json(
        { error: "No hay ninguna solicitud pendiente tuya con ese identificador." },
        { status: 404 },
      );
    }

    return NextResponse.json({
      contactRequest: updated,
      message:
        updated.status === "ACCEPTED"
          ? "Contacto aceptado. Ya podéis ver los datos el uno del otro."
          : "Solicitud rechazada. No se ha revelado ningún dato.",
    });
  } catch (error) {
    console.error("[PATCH /api/contact-requests/[id]]", error);
    return NextResponse.json(
      { error: "No se ha podido actualizar la solicitud." },
      { status: 500 },
    );
  }
}
